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

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [savedData, setSavedData] = useState(null);

  const [showModal, setShowModal] = useState(false);

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
    fetchData();
  }, []);

  // 🔥 LOAD
  const fetchData = async () => {
    const snap = await getDoc(
      doc(db, "websites", "globalbiomedicals", "pages", "home")
    );

    if (snap.exists()) {
      const d = snap.data();
      setSavedData(d);
      setImagePreview(d.imageUrl || "");
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

    await setDoc(
      doc(db, "websites", "globalbiomedicals", "pages", "home"),
      newData
    );

    setSavedData(newData);

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
    await deleteDoc(doc(db, "websites", "globalbiomedicals", "pages", "home"));

    setSavedData(null);
    setImagePreview("");
    setShowModal(false);

    toast.success("Deleted successfully", { id });

  } catch (err) {
    console.error(err);
    toast.error("Delete failed", { id });
  }
};

  return (
    <div className="wrapper">
      <div className="main">

        <h1 className="heading">Home Page Admin</h1>

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
<div className="card">
  <h2>Preview</h2>

  {!savedData ? (
    <p>No Data Saved</p>
  ) : (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th>Image</th>
          <th>Title</th>
          <th>Description</th>
          <th>Button 1</th>
          <th>Button 2</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>
            {savedData.imageUrl && (
              <img
                src={savedData.imageUrl}
                className="preview-img"
              />
            )}
          </td>

          <td>{savedData.title}</td>
          <td>{savedData.description}</td>
          <td>{savedData.button1Text}</td>
          <td>{savedData.button2Text}</td>

          <td>
            <button className="edit" onClick={handleEdit}>
              Edit
            </button>

            <button
              className="delete"
              onClick={() => setShowModal(true)}
            >
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )}
</div>
  {/* <div className="card">
  <h2>Preview</h2>

  {!savedData ? (
    <p>No Data Saved</p>
  ) : (
    <div
      className="ag-theme-alpine"
      style={{ height: 250, width: "100%" }}
    >
      <AgGridReact rowData={rowData} rowHeight={50}  columnDefs={colDefs} />
    </div>
  )}
</div> */}
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