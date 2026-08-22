"use client";

import { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/firebase";
import { Trash2, Share2, Eye } from "lucide-react";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    doc
} from "firebase/firestore";
import Modal from "react-modal";
import "./query.css";
import toast, { Toaster } from "react-hot-toast";
import { usePathname, useSearchParams } from "next/navigation";

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
        "globalhealthkartcom",
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

export default function QueryPage() {
    return (
        <Suspense fallback={<div style={{ padding: "20px", color: "#64748b" }}>Loading Queries...</div>}>
            <QueryContent />
        </Suspense>
    );
}

function QueryContent() {



    const [activeTab, setActiveTab] = useState("contact");
    const [productQueries, setProductQueries] = useState([]);
    const [contactQueries, setContactQueries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedWebsite, setSelectedWebsite] = useState("");
    const [viewData, setViewData] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);

    const [deleteId, setDeleteId] = useState(null);
    const [deleteType, setDeleteType] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const searchParams = useSearchParams();

    useEffect(() => {
        const company = searchParams.get("company");
        const website = searchParams.get("website");
        const tab = searchParams.get("tab");

        if (company) setSelectedCompany(company);
        if (website) setSelectedWebsite(website);
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    useEffect(() => {
        Modal.setAppElement("body");
    }, []);


    // 🔥 CONTACT QUERIES
    // 🔥 CONTACT QUERIES
    useEffect(() => {

        if (!selectedWebsite) {
            setContactQueries([]);
            return;
        }

        // ALL WEBSITES
        if (selectedWebsite === "all") {

            const websites =
                COMPANY_WEBSITES[selectedCompany] || [];

            let allQueries = [];

            websites.forEach((website) => {

                const q = query(
                    collection(
                        db,
                        "websitesQueries",
                        website,
                        "contactQueries"
                    ),
                    orderBy("createdAt", "desc")
                );

                onSnapshot(q, (snap) => {

                    const data = snap.docs.map(doc => ({
                        id: doc.id,
                        website,
                        ...doc.data()
                    }));

                    allQueries = [
                        ...allQueries.filter(
                            item => item.website !== website
                        ),
                        ...data
                    ];

                    setContactQueries(
                        [...allQueries].sort(
                            (a, b) =>
                                (b.createdAt?.seconds || 0) -
                                (a.createdAt?.seconds || 0)
                        )
                    );

                    setLoading(false);

                });

            });

            return;
        }

        const q = query(
            collection(
                db,
                "websitesQueries",
                selectedWebsite,
                "contactQueries"
            ),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {

            const data = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            setContactQueries(data);
            setLoading(false);

        });

        return () => unsub();

    }, [selectedCompany, selectedWebsite]);

    // 🔥 PRODUCT QUERIES
    useEffect(() => {

        if (!selectedWebsite) {
            setProductQueries([]);
            return;
        }

        if (selectedWebsite === "all") {

            const websites =
                COMPANY_WEBSITES[selectedCompany] || [];

            let allProducts = [];

            websites.forEach((website) => {

                const q = query(
                    collection(
                        db,
                        "websitesQueries",
                        website,
                        "productQueries"
                    ),
                    orderBy("createdAt", "desc")
                );

                onSnapshot(q, (snap) => {

                    const data = snap.docs.map(doc => ({
                        id: doc.id,
                        website,
                        ...doc.data()
                    }));

                    allProducts = [
                        ...allProducts.filter(
                            item => item.website !== website
                        ),
                        ...data
                    ];

                    setProductQueries(
                        [...allProducts].sort(
                            (a, b) =>
                                (b.createdAt?.seconds || 0) -
                                (a.createdAt?.seconds || 0)
                        )
                    );

                });

            });

            return;
        }

        const q = query(
            collection(
                db,
                "websitesQueries",
                selectedWebsite,
                "productQueries"
            ),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {

            const data = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            setProductQueries(data);

        });

        return () => unsub();

    }, [selectedCompany, selectedWebsite]);

    // 🔥 DELETE FIX
    const handleDelete = async () => {
        if (!deleteId || !deleteType) return;

        try {
            const path =
                deleteType === "product"
                    ? ["websitesQueries", selectedWebsite, "productQueries"]
                    : ["websitesQueries", selectedWebsite, "contactQueries"];
            await deleteDoc(doc(db, ...path, deleteId));

            setShowDeleteModal(false);
            setDeleteId(null);
            setDeleteType(null);

            toast.success("Deleted successfully");

        } catch (err) {
            console.error(err);
            toast.error("Delete failed");
        }
    };

    const pathname = usePathname();
    const pathParts = pathname
        .split("/")
        .filter(Boolean);

    return (
        <div className="flex">
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

                    <div className="topbar">
                        <h1>Query Dashboard</h1>
                    </div>

                </div>
                <div className="card">

                    <h2>Select Website</h2>

                    <div className="website-select-row">

                        <select
                            value={selectedCompany}
                            onChange={(e) => {
                                setSelectedCompany(e.target.value);
                                setSelectedWebsite("");
                            }}
                        >
                            <option value="">Select Company</option>
                            <option value="human">Human Biomedical</option>
                            <option value="global">Global Biomedical</option>
                            <option value="rajbiosis">RajBiosis</option>
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

                {/* TABS */}
                <div className="tabs">
                    <button
                        className={activeTab === "contact" ? "tab active" : "tab"}
                        onClick={() => setActiveTab("contact")}
                    >
                        Contact Queries
                    </button>

                    <button
                        className={activeTab === "product" ? "tab active" : "tab"}
                        onClick={() => setActiveTab("product")}
                    >
                        Product Queries
                    </button>
                </div>

                {loading && <div className="empty-box">Please Select Company</div>}

                {!loading && selectedWebsite && (
                    <div className="content-box">

                        {/* CONTACT */}
                        {activeTab === "contact" && (

                            selectedWebsite === "all" ? (

                                COMPANY_WEBSITES[selectedCompany]?.map((website) => {

                                    const websiteQueries =
                                        contactQueries.filter(
                                            q => q.website === website
                                        );

                                    if (websiteQueries.length === 0)
                                        return null;

                                    return (

                                        <div
                                            key={website}
                                            className="query-wrapper"
                                            style={{ marginBottom: "20px" }}
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
                                                    {website}
                                                </h3>

                                                <button
                                                    className="icon-btn share-icon"
                                                    onClick={() => {

                                                        const body = websiteQueries
                                                            .map(
                                                                (q, i) =>
                                                                    `${i + 1}. ${q.name} | ${q.email} | ${q.phone}`
                                                            )
                                                            .join("\n");

                                                        window.open(
                                                            `mailto:?subject=${website} Contact Queries&body=${encodeURIComponent(body)}`
                                                        );

                                                    }}
                                                >
                                                    <Share2 size={18} />
                                                </button>

                                            </div>

                                            <table className="query-table">

                                                <thead>
                                                    <tr>
                                                        <th>S.R.</th>
                                                        <th>Name</th>
                                                        <th>Email</th>
                                                        <th>Phone</th>
                                                        <th>Date</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>

                                                <tbody>

                                                    {websiteQueries.map((q, i) => (

                                                        <tr key={q.id}>

                                                            <td>{i + 1}</td>

                                                            <td>{q.name}</td>

                                                            <td>{q.email}</td>

                                                            <td>{q.phone}</td>

                                                            <td className="date">
                                                                {q.createdAt?.toDate
                                                                    ? q.createdAt
                                                                        .toDate()
                                                                        .toLocaleString()
                                                                    : "-"}
                                                            </td>

                                                            <td>

                                                                <div className="action-btns">

                                                                    <button
                                                                        title="View Query"
                                                                        className="icon-btn view-icon"
                                                                        onClick={() => {
                                                                            setViewData(q);
                                                                            setShowViewModal(true);
                                                                        }}
                                                                    >
                                                                        <Eye size={18} />
                                                                    </button>

                                                                    <button
                                                                        title="Share Query"
                                                                        className="icon-btn share-icon"
                                                                        onClick={() => {

                                                                            const body = `
Name: ${q.name}
Email: ${q.email}
Phone: ${q.phone}
Message: ${q.message || "-"}
            `;

                                                                            window.open(
                                                                                `mailto:?subject=Contact Query&body=${encodeURIComponent(body)}`
                                                                            );

                                                                        }}
                                                                    >
                                                                        <Share2 size={18} />
                                                                    </button>

                                                                    <button
                                                                        title="Delete Query"
                                                                        className="icon-btn delete-icon"
                                                                        onClick={() => {
                                                                            setDeleteId(q.id);
                                                                            setDeleteType("contact");
                                                                            setShowDeleteModal(true);
                                                                        }}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>

                                                                </div>

                                                            </td>

                                                        </tr>

                                                    ))}

                                                </tbody>

                                            </table>

                                        </div>

                                    );

                                })

                            ) : (

                                <div className="query-wrapper">
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
                                            {selectedWebsite}
                                        </h3>

                                        <button
                                            className="icon-btn share-icon"
                                            onClick={() => {

                                                const body = productQueries
                                                    .map(
                                                        (q, i) =>
                                                            `${i + 1}. ${q.productName} | ${q.email} | ${q.phone}`
                                                    )
                                                    .join("\n");

                                                window.open(
                                                    `mailto:?subject=${selectedWebsite} Product Queries&body=${encodeURIComponent(body)}`
                                                );

                                            }}
                                        >
                                            <Share2 size={18} />
                                        </button>

                                        <button
                                            className="icon-btn share-icon"
                                            onClick={() => {

                                                const body = contactQueries
                                                    .map(
                                                        (q, i) =>
                                                            `${i + 1}. ${q.name} | ${q.email} | ${q.phone}`
                                                    )
                                                    .join("\n");

                                                window.open(
                                                    `mailto:?subject=${selectedWebsite} Contact Queries&body=${encodeURIComponent(body)}`
                                                );
                                            }}
                                        >
                                            <Share2 size={18} />
                                        </button>

                                    </div>
                                    {!selectedCompany ? (

                                        <div className="empty-box">
                                            Please Select Company
                                        </div>

                                    ) : !selectedWebsite ? (

                                        <div className="empty-box">
                                            Please Select Website
                                        </div>

                                    ) : contactQueries.length === 0 ? (

                                        <div className="empty-box">
                                            No Contact Queries Found
                                        </div>

                                    ) : (

                                        <table className="query-table">

                                            <thead>
                                                <tr>
                                                    <th>S.R.</th>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    <th>Phone</th>
                                                    <th>Date</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>

                                            <tbody>

                                                {contactQueries.map((q, i) => (

                                                    <tr key={q.id}>

                                                        <td>{i + 1}</td>

                                                        <td>{q.name}</td>

                                                        <td>{q.email}</td>

                                                        <td>{q.phone}</td>

                                                        <td className="date">
                                                            {q.createdAt?.toDate
                                                                ? q.createdAt
                                                                    .toDate()
                                                                    .toLocaleString()
                                                                : "-"}
                                                        </td>

                                                        <td>

                                                            <div className="action-btns">

                                                                <button
                                                                    title="View Query"
                                                                    className="icon-btn view-icon"
                                                                    onClick={() => {
                                                                        setViewData(q);
                                                                        setShowViewModal(true);
                                                                    }}
                                                                >
                                                                    <Eye size={18} />
                                                                </button>

                                                                <button
                                                                    title="Share Query"
                                                                    className="icon-btn share-icon"
                                                                    onClick={() => {

                                                                        const body = `
Name: ${q.name}
Email: ${q.email}
Phone: ${q.phone}
Message: ${q.message || "-"}
            `;

                                                                        window.open(
                                                                            `mailto:?subject=Contact Query&body=${encodeURIComponent(body)}`
                                                                        );

                                                                    }}
                                                                >
                                                                    <Share2 size={18} />
                                                                </button>

                                                                <button
                                                                    title="Delete Query"
                                                                    className="icon-btn delete-icon"
                                                                    onClick={() => {
                                                                        setDeleteId(q.id);
                                                                        setDeleteType("contact");
                                                                        setShowDeleteModal(true);
                                                                    }}
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                ))}

                                            </tbody>

                                        </table>

                                    )}

                                </div>

                            )

                        )}

                        {/* PRODUCT */}
                        {activeTab === "product" && (

                            selectedWebsite === "all" ? (

                                COMPANY_WEBSITES[selectedCompany]?.map((website) => {

                                    const websiteQueries =
                                        productQueries.filter(
                                            q => q.website === website
                                        );

                                    if (websiteQueries.length === 0)
                                        return null;

                                    return (

                                        <div
                                            key={website}
                                            className="query-wrapper"
                                            style={{ marginBottom: "20px" }}
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
                                                    {website}
                                                </h3>

                                                <button
                                                    title="Share All Product Queries"
                                                    className="icon-btn share-icon"
                                                    onClick={() => {

                                                        const body = websiteQueries
                                                            .map(
                                                                (q, i) =>
                                                                    `${i + 1}. ${q.productName} | ${q.email} | ${q.phone}`
                                                            )
                                                            .join("\n");

                                                        window.open(
                                                            `mailto:?subject=${website} Product Queries&body=${encodeURIComponent(body)}`
                                                        );

                                                    }}
                                                >
                                                    <Share2 size={18} />
                                                </button>

                                            </div>

                                            <table className="query-table">

                                                <thead>
                                                    <tr>
                                                        <th>S.R.</th>
                                                        <th>Product</th>
                                                        <th>Email</th>
                                                        <th>Phone</th>
                                                        <th>Date</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>

                                                <tbody>

                                                    {websiteQueries.map((q, i) => (

                                                        <tr key={q.id}>

                                                            <td>{i + 1}</td>

                                                            <td>{q.productName}</td>

                                                            <td>{q.email}</td>

                                                            <td>{q.phone}</td>

                                                            <td>
                                                                {q.createdAt?.toDate
                                                                    ? q.createdAt
                                                                        .toDate()
                                                                        .toLocaleString()
                                                                    : "-"}
                                                            </td>
                                                            <td>

                                                                <div className="action-btns">

                                                                    <button
                                                                        title="View Query"
                                                                        className="icon-btn view-icon"
                                                                        onClick={() => {
                                                                            setViewData(q);
                                                                            setShowViewModal(true);
                                                                        }}
                                                                    >
                                                                        <Eye size={18} />
                                                                    </button>

                                                                    <button
                                                                        title="Share Query"
                                                                        className="icon-btn share-icon"
                                                                        onClick={() => {

                                                                            const body = `
Product: ${q.productName}
Email: ${q.email}
Phone: ${q.phone}
                `;

                                                                            window.open(
                                                                                `mailto:?subject=Product Query&body=${encodeURIComponent(body)}`
                                                                            );

                                                                        }}
                                                                    >
                                                                        <Share2 size={18} />
                                                                    </button>

                                                                    <button
                                                                        title="Delete Query"
                                                                        className="icon-btn delete-icon"
                                                                        onClick={() => {
                                                                            setDeleteId(q.id);
                                                                            setDeleteType("product");
                                                                            setShowDeleteModal(true);
                                                                        }}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>

                                                                </div>

                                                            </td>

                                                        </tr>

                                                    ))}

                                                </tbody>

                                            </table>

                                        </div>

                                    );

                                })

                            ) : (

                                <div className="query-wrapper">
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
                                            {selectedWebsite}
                                        </h3>

                                        <button
                                            title="Share All Product Queries"
                                            className="icon-btn share-icon"
                                            onClick={() => {

                                                const body = productQueries
                                                    .map(
                                                        (q, i) =>
                                                            `${i + 1}. ${q.productName} | ${q.email} | ${q.phone}`
                                                    )
                                                    .join("\n");

                                                window.open(
                                                    `mailto:?subject=${selectedWebsite} Product Queries&body=${encodeURIComponent(body)}`
                                                );

                                            }}
                                        >
                                            <Share2 size={18} />
                                        </button>
                                    </div>
                                    {!selectedCompany ? (

                                        <div className="empty-box">
                                            Please Select Company
                                        </div>

                                    ) : !selectedWebsite ? (

                                        <div className="empty-box">
                                            Please Select Website
                                        </div>

                                    ) : productQueries.length === 0 ? (

                                        <div className="empty-box">
                                            No Product Queries Found
                                        </div>

                                    ) : (

                                        <table className="query-table">

                                            <thead>
                                                <tr>
                                                    <th>S.R.</th>
                                                    <th>Product</th>
                                                    <th>Email</th>
                                                    <th>Phone</th>
                                                    <th>Date</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>

                                            <tbody>

                                                {productQueries.map((q, i) => (

                                                    <tr key={q.id}>

                                                        <td>{i + 1}</td>

                                                        <td>{q.productName}</td>

                                                        <td>{q.email}</td>

                                                        <td>{q.phone}</td>

                                                        <td>
                                                            {q.createdAt?.toDate
                                                                ? q.createdAt
                                                                    .toDate()
                                                                    .toLocaleString()
                                                                : "-"}
                                                        </td>

                                                        <td>

                                                            <div className="action-btns">

                                                                <button
                                                                    title="View Query"
                                                                    className="icon-btn view-icon"
                                                                    onClick={() => {
                                                                        setViewData(q);
                                                                        setShowViewModal(true);
                                                                    }}
                                                                >
                                                                    <Eye size={18} />
                                                                </button>

                                                                <button
                                                                    title="Share Query"
                                                                    className="icon-btn share-icon"
                                                                    onClick={() => {

                                                                        const body = `
Product: ${q.productName}
Email: ${q.email}
Phone: ${q.phone}
Date: ${q.createdAt?.toDate
                                                                                ? q.createdAt.toDate().toLocaleString()
                                                                                : "-"
                                                                            }
                `;

                                                                        window.open(
                                                                            `mailto:?subject=Product Query&body=${encodeURIComponent(body)}`
                                                                        );

                                                                    }}
                                                                >
                                                                    <Share2 size={18} />
                                                                </button>

                                                                <button
                                                                    title="Delete Query"
                                                                    className="icon-btn delete-icon"
                                                                    onClick={() => {
                                                                        setDeleteId(q.id);
                                                                        setDeleteType("product");
                                                                        setShowDeleteModal(true);
                                                                    }}
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>

                                                            </div>

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
                )}
            </div>

            <Modal
                isOpen={showDeleteModal}
                onRequestClose={() => setShowDeleteModal(false)}
                className="modal-base modal-box-delete"
                overlayClassName="modal-overlay"
            >
                <div className="modal-content">
                    <h2>Delete Query?</h2>
                    <p>Are you sure you want to delete this?</p>

                    <div className="modal-actions">
                        <button
                            className="cancel-btn"
                            onClick={() => setShowDeleteModal(false)}
                        >
                            Cancel
                        </button>

                        <button
                            className="delete-btn"
                            onClick={handleDelete}
                        >
                            Yes, Delete
                        </button>
                    </div>
                </div>
            </Modal>



            <Modal
                isOpen={showViewModal}
                onRequestClose={() => setShowViewModal(false)}
                className="modal-base modal-box-view"
                overlayClassName="modal-overlay"
            >
                {viewData && (
                    <div className="modal-content">

                        <h2>Query Details</h2>

                        <div className="view-grid">
                            <div><b>Name:</b> {viewData.name}</div>
                            <div><b>Email:</b> {viewData.email}</div>
                            <div><b>Phone:</b> {viewData.phone}</div>
                            <div><b>Subject:</b> {viewData.subject}</div>

                            <div className="full-msg">
                                <b>Message:</b>
                                <p>{viewData.message}</p>
                            </div>

                            <div>
                                <b>Date:</b>{" "}
                                {viewData.createdAt?.toDate
                                    ? viewData.createdAt.toDate().toLocaleString()
                                    : "-"}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowViewModal(false)}
                            >
                                Close
                            </button>
                        </div>

                    </div>
                )}
            </Modal>
            <Toaster position="top-right" />
        </div>
    );
}