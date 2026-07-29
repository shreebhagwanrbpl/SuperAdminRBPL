"use client";
import Modal from "react-modal";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "./contact.css";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
const COMPANY_WEBSITES = {
    human: [
        "humanbiomedicalorg",
        "humanbiomedicalin",
        "humanbiomedicalsin",
        "humanbiomedicalsorg",
        "humanbiomedicalscoin",
        "humanbiomedicalcom",
    ],

    global: [
        "globalbiomedicalorg",
        "globalbiomedicalsin",
    ],

    rajbiosis: [
        "indiandiagnostic",
        "centralbiomedicals",
        "ozonexco",
        "aozellocom"
    ],
};
export default function AdminContact() {
    const pathname = usePathname();
    const pathParts = pathname
        .split("/")
        .filter(Boolean);

    const getDocRef = (website) =>
        doc(
            db,
            "websites",
            website,
            "pages",
            "contact"
        );

    const [contactInfo, setContactInfo] = useState([]);
    const [form, setForm] = useState([
        {
            label: "",
            value: "",
        },
    ]);
    const [editIndex, setEditIndex] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedWebsite, setSelectedWebsite] = useState("");
    const [allWebsiteData, setAllWebsiteData] = useState([]);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    // LOAD

    useEffect(() => {

        const load = async () => {

            setLoading(true);

            if (!selectedCompany || !selectedWebsite) {
                setContactInfo([]);
                setLoading(false);
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
                        contactInfo:
                            snap.exists()
                                ? snap.data().contactInfo || []
                                : [],
                    });
                }

                setAllWebsiteData(data);
                setContactInfo([]);
                setLoading(false);
                return;
            }

            const snap = await getDoc(
                getDocRef(selectedWebsite)
            );

            if (snap.exists()) {
                setContactInfo(
                    snap.data().contactInfo || []
                );
            } else {
                setContactInfo([]);
            }

            setLoading(false);
        };

        load();

    }, [selectedCompany, selectedWebsite]);

    const addNewField = () => {
        setForm([
            ...form,
            {
                label: "",
                value: "",
            },
        ]);
    };
    const handleChange = (index, e) => {
        const updated = [...form];

        updated[index][e.target.name] = e.target.value;

        setForm(updated);
    };

    // SAVE / UPDATE
    const handleSave = async () => {

        try {

            let updated = [];

            // UPDATE MODE
            if (isEditing) {

                updated = [...form];

            } else {

                // NEW SAVE
                updated = [
                    ...contactInfo,
                    ...form.filter(
                        item =>
                            item.label?.trim() &&
                            item.value?.trim()
                    )
                ];

            }

            setContactInfo(updated);

            const targets =
                selectedWebsite === "all"
                    ? COMPANY_WEBSITES[selectedCompany]
                    : [selectedWebsite];

            for (const website of targets) {

                await setDoc(
                    getDocRef(website),
                    {
                        contactInfo: updated
                    },
                    {
                        merge: true
                    }
                );

            }

            // reset form
            setForm([
                {
                    label: "",
                    value: ""
                }
            ]);

            // exit edit mode
            setIsEditing(false);

            toast.success(
                isEditing
                    ? "Updated Successfully"
                    : "Saved Successfully"
            );

        } catch (err) {

            console.error(err);

            toast.error(
                "Something went wrong"
            );

        }

    };

    // EDIT
    const handleEdit = (index) => {
        setForm(contactInfo[index]);
        setEditIndex(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // DELETE
    const deleteField = (index) => {
        setDeleteIndex(index);
        setIsModalOpen(true);
    };

    const confirmDelete = async () => {
        if (deleteIndex === null) return;

        const updated = contactInfo.filter((_, i) => i !== deleteIndex);
        setContactInfo(updated);

        const targets =
            selectedWebsite === "all"
                ? COMPANY_WEBSITES[selectedCompany]
                : [selectedWebsite];

        for (const website of targets) {

            await setDoc(
                getDocRef(website),
                { contactInfo: updated },
                { merge: true }
            );
        }

        setDeleteIndex(null);
        setIsModalOpen(false);

        toast.success("Deleted successfully");
    };
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);


    // if (loading)
    //     return (
    //         <div className="page-loader">
    //             <div className="loader-logo">
    //                 <span>RBPL</span>
    //             </div>

    //             <div className="loader-bar">
    //                 <div className="loader-progress">RBPL</div>
    //             </div>

    //             <p>Loading Contact Dashboard...</p>
    //         </div>
    //     );




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

                    <h1 className="heading">Contact Info Admin</h1>

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

                {/* FORM */}
                <div className="card">
                    <h2>{editIndex !== null ? "Edit Field" : "Add Field"}</h2>

                    {form.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                display: "flex",
                                gap: "10px",
                                marginBottom: "10px",
                            }}
                        >
                            <input
                                name="label"
                                placeholder="Label"
                                value={item.label}
                                onChange={(e) => handleChange(index, e)}
                                style={{
                                    width: "250px",
                                    height: "48px",
                                    fontSize: "15px"
                                }}
                            />

                            <input
                                name="value"
                                placeholder="Value"
                                value={item.value}
                                onChange={(e) => handleChange(index, e)}
                                style={{
                                    flex: 1,
                                    height: "48px",
                                    fontSize: "15px"
                                }}
                            />

                            {form.length > 1 && (
                                <button
                                    type="button"
                                    className="remove-btn"
                                    onClick={() =>
                                        setForm(form.filter((_, i) => i !== index))
                                    }
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    ))}


                    <div className="actions">
                        <button
                            type="button"
                            className="add-btn"
                            onClick={addNewField}
                        >
                            + Add More
                        </button>
                        <button
                            className="add-btn"
                            onClick={handleSave}
                        >
                            {isEditing ? "Update" : "Save"}
                        </button>
                    </div>
                </div>

                {/* 🔥 TABLE PREVIEW */}
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
                                <h2 style={{ margin: 0 }}>
                                    All Website Contact Preview
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
                                    {allWebsiteData.length} Websites
                                </span>
                            </div>

                            {allWebsiteData.map((site) => (

                                <div
                                    key={site.website}
                                    className="card"
                                >

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "15px"
                                        }}
                                    >

                                        <h3
                                            style={{
                                                margin: 0,
                                                color: "#4338ca"
                                            }}
                                        >
                                            {site.website}
                                        </h3>

                                        <button
                                            className="edit"
                                            onClick={() => {
                                                setSelectedWebsite(site.website);
                                                setContactInfo(site.contactInfo);
                                                setForm(site.contactInfo);
                                                setIsEditing(true);

                                                window.scrollTo({
                                                    top: 0,
                                                    behavior: "smooth"
                                                });
                                            }}
                                        >
                                            Edit
                                        </button>

                                    </div>

                                    {site.contactInfo.length === 0 ? (

                                        <p className="no-data">
                                            No Contact Data
                                        </p>

                                    ) : (

                                        <table
                                            style={{
                                                width: "100%",
                                                borderCollapse: "collapse"
                                            }}
                                        >
                                            <thead>
                                                <tr>
                                                    <th>Label</th>
                                                    <th>Value</th>
                                                    <th
                                                        style={{
                                                            width: "80px",
                                                            textAlign: "center"
                                                        }}
                                                    >
                                                        Delete
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>

                                                {site.contactInfo.map((item, i) => (

                                                    <tr key={i}>

                                                        <td>{item.label}</td>

                                                        <td>{item.value}</td>

                                                        <td
                                                            style={{
                                                                textAlign: "center"
                                                            }}
                                                        >
                                                            <button
                                                                className="remove-btn"
                                                                onClick={() => {
                                                                    setSelectedWebsite(site.website);
                                                                    deleteField(i);
                                                                }}
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>

                                                    </tr>

                                                ))}

                                            </tbody>

                                        </table>

                                    )}

                                </div>

                            ))}

                        </div>

                    ) : (

                        <div className="card">

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
                                        Preview
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
                                    className="edit"
                                    onClick={() => {
                                        setForm(contactInfo);
                                        setIsEditing(true);

                                        window.scrollTo({
                                            top: 0,
                                            behavior: "smooth"
                                        });
                                    }}
                                >
                                    Edit
                                </button>

                            </div>

                            {contactInfo.length === 0 ? (

                                <div className="no-data">
                                    No Data Found
                                </div>

                            ) : (

                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse"
                                    }}
                                >
                                    <thead>
                                        <tr>
                                            <th>Label</th>
                                            <th>Value</th>
                                            <th
                                                style={{
                                                    width: "80px",
                                                    textAlign: "center"
                                                }}
                                            >
                                                Delete
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {contactInfo.map((item, index) => (

                                            <tr key={index}>

                                                <td>{item.label}</td>

                                                <td>{item.value}</td>

                                                <td
                                                    style={{
                                                        textAlign: "center"
                                                    }}
                                                >
                                                    <button
                                                        className="remove-btn"
                                                        onClick={() => deleteField(index)}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>

                                            </tr>

                                        ))}

                                    </tbody>

                                </table>

                            )}

                        </div>

                    )

                )}

            </div>
            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                className="modal-box"
                overlayClassName="modal-overlay"
            >
                <div className="modal-content">
                    <h2>Delete Field</h2>
                    <p>Are you sure you want to delete this?</p>

                    <div className="modal-actions">
                        <button
                            className="cancel-btn"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancel
                        </button>

                        <button
                            className="delete-btn"
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

// <div className="col-md-4">
//   <div className="contact-box h-100">
//     <h5 className="mb-4">Contact Information</h5>
//     <p><strong>📍 Address:</strong><br/>Jaipur, Rajasthan, India</p>
//     <p><strong>📞 Phone:</strong><br/>+91 98765 43210</p>
//     <p><strong>📧 Email:</strong><br/>info@rajbiosis.com</p>
//     <p><strong>⏰ Working Hours:</strong><br/>Mon - Sat (9AM - 7PM)</p>
//   </div>
// </div>