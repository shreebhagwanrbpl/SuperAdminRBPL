"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
        "tublerin"
    ],
    qlyte: [
        "qlyte"
    ]
};
export default function ServicesAdmin() {
    const [services, setServices] = useState([{ title: "", desc: "" }]);
    const [savedServices, setSavedServices] = useState([]);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedWebsite, setSelectedWebsite] = useState("");
    const [allWebsiteData, setAllWebsiteData] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);
    const getDocRef = (website) =>
        doc(
            db,
            "websites",
            website,
            "pages",
            "services"
        );
    // 🔥 LOAD DATA
    useEffect(() => {

        const load = async () => {

            if (!selectedCompany || !selectedWebsite) {
                setSavedServices([]);
                return;
            }

            if (selectedWebsite === "all") {

                const data = [];

                for (const website of COMPANY_WEBSITES[selectedCompany]) {

                    const snap = await getDoc(
                        getDocRef(website)
                    );

                    data.push({
                        website,
                        services:
                            snap.exists()
                                ? snap.data().services || []
                                : [],
                    });

                }

                setAllWebsiteData(data);
                return;
            }

            const snap = await getDoc(
                getDocRef(selectedWebsite)
            );

            if (snap.exists()) {
                setSavedServices(
                    snap.data().services || []
                );
            }

        };

        load();

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
        if (services.length === 1) return toast.error("At least one required");

        const updated = services.filter((_, i) => i !== index);
        setServices(updated);
    };

    // 🔥 SAVE (APPEND FIX)
    const saveServices = async () => {

        try {

            let updatedServices = [];

            // UPDATE MODE
            if (isEditing) {

                updatedServices = services.filter(
                    item =>
                        item.title?.trim() &&
                        item.desc?.trim()
                );

            } else {

                // NEW SAVE
                updatedServices = [
                    ...savedServices,
                    ...services.filter(
                        item =>
                            item.title?.trim() &&
                            item.desc?.trim()
                    )
                ];

            }

            const targets =
                selectedWebsite === "all"
                    ? COMPANY_WEBSITES[selectedCompany]
                    : [selectedWebsite];

            for (const website of targets) {

                await setDoc(
                    getDocRef(website),
                    {
                        services: updatedServices
                    },
                    {
                        merge: true
                    }
                );

            }

            setSavedServices(updatedServices);

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
                    : "Saved Successfully"
            );

        } catch (error) {

            console.error(error);
            toast.error("Something went wrong");

        }

    };

    // 🔥 EDIT (LOAD ALL DATA)
    const handleEdit = () => {

        setServices(
            savedServices.map(item => ({
                ...item
            }))
        );

        setIsEditing(true);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    };

    // 🔥 DELETE CONFIRM
    const confirmDelete = async () => {
        if (deleteIndex === null) return;

        const updated = savedServices.filter((_, i) => i !== deleteIndex);

        await setDoc(
            doc(db, "websites", "indiandiagnostic", "pages", "services"),
            { services: updated }
        );

        setSavedServices(updated);

        if (updated.length === 0) {
            setServices([{ title: "", desc: "" }]);
        }

        setDeleteIndex(null);
    };

    const pathname = usePathname();
    const pathParts = pathname
        .split("/")
        .filter(Boolean);

    return (
        <div className="wrapper">
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
                            </select>

                            {selectedCompany && (

                                <select
                                    value={selectedWebsite}
                                    onChange={(e) =>
                                        setSelectedWebsite(e.target.value)
                                    }
                                >

                                    <option value="">
                                        Select Website
                                    </option>

                                    <option value="all">
                                        All Websites
                                    </option>

                                    {COMPANY_WEBSITES[selectedCompany].map(
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
                    <h2>Add / Edit Services</h2>

                    {services.map((item, i) => (
                        <div className="service-row" key={i}>
                            <input
                                placeholder="Title"
                                value={item.title}
                                onChange={(e) =>
                                    handleChange(i, "title", e.target.value)
                                }
                            />

                            <input
                                placeholder="Description"
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
                        <button type="button" onClick={addService}>
                            + Add Servicesa
                        </button>
                        <button
                            className="add-btn"
                            type="button"
                            onClick={saveServices}
                        >
                            {isEditing ? "Update" : "Save"}
                        </button>
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

                                                await setDoc(
                                                    getDocRef(site.website),
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
                                    {site.services.length === 0 ? (

                                        <p>No Services Found</p>

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

                                                                setSelectedWebsite(site.website);

                                                                setDeleteIndex(i);

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

                                <button
                                    className="delete-btn"
                                    onClick={async () => {

                                        if (
                                            !confirm(
                                                `Delete all services from ${selectedWebsite}?`
                                            )
                                        ) return;

                                        await setDoc(
                                            getDocRef(selectedWebsite),
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

                            {savedServices.length === 0 ? (

                                <p>No Services Found</p>

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
                                                        setDeleteIndex(i);
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
                onRequestClose={() => setIsModalOpen(false)}
                className="modal-box"
                overlayClassName="modal-overlay"
            >
                <div className="modal-content">
                    <h2>Delete Service</h2>
                    <p>Are you sure you want to delete this service?</p>

                    <div className="modal-actions">
                        <button
                            className="cancel-btn"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancel
                        </button>

                        <button
                            className="delete-btn"
                            onClick={async () => {
                                await confirmDelete();
                                toast.success("Deleted successfully");
                                setIsModalOpen(false);
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
}