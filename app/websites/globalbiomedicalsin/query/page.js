"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
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
import { usePathname } from "next/navigation";



export default function QueryPage() {

  const WEBSITE = "globalbiomedicalsin"; // 🔥 yahi change karoge

  const [activeTab, setActiveTab] = useState("contact");
  const [productQueries, setProductQueries] = useState([]);
  const [contactQueries, setContactQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewData, setViewData] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // 🔥 CONTACT FIX
  useEffect(() => {
    const q = query(
      collection(db, "websitesQueries", WEBSITE, "contactQueries"),
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
  }, []);

  // 🔥 PRODUCT FIX
  useEffect(() => {
    const q = query(
      collection(db, "websitesQueries", WEBSITE, "productQueries"),
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
  }, []);

  // 🔥 DELETE FIX
  const handleDelete = async () => {
    if (!deleteId || !deleteType) return;

    try {
      const path =
        deleteType === "product"
          ? ["websitesQueries", WEBSITE, "productQueries"]
          : ["websitesQueries", WEBSITE, "contactQueries"];

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

        {loading && <div className="empty-box">Loading...</div>}

        {!loading && (
          <div className="content-box">

            {/* CONTACT */}
            {activeTab === "contact" && (
              <div className="query-wrapper">
                {contactQueries.length === 0 ? (
                  <div className="empty-box">No Contact Queries</div>
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
                              ? q.createdAt.toDate().toLocaleString()
                              : "-"}
                          </td>

                          <td>
                            <div className="action-btns">

                              <button
                                className="view-btn"
                                onClick={() => {
                                  setViewData(q);
                                  setShowViewModal(true);
                                }}
                              >
                                View
                              </button>

                              <button
                                className="delete-btn"
                                onClick={() => {
                                  setDeleteId(q.id);
                                  setDeleteType("contact");
                                  setShowDeleteModal(true);
                                }}
                              >
                                Delete
                              </button>

                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* PRODUCT */}
            {activeTab === "product" && (
              <div className="query-wrapper">
                {productQueries.length === 0 ? (
                  <div className="empty-box">No Product Queries</div>
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
                              ? q.createdAt.toDate().toLocaleString()
                              : "-"}
                          </td>

                          <td>
                            <button
                              className="delete-btn"
                              onClick={() => {
                                setDeleteId(q.id);
                                setDeleteType("product");
                                setShowDeleteModal(true);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        )}
      </div>

/* DELETE MODAL */
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