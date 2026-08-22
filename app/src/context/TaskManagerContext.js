"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection, collectionGroup, onSnapshot, query, orderBy } from "firebase/firestore";
import toast from "react-hot-toast";

const COMPANY_WEBSITES = {
    human: [
        "humanbiomedicalcom",
        "humanbiomedicalin",
        "humanbiomedicalorg",
        "humanbiomedicalsnet",
        "humanbiomedicalsin",
        "humanbiomedicalsorg",
        "humanbiomedicalscoin",
    ],
    global: [
        "globalbiomedicalorg",
        "globalbiomedicalin",
        "globalbiomedicalcoin",
        "globalbiomedicalsin",
        "globalbiomedicalsnet",
        "globalhealthkartcom",
    ],
    rajbiosis: [
        "indiandiagnostic",
        "centralbiomedicals",
        "humarilabin",
        "humarilabcom",
        "rajbiosisinfo",
        "rajbiosiscoin",
        "rajbiosisltd",
        "ozonexco",
        "aozellocom",
        "aozallocom",
        "ozallecom",
        "ozallocom",
        "ozellein",
        "qlytein",
        "qlyserin",
        "anylabtestin",
        "radioimmunoassayin",
        "bloodmixerin",
        "glucostripscom",
        "glucometersin",
        "safekitin",
        "haemoglobinstripcom",
        "haemoglobinstripscom",
        "haemoglobinmetercom",
        "hemoglobinstripcom",
        "hemoglobinstripin",
        "hemoglobinstripscom",
        "hemoglobinmetercom",
        "hemoglobinmeterin",
        "cliakitscom",
        "clinicalchemistryin",
        "medicalsjobportalcom",
        "tublerin"
    ],
    qlyte: [
        "qlyte"
    ]
};

const TaskManagerContext = createContext();

