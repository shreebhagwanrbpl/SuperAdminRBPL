"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Modal from "react-modal";
import "./home.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { useRef } from "react";
import toast from "react-hot-toast";
ModuleRegistry.registerModules([AllCommunityModule]);
import dynamic from "next/dynamic";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
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

const AgGridReact = dynamic(
    () => import("ag-grid-react").then((mod) => mod.AgGridReact),
    { ssr: false }
);
export default function HomePage() {

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const fileInputRef = useRef(null);
    const [btn1Text, setBtn1Text] = useState("");
    const [btn1Link, setBtn1Link] = useState("");
    const [btn2Text, setBtn2Text] = useState("");
    const [btn2Link, setBtn2Link] = useState("");
    const [allWebsiteData, setAllWebsiteData] = useState([]);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState("");

    const [savedData, setSavedData] = useState(null);

    const [showModal, setShowModal] = useState(false);

    const [selectedCompany, setSelectedCompany] =
        useState("");

    const [selectedWebsite, setSelectedWebsite] =
        useState("");

    const websites =
        COMPANY_WEBSITES[selectedCompany] || [];

    const getTargetWebsites = () => {

        if (selectedWebsite === "all") {
            return COMPANY_WEBSITES[selectedCompany];
        }

        return [selectedWebsite];
    };
    const rowData = savedData
        ? [
            { field: "Title", value: savedData.title },
            { field: "Description", value: savedData.description },
            { field: "Button 1", value: savedData.button1Text },
            { field: "Button 2", value: savedData.button2Text },
        ]
        : [];
    const colDefs = [
        { field: "field", headerName: "Field", flex: 1 },
        { field: "value", headerName: "Value", flex: 2 },
        {
            headerName: "Actions",
            cellRenderer: (params) => {
                return (
                    <div style={{ display: "flex", gap: "6px" }}>
                        <button className="edit-btn" onClick={handleEdit}>
                            Edit
                        </button>
                        <button
                            className="delete-btn"
                            onClick={() => setShowModal(true)}
                        >
                            Delete
                        </button>
                    </div>
                );
            },
            flex: 1,
        },
    ];

    useEffect(() => {
        Modal.setAppElement("body");
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedCompany, selectedWebsite]);

    // 🔥 LOAD
    const fetchData = async () => {
        if (selectedWebsite === "all") {

            const dataList = [];

            for (const website of COMPANY_WEBSITES[selectedCompany]) {

                const snap = await getDoc(
                    doc(
                        db,
                        "websites",
                        website,
                        "pages",
                        "home"
                    )
                );

                if (snap.exists()) {

                    dataList.push({
                        website,
                        ...snap.data(),
                    });

                }
            }

            setAllWebsiteData(dataList);
            setSavedData(null);

            return;
        }
        if (!selectedCompany || !selectedWebsite) {

            setSavedData(null);

            return;
        }

        try {

            const website =
                selectedWebsite === "all"
                    ? COMPANY_WEBSITES[selectedCompany][0]
                    : selectedWebsite;

            const snap = await getDoc(
                doc(
                    db,
                    "websites",
                    website,
                    "pages",
                    "home"
                )
            );

            if (snap.exists()) {

                const d = snap.data();

                setSavedData(d);

                setImagePreview(d.imageUrl || "");

            } else {

                setSavedData(null);

                setTitle("");
                setDescription("");

                setBtn1Text("");
                setBtn1Link("");

                setBtn2Text("");
                setBtn2Link("");

                setImage(null);
                setImagePreview("");
            }

        } catch (error) {

            console.error(error);

            setSavedData(null);

            setTitle("");
            setDescription("");

            setBtn1Text("");
            setBtn1Link("");

            setBtn2Text("");
            setBtn2Link("");

            setImage(null);
            setImagePreview("");
        }
    };

    // IMAGE
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        setImage(file);

        if (file) {
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // SAVE
    const saveData = async () => {
        const id = toast.loading("Saving...");

        try {
            let imageUrl = savedData?.imageUrl || "";

            if (image) {
                imageUrl = URL.createObjectURL(image);
            }

            const newData = {
                title,
                description,
                imageUrl,
                button1Text: btn1Text,
                button1Link: btn1Link,
                button2Text: btn2Text,
                button2Link: btn2Link,
            };

            for (const website of getTargetWebsites()) {

                await setDoc(
                    doc(
                        db,
                        "websites",
                        website,
                        "pages",
                        "home"
                    ),
                    newData
                );

            }

            setSavedData(newData);

            setImage(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            // reset
            setTitle("");
            setDescription("");
            setBtn1Text("");
            setBtn1Link("");
            setBtn2Text("");
            setBtn2Link("");
            setImage(null);
            setImagePreview("");

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            toast.success("Saved successfully", { id });

        } catch (err) {
            console.error(err);
            toast.error("Error saving", { id });
        }
    };

    // EDIT
    const handleEdit = () => {
        if (!savedData) return;

        setTitle(savedData.title || "");
        setDescription(savedData.description || "");
        setBtn1Text(savedData.button1Text || "");
        setBtn1Link(savedData.button1Link || "");
        setBtn2Text(savedData.button2Text || "");
        setBtn2Link(savedData.button2Link || "");
        setImagePreview(savedData.imageUrl || "");
    };
    // DELETE CONFIRM
    const confirmDelete = async () => {
        const id = toast.loading("Deleting...");

        try {
            for (const website of getTargetWebsites()) {

                await deleteDoc(
                    doc(
                        db,
                        "websites",
                        website,
                        "pages",
                        "home"
                    )
                );

            }

            setSavedData(null);
            setImagePreview("");
            setShowModal(false);

            toast.success("Deleted successfully", { id });

        } catch (err) {
            console.error(err);
            toast.error("Delete failed", { id });
        }
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

                    <h1 className="heading">
                        Home Page Admin
                    </h1>

                </div>
                <div className="card">

                    <h2>Select Website</h2>

                    <div
                        style={{
                            display: "flex",
                            gap: "15px",
                            alignItems: "center",
                            flexWrap: "wrap",
                            marginTop: "20px",
                        }}
                    >
                        <select
                            className="company-select"
                            value={selectedCompany}
                            onChange={(e) => {
                                setSelectedCompany(e.target.value);
                                setSelectedWebsite("");
                            }}
                        >
                            <option value="">Please Select Company</option>
                            <option value="human">Human Biomedical</option>
                            <option value="global">Global Biomedical</option>
                            <option value="rajbiosis">RajBiosis</option>
                        </select>

                        {selectedCompany && (
                            <select
                                className="website-select"
                                value={selectedWebsite}
                                onChange={(e) => setSelectedWebsite(e.target.value)}
                            >
                                <option value="">Select Website</option>
                                <option value="all">All Websites</option>

                                {websites.map((site) => (
                                    <option key={site} value={site}>
                                        {site}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                </div>


                {/* FORM */}
                <div className="card">
                    <h2>Hero Section</h2>

                    <div className="row">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Title"
                        />

                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description"
                        />

                        <div className="img-upload">
                            <input type="file" onChange={handleImageChange} ref={fileInputRef} />
                            {/* {imagePreview && (
                <img src={imagePreview} className="preview-img" />
              )} */}
                        </div>
                    </div>

                    <div className="row">
                        <input value={btn1Text} onChange={(e) => setBtn1Text(e.target.value)} placeholder="Btn1 Text" />
                        <input value={btn1Link} onChange={(e) => setBtn1Link(e.target.value)} placeholder="Btn1 Link" />
                        <input value={btn2Text} onChange={(e) => setBtn2Text(e.target.value)} placeholder="Btn2 Text" />
                        <input value={btn2Link} onChange={(e) => setBtn2Link(e.target.value)} placeholder="Btn2 Link" />
                    </div>

                    <button className="add-btn" onClick={saveData}>Save Data</button>
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
                                    All Website Preview
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

                            {allWebsiteData.length === 0 ? (

                                <div className="card">
                                    <p className="no-data">
                                        No Data Found
                                    </p>
                                </div>

                            ) : (

                                allWebsiteData.map((item) => (

                                    <div
                                        key={item.website}
                                        className="card"
                                        style={{
                                            padding: "0",
                                            overflow: "hidden"
                                        }}
                                    >

                                        <div
                                            style={{
                                                // background:
                                                //     "linear-gradient(135deg,#4f46e5,#6366f1)",
                                                color: "#4338ca",
                                                padding: "14px 18px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: "700",
                                                    fontSize: "15px"
                                                }}
                                            >
                                                {item.website}
                                            </div>

                                            <div
                                                className="action-buttons"
                                            >
                                                <button
                                                    className="edit"
                                                    onClick={() => {

                                                        setSelectedWebsite(
                                                            item.website
                                                        );

                                                        setSavedData(item);

                                                        setTitle(item.title || "");
                                                        setDescription(item.description || "");

                                                        setBtn1Text(item.button1Text || "");
                                                        setBtn1Link(item.button1Link || "");

                                                        setBtn2Text(item.button2Text || "");
                                                        setBtn2Link(item.button2Link || "");

                                                    }}
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    className="delete"
                                                    onClick={() => {

                                                        setShowModal(true);

                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                padding: "20px"
                                            }}
                                        >

                                            <table
                                                style={{
                                                    width: "100%"
                                                }}
                                            >
                                                <thead>
                                                    <tr>
                                                        <th>Image</th>
                                                        <th>Title</th>
                                                        <th>Description</th>
                                                        <th>Button 1</th>
                                                        <th>Button 2</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    <tr>

                                                        <td>
                                                            {item.imageUrl ? (
                                                                <img
                                                                    src={item.imageUrl}
                                                                    className="preview-img"
                                                                />
                                                            ) : (
                                                                "-"
                                                            )}
                                                        </td>

                                                        <td>
                                                            {item.title || "-"}
                                                        </td>

                                                        <td>
                                                            {item.description || "-"}
                                                        </td>

                                                        <td>
                                                            {item.button1Text || "-"}
                                                        </td>

                                                        <td>
                                                            {item.button2Text || "-"}
                                                        </td>

                                                    </tr>
                                                </tbody>
                                            </table>

                                        </div>

                                    </div>

                                ))

                            )}

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

                            {!savedData ? (

                                <div className="no-data">
                                    No Data Saved
                                </div>

                            ) : (

                                <>

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "15px",
                                            padding: "12px 16px",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "10px"
                                        }}
                                    >

                                        <div
                                            style={{
                                                fontWeight: "600",
                                                color: "#334155"
                                            }}
                                        >
                                            Current Website: {selectedWebsite}
                                        </div>

                                        <div className="action-buttons">

                                            <button
                                                className="edit"
                                                onClick={handleEdit}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                className="delete"
                                                onClick={() => setShowModal(true)}
                                            >
                                                Delete
                                            </button>

                                        </div>

                                    </div>

                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse"
                                        }}
                                    >
                                        <thead>
                                            <tr>
                                                <th>Image</th>
                                                <th>Title</th>
                                                <th>Description</th>
                                                <th>Button 1</th>
                                                <th>Button 2</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            <tr>

                                                <td>
                                                    {savedData.imageUrl ? (
                                                        <img
                                                            src={savedData.imageUrl}
                                                            className="preview-img"
                                                        />
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>

                                                <td>
                                                    {savedData.title || "-"}
                                                </td>

                                                <td>
                                                    {savedData.description || "-"}
                                                </td>

                                                <td>
                                                    {savedData.button1Text || "-"}
                                                </td>

                                                <td>
                                                    {savedData.button2Text || "-"}
                                                </td>

                                            </tr>
                                        </tbody>

                                    </table>

                                </>

                            )}

                        </div>

                    )

                )}

            </div>

            {/* 🔥 MODAL */}
            <Modal
                isOpen={showModal}
                onRequestClose={() => setShowModal(false)}
                className="modal-box"
                overlayClassName="modal-overlay"
            >
                <h2>Delete Data?</h2>
                <p>Are you sure you want to delete?</p>

                <div className="modal-actions">
                    <button onClick={() => setShowModal(false)}>Cancel</button>
                    <button className="delete-btn" onClick={confirmDelete}>
                        Yes Delete
                    </button>
                </div>
            </Modal>

        </div>
    );
}