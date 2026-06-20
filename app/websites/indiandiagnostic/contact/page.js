"use client";
import Modal from "react-modal";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "./contact.css";
import toast from "react-hot-toast";
import { usePathname } from "next/navigation";

export default function AdminContact() {
  const pathname = usePathname();
  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  const docRef = doc(db, "websites", "indiandiagnostic", "pages", "contact");

  const [contactInfo, setContactInfo] = useState([]);
  const [form, setForm] = useState({ label: "", value: "" });
  const [editIndex, setEditIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);

  // LOAD
  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setContactInfo(snap.data().contactInfo || []);
      }

      setLoading(false);
    };

    load();
  }, []);

  // INPUT CHANGE
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // SAVE / UPDATE
  const handleSave = async () => {
    let updated = [...contactInfo];

    try {
      if (editIndex !== null) {
        updated[editIndex] = form; // update
      } else {
        updated.push(form); // add
      }

      setContactInfo(updated);

      // reset
      setForm({ label: "", value: "" });
      setEditIndex(null);

      await setDoc(docRef, { contactInfo: updated }, { merge: true });

      // 🔥 TOAST SUCCESS
      toast.success(
        editIndex !== null
          ? "Updated successfully "
          : "Saved successfully "
      );

    } catch (err) {
      console.error(err);

      // ❌ ERROR TOAST
      toast.error("Something went wrong ❌");
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

    await setDoc(docRef, { contactInfo: updated }, { merge: true });

    setDeleteIndex(null);
    setIsModalOpen(false);

    toast.success("Deleted successfully");
  };
  useEffect(() => {
    Modal.setAppElement("body");
  }, []);
  if (loading) return <p>Loading...</p>;




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


        {/* FORM */}
        <div className="card">
          <h2>{editIndex !== null ? "Edit Field" : "Add Field"}</h2>

          <input
            name="label"
            placeholder="Label (Address, Phone...)"
            value={form.label}
            onChange={handleChange}
          />

          <input
            name="value"
            placeholder="Value"
            value={form.value}
            onChange={handleChange}
          />

          <div className="actions">
            <button className="add-btn" onClick={handleSave}>
              {editIndex !== null ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {/* 🔥 TABLE PREVIEW */}
        <div className="card">
          <h2>Preview</h2>

          {contactInfo.length === 0 ? (
            <p>No Data</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {contactInfo.map((item, index) => (
                  <tr key={index}>

                    <td>{item.label}</td>
                    <td>{item.value}</td>

                    <td>
                      <button
                        className="edit"
                        onClick={() => handleEdit(index)}
                      >
                        Edit
                      </button>

                      <button
                        className="delete"
                        onClick={() => deleteField(index)}
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