export const TaskManagerProvider = ({ children }) => {
    const [tasks, setTasks] = useState({});
    const tasksRef = useRef({});

    // Keep tasksRef in sync
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
                // Limit logs to the last 100 entries to prevent QuotaExceededError
                logs: Array.isArray(t.logs) ? t.logs.slice(-100) : [],
                sites: t.sites, // Also store sites so the worker details are preserved
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
            console.warn("[TaskManagerContext] LocalStorage write failed (quota exceeded):", e);
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

    const writeWithRetry = async (taskId, docRef, data, docTitle, cancelRef, options = null) => {
        let retries = 3;
        while (retries > 0) {
            if (cancelRef.current) throw new Error("cancelled");
            try {
                updateTask(taskId, { lastWriteTime: Date.now(), isStuck: false });
                if (options) {
                    await setDoc(docRef, data, options);
                } else {
                    await setDoc(docRef, data);
                }
                updateTask(taskId, { lastWriteTime: Date.now(), isStuck: false });
                return;
            } catch (err) {
                retries--;
                if (retries === 0) {
                    addLogToTask(taskId, `Failed: ${docTitle}. Reason: ${err.message || err}`, "error");
                    throw err;
                }
                const isResourceExhausted = err.code === "resource-exhausted" ||
                    (err.message && err.message.toLowerCase().includes("resource-exhausted"));

                const delay = isResourceExhausted ? 4000 : 1500;
                const warningMsg = isResourceExhausted
                    ? `Write stream exhausted. Waiting ${delay}ms for Firestore buffer queue to flush...`
                    : `Failed. Document: ${docTitle}. Retrying in ${delay}ms...`;

                addLogToTask(taskId, warningMsg, "warning");
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    // ----------------------------------------------------
    // TASK RUNNER: CATEGORY PRODUCT COPY
    // ----------------------------------------------------
    const startCategoryProductCopy = async (config) => {
        const taskId = `cat-copy-${Date.now()}`;
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

        const hasNormalSelected = copyNormalEnabled && selectedNormalProductIds.length > 0;
        const normalSelectedCount = hasNormalSelected ? selectedNormalProductIds.length : 0;
        let categorySelectedCount = 0;
        let selectedCategoriesCount = 0;
        let selectedSubcategoriesCount = 0;

        if (copyCategoryEnabled && sourceCategories) {
            sourceCategories.forEach(cat => {
                const selectedSubs = (cat.subcategories || []).filter(sub => selectedSubcategories[cat.id]?.[sub.id]);
                if (selectedSubs.length > 0) {
                    selectedCategoriesCount++;
                    selectedSubcategoriesCount += selectedSubs.length;
                    selectedSubs.forEach(sub => {
                        categorySelectedCount += (sub.products || []).length;
                    });
                }
            });
        }
        const totalProductsPerSite = normalSelectedCount + categorySelectedCount;
        const totalProductsGlobal = totalProductsPerSite * destSites.length;

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
                totalCount: totalProductsPerSite,
                percent: 0
            };
        });

        const taskData = {
            id: taskId,
            name: "Category Product Copy",
            website: sourceSite,
            status: "running",
            percent: 0,
            isMinimized: false,
            isStuck: false,
            logs: [],
            stats: {
                totalWebsites: destSites.length,
                completedWebsites: 0,
                totalProducts: totalProductsGlobal,
                copiedProducts: 0,
                speed: 0,
                elapsed: 0,
                eta: 0
            },
            sites: initialSites,
            config,
            cancelHandler: () => {
                cancelRef.current = true;
                addLogToTask(taskId, "Cancel requested. Stopping remaining operations...", "warning");
                updateTask(taskId, { status: "cancelled" });
            }
        };

        setTasks(prev => ({ ...prev, [taskId]: taskData }));
        addLogToTask(taskId, `Starting Category Copy from ${sourceSite}...`, "info");
        addLogToTask(taskId, `[Diagnostic] Selected Categories Count: ${selectedCategoriesCount}`, "info");
        addLogToTask(taskId, `[Diagnostic] Selected Subcategories Count: ${selectedSubcategoriesCount}`, "info");
        addLogToTask(taskId, `[Diagnostic] Selected Category Products Count: ${categorySelectedCount}`, "info");
        await new Promise(resolve => setTimeout(resolve, 50));

        let stats = {
            normalProductsCopied: 0,
            categoryProductsCopied: 0,
            categoriesCreated: 0,
            subcategoriesCreated: 0,
            productsSkipped: 0,
            productsFailed: 0,
            destinationWebsitesUpdated: []
        };

        const startTime = Date.now();
        let lastWriteTime = Date.now();

        const syncInterval = setInterval(() => {
            const current = tasksRef.current[taskId];
            if (!current || current.status !== "running") {
                clearInterval(syncInterval);
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const copied = current.stats.copiedProducts || 0;
            const skipped = current.stats.productsSkipped || 0;
            const processed = copied + skipped;
            const total = current.stats.totalProducts;
            const speed = elapsed > 0 ? Math.round(processed / elapsed) : 0;
            const eta = speed > 0 ? Math.round((total - processed) / speed) : 0;
            const percent = total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;
            const isStuck = (Date.now() - lastWriteTime > 10000);

            const updatedSites = { ...current.sites };
            Object.entries(updatedSites).forEach(([site, s]) => {
                if (s.status === "running" && s.startTime) {
                    s.percent = s.totalCount > 0 ? Math.min(Math.round((s.copiedCount / s.totalCount) * 100), 100) : 0;
                }
            });

            updateTask(taskId, {
                percent,
                isStuck,
                stats: {
                    ...current.stats,
                    speed,
                    elapsed,
                    eta,
                    copiedProducts: copied,
                    productsSkipped: skipped
                },
                sites: updatedSites
            });
        }, 500);

        const copyWebsiteTask = async (destSite) => {
            const current = tasksRef.current[taskId];
            const siteProgress = current.sites[destSite];
            siteProgress.status = "running";
            siteProgress.startTime = Date.now();
            siteProgress.step = "Preparing Copy...";
            addLogToTask(taskId, `Starting ${destSite}...`, "info");

            try {
                let siteUpdated = false;
                let normalCopiedCount = 0;
                let categoryCopiedCount = 0;

                if (hasNormalSelected) {
                    addLogToTask(taskId, `[${destSite}] START NORMAL PRODUCT COPY`, "info");
                    siteProgress.step = "Reading Normal Products";
                    const destDocRef = doc(db, "websites", destSite, "pages", "products");
                    const destSnap = await getDoc(destDocRef);
                    const destNormalProducts = destSnap.exists() ? destSnap.data().products || [] : [];

                    let maxId = 0;
                    destNormalProducts.forEach(p => {
                        const num = Number(p.productId);
                        if (!isNaN(num) && num > maxId) {
                            maxId = num;
                        }
                    });

                    const prodsToAppend = [];
                    for (const sId of selectedNormalProductIds) {
                        if (cancelRef.current) throw new Error("cancelled");
                        const sourceProd = sourceNormalProducts.find(p => p.id === sId);
                        if (!sourceProd) continue;

                        const exists = destNormalProducts.some(p => {
                            if (sourceProd.slug && p.slug) return p.slug.trim() === sourceProd.slug.trim();
                            return p.title?.trim() === sourceProd.title?.trim();
                        }) || prodsToAppend.some(p => {
                            if (sourceProd.slug && p.slug) return p.slug.trim() === sourceProd.slug.trim();
                            return p.title?.trim() === sourceProd.title?.trim();
                        });

                        if (exists) {
                            stats.productsSkipped++;
                            addLogToTask(taskId, `🟡 DUPLICATE SKIPPED\nWebsite: ${destSite}\nProduct: ${sourceProd.title || "Unknown Product"}\nReason: Product already exists`, "warning");
                            setTasks(prev => {
                                const t = prev[taskId];
                                return {
                                    ...prev,
                                    [taskId]: {
                                        ...t,
                                        stats: { ...t.stats, productsSkipped: (t.stats.productsSkipped || 0) + 1 }
                                    }
                                };
                            });
                            siteProgress.copiedCount++;
                            continue;
                        }

                        maxId++;
                        prodsToAppend.push({
                            ...sourceProd,
                            id: crypto.randomUUID(),
                            productId: maxId,
                            createdAt: new Date().toISOString()
                        });
                    }

                    if (prodsToAppend.length > 0) {
                        siteProgress.step = "Saving Normal Products...";
                        lastWriteTime = Date.now();
                        await writeWithRetry(taskId, destDocRef, { products: [...destNormalProducts, ...prodsToAppend] }, "Normal Products", cancelRef, { merge: true });
                        lastWriteTime = Date.now();
                        stats.normalProductsCopied += prodsToAppend.length;
                        setTasks(prev => {
                            const t = prev[taskId];
                            return {
                                ...prev,
                                [taskId]: {
                                    ...t,
                                    stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + prodsToAppend.length }
                                }
                            };
                        });
                        siteProgress.copiedCount += prodsToAppend.length;
                        normalCopiedCount = prodsToAppend.length;
                        siteUpdated = true;
                        addLogToTask(taskId, `Normal Products copied to ${destSite} (${prodsToAppend.length} products)`, "success");
                    }
                    addLogToTask(taskId, `[${destSite}] END NORMAL PRODUCT COPY`, "info");
                }

                if (copyCategoryEnabled) {
                    siteProgress.step = "Reading Destination Categories";
                    const destCatsRef = collection(db, "websites", destSite, "pages", "categoryproducts", "categories");
                    const destCatsSnap = await getDocs(destCatsRef);
                    const existingCatIds = new Set(destCatsSnap.docs.map(d => d.id));

                    const categoriesToProcess = sourceCategories.filter(cat => {
                        return (cat.subcategories || []).some(sub => selectedSubcategories[cat.id]?.[sub.id]);
                    });

                    const subcategoriesCache = {};
                    await Promise.all(categoriesToProcess.map(async (cat) => {
                        if (existingCatIds.has(cat.id)) {
                            const subSnap = await getDocs(
                                collection(db, "websites", destSite, "pages", "categoryproducts", "categories", cat.id, "subcategories")
                            );
                            subcategoriesCache[cat.id] = {};
                            subSnap.docs.forEach(docSnap => {
                                subcategoriesCache[cat.id][docSnap.id] = docSnap.data().products || [];
                            });
                        } else {
                            subcategoriesCache[cat.id] = {};
                        }
                    }));

                    for (const cat of categoriesToProcess) {
                        if (cancelRef.current) throw new Error("cancelled");
                        const selectedSubs = (cat.subcategories || []).filter(sub => selectedSubcategories[cat.id]?.[sub.id]);
                        if (selectedSubs.length === 0) continue;

                        addLogToTask(taskId, `[${destSite}] START CATEGORY COPY: ${cat.category}`, "info");
                        siteProgress.currentCat = cat.category;
                        const destCatDocRef = doc(db, "websites", destSite, "pages", "categoryproducts", "categories", cat.id);

                        if (!existingCatIds.has(cat.id)) {
                            siteProgress.step = `Creating category: ${cat.category}`;
                            lastWriteTime = Date.now();
                            await writeWithRetry(taskId, destCatDocRef, {
                                id: cat.id,
                                category: cat.category,
                                website: destSite,
                                createdAt: new Date().toISOString()
                            }, cat.category, cancelRef);
                            await new Promise(resolve => setTimeout(resolve, 100));
                            lastWriteTime = Date.now();
                            stats.categoriesCreated++;
                            siteUpdated = true;
                            existingCatIds.add(cat.id);
                        }

                        for (const sub of selectedSubs) {
                            if (cancelRef.current) throw new Error("cancelled");
                            addLogToTask(taskId, `[${destSite}]   START SUBCATEGORY COPY: ${sub.subCategory}`, "info");
                            siteProgress.currentSub = sub.subCategory;
                            siteProgress.step = `Processing Subcategory: ${sub.subCategory}`;

                            const destSubDocRef = doc(db, "websites", destSite, "pages", "categoryproducts", "categories", cat.id, "subcategories", sub.id);
                            const cacheEntry = subcategoriesCache[cat.id];
                            const subCatExists = cacheEntry && cacheEntry.hasOwnProperty(sub.id);
                            const destSubProducts = subCatExists ? cacheEntry[sub.id] : [];

                            if (!subCatExists) {
                                stats.subcategoriesCreated++;
                                siteUpdated = true;
                            }

                            const prefix = (sub.subCategory || "")
                                .split(" ")
                                .map(w => w[0]?.toUpperCase())
                                .join("")
                                .replace(/[^\w]/g, "") || "CP";

                            let maxCounter = 0;
                            destSubProducts.forEach(p => {
                                if (p.categoryProductId && p.categoryProductId.includes("-")) {
                                    const parts = p.categoryProductId.split("-");
                                    const lastPart = Number(parts[parts.length - 1]);
                                    if (!isNaN(lastPart) && lastPart > maxCounter) {
                                        maxCounter = lastPart;
                                    }
                                }
                            });

                            const prodsToAppend = [];
                            const sourceSubProducts = sub.products || [];

                            addLogToTask(taskId, `[${destSite}]     START CATEGORY PRODUCT COPY for ${sub.subCategory} (${sourceSubProducts.length} items)`, "info");
                            for (const sourceProd of sourceSubProducts) {
                                if (cancelRef.current) throw new Error("cancelled");
                                siteProgress.currentProd = sourceProd.title;

                                const exists = destSubProducts.some(p => {
                                    if (sourceProd.slug && p.slug) return p.slug.trim() === sourceProd.slug.trim();
                                    return p.title?.trim() === sourceProd.title?.trim();
                                }) || prodsToAppend.some(p => {
                                    if (sourceProd.slug && p.slug) return p.slug.trim() === sourceProd.slug.trim();
                                    return p.title?.trim() === sourceProd.title?.trim();
                                });

                                if (exists) {
                                    stats.productsSkipped++;
                                    addLogToTask(taskId, `🟡 DUPLICATE SKIPPED\nWebsite: ${destSite}\nProduct: ${sourceProd.title || "Unknown Product"}\nReason: Product already exists`, "warning");
                                    setTasks(prev => {
                                        const t = prev[taskId];
                                        return {
                                            ...prev,
                                            [taskId]: {
                                                ...t,
                                                stats: { ...t.stats, productsSkipped: (t.stats.productsSkipped || 0) + 1 }
                                            }
                                        };
                                    });
                                    siteProgress.copiedCount++;
                                    continue;
                                }

                                maxCounter++;
                                prodsToAppend.push({
                                    ...sourceProd,
                                    id: crypto.randomUUID(),
                                    categoryProductId: `${prefix}-${maxCounter}`,
                                    createdAt: new Date().toISOString()
                                });
                            }
                            addLogToTask(taskId, `[${destSite}]     END CATEGORY PRODUCT COPY for ${sub.subCategory} (copied ${prodsToAppend.length} items)`, "info");

                            if (prodsToAppend.length > 0 || !subCatExists) {
                                siteProgress.step = `Writing subcategory: ${sub.subCategory}`;
                                lastWriteTime = Date.now();
                                await writeWithRetry(taskId, destSubDocRef, {
                                    id: sub.id,
                                    subCategory: sub.subCategory,
                                    products: [...destSubProducts, ...prodsToAppend],
                                    createdAt: sub.createdAt || new Date().toISOString()
                                }, sub.subCategory, cancelRef, { merge: true });
                                await new Promise(resolve => setTimeout(resolve, 100));
                                lastWriteTime = Date.now();

                                stats.categoryProductsCopied += prodsToAppend.length;
                                setTasks(prev => {
                                    const t = prev[taskId];
                                    return {
                                        ...prev,
                                        [taskId]: {
                                            ...t,
                                            stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + prodsToAppend.length }
                                        }
                                    };
                                });
                                siteProgress.copiedCount += prodsToAppend.length;
                                categoryCopiedCount += prodsToAppend.length;
                                siteUpdated = true;
                                addLogToTask(taskId, `[${destSite}] Category "${cat.category}" > "${sub.subCategory}" copied (${prodsToAppend.length} products)`, "success");
                            }
                            addLogToTask(taskId, `[${destSite}]   END SUBCATEGORY COPY: ${sub.subCategory}`, "info");
                        }
                        addLogToTask(taskId, `[${destSite}] END CATEGORY COPY: ${cat.category}`, "info");
                    }
                }

                if (siteUpdated) {
                    stats.destinationWebsitesUpdated.push(destSite);
                }

                siteProgress.status = "completed";
                siteProgress.percent = 100;
                siteProgress.step = "Completed";
                setTasks(prev => {
                    const t = prev[taskId];
                    return {
                        ...prev,
                        [taskId]: {
                            ...t,
                            stats: { ...t.stats, completedWebsites: t.stats.completedWebsites + 1 }
                        }
                    };
                });
                const duration = Math.round((Date.now() - siteProgress.startTime) / 1000);
                addLogToTask(taskId, `✔ ${destSite} Completed (${normalCopiedCount + categoryCopiedCount} Products, Time: ${duration}s)`, "success");
            } catch (err) {
                if (err.message === "cancelled") {
                    siteProgress.status = "cancelled";
                    siteProgress.step = "Cancelled";
                    addLogToTask(taskId, `⚠ ${destSite} Cancelled`, "warning");
                } else {
                    siteProgress.status = "failed";
                    siteProgress.step = `Failed: ${err.message || err}`;
                    stats.productsFailed++;
                    addLogToTask(taskId, `❌ ${destSite} Failed. Reason: ${err.message || err}`, "error");
                }
            }
        };

        try {
            let destIndex = 0;
            const runWorker = async () => {
                while (destIndex < destSites.length && !cancelRef.current) {
                    const site = destSites[destIndex++];
                    await copyWebsiteTask(site);
                }
            };

            const workers = [];
            const actualConcurrency = Math.min(concurrencyLimit || 3, destSites.length);
            for (let i = 0; i < actualConcurrency; i++) {
                workers.push(runWorker());
            }

            await Promise.all(workers);
            clearInterval(syncInterval);

            if (cancelRef.current) {
                const finalGlobal = tasksRef.current[taskId];
                const totalRemaining = finalGlobal.stats.totalProducts - finalGlobal.stats.copiedProducts;
                updateTask(taskId, {
                    status: "cancelled",
                    summary: {
                        status: "cancelled",
                        copied: finalGlobal.stats.copiedProducts,
                        remaining: totalRemaining
                    }
                });
            } else {
                const finalGlobal = tasksRef.current[taskId];
                updateTask(taskId, {
                    status: "completed",
                    percent: 100,
                    summary: {
                        status: "completed",
                        websites: finalGlobal.stats.totalWebsites,
                        products: finalGlobal.stats.copiedProducts,
                        elapsed: (Date.now() - startTime) / 1000,
                        speed: finalGlobal.stats.speed
                    }
                });
                toast.success("Category Copy completed!");
            }
        } catch (err) {
            clearInterval(syncInterval);
            console.error(err);
            updateTask(taskId, { status: "failed" });
        }
    };

    // ----------------------------------------------------
    // TASK RUNNER: NORMAL PRODUCT COPY
    // ----------------------------------------------------
    const startProductCopy = async (config) => {
        const taskId = `prod-copy-${Date.now()}`;
        const {
            sourceSite,
            destSites,
            selectedProductIds,
            sourceNormalProducts,
            concurrencyLimit
        } = config;

        const totalProductsPerSite = selectedProductIds.length;
        const totalProductsGlobal = totalProductsPerSite * destSites.length;

        const cancelRef = { current: false };

        const initialSites = {};
        destSites.forEach(site => {
            initialSites[site] = {
                status: "pending",
                step: "Queued",
                currentCat: "Normal Products",
                currentSub: "",
                currentProd: "",
                copiedCount: 0,
                totalCount: totalProductsPerSite,
                percent: 0
            };
        });

        const taskData = {
            id: taskId,
            name: "Product Copy",
            website: sourceSite,
            status: "running",
            percent: 0,
            isMinimized: false,
            isStuck: false,
            logs: [],
            stats: {
                totalWebsites: destSites.length,
                completedWebsites: 0,
                totalProducts: totalProductsGlobal,
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
                addLogToTask(taskId, "Cancel requested. Stopping remaining operations...", "warning");
                updateTask(taskId, { status: "cancelled" });
            }
        };

        setTasks(prev => ({ ...prev, [taskId]: taskData }));
        addLogToTask(taskId, `START PRODUCT COPY`, "info");
        addLogToTask(taskId, `Reading Products...`, "info");
        await new Promise(resolve => setTimeout(resolve, 50));

        const startTime = Date.now();
        let lastWriteTime = Date.now();

        const syncInterval = setInterval(() => {
            const current = tasksRef.current[taskId];
            if (!current || current.status !== "running") {
                clearInterval(syncInterval);
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const copied = current.stats.copiedProducts || 0;
            const skipped = current.stats.productsSkipped || 0;
            const processed = copied + skipped;
            const total = current.stats.totalProducts;
            const speed = elapsed > 0 ? Math.round(processed / elapsed) : 0;
            const eta = speed > 0 ? Math.round((total - processed) / speed) : 0;
            const percent = total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;
            const isStuck = (Date.now() - lastWriteTime > 10000);

            const updatedSites = { ...current.sites };
            Object.entries(updatedSites).forEach(([site, s]) => {
                if (s.status === "running" && s.startTime) {
                    s.percent = s.totalCount > 0 ? Math.min(Math.round((s.copiedCount / s.totalCount) * 100), 100) : 0;
                }
            });

            updateTask(taskId, {
                percent,
                isStuck,
                stats: {
                    ...current.stats,
                    speed,
                    elapsed,
                    eta,
                    copiedProducts: copied,
                    productsSkipped: skipped
                },
                sites: updatedSites
            });
        }, 500);

        const copyWebsiteNormalTask = async (destSite) => {
            const current = tasksRef.current[taskId];
            const siteProgress = current.sites[destSite];
            siteProgress.status = "running";
            siteProgress.startTime = Date.now();
            siteProgress.step = "Reading Normal Products";

            try {
                const destDocRef = doc(db, "websites", destSite, "pages", "products");
                const destSnap = await getDoc(destDocRef);
                const destNormalProducts = destSnap.exists() ? destSnap.data().products || [] : [];

                let maxId = 0;
                destNormalProducts.forEach(p => {
                    const num = Number(p.productId);
                    if (!isNaN(num) && num > maxId) maxId = num;
                });

                const prodsToAppend = [];
                for (const sId of selectedProductIds) {
                    if (cancelRef.current) throw new Error("cancelled");
                    const sourceProd = sourceNormalProducts.find(p => p.id === sId);
                    if (!sourceProd) continue;

                    siteProgress.currentProd = sourceProd.title;
                    addLogToTask(taskId, `Copying Product:\n${sourceProd.title}`, "info");

                    const exists = destNormalProducts.some(p => {
                        if (sourceProd.slug && p.slug) return p.slug.trim() === sourceProd.slug.trim();
                        return p.title?.trim() === sourceProd.title?.trim();
                    }) || prodsToAppend.some(p => {
                        if (sourceProd.slug && p.slug) return p.slug.trim() === sourceProd.slug.trim();
                        return p.title?.trim() === sourceProd.title?.trim();
                    });

                    if (exists) {
                        addLogToTask(taskId, `Duplicate Product Found\n→ Skipped`, "warning");
                        setTasks(prev => {
                            const t = prev[taskId];
                            return {
                                ...prev,
                                [taskId]: {
                                    ...t,
                                    stats: { ...t.stats, productsSkipped: (t.stats.productsSkipped || 0) + 1 }
                                }
                            };
                        });
                        siteProgress.copiedCount++;
                        continue;
                    }

                    maxId++;
                    prodsToAppend.push({
                        ...sourceProd,
                        id: crypto.randomUUID(),
                        productId: maxId,
                        createdAt: new Date().toISOString()
                    });
                    addLogToTask(taskId, `✓ Product Copied`, "success");
                }

                if (prodsToAppend.length > 0) {
                    siteProgress.step = "Saving Products...";
                    lastWriteTime = Date.now();
                    await writeWithRetry(taskId, destDocRef, { products: [...destNormalProducts, ...prodsToAppend] }, "Products", cancelRef, { merge: true });
                    lastWriteTime = Date.now();
                    setTasks(prev => {
                        const t = prev[taskId];
                        return {
                            ...prev,
                            [taskId]: {
                                ...t,
                                stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + prodsToAppend.length }
                            }
                        };
                    });
                    siteProgress.copiedCount += prodsToAppend.length;
                }

                siteProgress.status = "completed";
                siteProgress.percent = 100;
                siteProgress.step = "Completed";
                setTasks(prev => {
                    const t = prev[taskId];
                    return {
                        ...prev,
                        [taskId]: {
                            ...t,
                            stats: { ...t.stats, completedWebsites: t.stats.completedWebsites + 1 }
                        }
                    };
                });
                addLogToTask(taskId, `Website Completed`, "success");
            } catch (err) {
                if (err.message === "cancelled") {
                    siteProgress.status = "cancelled";
                    siteProgress.step = "Cancelled";
                } else {
                    siteProgress.status = "failed";
                    siteProgress.step = err.message || "Failed";
                    addLogToTask(taskId, `❌ ${destSite} Failed. Reason: ${err.message || err}`, "error");
                }
            }
        };

        try {
            let destIndex = 0;
            const runWorker = async () => {
                while (destIndex < destSites.length && !cancelRef.current) {
                    const site = destSites[destIndex++];
                    await copyWebsiteNormalTask(site);
                }
            };

            const workers = [];
            const actualConcurrency = Math.min(concurrencyLimit || 3, destSites.length);
            for (let i = 0; i < actualConcurrency; i++) {
                workers.push(runWorker());
            }

            await Promise.all(workers);
            clearInterval(syncInterval);

            if (cancelRef.current) {
                const finalGlobal = tasksRef.current[taskId];
                const totalRemaining = finalGlobal.stats.totalProducts - finalGlobal.stats.copiedProducts;
                updateTask(taskId, {
                    status: "cancelled",
                    summary: {
                        status: "cancelled",
                        copied: finalGlobal.stats.copiedProducts,
                        remaining: totalRemaining
                    }
                });
            } else {
                const finalGlobal = tasksRef.current[taskId];
                updateTask(taskId, {
                    status: "completed",
                    percent: 100,
                    summary: {
                        status: "completed",
                        websites: finalGlobal.stats.totalWebsites,
                        products: finalGlobal.stats.copiedProducts,
                        productsSkipped: finalGlobal.stats.productsSkipped || 0,
                        elapsed: (Date.now() - startTime) / 1000,
                        speed: finalGlobal.stats.speed
                    }
                });
                addLogToTask(taskId, `END PRODUCT COPY`, "info");
                toast.success("Products Copy completed!");
            }
        } catch (err) {
            clearInterval(syncInterval);
            console.error(err);
            updateTask(taskId, { status: "failed" });
        }
    };

    // ----------------------------------------------------
    // TASK RUNNER: NORMAL PRODUCT WATERMARK GENERATION
    // ----------------------------------------------------
    const startWatermarkProcess = async (config) => {
        const taskId = `watermark-${Date.now()}`;
        const {
            selectedCompany,
            selectedWebsite,
            COMPANY_WEBSITES
        } = config;

        const targetWebsites = selectedWebsite === "all"
            ? COMPANY_WEBSITES[selectedCompany] || []
            : [selectedWebsite];

        const cancelRef = { current: false };

        const initialSites = {};
        targetWebsites.forEach(site => {
            initialSites[site] = {
                status: "pending",
                step: "Queued",
                currentCat: "Normal Products",
                currentSub: "",
                currentProd: "",
                copiedCount: 0,
                totalCount: 0,
                percent: 0
            };
        });

        const taskData = {
            id: taskId,
            name: "Watermark Generation",
            website: selectedWebsite,
            status: "running",
            percent: 0,
            isMinimized: false,
            isStuck: false,
            logs: [],
            stats: {
                totalWebsites: targetWebsites.length,
                completedWebsites: 0,
                totalProducts: 0,
                copiedProducts: 0,
                speed: 0,
                elapsed: 0,
                eta: 0
            },
            sites: initialSites,
            config,
            cancelHandler: () => {
                cancelRef.current = true;
                addLogToTask(taskId, "Cancel requested. Stopping watermark generation...", "warning");
                updateTask(taskId, { status: "cancelled" });
            }
        };

        setTasks(prev => ({ ...prev, [taskId]: taskData }));
        addLogToTask(taskId, `Starting Watermark Generation for ${selectedCompany} sites...`, "info");
        await new Promise(resolve => setTimeout(resolve, 50));

        const startTime = Date.now();
        let lastWriteTime = Date.now();

        const syncInterval = setInterval(() => {
            const current = tasksRef.current[taskId];
            if (!current || current.status !== "running") {
                clearInterval(syncInterval);
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const copied = current.stats.copiedProducts;
            const total = current.stats.totalProducts;
            const speed = elapsed > 0 ? Math.round(copied / elapsed) : 0;
            const eta = speed > 0 ? Math.round((total - copied) / speed) : 0;
            const percent = total > 0 ? Math.min(Math.round((copied / total) * 100), 100) : 0;
            const isStuck = (Date.now() - lastWriteTime > 15000);

            const updatedSites = { ...current.sites };
            Object.entries(updatedSites).forEach(([site, s]) => {
                if (s.status === "running" && s.startTime) {
                    s.percent = s.totalCount > 0 ? Math.min(Math.round((s.copiedCount / s.totalCount) * 100), 100) : 0;
                }
            });

            updateTask(taskId, {
                percent,
                isStuck,
                stats: {
                    ...current.stats,
                    speed,
                    elapsed,
                    eta,
                    copiedProducts: copied
                },
                sites: updatedSites
            });
        }, 500);

        try {
            const totalWebsites = targetWebsites.length;

            for (let wIdx = 0; wIdx < totalWebsites; wIdx++) {
                if (cancelRef.current) throw new Error("cancelled");
                const site = targetWebsites[wIdx];
                const siteProgress = tasksRef.current[taskId].sites[site];
                siteProgress.status = "running";
                siteProgress.startTime = Date.now();
                siteProgress.step = "Reading Products";
                addLogToTask(taskId, `Reading products from ${site}...`, "info");

                const docRef = doc(db, "websites", site, "pages", "products");
                const snap = await getDoc(docRef);
                const siteProducts = snap.exists() ? snap.data().products || [] : [];

                if (siteProducts.length === 0) {
                    siteProgress.status = "completed";
                    siteProgress.percent = 100;
                    siteProgress.step = "Completed (No Products)";
                    setTasks(prev => {
                        const t = prev[taskId];
                        return {
                            ...prev,
                            [taskId]: {
                                ...t,
                                stats: { ...t.stats, completedWebsites: t.stats.completedWebsites + 1 }
                            }
                        };
                    });
                    addLogToTask(taskId, `No products found on ${site}`, "warning");
                    continue;
                }

                siteProgress.totalCount = siteProducts.length;
                setTasks(prev => {
                    const t = prev[taskId];
                    return {
                        ...prev,
                        [taskId]: {
                            ...t,
                            stats: { ...t.stats, totalProducts: t.stats.totalProducts + siteProducts.length }
                        }
                    };
                });

                const watermarkedProds = [];
                for (let pIdx = 0; pIdx < siteProducts.length; pIdx++) {
                    if (cancelRef.current) throw new Error("cancelled");
                    const product = siteProducts[pIdx];
                    siteProgress.currentProd = product.title || `Product #${pIdx + 1}`;
                    siteProgress.step = `Watermarking: ${product.title || pIdx + 1}`;

                    const allCandidateUrls = [
                        ...(Array.isArray(product.originalImages) ? product.originalImages : []),
                        ...(Array.isArray(product.images) ? product.images : []),
                        ...(product.image ? [product.image] : [])
                    ];

                    const cleanOriginals = allCandidateUrls.filter(
                        (url) => typeof url === "string" && !url.includes("watermarked_products") && !url.startsWith("data:image")
                    );

                    const sourceImages = cleanOriginals.length > 0 ? cleanOriginals : allCandidateUrls;
                    if (sourceImages.length === 0) {
                        watermarkedProds.push(product);
                        siteProgress.copiedCount++;
                        setTasks(prev => {
                            const t = prev[taskId];
                            return {
                                ...prev,
                                [taskId]: {
                                    ...t,
                                    stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + 1 }
                                }
                            };
                        });
                        continue;
                    }

                    const watermarkedStorageUrls = await Promise.all(
                        sourceImages.map(async (imgUrl) => {
                            try {
                                lastWriteTime = Date.now();
                                const res = await fetch("/api/generate-watermark", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ imageUrl: imgUrl, website: site }),
                                });
                                lastWriteTime = Date.now();
                                if (res.ok) {
                                    const data = await res.json();
                                    if (data.success && data.watermarkedImage) {
                                        return data.watermarkedImage;
                                    }
                                }
                            } catch (e) {
                                console.error("Watermark API error:", e);
                            }
                            return imgUrl;
                        })
                    );

                    watermarkedProds.push({
                        ...product,
                        originalImages: cleanOriginals.length > 0 ? cleanOriginals : (product.originalImages || sourceImages),
                        images: watermarkedStorageUrls,
                    });

                    siteProgress.copiedCount++;
                    setTasks(prev => {
                        const t = prev[taskId];
                        return {
                            ...prev,
                            [taskId]: {
                                ...t,
                                stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + 1 }
                            }
                        };
                    });
                }

                siteProgress.step = "Saving to database...";
                lastWriteTime = Date.now();
                await writeWithRetry(taskId, docRef, { products: watermarkedProds }, `${site} Products`, cancelRef);
                lastWriteTime = Date.now();

                siteProgress.status = "completed";
                siteProgress.percent = 100;
                siteProgress.step = "Completed";
                setTasks(prev => {
                    const t = prev[taskId];
                    return {
                        ...prev,
                        [taskId]: {
                            ...t,
                            stats: { ...t.stats, completedWebsites: t.stats.completedWebsites + 1 }
                        }
                    };
                });
                addLogToTask(taskId, `✔ Watermarks applied to ${site} (${siteProducts.length} products)`, "success");
            }

            clearInterval(syncInterval);
            const finalGlobal = tasksRef.current[taskId];
            updateTask(taskId, {
                status: "completed",
                percent: 100,
                summary: {
                    status: "completed",
                    websites: finalGlobal.stats.totalWebsites,
                    products: finalGlobal.stats.copiedProducts,
                    elapsed: (Date.now() - startTime) / 1000,
                    speed: finalGlobal.stats.speed
                }
            });
            toast.success("Watermarking completed successfully!");
        } catch (err) {
            clearInterval(syncInterval);
            if (err.message === "cancelled") {
                const finalGlobal = tasksRef.current[taskId];
                const totalRemaining = finalGlobal.stats.totalProducts - finalGlobal.stats.copiedProducts;
                updateTask(taskId, {
                    status: "cancelled",
                    summary: {
                        status: "cancelled",
                        copied: finalGlobal.stats.copiedProducts,
                        remaining: totalRemaining
                    }
                });
            } else {
                console.error(err);
                updateTask(taskId, { status: "failed" });
                addLogToTask(taskId, `Watermarking failed: ${err.message}`, "error");
            }
        }
    };

    // ----------------------------------------------------
    // TASK RUNNER: CATEGORY PRODUCT WATERMARK GENERATION
    // ----------------------------------------------------
    const startCategoryWatermarkProcess = async (config) => {
        const taskId = `cat-watermark-${Date.now()}`;
        const {
            selectedCompany,
            selectedWebsiteFilter,
            COMPANY_WEBSITES,
            currentWebsite
        } = config;

        const targetWebsites = selectedWebsiteFilter
            ? [selectedWebsiteFilter]
            : COMPANY_WEBSITES[selectedCompany] || [];

        const cancelRef = { current: false };

        const initialSites = {};
        targetWebsites.forEach(site => {
            initialSites[site] = {
                status: "pending",
                step: "Queued",
                currentCat: "",
                currentSub: "",
                currentProd: "",
                copiedCount: 0,
                totalCount: 0,
                percent: 0
            };
        });

        const taskData = {
            id: taskId,
            name: "Category Watermark Generation",
            website: selectedWebsiteFilter || "All Sites",
            status: "running",
            percent: 0,
            isMinimized: false,
            isStuck: false,
            logs: [],
            stats: {
                totalWebsites: targetWebsites.length,
                completedWebsites: 0,
                totalProducts: 0,
                copiedProducts: 0,
                speed: 0,
                elapsed: 0,
                eta: 0
            },
            sites: initialSites,
            config,
            cancelHandler: () => {
                cancelRef.current = true;
                addLogToTask(taskId, "Cancel requested. Stopping watermark generation...", "warning");
                updateTask(taskId, { status: "cancelled" });
            }
        };

        setTasks(prev => ({ ...prev, [taskId]: taskData }));
        addLogToTask(taskId, `Starting Category Watermarking for ${selectedCompany} sites...`, "info");
        await new Promise(resolve => setTimeout(resolve, 50));

        const startTime = Date.now();
        let lastWriteTime = Date.now();

        const syncInterval = setInterval(() => {
            const current = tasksRef.current[taskId];
            if (!current || current.status !== "running") {
                clearInterval(syncInterval);
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const copied = current.stats.copiedProducts;
            const total = current.stats.totalProducts;
            const speed = elapsed > 0 ? Math.round(copied / elapsed) : 0;
            const eta = speed > 0 ? Math.round((total - copied) / speed) : 0;
            const percent = total > 0 ? Math.min(Math.round((copied / total) * 100), 100) : 0;
            const isStuck = (Date.now() - lastWriteTime > 15000);

            const updatedSites = { ...current.sites };
            Object.entries(updatedSites).forEach(([site, s]) => {
                if (s.status === "running" && s.startTime) {
                    s.percent = s.totalCount > 0 ? Math.min(Math.round((s.copiedCount / s.totalCount) * 100), 100) : 0;
                }
            });

            updateTask(taskId, {
                percent,
                isStuck,
                stats: {
                    ...current.stats,
                    speed,
                    elapsed,
                    eta,
                    copiedProducts: copied
                },
                sites: updatedSites
            });
        }, 500);

        try {
            const totalWebsites = targetWebsites.length;

            const mapConcurrent = async (items, concurrency, fn) => {
                if (!Array.isArray(items) || items.length === 0) return [];
                const results = new Array(items.length);
                let index = 0;
                const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
                    while (index < items.length) {
                        const i = index++;
                        results[i] = await fn(items[i], i);
                    }
                });
                await Promise.all(workers);
                return results;
            };

            const applyWatermarkClientSide = (imageUrl, websiteText) => {
                return new Promise((resolve) => {
                    if (!imageUrl || typeof imageUrl !== "string") return resolve(imageUrl);
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    const timeout = setTimeout(() => resolve(imageUrl), 1000);
                    img.onload = () => {
                        clearTimeout(timeout);
                        try {
                            const canvas = document.createElement("canvas");
                            let width = img.naturalWidth || img.width || 800;
                            let height = img.naturalHeight || img.height || 800;
                            const maxDim = 800;
                            if (width > maxDim || height > maxDim) {
                                if (width >= height) {
                                    height = Math.round((height * maxDim) / width);
                                    width = maxDim;
                                } else {
                                    width = Math.round((width * maxDim) / height);
                                    height = maxDim;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0, width, height);
                            ctx.save();
                            ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
                            ctx.font = "600 18px 'Segoe UI', Roboto, sans-serif";
                            ctx.translate(width / 2, height / 2);
                            ctx.rotate((-25 * Math.PI) / 180);
                            const textWidth = ctx.measureText(websiteText).width + 70;
                            const stepY = 90;
                            const diagonal = Math.sqrt(width * width + height * height) * 1.5;
                            const startX = -diagonal;
                            const endX = diagonal;
                            const startY = -diagonal;
                            const endY = diagonal;
                            let row = 0;
                            for (let y = startY; y < endY; y += stepY) {
                                const offsetX = (row % 2) * (textWidth / 2);
                                for (let x = startX; x < endX; x += textWidth) {
                                    ctx.fillText(websiteText, x + offsetX, y);
                                }
                                row++;
                            }
                            ctx.restore();
                            const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
                            resolve(dataUrl);
                        } catch (err) {
                            console.error("Canvas watermark error:", err);
                            resolve(imgUrl);
                        }
                    };
                    img.onerror = () => {
                        clearTimeout(timeout);
                        resolve(imgUrl);
                    };
                    img.src = imageUrl;
                });
            };

            const getWatermarkDisplayText = (s) => {
                const parts = s.split(".");
                const domain = parts[0];
                return domain.replace(/^(https?:\/\/)?(www\.)?/, "").toUpperCase();
            };

            const watermarkSingleImage = async (imgUrl, site) => {
                if (!imgUrl || typeof imgUrl !== "string") return imgUrl;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                try {
                    const res = await fetch("/api/generate-watermark", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ imageUrl: imgUrl, website: site }),
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success && data.watermarkedImage) {
                            return data.watermarkedImage;
                        }
                    }
                } catch (err) {
                    clearTimeout(timeoutId);
                    console.warn("API watermark fallback to client canvas:", err);
                }
                const siteText = getWatermarkDisplayText(site);
                return applyWatermarkClientSide(imgUrl, siteText);
            };

            for (let wIdx = 0; wIdx < totalWebsites; wIdx++) {
                if (cancelRef.current) throw new Error("cancelled");
                const site = targetWebsites[wIdx];
                const siteProgress = tasksRef.current[taskId].sites[site];
                siteProgress.status = "running";
                siteProgress.startTime = Date.now();
                siteProgress.step = "Reading Categories";
                addLogToTask(taskId, `Reading category list from ${site}...`, "info");

                const categoriesRef = collection(db, "websites", site, "pages", "categoryproducts", "categories");
                const categoriesSnap = await getDocs(categoriesRef);
                const totalCats = categoriesSnap.docs.length;

                if (totalCats === 0) {
                    siteProgress.status = "completed";
                    siteProgress.percent = 100;
                    siteProgress.step = "Completed (No Categories)";
                    setTasks(prev => {
                        const t = prev[taskId];
                        return {
                            ...prev,
                            [taskId]: {
                                ...t,
                                stats: { ...t.stats, completedWebsites: t.stats.completedWebsites + 1 }
                            }
                        };
                    });
                    addLogToTask(taskId, `No categories found on ${site}`, "warning");
                    continue;
                }

                for (let cIdx = 0; cIdx < totalCats; cIdx++) {
                    if (cancelRef.current) throw new Error("cancelled");
                    const catDoc = categoriesSnap.docs[cIdx];
                    const catData = catDoc.data();

                    siteProgress.currentCat = catData.category || catDoc.id;
                    siteProgress.step = `Watermarking Category: ${catData.category || catDoc.id}`;

                    const subCatsRef = collection(db, "websites", site, "pages", "categoryproducts", "categories", catDoc.id, "subcategories");
                    const subCatsSnap = await getDocs(subCatsRef);

                    await mapConcurrent(subCatsSnap.docs, 6, async (subCatDoc) => {
                        const subCatData = subCatDoc.data();
                        const subCatProducts = subCatData.products || [];
                        if (subCatProducts.length === 0) return;

                        setTasks(prev => {
                            const t = prev[taskId];
                            return {
                                ...prev,
                                [taskId]: {
                                    ...t,
                                    stats: { ...t.stats, totalProducts: t.stats.totalProducts + subCatProducts.length }
                                }
                            };
                        });

                        const watermarkedProds = await mapConcurrent(subCatProducts, 10, async (product, pIdx) => {
                            if (cancelRef.current) throw new Error("cancelled");
                            siteProgress.currentProd = product.title || `${catData.category} Product`;

                            const allCandidateUrls = [
                                ...(Array.isArray(product.originalImages) ? product.originalImages : []),
                                ...(Array.isArray(product.images) ? product.images : []),
                                ...(product.image ? [product.image] : [])
                            ];

                            const cleanOriginals = allCandidateUrls.filter(
                                (url) => typeof url === "string" && !url.includes("watermarked_products") && !url.startsWith("data:image")
                            );

                            const sourceImages = cleanOriginals.length > 0 ? cleanOriginals : allCandidateUrls;
                            if (sourceImages.length === 0) {
                                siteProgress.copiedCount++;
                                setTasks(prev => {
                                    const t = prev[taskId];
                                    return {
                                        ...prev,
                                        [taskId]: {
                                            ...t,
                                            stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + 1 }
                                        }
                                    };
                                });
                                return product;
                            }

                            const watermarkedStorageUrls = await mapConcurrent(sourceImages, 6, (imgUrl) => watermarkSingleImage(imgUrl, site));
                            siteProgress.copiedCount++;
                            setTasks(prev => {
                                const t = prev[taskId];
                                return {
                                    ...prev,
                                    [taskId]: {
                                        ...t,
                                        stats: { ...t.stats, copiedProducts: t.stats.copiedProducts + 1 }
                                    }
                                };
                            });

                            return {
                                ...product,
                                originalImages: cleanOriginals.length > 0 ? cleanOriginals : (product.originalImages || sourceImages),
                                images: watermarkedStorageUrls,
                            };
                        });

                        lastWriteTime = Date.now();
                        await writeWithRetry(taskId, subCatDoc.ref, { products: watermarkedProds }, subCatDoc.id, cancelRef, { merge: true });
                        lastWriteTime = Date.now();
                    });
                }

                siteProgress.status = "completed";
                siteProgress.percent = 100;
                siteProgress.step = "Completed";
                setTasks(prev => {
                    const t = prev[taskId];
                    return {
                        ...prev,
                        [taskId]: {
                            ...t,
                            stats: { ...t.stats, completedWebsites: t.stats.completedWebsites + 1 }
                        }
                    };
                });
                addLogToTask(taskId, `✔ Category Watermarks applied to ${site}`, "success");
            }

            clearInterval(syncInterval);
            const finalGlobal = tasksRef.current[taskId];
            updateTask(taskId, {
                status: "completed",
                percent: 100,
                summary: {
                    status: "completed",
                    websites: finalGlobal.stats.totalWebsites,
                    products: finalGlobal.stats.copiedProducts,
                    elapsed: (Date.now() - startTime) / 1000,
                    speed: finalGlobal.stats.speed
                }
            });
            toast.success("Category watermarking completed successfully!");
        } catch (err) {
            clearInterval(syncInterval);
            if (err.message === "cancelled") {
                const finalGlobal = tasksRef.current[taskId];
                const totalRemaining = finalGlobal.stats.totalProducts - finalGlobal.stats.copiedProducts;
                updateTask(taskId, {
                    status: "cancelled",
                    summary: {
                        status: "cancelled",
                        copied: finalGlobal.stats.copiedProducts,
                        remaining: totalRemaining
                    }
                });
            } else {
                console.error(err);
                updateTask(taskId, { status: "failed" });
                addLogToTask(taskId, `Category Watermarking failed: ${err.message}`, "error");
            }
        }
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

            let company = "rajbiosis";
            const companies = {
                human: ["humanbiomedicalcom", "humanbiomedicalin", "humanbiomedicalorg", "humanbiomedicalsnet", "humanbiomedicalsin", "humanbiomedicalsorg", "humanbiomedicalscoin"],
                global: ["globalbiomedicalorg", "globalbiomedicalin", "globalbiomedicalcoin", "globalbiomedicalsin", "globalbiomedicalsnet", "globalhealthkartcom"],
                qlyte: ["qlyte"]
            };
            Object.entries(companies).forEach(([cName, list]) => {
                if (list.includes(website)) company = cName;
            });

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
                        🔔 New {type}
                    </div>
                    <div style={{ fontSize: "12px", color: "#374151" }}>
                        <strong>Website:</strong> {website}
                    </div>
                    {product && (
                        <div style={{ fontSize: "12px", color: "#374151" }}>
                            <strong>Product:</strong> {product}
                        </div>
                    )}
                    {name && (
                        <div style={{ fontSize: "12px", color: "#374151" }}>
                            <strong>Customer:</strong> {name}
                        </div>
                    )}
                    <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>
                        Received: Just Now
                    </div>
                </div>
            ), {
                duration: 8000,
                position: "bottom-right",
                style: {
                    background: "#ffffff",
                    border: "1px solid #e0e7ff",
                    boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.1), 0 4px 6px -2px rgba(79, 70, 229, 0.05)",
                    borderRadius: "12px",
                    padding: "12px"
                }
            });
        };

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            // Unsubscribe all active query listeners
            activeUnsubscribers.forEach(unsub => unsub());
            activeUnsubscribers = [];

            if (user) {
                const sessionMountTime = new Date();
                const websites = Object.values(COMPANY_WEBSITES).flat();
                const projectId = db?.app?.options?.projectId || "unknown";
                const userUid = user.uid;

                console.log(`[Query Notification System] Project ID: ${projectId}, User UID: ${userUid}`);

                await Promise.all(websites.map(async (website) => {
                    const contactPath = `websitesQueries/${website}/contactQueries`;
                    const productPath = `websitesQueries/${website}/productQueries`;

                    // Contact query snapshot listener
                    try {
                        const contactUnsub = onSnapshot(
                            collection(db, "websitesQueries", website, "contactQueries"),
                            (snap) => {
                                snap.docChanges().forEach(change => {
                                    if (change.type === "added") {
                                        const docData = change.doc.data();
                                        const createdAt = docData.createdAt?.toDate ? docData.createdAt.toDate() : null;
                                        if (createdAt && createdAt.getTime() > sessionMountTime.getTime()) {
                                            triggerNotification("Contact Query", website, docData.name || docData.email || "Valued User", null, change.doc.id);
                                        }
                                    }
                                });
                            },
                            (err) => {
                                console.error(`[Query Notification System] Full FirebaseError listening on ${contactPath}:`, err);
                            }
                        );
                        activeUnsubscribers.push(contactUnsub);
                    } catch (e) {
                        console.error(`[Query Notification System] Exception setting contact listener on ${contactPath}:`, e);
                    }

                    // Product query snapshot listener
                    try {
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
                            (err) => {
                                console.error(`[Query Notification System] Full FirebaseError listening on ${productPath}:`, err);
                            }
                        );
                        activeUnsubscribers.push(productUnsub);
                    } catch (e) {
                        console.error(`[Query Notification System] Exception setting product listener on ${productPath}:`, e);
                    }
                }));
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
                        t.logs.push(`[${new Date().toLocaleTimeString()}] ⚠ Process interrupted due to browser refresh.`);
                    }
                });
                setTasks(parsed);
            } catch (e) {
                console.error("Failed to parse restored tasks:", e);
            }
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
