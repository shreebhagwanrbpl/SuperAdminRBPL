"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef
} from "react";

import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import {
    doc,
    getDoc,
    setDoc,
    getDocs,
    collection,
    onSnapshot,
    onQueryNotifications,
    query,
    orderBy
} from "@/lib/sqliteFirestore";

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


    // ----------------------------------------------------
    // KEEP TASK REF IN SYNC + LOCAL STORAGE
    // ----------------------------------------------------

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
                logs: Array.isArray(t.logs)
                    ? t.logs.slice(-100)
                    : [],
                sites: t.sites,
                isMinimized: t.isMinimized,
                isStuck: t.isStuck,

                config: {
                    concurrencyLimit:
                        t.config?.concurrencyLimit
                }
            };
        });

        try {

            localStorage.setItem(
                "bg_tasks_meta",
                JSON.stringify(serializableTasks)
            );

        } catch (e) {

            console.warn(
                "[TaskManagerContext] LocalStorage write failed:",
                e
            );

        }

    }, [tasks]);


    // ----------------------------------------------------
    // UPDATE TASK
    // ----------------------------------------------------

    const updateTask = (id, updates) => {

        setTasks(prev => {

            const existing = prev[id] || {};

            return {
                ...prev,

                [id]: {
                    ...existing,
                    ...updates
                }
            };

        });

    };


    // ----------------------------------------------------
    // REMOVE TASK
    // ----------------------------------------------------

    const removeTask = (id) => {

        setTasks(prev => {

            const next = {
                ...prev
            };

            delete next[id];

            return next;

        });

    };


    // ----------------------------------------------------
    // ADD TASK LOG
    // ----------------------------------------------------

    const addLogToTask = (
        id,
        msg,
        type = "info"
    ) => {

        const symbols = {

            info: "ℹ",
            success: "✔",
            error: "❌",
            warning: "⚠"

        };

        const prefix =
            symbols[type] || "ℹ";

        const formatted =
            `[${new Date().toLocaleTimeString()}] ${prefix} ${msg}`;


        setTasks(prev => {

            const existing = prev[id];

            if (!existing) {
                return prev;
            }


            return {

                ...prev,

                [id]: {

                    ...existing,

                    logs: [
                        ...(existing.logs || []),
                        formatted
                    ].slice(-300)

                }

            };

        });

    };


    // ----------------------------------------------------
    // FORMAT TIME
    // ----------------------------------------------------

    const formatTime = (totalSeconds) => {

        if (
            isNaN(totalSeconds) ||
            totalSeconds < 0
        ) {

            return "00:00";

        }

        const mins =
            Math.floor(totalSeconds / 60);

        const secs =
            Math.floor(totalSeconds % 60);


        return (
            `${mins
                .toString()
                .padStart(2, "0")}:${secs
                    .toString()
                    .padStart(2, "0")}`
        );

    };


    // ====================================================
    // TASK RUNNER
    // WEBSITE VISIBILITY / ENABLE MASTER PRODUCTS
    // ====================================================

    const startCategoryProductCopy = async (
        config
    ) => {

        const taskId =
            `cat-visibility-${Date.now()}`;


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


        const companyId =
            getCompanyForWebsite(sourceSite);


        const companyName =
            getCompanyDisplayName(companyId);


        // ------------------------------------------------
        // TOTAL PRODUCTS
        // ------------------------------------------------

        let totalTargetProducts =
            (selectedNormalProductIds || []).length;


        if (
            copyCategoryEnabled &&
            sourceCategories
        ) {

            sourceCategories.forEach(cat => {

                const selectedSubs =
                    (cat.subcategories || [])
                        .filter(
                            sub =>
                                selectedSubcategories?.[
                                cat.id
                                ]?.[
                                sub.id
                                ]
                        );


                selectedSubs.forEach(sub => {

                    totalTargetProducts +=
                        (sub.products || []).length;

                });

            });

        }


        const totalOperationsGlobal =
            totalTargetProducts *
            destSites.length;


        const cancelRef = {
            current: false
        };


        // ------------------------------------------------
        // INITIAL SITE STATUS
        // ------------------------------------------------

        const initialSites = {};


        destSites.forEach(site => {

            initialSites[site] = {

                status: "pending",

                step: "Queued",

                currentCat: "",

                currentSub: "",

                currentProd: "",

                copiedCount: 0,

                totalCount:
                    totalTargetProducts,

                percent: 0

            };

        });


        // ------------------------------------------------
        // TASK DATA
        // ------------------------------------------------

        const taskData = {

            id: taskId,

            name:
                "Website Visibility Mapping",

            website:
                sourceSite,

            status:
                "running",

            percent:
                0,

            isMinimized:
                false,

            isStuck:
                false,

            logs: [],

            stats: {

                totalWebsites:
                    destSites.length,

                completedWebsites:
                    0,

                totalProducts:
                    totalOperationsGlobal,

                copiedProducts:
                    0,

                productsSkipped:
                    0,

                speed:
                    0,

                elapsed:
                    0,

                eta:
                    0

            },

            sites:
                initialSites,

            config,

            cancelHandler: () => {

                cancelRef.current =
                    true;


                addLogToTask(
                    taskId,
                    "Cancel requested. Stopping visibility updates...",
                    "warning"
                );


                updateTask(
                    taskId,
                    {
                        status:
                            "cancelled"
                    }
                );

            }

        };


        setTasks(prev => ({
            ...prev,
            [taskId]:
                taskData
        }));


        addLogToTask(
            taskId,
            `Enabling products for ${destSites.length} websites in ${companyName}...`,
            "info"
        );


        await new Promise(
            resolve =>
                setTimeout(resolve, 50)
        );


        const startTime =
            Date.now();


        // ------------------------------------------------
        // PROGRESS SYNC
        // ------------------------------------------------

        const syncInterval =
            setInterval(() => {

                const current =
                    tasksRef.current[
                    taskId
                    ];


                if (
                    !current ||
                    current.status !== "running"
                ) {

                    clearInterval(
                        syncInterval
                    );

                    return;

                }


                const elapsed =
                    (
                        Date.now() -
                        startTime
                    ) / 1000;


                const copied =
                    current.stats
                        ?.copiedProducts || 0;


                const total =
                    current.stats
                        ?.totalProducts || 1;


                const speed =
                    elapsed > 0
                        ? Math.round(
                            copied / elapsed
                        )
                        : 0;


                const eta =
                    speed > 0
                        ? Math.round(
                            (total - copied) /
                            speed
                        )
                        : 0;


                const percent =
                    Math.min(
                        Math.round(
                            (copied / total) *
                            100
                        ),
                        100
                    );


                updateTask(
                    taskId,
                    {

                        percent,

                        stats: {

                            ...current.stats,

                            speed,

                            elapsed,

                            eta,

                            copiedProducts:
                                copied

                        }

                    }
                );


            }, 500);


        try {

            // ============================================
            // 1. NORMAL PRODUCTS
            // ============================================

            if (
                copyNormalEnabled &&
                selectedNormalProductIds &&
                selectedNormalProductIds.length > 0
            ) {

                addLogToTask(
                    taskId,
                    `Enabling ${selectedNormalProductIds.length} normal master products across destination websites...`,
                    "info"
                );


                await bulkEnableProductsOnWebsites(
                    companyId,
                    selectedNormalProductIds,
                    destSites
                );


                updateTask(
                    taskId,
                    {

                        stats: {

                            ...tasksRef.current[
                                taskId
                            ].stats,

                            copiedProducts:
                                tasksRef.current[
                                    taskId
                                ].stats
                                    .copiedProducts +
                                (
                                    selectedNormalProductIds.length *
                                    destSites.length
                                )

                        }

                    }
                );

            }


            // ============================================
            // 2. CATEGORY + SUBCATEGORY
            // ============================================

            if (
                copyCategoryEnabled &&
                sourceCategories
            ) {

                for (
                    const cat
                    of sourceCategories
                ) {

                    if (
                        cancelRef.current
                    ) {
                        break;
                    }


                    const selectedSubs =
                        (
                            cat.subcategories ||
                            []
                        ).filter(
                            sub =>
                                selectedSubcategories?.[
                                cat.id
                                ]?.[
                                sub.id
                                ]
                        );


                    if (
                        selectedSubs.length === 0
                    ) {

                        continue;

                    }


                    await bulkEnableCategoryOnWebsites(
                        companyId,
                        cat.id,
                        destSites
                    );


                    for (
                        const sub
                        of selectedSubs
                    ) {

                        if (
                            cancelRef.current
                        ) {

                            break;

                        }


                        await bulkEnableSubcategoryOnWebsites(
                            companyId,
                            cat.id,
                            sub.id,
                            destSites
                        );


                        const subProdIds =
                            (
                                sub.products ||
                                []
                            ).map(
                                p => p.id
                            );


                        if (
                            subProdIds.length > 0
                        ) {

                            await bulkEnableProductsOnWebsites(
                                companyId,
                                subProdIds,
                                destSites
                            );


                            updateTask(
                                taskId,
                                {

                                    stats: {

                                        ...tasksRef.current[
                                            taskId
                                        ].stats,

                                        copiedProducts:
                                            tasksRef.current[
                                                taskId
                                            ].stats
                                                .copiedProducts +
                                            (
                                                subProdIds.length *
                                                destSites.length
                                            )

                                    }

                                }
                            );

                        }

                    }

                }

            }


            // ============================================
            // MARK WEBSITES COMPLETED
            // ============================================

            const finalSites = {
                ...tasksRef.current[
                    taskId
                ].sites
            };


            Object.keys(finalSites)
                .forEach(s => {

                    finalSites[s].status =
                        "completed";

                    finalSites[s].percent =
                        100;

                    finalSites[s].step =
                        "Enabled";

                });


            clearInterval(
                syncInterval
            );


            updateTask(
                taskId,
                {

                    status:
                        "completed",

                    percent:
                        100,

                    sites:
                        finalSites,

                    summary: {

                        status:
                            "completed",

                        websites:
                            destSites.length,

                        products:
                            totalTargetProducts,

                        elapsed:
                            (
                                Date.now() -
                                startTime
                            ) / 1000,

                        speed:
                            10

                    }

                }
            );


            addLogToTask(
                taskId,
                "Website visibility updated successfully (Zero duplicate products created)",
                "success"
            );


            toast.success(
                "Products enabled on websites successfully!"
            );


        } catch (err) {

            clearInterval(
                syncInterval
            );


            console.error(
                "[TaskManager] Visibility error:",
                err
            );


            updateTask(
                taskId,
                {
                    status:
                        "failed"
                }
            );


            addLogToTask(
                taskId,
                `Failed to update website visibility: ${err.message}`,
                "error"
            );

        }

    };


    // ====================================================
    // SIMPLE PRODUCT COPY
    // ====================================================

    const startProductCopy = async (
        config
    ) => {

        return startCategoryProductCopy({

            ...config,

            copyNormalEnabled:
                true,

            copyCategoryEnabled:
                false

        });

    };


    // ====================================================
    // WATERMARK PROCESS
    // ====================================================

    const startWatermarkProcess = async (
        config
    ) => {

        const taskId =
            `watermark-${Date.now()}`;


        const {
            selectedCompany,
            selectedWebsite
        } = config;


        const companyName =
            getCompanyDisplayName(
                selectedCompany
            );


        const taskData = {

            id:
                taskId,

            name:
                "Company Watermark Activation",

            website:
                selectedWebsite,

            status:
                "completed",

            percent:
                100,

            isMinimized:
                false,

            isStuck:
                false,

            logs: [

                `[${new Date().toLocaleTimeString()}] ℹ Watermark set to Company Name: "${companyName}".`,

                `[${new Date().toLocaleTimeString()}] ✔ Dynamic display-time watermarking active (No duplicate storage files needed).`

            ],

            stats: {

                totalWebsites:
                    1,

                completedWebsites:
                    1,

                totalProducts:
                    1,

                copiedProducts:
                    1,

                speed:
                    1,

                elapsed:
                    0.5,

                eta:
                    0

            },

            summary: {

                status:
                    "completed",

                websites:
                    1,

                products:
                    1,

                elapsed:
                    0.5,

                speed:
                    1

            }

        };


        setTasks(prev => ({

            ...prev,

            [taskId]:
                taskData

        }));


        toast.success(
            `Dynamic watermarks active: "${companyName}"`
        );

    };


    // ====================================================
    // CATEGORY WATERMARK
    // ====================================================

    const startCategoryWatermarkProcess = async (
        config
    ) => {

        return startWatermarkProcess(
            config
        );

    };


    // ====================================================
    // REAL-TIME QUERY PUSH NOTIFICATIONS
    // ====================================================

    /*
     * SQLite does not have Firestore's native realtime
     * listener.
     *
     * We use ONE lightweight polling stream instead of
     * creating separate listeners for every website.
     *
     * This prevents hundreds of API requests.
     */

    useEffect(() => {

        let queryUnsub = null;


        // ------------------------------------------------
        // NOTIFICATION FUNCTION
        // ------------------------------------------------

        const triggerNotification = (
            type,
            website,
            name,
            product
        ) => {

            try {

                const audio =
                    new Audio(
                        "https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav"
                    );


                audio.volume = 0.5;


                audio
                    .play()
                    .catch(() => { });


            } catch (error) {

                console.warn(
                    "[TaskManager] Notification audio failed:",
                    error
                );

            }


            const company =
                getCompanyForWebsite(
                    website
                );


            const linkParams =
                `company=${encodeURIComponent(company || "")}` +
                `&website=${encodeURIComponent(website || "")}` +
                `&tab=${type === "Product Query"
                    ? "product"
                    : "contact"
                }`;


            toast(
                (t) => (

                    <div

                        onClick={() => {

                            toast.dismiss(
                                t.id
                            );


                            window.location.href =
                                `/queries?${linkParams}`;

                        }}

                        style={{

                            cursor:
                                "pointer",

                            display:
                                "flex",

                            flexDirection:
                                "column",

                            gap:
                                "4px"

                        }}

                    >

                        <div

                            style={{

                                fontWeight:
                                    "700",

                                color:
                                    "#4f46e5",

                                fontSize:
                                    "14px",

                                display:
                                    "flex",

                                alignItems:
                                    "center",

                                gap:
                                    "6px"

                            }}

                        >

                            <span>
                                🔔 {type}
                            </span>

                        </div>


                        <div

                            style={{

                                fontSize:
                                    "12px",

                                color:
                                    "#334155"

                            }}

                        >

                            <strong>
                                {name}
                            </strong>

                            {" for "}

                            <strong>
                                {product}
                            </strong>

                            {" ("}

                            {website}

                            {")"}

                        </div>

                    </div>

                ),

                {
                    duration:
                        6000
                }

            );

        };


        // ------------------------------------------------
        // EXTRACT PATH SAFELY
        // ------------------------------------------------

        const getNotificationPath = (
            change
        ) => {

            const docSnap =
                change?.doc;


            const possiblePaths = [

                change?.collectionPath,

                change?.path,

                docSnap?.ref?.path,

                docSnap?.path,

                docSnap?.collectionPath,

                docSnap?.data?.()?.collectionPath,

                docSnap?.data?.()?.path

            ];


            for (
                const value
                of possiblePaths
            ) {

                if (
                    typeof value ===
                    "string" &&
                    value.trim()
                ) {

                    return value;

                }

            }


            return "";

        };


        // ------------------------------------------------
        // AUTH LISTENER
        // ------------------------------------------------

        const unsubscribeAuth =
            onAuthStateChanged(
                auth,
                (user) => {

                    // ------------------------------------
                    // CLEAN OLD LISTENER
                    // ------------------------------------

                    if (queryUnsub) {

                        try {
                            queryUnsub();
                        } catch (e) { }

                        queryUnsub =
                            null;

                    }


                    // ------------------------------------
                    // USER NOT LOGGED IN
                    // ------------------------------------

                    if (!user) {

                        return;

                    }


                    // ------------------------------------
                    // SESSION START TIME
                    // ------------------------------------

                    const sessionMountTime =
                        Date.now();


                    // ------------------------------------
                    // SINGLE SQLITE NOTIFICATION LISTENER
                    // ------------------------------------

                    queryUnsub =
                        onQueryNotifications(

                            (snap) => {

                                if (
                                    !snap ||
                                    typeof snap.docChanges !==
                                    "function"
                                ) {

                                    console.warn(
                                        "[TaskManager] Invalid query notification snapshot"
                                    );

                                    return;

                                }


                                const changes =
                                    snap.docChanges();


                                if (
                                    !Array.isArray(
                                        changes
                                    )
                                ) {

                                    return;

                                }


                                changes.forEach(
                                    (change) => {

                                        if (
                                            !change ||
                                            change.type !==
                                            "added"
                                        ) {

                                            return;

                                        }


                                        if (
                                            !change.doc ||
                                            typeof change.doc.data !==
                                            "function"
                                        ) {

                                            return;

                                        }


                                        const docData =
                                            change.doc.data() ||
                                            {};


                                        // --------------------------------
                                        // CREATED AT
                                        // --------------------------------

                                        let createdAt =
                                            null;


                                        try {

                                            if (
                                                docData
                                                    .createdAt
                                                    ?.toDate
                                            ) {

                                                createdAt =
                                                    docData.createdAt.toDate();

                                            } else if (
                                                docData.createdAt instanceof
                                                Date
                                            ) {

                                                createdAt =
                                                    docData.createdAt;

                                            } else if (
                                                typeof docData.createdAt ===
                                                "number"
                                            ) {

                                                createdAt =
                                                    new Date(
                                                        docData.createdAt
                                                    );

                                            } else if (
                                                typeof docData.createdAt ===
                                                "string"
                                            ) {

                                                const parsed =
                                                    new Date(
                                                        docData.createdAt
                                                    );


                                                if (
                                                    !isNaN(
                                                        parsed.getTime()
                                                    )
                                                ) {

                                                    createdAt =
                                                        parsed;

                                                }

                                            }

                                        } catch (
                                        timestampError
                                        ) {

                                            console.warn(
                                                "[TaskManager] createdAt parse failed:",
                                                timestampError
                                            );

                                        }


                                        // --------------------------------
                                        // IGNORE OLD QUERIES
                                        // --------------------------------

                                        if (
                                            !createdAt ||
                                            isNaN(
                                                createdAt.getTime()
                                            )
                                        ) {

                                            return;

                                        }


                                        if (
                                            createdAt.getTime() <=
                                            sessionMountTime
                                        ) {

                                            return;

                                        }


                                        // --------------------------------
                                        // GET DOCUMENT PATH
                                        // --------------------------------

                                        const documentPath =
                                            getNotificationPath(
                                                change
                                            );


                                        if (
                                            !documentPath
                                        ) {

                                            console.warn(
                                                "[TaskManager] Query notification has no path:",
                                                change
                                            );

                                            return;

                                        }


                                        // --------------------------------
                                        // EXPECTED PATH
                                        //
                                        // websitesQueries/{website}/contactQueries/{docId}
                                        //
                                        // websitesQueries/{website}/productQueries/{docId}
                                        // --------------------------------

                                        const parts =
                                            String(
                                                documentPath
                                            )
                                                .split("/")
                                                .filter(Boolean);


                                        if (
                                            parts.length <
                                            4
                                        ) {

                                            console.warn(
                                                "[TaskManager] Invalid query path:",
                                                documentPath
                                            );

                                            return;

                                        }


                                        const rootCollection =
                                            parts[0];


                                        const website =
                                            parts[1];


                                        const collectionName =
                                            parts[2];


                                        // --------------------------------
                                        // SAFETY CHECK
                                        // --------------------------------

                                        if (
                                            rootCollection !==
                                            "websitesQueries"
                                        ) {

                                            return;

                                        }


                                        if (
                                            !website
                                        ) {

                                            return;

                                        }


                                        // =================================
                                        // CONTACT QUERY
                                        // =================================

                                        if (
                                            collectionName ===
                                            "contactQueries"
                                        ) {

                                            triggerNotification(

                                                "Contact Query",

                                                website,

                                                docData.name ||
                                                docData.email ||
                                                "Valued User",

                                                "Contact Us Form"

                                            );

                                            return;

                                        }


                                        // =================================
                                        // PRODUCT QUERY
                                        // =================================

                                        if (
                                            collectionName ===
                                            "productQueries"
                                        ) {

                                            triggerNotification(

                                                "Product Query",

                                                website,

                                                docData.name ||
                                                docData.email ||
                                                "Valued User",

                                                docData.productName ||
                                                "Unknown Product"

                                            );

                                            return;

                                        }

                                    }
                                );

                            },


                            // ------------------------------------
                            // ERROR CALLBACK
                            // ------------------------------------

                            (error) => {

                                console.error(
                                    "[TaskManager] SQLite query notifications error:",
                                    error
                                );

                            },


                            sessionMountTime

                        );

                }
            );


        // ------------------------------------------------
        // CLEANUP
        // ------------------------------------------------

        return () => {

            try {

                unsubscribeAuth();

            } catch (e) { }


            if (queryUnsub) {

                try {

                    queryUnsub();

                } catch (e) { }

                queryUnsub =
                    null;

            }

        };


    }, []);


    // ====================================================
    // RESTORE TASKS FROM LOCAL STORAGE
    // ====================================================

    useEffect(() => {

        try {

            const stored =
                localStorage.getItem(
                    "bg_tasks_meta"
                );


            if (!stored) {

                return;

            }


            const parsed =
                JSON.parse(stored);


            Object.entries(parsed)
                .forEach(
                    ([id, t]) => {

                        if (
                            t.status ===
                            "running"
                        ) {

                            t.status =
                                "cancelled";

                        }

                    }
                );


            setTasks(
                parsed
            );


        } catch (e) {

            console.warn(
                "[TaskManagerContext] Failed to restore tasks:",
                e
            );

        }

    }, []);


    // ====================================================
    // PROVIDER
    // ====================================================

    return (

        <TaskManagerContext.Provider

            value={{

                tasks,

                updateTask,

                removeTask,

                startCategoryProductCopy,

                startProductCopy,

                startWatermarkProcess,

                startCategoryWatermarkProcess,

                formatTime

            }}

        >

            {children}

        </TaskManagerContext.Provider>

    );

};


// ========================================================
// HOOK
// ========================================================

export const useTaskManager = () =>
    useContext(
        TaskManagerContext
    );