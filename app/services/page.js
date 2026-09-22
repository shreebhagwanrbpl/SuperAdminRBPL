"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "@/lib/sqliteFirestore";
import { db } from "@/lib/firebase";
import "./services.css";
import toast, { Toaster } from "react-hot-toast";
import Modal from "react-modal";
import { usePathname } from "next/navigation";

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
        "clinidixcom",
        "oleturcom",
        "indiandiagnosticscom",
        "cliakitsin",
        "radioimmunoassaycoin",
        "centralbiomedicalsin",
        "diagnostatcom",
        "diagnosticbloomcom",
        "diagnotexcom",
        "biohaloscom",
        "diagnosticsbloomcom",
        "globalhealthdirectorycom",
        "humanbiomedicalscom",
        "dxgelcom",
        "globalhealthcartcom",
        "medflixbiomedicalcom",
        "medflixbiomedicalscom",
        "qlysercom",
        "ichromain",
        "spinreactin",
        "rajvedcom",
        "coolpacksin",
        "hamarilabcom",
    ],
    qlyte: [
        "qlyte"
    ]
};

export default function ServicesAdmin() {
    const [services, setServices] = useState([{ title: "", desc: "" }]);
    const [savedServices, setSavedServices] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState({ website: "", index: null });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedWebsite, setSelectedWebsite] = useState("");
    const [allWebsiteData, setAllWebsiteData] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Modal.setAppElement("body");
    }, []);

    const getDocRef = (website) => {
        if (!website) return null;
        return doc(db, "websites", website, "pages", "services");
    };

    const getTargetWebsites = () => {
        if (!selectedCompany) return [];
        if (selectedWebsite === "all") {
            return COMPANY_WEBSITES[selectedCompany] || [];
        }
        return selectedWebsite ? [selectedWebsite] : [];
    };

    // 🔥 LOAD DATA
    const loadData = async () => {
        if (!selectedCompany || !selectedWebsite) {
            setSavedServices([]);
            setAllWebsiteData([]);
            return;
        }

        setLoading(true);
        try {
            if (selectedWebsite === "all") {
                const data = [];
                const siteList = COMPANY_WEBSITES[selectedCompany] || [];

                for (const website of siteList) {
                    const docRef = getDocRef(website);
                    if (!docRef) continue;
                    const snap = await getDoc(docRef);

                    data.push({
                        website,
                        services: snap.exists() ? snap.data().services || [] : [],
                    });
                }

                setAllWebsiteData(data);
                setSavedServices([]);
                return;
            }

            const docRef = getDocRef(selectedWebsite);
            if (!docRef) return;
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                setSavedServices(snap.data().services || []);
            } else {
                setSavedServices([]);
            }
        } catch (error) {
            console.error("Error loading services:", error);
            toast.error("Failed to load services");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedCompany, selectedWebsite]);

    // 🔥 INPUT CHANGE
    const handleChange = (index, field, value) => {
        const updated = [...services];
        updated[index][field] = value;
        setServices(updated);
    };

    // 🔥 ADD FIELD
    const addService = () => {
        setServices([...services, { title: "", desc: "" }]);
    };

    // 🔥 DELETE FIELD (FORM)
    const deleteService = (index) => {
        if (services.length === 1) return toast.error("At least one service row required");
        const updated = services.filter((_, i) => i !== index);
        setServices(updated);
    };

    // 🔥 SAVE / UPDATE SERVICES
    const saveServices = async () => {
        if (!selectedCompany) {
            toast.error("Please select a company first");
            return;
        }

        if (!selectedWebsite) {
            toast.error("Please select a website first");
            return;
        }

        const validServices = services.filter(
            item => item.title?.trim() && item.desc?.trim()
        );

        if (validServices.length === 0) {
            toast.error("Please fill in at least one service with title and description");
            return;
        }

        const targets = getTargetWebsites();
        if (targets.length === 0) {
            toast.error("Please select a valid website");
            return;
        }

        const toastId = toast.loading("Saving services...");

        try {
            let updatedServices = [];

            if (isEditing) {
                if (editIndex !== null && selectedWebsite !== "all") {
                    // Update single service in array
                    updatedServices = [...savedServices];
                    updatedServices[editIndex] = validServices[0];
                } else {
                    // Update full list
                    updatedServices = validServices;
                }
            } else {
                // Append new services
                updatedServices = [
                    ...savedServices,
                    ...validServices
                ];
            }

            for (const website of targets) {
                const docRef = getDocRef(website);
                if (!docRef) continue;
                await setDoc(
                    docRef,
                    {
                        services: updatedServices
                    },
                    {
                        merge: true
                    }
                );
            }

            if (selectedWebsite === "all") {
                await loadData();
            } else {
                setSavedServices(updatedServices);
            }

            setServices([
                {
                    title: "",
                    desc: ""
                }
            ]);

            setIsEditing(false);
            setEditIndex(null);

            toast.success(
                isEditing
                    ? "Updated Successfully"
                    : "Saved Successfully",
                { id: toastId }
            );

        } catch (error) {
            console.error("Error saving services:", error);
            toast.error("Something went wrong: " + (error.message || ""), { id: toastId });
        }
    };

    // 🔥 EDIT (LOAD ALL DATA)
    const handleEditAll = () => {
        if (savedServices.length === 0) {
            toast.error("No saved services to edit");
            return;
        }

        setServices(
            savedServices.map(item => ({
                ...item
            }))
        );

        setIsEditing(true);
        setEditIndex(null);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    // 🔥 DELETE CONFIRM
    const confirmDelete = async () => {
        if (deleteTarget.index === null || !deleteTarget.website) return;

        try {
            const docRef = getDocRef(deleteTarget.website);
            if (!docRef) return;

            let currentServices = [];
            if (selectedWebsite === "all") {
                const siteItem = allWebsiteData.find(s => s.website === deleteTarget.website);
                currentServices = siteItem ? siteItem.services || [] : [];
            } else {
                currentServices = savedServices;
            }

            const updated = currentServices.filter((_, i) => i !== deleteTarget.index);

            await setDoc(
                docRef,
                { services: updated },
                { merge: true }
            );

            if (selectedWebsite === "all") {
                setAllWebsiteData(prev =>
                    prev.map(item =>
                        item.website === deleteTarget.website
                            ? { ...item, services: updated }
                            : item
                    )
                );
            } else {
                setSavedServices(updated);
                if (updated.length === 0) {
                    setServices([{ title: "", desc: "" }]);
                }
            }

            toast.success("Deleted successfully");
        } catch (error) {
            console.error("Error deleting service:", error);
            toast.error("Failed to delete service");
        } finally {
            setDeleteTarget({ website: "", index: null });
            setIsModalOpen(false);
        }
    };

    const pathname = usePathname();
    const pathParts = pathname ? pathname.split("/").filter(Boolean) : ["services"];

    return (
        <div className="wrapper">
            <Toaster position="top-right" />
            <div className="main">

                <div className="top-header">

                    <div className="page-path">
                        {pathParts.map((part, index) => (
                            <span key={index}>
                                {part.charAt(0).toUpperCase() + part.slice(1)}
                                {index !== pathParts.length - 1 && " > "}
                            </span>
                        ))}
                    </div>

                    <h1 className="heading">Services Admin</h1>

                </div>

                <div className="card">

                    <h2>Select Website</h2>

                    <div
                        style={{
                            display: "flex",
                            gap: "15px",
                            marginTop: "15px",
                        }}
                    >
                        <div className="website-select-row">
                            <select
                                value={selectedCompany}
                                onChange={(e) => {
                                    setSelectedCompany(e.target.value);
                                    setSelectedWebsite("");
                                    setIsEditing(false);
                                    setEditIndex(null);
                                    setServices([{ title: "", desc: "" }]);
                                }}
                            >
                                <option value="">
                                    Please Select Company
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

                                <option value="qlyte">
                                    Qlyte
                                </option>
                            </select>

                            {selectedCompany && (

                                <select
                                    value={selectedWebsite}
                                    onChange={(e) => {
                                        setSelectedWebsite(e.target.value);
                                        setIsEditing(false);
                                        setEditIndex(null);
                                        setServices([{ title: "", desc: "" }]);
                                    }}
                                >

                                    <option value="">
                                        Select Website
                                    </option>

                                    <option value="all">
                                        All Websites
                                    </option>

                                    {COMPANY_WEBSITES[selectedCompany]?.map(
                                        (site) => (
                                            <option
                                                key={site}
                                                value={site}
                                            >
                                                {site}
                                            </option>
                                        )
                                    )}

                                </select>

                            )}
                        </div>
                    </div>

                </div>

                {/* FORM */}
                <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                        <h2 style={{ margin: 0 }}>
                            {isEditing ? (editIndex !== null ? `Edit Service #${editIndex + 1}` : "Edit Services") : "Add Services"}
                        </h2>
                        {isEditing && (
                            <span style={{ fontSize: "13px", color: "#4f46e5", fontWeight: "600", background: "#eef2ff", padding: "4px 10px", borderRadius: "6px" }}>
                                Editing Mode
                            </span>
                        )}
                    </div>

                    {services.map((item, i) => (
                        <div className="service-row" key={i}>
                            <input
                                placeholder="Service Title (e.g. Equipment Maintenance)"
                                value={item.title}
                                onChange={(e) =>
                                    handleChange(i, "title", e.target.value)
                                }
                            />

                            <input
                                placeholder="Service Description"
                                value={item.desc}
                                onChange={(e) =>
                                    handleChange(i, "desc", e.target.value)
                                }
                            />

                            <button
                                type="button"
                                className="delete-btn"
                                onClick={() => deleteService(i)}
                            >
                                Delete
                            </button>
                        </div>
                    ))}

                    <div className="actions">
                        {!isEditing && (
                            <button type="button" onClick={addService}>
                                + Add Service
                            </button>
                        )}
                        <button
                            className="add-btn"
                            type="button"
                            onClick={saveServices}
                        >
                            {isEditing ? "Update Service" : "Save Services"}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                style={{
                                    background: "#64748b",
                                    color: "#fff",
                                }}
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditIndex(null);
                                    setServices([{ title: "", desc: "" }]);
                                }}
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </div>

                {/* PREVIEW */}
                {selectedCompany && selectedWebsite && (

                    selectedWebsite === "all" ? (

                        <div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "20px"
                                }}
                            >
                                <h2>All Website Services</h2>

                                <span
                                    style={{
                                        background: "#eef2ff",
                                        color: "#4338ca",
                                        padding: "8px 14px",
                                        borderRadius: "999px",
                                        fontSize: "13px",
                                        fontWeight: "600"
                                    }}
                                >
                                    {allWebsiteData.length} Websites
                                </span>
                            </div>

                            {loading && <p>Loading services...</p>}

                            {allWebsiteData.map((site) => (

                                <div
                                    key={site.website}
                                    className="all-preview-card"
                                >

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "20px"
                                        }}
                                    >

                                        <h3
                                            style={{
                                                margin: 0,
                                                color: "#4338ca",
                                                fontSize: "18px",
                                                fontWeight: "700"
                                            }}
                                        >
                                            {site.website}
                                        </h3>

                                        <button
                                            className="delete-btn"
                                            onClick={async () => {

                                                if (
                                                    !confirm(
                                                        `Delete all services from ${site.website}?`
                                                    )
                                                ) return;

                                                const docRef = getDocRef(site.website);
                                                if (!docRef) return;

                                                await setDoc(
                                                    docRef,
                                                    {
                                                        services: []
                                                    },
                                                    {
                                                        merge: true
                                                    }
                                                );

                                                setAllWebsiteData(prev =>
                                                    prev.map(item =>
                                                        item.website === site.website
                                                            ? {
                                                                ...item,
                                                                services: []
                                                            }
                                                            : item
                                                    )
                                                );

                                                toast.success(
                                                    "All Services Deleted"
                                                );

                                            }}
                                        >
                                            Delete All
                                        </button>

                                    </div>
                                    {(!site.services || site.services.length === 0) ? (

                                        <p style={{ color: "#94a3b8" }}>No Services Found</p>

                                    ) : (

                                        <div className="preview-grid">

                                            {site.services.map((item, i) => (

                                                <div
                                                    className="preview-card"
                                                    key={i}
                                                >

                                                    <h4>{item.title}</h4>

                                                    <p>{item.desc}</p>

                                                    <div className="preview-actions">

                                                        <button
                                                            className="edit-btn"
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedWebsite(site.website);
                                                                setSavedServices(site.services || []);
                                                                setServices([{ ...item }]);
                                                                setEditIndex(i);
                                                                setIsEditing(true);

                                                                window.scrollTo({
                                                                    top: 0,
                                                                    behavior: "smooth"
                                                                });

                                                            }}
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="delete-btn"
                                                            onClick={() => {
                                                                setDeleteTarget({
                                                                    website: site.website,
                                                                    index: i
                                                                });
                                                                setIsModalOpen(true);
                                                            }}
                                                        >
                                                            Delete
                                                        </button>

                                                    </div>

                                                </div>

                                            ))}

                                        </div>

                                    )}

                                </div>

                            ))}

                        </div>

                    ) : (

                        <div className="preview">

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "20px"
                                }}
                            >

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "15px"
                                    }}
                                >

                                    <h2 style={{ margin: 0 }}>
                                        Saved Services
                                    </h2>

                                    <span
                                        style={{
                                            background: "#eef2ff",
                                            color: "#4338ca",
                                            padding: "8px 14px",
                                            borderRadius: "999px",
                                            fontSize: "13px",
                                            fontWeight: "600"
                                        }}
                                    >
                                        {selectedWebsite}
                                    </span>

                                </div>

                                <div style={{ display: "flex", gap: "10px" }}>
                                    {savedServices.length > 0 && !isEditing && (
                                        <button
                                            type="button"
                                            style={{
                                                background: "#4f46e5",
                                            }}
                                            onClick={handleEditAll}
                                        >
                                            Edit All
                                        </button>
                                    )}

                                    <button
                                        className="delete-btn"
                                        onClick={async () => {

                                            if (
                                                !confirm(
                                                    `Delete all services from ${selectedWebsite}?`
                                                )
                                            ) return;

                                            const docRef = getDocRef(selectedWebsite);
                                            if (!docRef) return;

                                            await setDoc(
                                                docRef,
                                                {
                                                    services: []
                                                },
                                                {
                                                    merge: true
                                                }
                                            );

                                            setSavedServices([]);

                                            toast.success(
                                                "All Services Deleted"
                                            );

                                        }}
                                    >
                                        Delete All
                                    </button>
                                </div>

                            </div>

                            {loading && <p>Loading services...</p>}

                            {(!savedServices || savedServices.length === 0) ? (

                                <p style={{ color: "#94a3b8" }}>No Services Found</p>

                            ) : (

                                <div className="preview-grid">

                                    {savedServices.map((item, i) => (

                                        <div
                                            className="preview-card"
                                            key={i}
                                        >

                                            <h4>{item.title}</h4>

                                            <p>{item.desc}</p>

                                            <div className="preview-actions">

                                                <button
                                                    className="edit-btn"
                                                    type="button"
                                                    onClick={() => {

                                                        setServices([{ ...item }]);

                                                        setEditIndex(i);

                                                        setIsEditing(true);

                                                        window.scrollTo({
                                                            top: 0,
                                                            behavior: "smooth"
                                                        });

                                                    }}
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className="delete-btn"
                                                    onClick={() => {
                                                        setDeleteTarget({
                                                            website: selectedWebsite,
                                                            index: i
                                                        });
                                                        setIsModalOpen(true);
                                                    }}
                                                >
                                                    Delete
                                                </button>

                                            </div>
                                        </div>

                                    ))}

                                </div>

                            )}

                        </div>

                    )

                )}

            </div>

            {/* REACT MODAL */}
            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => {
                    setDeleteTarget({ website: "", index: null });
                    setIsModalOpen(false);
                }}
                className="modal-box"
                overlayClassName="modal-overlay"
            >
                <div className="modal-content">
                    <h2>Delete Service</h2>
                    <p>Are you sure you want to delete this service{deleteTarget.website ? ` from ${deleteTarget.website}` : "" }?</p>

                    <div className="modal-actions">
                        <button
                            className="cancel-btn"
                            type="button"
                            onClick={() => {
                                setDeleteTarget({ website: "", index: null });
                                setIsModalOpen(false);
                            }}
                        >
                            Cancel
                        </button>

                        <button
                            className="delete-btn"
                            type="button"
                            onClick={confirmDelete}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
}