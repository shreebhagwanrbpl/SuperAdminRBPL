"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    doc,
    getDoc,
    setDoc,
    getDocs,
    collection,
    onSnapshot,
    query,
    orderBy
} from "firebase/firestore";
import toast from "react-hot-toast";
import {
    COMPANY_WEBSITES,
    COMPANIES,
    getCompanyForWebsite,
    getCompanyDisplayName,
    bulkEnableProductsOnWebsites,
    bulkEnableCategoryOnWebsites,
    bulkEnableSubcategoryOnWebsites,
    fetchCompanyProducts,
    fetchCompanyCategories
} from "@/lib/companyCatalog";

const TaskManagerContext = createContext();

export const TaskManagerProvider = ({ children }) => {
    const [tasks, setTasks] = useState({});
    const tasksRef = useRef({});

    useEffect(() => {
        tasksRef.current = tasks;
        const serializableTasks = {};
        Object.entries(tasks).forEach(([id, t]) => {
            serializableTasks[id] = {
                id: t.id,
                name: t.name,
                website: t.website,
                status: t.status,
                percent: t.percent,
                stats: t.stats,
                logs: Array.isArray(t.logs) ? t.logs.slice(-100) : [],
                sites: t.sites,
                isMinimized: t.isMinimized,
                isStuck: t.isStuck,
                config: {
                    concurrencyLimit: t.config?.concurrencyLimit
                }
            };
        });
        try {
            localStorage.setItem("bg_tasks_meta", JSON.stringify(serializableTasks));
        } catch (e) {
            console.warn("[TaskManagerContext] LocalStorage write failed:", e);
        }
    }, [tasks]);

    const updateTask = (id, updates) => {
        setTasks(prev => {
            const existing = prev[id] || {};
            return {
                ...prev,
                [id]: { ...existing, ...updates }
            };
        });
    };

    const removeTask = (id) => {
        setTasks(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const addLogToTask = (id, msg, type = "info") => {
        const symbols = {
            info: "ℹ",
            success: "✔",
            error: "❌",
            warning: "⚠"
        };
        const prefix = symbols[type] || "ℹ";
        const formatted = `[${new Date().toLocaleTimeString()}] ${prefix} ${msg}`;

        setTasks(prev => {
            const existing = prev[id];
            if (!existing) return prev;
            return {
                ...prev,
                [id]: {
                    ...existing,
                    logs: [...(existing.logs || []), formatted].slice(-300)
                }
            };
        });
    };

    const formatTime = (totalSeconds) => {
        if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // ----------------------------------------------------
    // TASK RUNNER: WEBSITE VISIBILITY / ENABLE MASTER PRODUCTS ON WEBSITES
    // ----------------------------------------------------
    const startCategoryProductCopy = async (config) => {
        const taskId = `cat-visibility-${Date.now()}`;
        const {
            sourceSite,
            destSites,
            copyNormalEnabled,
            copyCategoryEnabled,
            selectedNormalProductIds,
            selectedSubcategories,
            sourceNormalProducts,
            sourceCategories,
            concurrencyLimit
        } = config;

        const companyId = getCompanyForWebsite(sourceSite);
        const companyName = getCompanyDisplayName(companyId);

        let totalTargetProducts = (selectedNormalProductIds || []).length;
        if (copyCategoryEnabled && sourceCategories) {
            sourceCategories.forEach(cat => {
                const selectedSubs = (cat.subcategories || []).filter(sub => selectedSubcategories[cat.id]?.[sub.id]);
                selectedSubs.forEach(sub => {
                    totalTargetProducts += (sub.products || []).length;
                });
            });
        }

        const totalOperationsGlobal = totalTargetProducts * destSites.length;
        const cancelRef = { current: false };

        const initialSites = {};
        destSites.forEach(site => {
            initialSites[site] = {
                status: "pending",
                step: "Queued",
                currentCat: "",
                currentSub: "",
                currentProd: "",
                copiedCount: 0,
                totalCount: totalTargetProducts,
                percent: 0
            };
        });

        const taskData = {
            id: taskId,
            name: "Website Visibility Mapping",
            website: sourceSite,
            status: "running",
            percent: 0,
            isMinimized: false,
            isStuck: false,
            logs: [],
            stats: {
                totalWebsites: destSites.length,
                completedWebsites: 0,
                totalProducts: totalOperationsGlobal,
                copiedProducts: 0,
                productsSkipped: 0,
                speed: 0,
                elapsed: 0,
                eta: 0
            },
            sites: initialSites,
            config,
            cancelHandler: () => {
                cancelRef.current = true;
                addLogToTask(taskId, "Cancel requested. Stopping visibility updates...", "warning");
                updateTask(taskId, { status: "cancelled" });
            }
        };

        setTasks(prev => ({ ...prev, [taskId]: taskData }));
        addLogToTask(taskId, `Enabling products for ${destSites.length} websites in ${companyName}...`, "info");
        await new Promise(resolve => setTimeout(resolve, 50));

        const startTime = Date.now();

        const syncInterval = setInterval(() => {
            const current = tasksRef.current[taskId];
            if (!current || current.status !== "running") {
                clearInterval(syncInterval);
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const copied = current.stats.copiedProducts || 0;
            const total = current.stats.totalProducts || 1;
            const speed = elapsed > 0 ? Math.round(copied / elapsed) : 0;
            const eta = speed > 0 ? Math.round((total - copied) / speed) : 0;
            const percent = Math.min(Math.round((copied / total) * 100), 100);

            updateTask(taskId, {
                percent,
                stats: {
                    ...current.stats,
                    speed,
                    elapsed,
                    eta,
                    copiedProducts: copied
                }
            });
        }, 500);

        try {
            // 1. Process Normal Products
            if (copyNormalEnabled && selectedNormalProductIds && selectedNormalProductIds.length > 0) {
                addLogToTask(taskId, `Enabling ${selectedNormalProductIds.length} normal master products across destination websites...`, "info");
                await bulkEnableProductsOnWebsites(companyId, selectedNormalProductIds, destSites);
                updateTask(taskId, {
                    stats: {
                        ...tasksRef.current[taskId].stats,
                        copiedProducts: tasksRef.current[taskId].stats.copiedProducts + (selectedNormalProductIds.length * destSites.length)
                    }
                });
            }

            // 2. Process Categories & Subcategories
            if (copyCategoryEnabled && sourceCategories) {
                for (const cat of sourceCategories) {
                    if (cancelRef.current) break;
                    const selectedSubs = (cat.subcategories || []).filter(sub => selectedSubcategories[cat.id]?.[sub.id]);
                    if (selectedSubs.length === 0) continue;

                    await bulkEnableCategoryOnWebsites(companyId, cat.id, destSites);

                    for (const sub of selectedSubs) {
                        if (cancelRef.current) break;
                        await bulkEnableSubcategoryOnWebsites(companyId, cat.id, sub.id, destSites);

                        const subProdIds = (sub.products || []).map(p => p.id);
                        if (subProdIds.length > 0) {
                            await bulkEnableProductsOnWebsites(companyId, subProdIds, destSites);
                            updateTask(taskId, {
                                stats: {
                                    ...tasksRef.current[taskId].stats,
                                    copiedProducts: tasksRef.current[taskId].stats.copiedProducts + (subProdIds.length * destSites.length)
                                }
                            });
                        }
                    }
                }
            }

            // Mark sites as completed
            const finalSites = { ...tasksRef.current[taskId].sites };
            Object.keys(finalSites).forEach(s => {
                finalSites[s].status = "completed";
                finalSites[s].percent = 100;
                finalSites[s].step = "Enabled";
            });

            clearInterval(syncInterval);
            updateTask(taskId, {
                status: "completed",
                percent: 100,
                sites: finalSites,
                summary: {
                    status: "completed",
                    websites: destSites.length,
                    products: totalTargetProducts,
                    elapsed: (Date.now() - startTime) / 1000,
                    speed: 10
                }
            });
            addLogToTask(taskId, `Website visibility updated successfully (Zero duplicate products created)`, "success");
            toast.success("Products enabled on websites successfully!");
        } catch (err) {
            clearInterval(syncInterval);
            console.error(err);
            updateTask(taskId, { status: "failed" });
            addLogToTask(taskId, `Failed to update website visibility: ${err.message}`, "error");
        }
    };

    const startProductCopy = async (config) => {
        return startCategoryProductCopy({
            ...config,
            copyNormalEnabled: true,
            copyCategoryEnabled: false
        });
    };

    // ----------------------------------------------------
    // TASK RUNNER: DYNAMIC DISPLAY WATERMARK STATUS
    // ----------------------------------------------------
    const startWatermarkProcess = async (config) => {
        const taskId = `watermark-${Date.now()}`;
        const { selectedCompany, selectedWebsite } = config;
        const companyName = getCompanyDisplayName(selectedCompany);

        const taskData = {
            id: taskId,
            name: "Company Watermark Activation",
            website: selectedWebsite,
            status: "completed",
            percent: 100,
            isMinimized: false,
            isStuck: false,
            logs: [
                `[${new Date().toLocaleTimeString()}] ℹ Watermark set to Company Name: "${companyName}".`,
                `[${new Date().toLocaleTimeString()}] ✔ Dynamic display-time watermarking active (No duplicate storage files needed).`
            ],
            stats: {
                totalWebsites: 1,
                completedWebsites: 1,
                totalProducts: 1,
                copiedProducts: 1,
                speed: 1,
                elapsed: 0.5,
                eta: 0
            },
            summary: {
                status: "completed",
                websites: 1,
                products: 1,
                elapsed: 0.5,
                speed: 1
            }
        };

        setTasks(prev => ({ ...prev, [taskId]: taskData }));
        toast.success(`Dynamic watermarks active: "${companyName}"`);
    };

    const startCategoryWatermarkProcess = async (config) => {
        return startWatermarkProcess(config);
    };

    // ----------------------------------------------------
    // REAL-TIME QUERY PUSH NOTIFICATIONS
    // ----------------------------------------------------
    useEffect(() => {
        let activeUnsubscribers = [];

        const triggerNotification = (type, website, name, product, docId) => {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
            audio.volume = 0.5;
            audio.play().catch(() => { });

            const company = getCompanyForWebsite(website);
            const linkParams = `company=${company}&website=${website}&tab=${type === "Product Query" ? "product" : "contact"}`;

            toast((t) => (
                <div
                    onClick={() => {
                        toast.dismiss(t.id);
                        window.location.href = `/queries?${linkParams}`;
                    }}
                    style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px" }}
                >
                    <div style={{ fontWeight: "700", color: "#4f46e5", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>🔔 {type}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#334155" }}>
                        <strong>{name}</strong> for <strong>{product}</strong> ({website})
                    </div>
                </div>
            ), { duration: 6000 });
        };

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            activeUnsubscribers.forEach(unsub => unsub());
            activeUnsubscribers = [];

            if (user) {
                const allWebsites = Object.values(COMPANY_WEBSITES).flat();
                const sessionMountTime = new Date();

                allWebsites.forEach((website) => {
                    try {
                        const contactUnsub = onSnapshot(
                            collection(db, "websitesQueries", website, "contactQueries"),
                            (snap) => {
                                snap.docChanges().forEach(change => {
                                    if (change.type === "added") {
                                        const docData = change.doc.data();
                                        const createdAt = docData.createdAt?.toDate ? docData.createdAt.toDate() : null;
                                        if (createdAt && createdAt.getTime() > sessionMountTime.getTime()) {
                                            triggerNotification("Contact Query", website, docData.name || docData.email || "Valued User", "Contact Us Form", change.doc.id);
                                        }
                                    }
                                });
                            },
                            () => { }
                        );
                        activeUnsubscribers.push(contactUnsub);

                        const productUnsub = onSnapshot(
                            collection(db, "websitesQueries", website, "productQueries"),
                            (snap) => {
                                snap.docChanges().forEach(change => {
                                    if (change.type === "added") {
                                        const docData = change.doc.data();
                                        const createdAt = docData.createdAt?.toDate ? docData.createdAt.toDate() : null;
                                        if (createdAt && createdAt.getTime() > sessionMountTime.getTime()) {
                                            triggerNotification("Product Query", website, docData.name || docData.email || "Valued User", docData.productName || "Unknown Product", change.doc.id);
                                        }
                                    }
                                });
                            },
                            () => { }
                        );
                        activeUnsubscribers.push(productUnsub);
                    } catch (e) { }
                });
            }
        });

        return () => {
            unsubscribeAuth();
            activeUnsubscribers.forEach(unsub => unsub());
        };
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem("bg_tasks_meta");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                Object.entries(parsed).forEach(([id, t]) => {
                    if (t.status === "running") {
                        t.status = "cancelled";
                    }
                });
                setTasks(parsed);
            } catch (e) { }
        }
    }, []);

    return (
        <TaskManagerContext.Provider value={{
            tasks,
            updateTask,
            removeTask,
            startCategoryProductCopy,
            startProductCopy,
            startWatermarkProcess,
            startCategoryWatermarkProcess,
            formatTime
        }}>
            {children}
        </TaskManagerContext.Provider>
    );
};

export const useTaskManager = () => useContext(TaskManagerContext);
