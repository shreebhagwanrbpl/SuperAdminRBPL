"use client";

import Modal from "react-modal";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    writeBatch,
} from "firebase/firestore";
import "./contact.css";
import toast from "react-hot-toast";
import {
    Trash2,
    Copy,
    Check,
    RefreshCw,
} from "lucide-react";
import { usePathname } from "next/navigation";

/* =========================================================
   COMPANY → WEBSITES
========================================================= */

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
        "globalhealthkartcom",
        "tublerin",
    ],
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AdminContact() {
    const pathname = usePathname();

    const pathParts = pathname
        .split("/")
        .filter(Boolean);

    /* =====================================================
       FIRESTORE DOCUMENT REFERENCE
    ===================================================== */

    const getDocRef = (website) => {
        return doc(
            db,
            "websites",
            website,
            "pages",
            "contact"
        );
    };

    /* =====================================================
       STATES
    ===================================================== */

    const [contactInfo, setContactInfo] = useState([]);

    const [form, setForm] = useState([
        {
            label: "",
            value: "",
        },
    ]);

    const [editIndex, setEditIndex] = useState(null);

    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] =
        useState(false);

    const [selectedCompany, setSelectedCompany] =
        useState("");

    const [selectedWebsite, setSelectedWebsite] =
        useState("");

    const [deleteIndex, setDeleteIndex] =
        useState(null);

    const [isEditing, setIsEditing] =
        useState(false);

    /* =====================================================
       COPY SYSTEM
    ===================================================== */

    const [copySourceWebsite, setCopySourceWebsite] =
        useState("");

    const [copyTargetWebsites, setCopyTargetWebsites] =
        useState([]);

    const [sourceContactInfo, setSourceContactInfo] =
        useState([]);

    const [copyLoading, setCopyLoading] =
        useState(false);

    /* =====================================================
       LOAD SELECTED WEBSITE
    ===================================================== */

    useEffect(() => {
        const loadWebsiteContact = async () => {
            if (
                !selectedCompany ||
                !selectedWebsite
            ) {
                setContactInfo([]);
                return;
            }

            setLoading(true);

            try {
                const snap = await getDoc(
                    getDocRef(selectedWebsite)
                );

                if (snap.exists()) {
                    const data =
                        snap.data()?.contactInfo || [];

                    setContactInfo(data);
                } else {
                    setContactInfo([]);
                }
            } catch (error) {
                console.error(
                    "CONTACT LOAD ERROR:",
                    error
                );

                toast.error(
                    error?.message ||
                    "Failed to load contact"
                );

                setContactInfo([]);
            } finally {
                setLoading(false);
            }
        };

        loadWebsiteContact();
    }, [
        selectedCompany,
        selectedWebsite,
    ]);

    /* =====================================================
       LOAD COPY SOURCE
    ===================================================== */

    useEffect(() => {
        const loadSourceContact = async () => {
            if (
                !selectedCompany ||
                !copySourceWebsite
            ) {
                setSourceContactInfo([]);
                return;
            }

            try {
                const snap = await getDoc(
                    getDocRef(copySourceWebsite)
                );

                if (!snap.exists()) {
                    setSourceContactInfo([]);
                    return;
                }

                const data =
                    snap.data()?.contactInfo || [];

                setSourceContactInfo(data);
            } catch (error) {
                console.error(
                    "SOURCE CONTACT LOAD ERROR:",
                    error
                );

                setSourceContactInfo([]);

                toast.error(
                    error?.message ||
                    "Failed to load source contact"
                );
            }
        };

        loadSourceContact();
    }, [
        selectedCompany,
        copySourceWebsite,
    ]);

    /* =====================================================
       COMPANY CHANGE
    ===================================================== */

    const handleCompanyChange = (e) => {
        const company =
            e.target.value;

        setSelectedCompany(company);

        setSelectedWebsite("");

        setCopySourceWebsite("");

        setCopyTargetWebsites([]);

        setSourceContactInfo([]);

        setContactInfo([]);

        setForm([
            {
                label: "",
                value: "",
            },
        ]);

        setIsEditing(false);

        setEditIndex(null);
    };

    /* =====================================================
       WEBSITE CHANGE
    ===================================================== */

    const handleWebsiteChange = (e) => {
        const website =
            e.target.value;

        setSelectedWebsite(website);

        if (website) {
            setCopySourceWebsite(website);
        }

        setCopyTargetWebsites([]);

        setIsEditing(false);

        setEditIndex(null);
    };

    /* =====================================================
       ADD NEW FIELD
    ===================================================== */

    const addNewField = () => {
        setForm((prev) => [
            ...prev,
            {
                label: "",
                value: "",
            },
        ]);
    };

    /* =====================================================
       FORM CHANGE
    ===================================================== */

    const handleChange = (
        index,
        e
    ) => {
        const updated = [...form];

        updated[index][e.target.name] =
            e.target.value;

        setForm(updated);
    };

    /* =====================================================
       ADD PHONE
    ===================================================== */

    const addPhoneNumber = (
        fieldIndex
    ) => {
        const updated = [...form];

        const currentValue =
            updated[fieldIndex].value;

        if (
            Array.isArray(currentValue)
        ) {
            updated[fieldIndex].value = [
                ...currentValue,
                "",
            ];
        } else {
            updated[fieldIndex].value = [
                currentValue || "",
                "",
            ];
        }

        setForm(updated);
    };

    /* =====================================================
       UPDATE PHONE
    ===================================================== */

    const updatePhoneNumber = (
        fieldIndex,
        phoneIndex,
        value
    ) => {
        const updated = [...form];

        const currentValue =
            Array.isArray(
                updated[fieldIndex].value
            )
                ? [
                    ...updated[fieldIndex]
                        .value,
                ]
                : [
                    updated[fieldIndex]
                        .value || "",
                ];

        currentValue[phoneIndex] =
            value;

        updated[fieldIndex].value =
            currentValue;

        setForm(updated);
    };

    /* =====================================================
       REMOVE PHONE
    ===================================================== */

    const removePhoneNumber = (
        fieldIndex,
        phoneIndex
    ) => {
        const updated = [...form];

        const currentValue =
            Array.isArray(
                updated[fieldIndex].value
            )
                ? [
                    ...updated[fieldIndex]
                        .value,
                ]
                : [];

        currentValue.splice(
            phoneIndex,
            1
        );

        updated[fieldIndex].value =
            currentValue;

        setForm(updated);
    };

    /* =====================================================
       CLEAN CONTACT DATA
    ===================================================== */

    const cleanContactData = (
        data
    ) => {
        if (!Array.isArray(data)) {
            return [];
        }

        return data
            .map((item) => {
                const label =
                    item?.label
                        ?.trim() || "";

                if (!label) {
                    return null;
                }

                /* =========================
                   PHONE
                ========================= */

                if (
                    label.toLowerCase() ===
                    "phone"
                ) {
                    const phones =
                        Array.isArray(
                            item.value
                        )
                            ? item.value
                                .map(
                                    (
                                        phone
                                    ) =>
                                        typeof phone ===
                                            "string"
                                            ? phone.trim()
                                            : ""
                                )
                                .filter(
                                    Boolean
                                )
                            : typeof item.value ===
                                "string" &&
                                item.value.trim()
                                ? [
                                    item.value.trim(),
                                ]
                                : [];

                    if (
                        phones.length ===
                        0
                    ) {
                        return null;
                    }

                    return {
                        label,
                        value: phones,
                    };
                }

                /* =========================
                   OTHER FIELDS
                ========================= */

                if (
                    Array.isArray(
                        item.value
                    )
                ) {
                    const values =
                        item.value
                            .map(
                                (
                                    value
                                ) =>
                                    typeof value ===
                                        "string"
                                        ? value.trim()
                                        : value
                            )
                            .filter(
                                (value) =>
                                    value !==
                                    ""
                            );

                    if (
                        values.length ===
                        0
                    ) {
                        return null;
                    }

                    return {
                        label,
                        value: values,
                    };
                }

                const value =
                    typeof item.value ===
                        "string"
                        ? item.value.trim()
                        : item.value;

                if (
                    value === "" ||
                    value === null ||
                    value === undefined
                ) {
                    return null;
                }

                return {
                    label,
                    value,
                };
            })
            .filter(Boolean);
    };

    /* =====================================================
       SAVE / UPDATE
    ===================================================== */

    const handleSave = async () => {
        if (!selectedCompany) {
            toast.error(
                "Please select company"
            );
            return;
        }

        if (!selectedWebsite) {
            toast.error(
                "Please select website"
            );
            return;
        }

        const cleanedForm =
            cleanContactData(form);

        if (
            cleanedForm.length ===
            0
        ) {
            toast.error(
                "Please add contact information"
            );
            return;
        }

        try {
            let updated = [];

            /* =============================================
               UPDATE
            ============================================= */

            if (
                isEditing &&
                editIndex !== null
            ) {
                updated = [
                    ...contactInfo,
                ];

                updated[editIndex] =
                    cleanedForm[0];
            }

            /* =============================================
               NEW SAVE
            ============================================= */

            else {
                updated = [
                    ...contactInfo,
                    ...cleanedForm,
                ];
            }

            /* =============================================
               FIRESTORE SAVE
            ============================================= */

            await import(
                "firebase/firestore"
            ).then(
                async ({
                    setDoc,
                }) => {
                    await setDoc(
                        getDocRef(
                            selectedWebsite
                        ),
                        {
                            contactInfo:
                                updated,
                        },
                        {
                            merge: true,
                        }
                    );
                }
            );

            setContactInfo(updated);

            setForm([
                {
                    label: "",
                    value: "",
                },
            ]);

            setIsEditing(false);

            setEditIndex(null);

            toast.success(
                isEditing
                    ? "Updated Successfully"
                    : "Saved Successfully"
            );
        } catch (error) {
            console.error(
                "CONTACT SAVE ERROR:",
                error
            );

            toast.error(
                error?.message ||
                "Something went wrong while saving"
            );
        }
    };

    /* =====================================================
       EDIT
    ===================================================== */

    const handleEdit = (
        index
    ) => {
        const selected =
            contactInfo[index];

        if (!selected) {
            return;
        }

        setForm([
            {
                label:
                    selected.label ||
                    "",

                value: Array.isArray(
                    selected.value
                )
                    ? [
                        ...selected.value,
                    ]
                    : selected.value ||
                    "",
            },
        ]);

        setEditIndex(index);

        setIsEditing(true);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    /* =====================================================
       DELETE
    ===================================================== */

    const deleteField = (
        index
    ) => {
        setDeleteIndex(index);

        setIsModalOpen(true);
    };

    /* =====================================================
       CONFIRM DELETE
    ===================================================== */

    const confirmDelete = async () => {
        if (
            deleteIndex === null
        ) {
            return;
        }

        if (!selectedWebsite) {
            toast.error(
                "Please select website"
            );
            return;
        }

        try {
            const updated =
                contactInfo.filter(
                    (_, index) =>
                        index !==
                        deleteIndex
                );

            const { setDoc } =
                await import(
                    "firebase/firestore"
                );

            await setDoc(
                getDocRef(
                    selectedWebsite
                ),
                {
                    contactInfo:
                        updated,
                },
                {
                    merge: true,
                }
            );

            setContactInfo(updated);

            setDeleteIndex(null);

            setIsModalOpen(false);

            toast.success(
                "Deleted successfully"
            );
        } catch (error) {
            console.error(
                "DELETE ERROR:",
                error
            );

            toast.error(
                error?.message ||
                "Delete failed"
            );
        }
    };

    /* =====================================================
       TOGGLE COPY TARGET
    ===================================================== */

    const toggleTargetWebsite = (
        website
    ) => {
        if (
            website ===
            copySourceWebsite
        ) {
            return;
        }

        setCopyTargetWebsites(
            (prev) => {
                if (
                    prev.includes(
                        website
                    )
                ) {
                    return prev.filter(
                        (item) =>
                            item !==
                            website
                    );
                }

                return [
                    ...prev,
                    website,
                ];
            }
        );
    };

    /* =====================================================
       SELECT ALL
    ===================================================== */

    const selectAllTargets = () => {
        if (!selectedCompany) {
            toast.error(
                "Please select company first"
            );
            return;
        }

        if (!copySourceWebsite) {
            toast.error(
                "Please select source website first"
            );
            return;
        }

        const websites =
            COMPANY_WEBSITES[
            selectedCompany
            ] || [];

        const targets =
            websites.filter(
                (website) =>
                    website !==
                    copySourceWebsite
            );

        setCopyTargetWebsites(
            targets
        );
    };

    /* =====================================================
       CLEAR ALL
    ===================================================== */

    const clearAllTargets = () => {
        setCopyTargetWebsites([]);
    };

    /* =====================================================
       COPY TO SELECTED
    ===================================================== */

    const copyContactToSelected =
        async () => {
            if (!selectedCompany) {
                toast.error(
                    "Please select company"
                );
                return;
            }

            if (!copySourceWebsite) {
                toast.error(
                    "Please select source website"
                );
                return;
            }

            if (
                copyTargetWebsites.length ===
                0
            ) {
                toast.error(
                    "Please select at least one target website"
                );
                return;
            }

            /* =========================================
               SOURCE KO TARGET SE REMOVE
            ========================================= */

            const targets =
                copyTargetWebsites.filter(
                    (website) =>
                        website !==
                        copySourceWebsite
                );

            if (
                targets.length ===
                0
            ) {
                toast.error(
                    "No target websites selected"
                );
                return;
            }

            setCopyLoading(true);

            try {
                /* =========================================
                   FRESH SOURCE DATA
                ========================================= */

                const sourceSnap =
                    await getDoc(
                        getDocRef(
                            copySourceWebsite
                        )
                    );

                if (
                    !sourceSnap.exists()
                ) {
                    toast.error(
                        `${copySourceWebsite} ka contact document nahi mila`
                    );
                    return;
                }

                const sourceData =
                    sourceSnap.data()
                        ?.contactInfo ||
                    [];

                if (
                    !Array.isArray(
                        sourceData
                    ) ||
                    sourceData.length ===
                    0
                ) {
                    toast.error(
                        `${copySourceWebsite} mein contact information nahi hai`
                    );
                    return;
                }

                /* =========================================
                   CLEAN SOURCE
                ========================================= */

                const cleanedSource =
                    cleanContactData(
                        sourceData
                    );

                if (
                    cleanedSource.length ===
                    0
                ) {
                    toast.error(
                        "Source contact data empty hai"
                    );
                    return;
                }

                /* =========================================
                   BATCH
                ========================================= */

                const batch =
                    writeBatch(db);

                targets.forEach(
                    (website) => {
                        const targetRef =
                            getDocRef(
                                website
                            );

                        batch.set(
                            targetRef,
                            {
                                contactInfo:
                                    cleanedSource,
                            },
                            {
                                merge: true,
                            }
                        );
                    }
                );

                /* =========================================
                   SAVE ALL
                ========================================= */

                await batch.commit();

                /* =========================================
                   UPDATE UI
                ========================================= */

                setSourceContactInfo(
                    cleanedSource
                );

                if (
                    targets.includes(
                        selectedWebsite
                    )
                ) {
                    setContactInfo(
                        cleanedSource
                    );
                }

                toast.success(
                    `Contact copied successfully to ${targets.length} website${targets.length > 1 ? "s" : ""}`
                );
            } catch (error) {
                console.error(
                    "COPY SELECTED ERROR:",
                    error
                );

                if (
                    error?.code ===
                    "permission-denied"
                ) {
                    toast.error(
                        "Firestore permission denied"
                    );
                } else {
                    toast.error(
                        error?.message ||
                        "Contact copy failed"
                    );
                }
            } finally {
                setCopyLoading(false);
            }
        };

    /* =====================================================
       COPY TO ALL
    ===================================================== */

    const copyContactToAll =
        async () => {
            if (!selectedCompany) {
                toast.error(
                    "Please select company"
                );
                return;
            }

            if (!copySourceWebsite) {
                toast.error(
                    "Please select source website"
                );
                return;
            }

            setCopyLoading(true);

            try {
                /* =========================================
                   FRESH SOURCE
                ========================================= */

                const sourceSnap =
                    await getDoc(
                        getDocRef(
                            copySourceWebsite
                        )
                    );

                if (
                    !sourceSnap.exists()
                ) {
                    toast.error(
                        `${copySourceWebsite} ka contact document nahi mila`
                    );
                    return;
                }

                const sourceData =
                    sourceSnap.data()
                        ?.contactInfo ||
                    [];

                if (
                    !Array.isArray(
                        sourceData
                    ) ||
                    sourceData.length ===
                    0
                ) {
                    toast.error(
                        `${copySourceWebsite} mein contact information nahi hai`
                    );
                    return;
                }

                /* =========================================
                   CLEAN
                ========================================= */

                const cleanedSource =
                    cleanContactData(
                        sourceData
                    );

                if (
                    cleanedSource.length ===
                    0
                ) {
                    toast.error(
                        "Source contact data empty hai"
                    );
                    return;
                }

                /* =========================================
                   TARGETS
                ========================================= */

                const websites =
                    COMPANY_WEBSITES[
                    selectedCompany
                    ] || [];

                const targets =
                    websites.filter(
                        (website) =>
                            website !==
                            copySourceWebsite
                    );

                if (
                    targets.length ===
                    0
                ) {
                    toast.error(
                        "No target websites found"
                    );
                    return;
                }

                /* =========================================
                   BATCH
                ========================================= */

                const batch =
                    writeBatch(db);

                targets.forEach(
                    (website) => {
                        batch.set(
                            getDocRef(
                                website
                            ),
                            {
                                contactInfo:
                                    cleanedSource,
                            },
                            {
                                merge: true,
                            }
                        );
                    }
                );

                /* =========================================
                   COMMIT
                ========================================= */

                await batch.commit();

                /* =========================================
                   UI UPDATE
                ========================================= */

                setSourceContactInfo(
                    cleanedSource
                );

                setCopyTargetWebsites(
                    targets
                );

                if (
                    targets.includes(
                        selectedWebsite
                    )
                ) {
                    setContactInfo(
                        cleanedSource
                    );
                }

                toast.success(
                    `Contact copied successfully to all ${targets.length} websites`
                );
            } catch (error) {
                console.error(
                    "COPY ALL ERROR:",
                    error
                );

                if (
                    error?.code ===
                    "permission-denied"
                ) {
                    toast.error(
                        "Firestore permission denied"
                    );
                } else {
                    toast.error(
                        error?.message ||
                        "Copy to all failed"
                    );
                }
            } finally {
                setCopyLoading(false);
            }
        };

    /* =====================================================
       LOAD SOURCE INTO FORM
    ===================================================== */

    const loadSourceIntoForm =
        () => {
            if (
                sourceContactInfo.length ===
                0
            ) {
                toast.error(
                    "Source website has no contact information"
                );
                return;
            }

            setForm(
                sourceContactInfo.map(
                    (item) => ({
                        label:
                            item?.label ||
                            "",

                        value:
                            Array.isArray(
                                item?.value
                            )
                                ? [
                                    ...item.value,
                                ]
                                : item?.value ||
                                "",
                    })
                )
            );

            setIsEditing(false);

            setEditIndex(null);

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });

            toast.success(
                "Source contact loaded into form"
            );
        };

    /* =====================================================
       MODAL
    ===================================================== */

    useEffect(() => {
        Modal.setAppElement("body");
    }, []);

    /* =====================================================
       RENDER
    ===================================================== */

    return (
        <div className="wrapper">
            <div className="main">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="top-header">
                    <div className="page-path">
                        {pathParts.map(
                            (
                                part,
                                index
                            ) => (
                                <span
                                    key={
                                        index
                                    }
                                >
                                    {part
                                        .charAt(
                                            0
                                        )
                                        .toUpperCase() +
                                        part.slice(
                                            1
                                        )}

                                    {index !==
                                        pathParts.length -
                                        1 &&
                                        " > "}
                                </span>
                            )
                        )}
                    </div>

                    <h1 className="heading">
                        Contact Info Admin
                    </h1>
                </div>

                {/* =================================================
                    SELECT COMPANY + WEBSITE
                ================================================= */}

                <div className="card">
                    <h2>
                        Select Website
                    </h2>

                    <div
                        style={{
                            display:
                                "flex",
                            gap: "15px",
                            marginTop:
                                "15px",
                            flexWrap:
                                "wrap",
                        }}
                    >
                        <select
                            value={
                                selectedCompany
                            }
                            onChange={
                                handleCompanyChange
                            }
                        >
                            <option value="">
                                Please Select
                                Company
                            </option>

                            <option value="human">
                                Human Biomedical
                            </option>

                            <option value="global">
                                Global Biomedical
                            </option>

                            <option value="rajbiosis">
                                RajBiosis
                            </option>
                        </select>

                        {selectedCompany && (
                            <select
                                value={
                                    selectedWebsite
                                }
                                onChange={
                                    handleWebsiteChange
                                }
                            >
                                <option value="">
                                    Select Website
                                </option>

                                {COMPANY_WEBSITES[
                                    selectedCompany
                                ].map(
                                    (
                                        site
                                    ) => (
                                        <option
                                            key={
                                                site
                                            }
                                            value={
                                                site
                                            }
                                        >
                                            {
                                                site
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        )}
                    </div>
                </div>

                {/* =================================================
                    COPY CONTACT
                ================================================= */}

                {selectedCompany && (
                    <div
                        className="card"
                        style={{
                            border:
                                "2px solid #e0e7ff",
                        }}
                    >
                        <div
                            style={{
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                gap: "10px",
                                marginBottom:
                                    "20px",
                            }}
                        >
                            <Copy
                                size={22}
                                color="#4f46e5"
                            />

                            <h2
                                style={{
                                    margin: 0,
                                }}
                            >
                                Copy Contact
                            </h2>
                        </div>

                        {/* ===============================
                            COPY FROM
                        =============================== */}

                        <div
                            style={{
                                marginBottom:
                                    "20px",
                            }}
                        >
                            <label
                                style={{
                                    display:
                                        "block",
                                    fontWeight:
                                        "600",
                                    marginBottom:
                                        "8px",
                                }}
                            >
                                Copy From
                            </label>

                            <select
                                value={
                                    copySourceWebsite
                                }
                                onChange={(
                                    e
                                ) => {
                                    setCopySourceWebsite(
                                        e
                                            .target
                                            .value
                                    );

                                    setCopyTargetWebsites(
                                        []
                                    );
                                }}
                                style={{
                                    width:
                                        "100%",
                                    maxWidth:
                                        "450px",
                                }}
                            >
                                <option value="">
                                    Select Source
                                    Website
                                </option>

                                {COMPANY_WEBSITES[
                                    selectedCompany
                                ].map(
                                    (
                                        site
                                    ) => (
                                        <option
                                            key={
                                                site
                                            }
                                            value={
                                                site
                                            }
                                        >
                                            {
                                                site
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {/* ===============================
                            SOURCE PREVIEW
                        =============================== */}

                        {copySourceWebsite && (
                            <div
                                style={{
                                    background:
                                        "#f8fafc",
                                    border:
                                        "1px solid #e2e8f0",
                                    borderRadius:
                                        "12px",
                                    padding:
                                        "15px",
                                    marginBottom:
                                        "20px",
                                }}
                            >
                                <div
                                    style={{
                                        display:
                                            "flex",
                                        justifyContent:
                                            "space-between",
                                        alignItems:
                                            "center",
                                        gap:
                                            "10px",
                                        flexWrap:
                                            "wrap",
                                    }}
                                >
                                    <div>
                                        <strong>
                                            Source:
                                        </strong>{" "}
                                        {
                                            copySourceWebsite
                                        }

                                        <div
                                            style={{
                                                fontSize:
                                                    "13px",
                                                color:
                                                    "#64748b",
                                                marginTop:
                                                    "5px",
                                            }}
                                        >
                                            {
                                                sourceContactInfo.length
                                            }{" "}
                                            contact
                                            field
                                            {sourceContactInfo.length !==
                                                1
                                                ? "s"
                                                : ""}{" "}
                                            found
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="edit"
                                        onClick={
                                            loadSourceIntoForm
                                        }
                                        disabled={
                                            sourceContactInfo.length ===
                                            0
                                        }
                                        style={{
                                            display:
                                                "flex",
                                            alignItems:
                                                "center",
                                            gap:
                                                "6px",
                                        }}
                                    >
                                        <RefreshCw
                                            size={
                                                15
                                            }
                                        />

                                        Load Into
                                        Form
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ===============================
                            COPY TO HEADER
                        =============================== */}

                        <div
                            style={{
                                display:
                                    "flex",
                                justifyContent:
                                    "space-between",
                                alignItems:
                                    "center",
                                marginBottom:
                                    "12px",
                                flexWrap:
                                    "wrap",
                                gap:
                                    "10px",
                            }}
                        >
                            <label
                                style={{
                                    fontWeight:
                                        "600",
                                }}
                            >
                                Copy To
                            </label>

                            <div
                                style={{
                                    display:
                                        "flex",
                                    gap:
                                        "8px",
                                }}
                            >
                                <button
                                    type="button"
                                    className="edit"
                                    onClick={
                                        selectAllTargets
                                    }
                                    disabled={
                                        !copySourceWebsite
                                    }
                                >
                                    Select All
                                </button>

                                <button
                                    type="button"
                                    className="delete"
                                    onClick={
                                        clearAllTargets
                                    }
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* ===============================
                            TARGET WEBSITES
                        =============================== */}

                        <div
                            style={{
                                display:
                                    "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fill, minmax(240px, 1fr))",
                                gap:
                                    "10px",
                                marginBottom:
                                    "20px",
                            }}
                        >
                            {COMPANY_WEBSITES[
                                selectedCompany
                            ].map(
                                (
                                    site
                                ) => {
                                    const isSource =
                                        site ===
                                        copySourceWebsite;

                                    const isChecked =
                                        copyTargetWebsites.includes(
                                            site
                                        );

                                    return (
                                        <label
                                            key={
                                                site
                                            }
                                            style={{
                                                display:
                                                    "flex",
                                                alignItems:
                                                    "center",
                                                gap:
                                                    "10px",
                                                padding:
                                                    "12px",
                                                border:
                                                    isChecked
                                                        ? "2px solid #6366f1"
                                                        : "1px solid #e2e8f0",
                                                background:
                                                    isChecked
                                                        ? "#eef2ff"
                                                        : "#fff",
                                                borderRadius:
                                                    "10px",
                                                cursor:
                                                    isSource
                                                        ? "not-allowed"
                                                        : "pointer",
                                                opacity:
                                                    isSource
                                                        ? 0.5
                                                        : 1,
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={
                                                    isChecked
                                                }
                                                disabled={
                                                    isSource
                                                }
                                                onChange={() =>
                                                    toggleTargetWebsite(
                                                        site
                                                    )
                                                }
                                            />

                                            <span>
                                                {
                                                    site
                                                }

                                                {isSource && (
                                                    <small
                                                        style={{
                                                            display:
                                                                "block",
                                                            color:
                                                                "#64748b",
                                                            marginTop:
                                                                "2px",
                                                        }}
                                                    >
                                                        Source
                                                    </small>
                                                )}
                                            </span>

                                            {isChecked && (
                                                <Check
                                                    size={
                                                        17
                                                    }
                                                    color="#4f46e5"
                                                    style={{
                                                        marginLeft:
                                                            "auto",
                                                    }}
                                                />
                                            )}
                                        </label>
                                    );
                                }
                            )}
                        </div>

                        {/* ===============================
                            COPY BUTTONS
                        =============================== */}

                        <div
                            style={{
                                display:
                                    "flex",
                                gap:
                                    "10px",
                                flexWrap:
                                    "wrap",
                            }}
                        >
                            <button
                                type="button"
                                className="add-btn"
                                onClick={
                                    copyContactToSelected
                                }
                                disabled={
                                    copyLoading ||
                                    !copySourceWebsite ||
                                    copyTargetWebsites.length ===
                                    0
                                }
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    gap:
                                        "8px",
                                    opacity:
                                        copyLoading ||
                                            !copySourceWebsite ||
                                            copyTargetWebsites.length ===
                                            0
                                            ? 0.5
                                            : 1,
                                }}
                            >
                                <Copy
                                    size={
                                        16
                                    }
                                />

                                {copyLoading
                                    ? "Copying..."
                                    : `Copy to Selected (${copyTargetWebsites.length})`}
                            </button>

                            <button
                                type="button"
                                className="edit"
                                onClick={
                                    copyContactToAll
                                }
                                disabled={
                                    copyLoading ||
                                    !copySourceWebsite
                                }
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    gap:
                                        "8px",
                                    opacity:
                                        copyLoading ||
                                            !copySourceWebsite
                                            ? 0.5
                                            : 1,
                                }}
                            >
                                <Copy
                                    size={
                                        16
                                    }
                                />

                                Copy to All
                            </button>
                        </div>

                        {/* ===============================
                            SELECTED COUNT
                        =============================== */}

                        {copyTargetWebsites.length >
                            0 && (
                                <div
                                    style={{
                                        marginTop:
                                            "15px",
                                        fontSize:
                                            "13px",
                                        color:
                                            "#475569",
                                    }}
                                >
                                    <strong>
                                        {
                                            copyTargetWebsites.length
                                        }
                                    </strong>{" "}
                                    website
                                    {copyTargetWebsites.length !==
                                        1
                                        ? "s"
                                        : ""}{" "}
                                    selected for
                                    copying.
                                </div>
                            )}
                    </div>
                )}

                {/* =================================================
                    ADD / EDIT FORM
                ================================================= */}

                {selectedWebsite && (
                    <div className="card">
                        <h2>
                            {isEditing
                                ? "Edit Field"
                                : "Add Field"}
                        </h2>

                        {form.map(
                            (
                                item,
                                index
                            ) => (
                                <div
                                    key={
                                        index
                                    }
                                    style={{
                                        display:
                                            "flex",
                                        gap:
                                            "10px",
                                        marginBottom:
                                            "10px",
                                        alignItems:
                                            "flex-start",
                                    }}
                                >
                                    {/* LABEL */}

                                    <input
                                        name="label"
                                        placeholder="Label"
                                        value={
                                            item.label
                                        }
                                        onChange={(
                                            e
                                        ) =>
                                            handleChange(
                                                index,
                                                e
                                            )
                                        }
                                        style={{
                                            width:
                                                "250px",
                                            height:
                                                "48px",
                                            fontSize:
                                                "15px",
                                        }}
                                    />

                                    {/* VALUE */}

                                    {item.label
                                        .trim()
                                        .toLowerCase() ===
                                        "phone" ? (
                                        <div
                                            style={{
                                                flex:
                                                    1,
                                                display:
                                                    "flex",
                                                flexDirection:
                                                    "column",
                                                gap:
                                                    "10px",
                                            }}
                                        >
                                            {(Array.isArray(
                                                item.value
                                            )
                                                ? item.value
                                                : [
                                                    item.value ||
                                                    "",
                                                ]
                                            ).map(
                                                (
                                                    phone,
                                                    phoneIndex
                                                ) => (
                                                    <div
                                                        key={
                                                            phoneIndex
                                                        }
                                                        style={{
                                                            display:
                                                                "flex",
                                                            gap:
                                                                "10px",
                                                        }}
                                                    >
                                                        <input
                                                            type="text"
                                                            placeholder={`Phone Number ${phoneIndex + 1}`}
                                                            value={
                                                                phone
                                                            }
                                                            onChange={(
                                                                e
                                                            ) =>
                                                                updatePhoneNumber(
                                                                    index,
                                                                    phoneIndex,
                                                                    e
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                            style={{
                                                                flex:
                                                                    1,
                                                                height:
                                                                    "48px",
                                                                fontSize:
                                                                    "15px",
                                                            }}
                                                        />

                                                        {Array.isArray(
                                                            item.value
                                                        ) &&
                                                            item
                                                                .value
                                                                .length >
                                                            1 && (
                                                                <button
                                                                    type="button"
                                                                    className="remove-btn"
                                                                    onClick={() =>
                                                                        removePhoneNumber(
                                                                            index,
                                                                            phoneIndex
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2
                                                                        size={
                                                                            18
                                                                        }
                                                                    />
                                                                </button>
                                                            )}
                                                    </div>
                                                )
                                            )}

                                            <button
                                                type="button"
                                                className="add-btn"
                                                onClick={() =>
                                                    addPhoneNumber(
                                                        index
                                                    )
                                                }
                                                style={{
                                                    alignSelf:
                                                        "flex-start",
                                                }}
                                            >
                                                + Add Phone
                                                Number
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            name="value"
                                            placeholder="Value"
                                            value={
                                                item.value
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                handleChange(
                                                    index,
                                                    e
                                                )
                                            }
                                            style={{
                                                flex:
                                                    1,
                                                height:
                                                    "48px",
                                                fontSize:
                                                    "15px",
                                            }}
                                        />
                                    )}

                                    {/* REMOVE FIELD */}

                                    {form.length >
                                        1 && (
                                            <button
                                                type="button"
                                                className="remove-btn"
                                                onClick={() =>
                                                    setForm(
                                                        (
                                                            prev
                                                        ) =>
                                                            prev.filter(
                                                                (
                                                                    _,
                                                                    i
                                                                ) =>
                                                                    i !==
                                                                    index
                                                            )
                                                    )
                                                }
                                            >
                                                <Trash2
                                                    size={
                                                        18
                                                    }
                                                />
                                            </button>
                                        )}
                                </div>
                            )
                        )}

                        {/* ACTIONS */}

                        <div className="actions">
                            <button
                                type="button"
                                className="add-btn"
                                onClick={
                                    addNewField
                                }
                            >
                                + Add More
                            </button>

                            <button
                                type="button"
                                className="add-btn"
                                onClick={
                                    handleSave
                                }
                            >
                                {isEditing
                                    ? "Update"
                                    : "Save"}
                            </button>

                            {isEditing && (
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => {
                                        setForm([
                                            {
                                                label:
                                                    "",
                                                value:
                                                    "",
                                            },
                                        ]);

                                        setIsEditing(
                                            false
                                        );

                                        setEditIndex(
                                            null
                                        );
                                    }}
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* =================================================
                    PREVIEW
                ================================================= */}

                {selectedCompany &&
                    selectedWebsite && (
                        <div className="card">
                            <div
                                style={{
                                    display:
                                        "flex",
                                    justifyContent:
                                        "space-between",
                                    alignItems:
                                        "center",
                                    marginBottom:
                                        "20px",
                                    flexWrap:
                                        "wrap",
                                    gap:
                                        "10px",
                                }}
                            >
                                <div
                                    style={{
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        gap:
                                            "15px",
                                    }}
                                >
                                    <h2
                                        style={{
                                            margin:
                                                0,
                                        }}
                                    >
                                        Preview
                                    </h2>

                                    <span
                                        style={{
                                            background:
                                                "#eef2ff",
                                            color:
                                                "#4338ca",
                                            padding:
                                                "8px 14px",
                                            borderRadius:
                                                "999px",
                                            fontSize:
                                                "13px",
                                            fontWeight:
                                                "600",
                                        }}
                                    >
                                        {
                                            selectedWebsite
                                        }
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div
                                    style={{
                                        padding:
                                            "30px",
                                        textAlign:
                                            "center",
                                        color:
                                            "#64748b",
                                    }}
                                >
                                    Loading...
                                </div>
                            ) : contactInfo.length ===
                                0 ? (
                                <div className="no-data">
                                    No Data Found
                                </div>
                            ) : (
                                <div
                                    style={{
                                        overflowX:
                                            "auto",
                                    }}
                                >
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>
                                                    Label
                                                </th>

                                                <th>
                                                    Value
                                                </th>

                                                <th
                                                    style={{
                                                        width:
                                                            "150px",
                                                        textAlign:
                                                            "center",
                                                    }}
                                                >
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {contactInfo.map(
                                                (
                                                    item,
                                                    index
                                                ) => (
                                                    <tr
                                                        key={
                                                            index
                                                        }
                                                    >
                                                        <td>
                                                            {
                                                                item.label
                                                            }
                                                        </td>

                                                        <td>
                                                            {Array.isArray(
                                                                item.value
                                                            ) ? (
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        flexDirection:
                                                                            "column",
                                                                        gap:
                                                                            "6px",
                                                                    }}
                                                                >
                                                                    {item.value.map(
                                                                        (
                                                                            value,
                                                                            valueIndex
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    valueIndex
                                                                                }
                                                                            >
                                                                                {
                                                                                    value
                                                                                }
                                                                            </span>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                item.value
                                                            )}
                                                        </td>

                                                        <td
                                                            style={{
                                                                textAlign:
                                                                    "center",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    justifyContent:
                                                                        "center",
                                                                    gap:
                                                                        "8px",
                                                                }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    className="edit"
                                                                    onClick={() =>
                                                                        handleEdit(
                                                                            index
                                                                        )
                                                                    }
                                                                >
                                                                    Edit
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="remove-btn"
                                                                    onClick={() =>
                                                                        deleteField(
                                                                            index
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2
                                                                        size={
                                                                            18
                                                                        }
                                                                    />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
            </div>

            {/* =====================================================
                DELETE MODAL
            ===================================================== */}

            <Modal
                isOpen={
                    isModalOpen
                }
                onRequestClose={() =>
                    setIsModalOpen(
                        false
                    )
                }
                className="modal-box"
                overlayClassName="modal-overlay"
            >
                <div className="modal-content">
                    <h2>
                        Delete Field
                    </h2>

                    <p>
                        Are you sure you
                        want to delete
                        this?
                    </p>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={() =>
                                setIsModalOpen(
                                    false
                                )
                            }
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="delete-btn"
                            onClick={
                                confirmDelete
                            }
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}