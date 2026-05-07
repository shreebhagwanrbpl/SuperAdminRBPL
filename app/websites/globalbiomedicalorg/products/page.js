"use client";
import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { useState, useEffect, useMemo  } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Modal from "react-modal";
import "./products.css";
import * as XLSX from "xlsx";
import toast, { Toaster } from "react-hot-toast";
import { Pencil, Trash2, Upload, FileUp  } from "lucide-react"; 


export default function ProductPage() {
  const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(25);
  const [openIndex, setOpenIndex] = useState(null);
const [activeId, setActiveId] = useState(null);
const [products, setProducts] = useState([
  {
    title: "",
    price: "",
    desc: "",
    capacity: "",
    throughput: "",
    instrument: "",
    model: "",
    usage: "",
    brand: "",
    parameters: "",
    automation: "",
    availability: "",
    size: "",
  },
]);
const cleanProduct = (p) => ({
  id: p.id || crypto.randomUUID(),
  title: p.title || "",
  price: p.price || "",
  desc: p.desc || "",
  capacity: p.capacity || "",
  throughput: p.throughput || "",
  instrument: p.instrument || "",
  model: p.model || "",
  usage: p.usage || "",
  brand: p.brand || "",
  parameters: p.parameters || "",
  automation: p.automation || "",
  availability: p.availability || "",
  size: p.size || "",
  image: typeof p.image === "string" ? p.image : "", 
  createdAt: p.createdAt ? p.createdAt : new Date().toISOString(),
  isPublished: typeof p.isPublished === "boolean" ? p.isPublished : true,
});
  const [savedProducts, setSavedProducts] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
 const [imageModal, setImageModal] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalPages = Math.ceil(savedProducts.length / itemsPerPage);

const paginatedProducts = useMemo(() => {
  return savedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
}, [savedProducts, currentPage, itemsPerPage]);
  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // LOAD DATA
  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDoc(
        doc(db, "websites", "globalbiomedicalorg", "pages", "products")
      );

      if (snap.exists()) {
        setSavedProducts(snap.data().products || []);
      }
    };

    fetchData();
  }, []);
useEffect(() => {
  setActiveId(null);
}, [savedProducts, currentPage, itemsPerPage]);

  // INPUT CHANGE
  const handleChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  // ADD FIELD
  const addProduct = () => {
    setProducts([...products, { title: "", price: "", desc: "",  capacity: "",
    throughput: "",
    instrument: "",
    model: "",
    usage: "",
    brand: "",
    parameters: "",
    automation: "",
    availability: "",
    size: "",
  image: ""}]);
  };

  // DELETE FIELD (FORM)
  const deleteProduct = (index) => {
    if (products.length === 1) return toast.error("At least one required");
    setProducts(products.filter((_, i) => i !== index));
  };

  // SAVE / UPDATE
  const saveProducts = async () => {
    const docRef = doc(db, "websites", "globalbiomedicalorg", "pages", "products");

    const snap = await getDoc(docRef);
   let existing = snap.exists()
  ? (snap.data().products || []).map((p) => cleanProduct(p))
  : [];

    let updatedProducts = [];

    if (editIndex !== null) {
      updatedProducts = [...existing];
updatedProducts[editIndex] = {
  ...cleanProduct(products[0]), // 🔥 clean use karo
  id: existing[editIndex].id,
  isPublished: existing[editIndex].isPublished,
};
    } else {
updatedProducts = [
  ...products.map((p) => ({
   ...cleanProduct(p),
id: crypto.randomUUID(), 
createdAt: new Date().toISOString(),
isPublished: true,
  })),
  ...existing
];
    }

try {
  await setDoc(docRef, {
    products: updatedProducts.map((p) => cleanProduct(p)),
  });

  setSavedProducts(updatedProducts);

  setProducts([{
    title: "", price: "", desc: "", capacity: "",
    throughput: "", instrument: "", model: "", usage: "",
    brand: "", parameters: "", automation: "",
    availability: "", size: "", image: ""
  }]);

  setEditIndex(null);

  toast.success(editIndex !== null ? "Updated Successfully" : "Saved Successfully");

} catch (error) {
  toast.error("Something went wrong");
  console.error(error);
}

  };
const handleExcelImport = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (evt) => {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const formatted = jsonData.map((row) => ({
      id: crypto.randomUUID(),
      title: row.title || "",
      price: row.price || "",
      desc: row.desc || "",
      capacity: row.capacity || "",
      throughput: row.throughput || "",
      instrument: row.instrument || "",
      model: row.model || "",
      usage: row.usage || "",
      brand: row.brand || "",
      parameters: row.parameters || "",
      automation: row.automation || "",
      availability: row.availability || "",
      size: row.size || "",
      image: row.image || "",
      createdAt: new Date().toISOString(),
      isPublished: true,
    }));

    try {
      const docRef = doc(db, "websites", "globalbiomedicalorg", "pages", "products");

      const snap = await getDoc(docRef);
      const existing = snap.exists() ? snap.data().products || [] : [];

      // 🔥 merge old + new
      const updated = [...formatted, ...existing];

      await setDoc(docRef, { products: updated });

      setSavedProducts(updated);

      toast.success("Excel imported successfully ✅");
    } catch (err) {
      console.error(err);
      toast.error("Import failed ❌");
    }
  };

  reader.readAsArrayBuffer(file);
};
const handleImageUpload = (index, file) => {
  if (!file) return;

if (!file.type.startsWith("image/")) {
  toast.error("Only image allowed");
  return;
}

if (file.size > 200 * 1024) {
  toast.error("Image too large (max 200KB)");
  return;
}

  const reader = new FileReader();

  reader.onloadend = () => {
    const updated = [...products];
    updated[index].image = reader.result;
    setProducts(updated);
  };

  reader.readAsDataURL(file);
};
  // EDIT
  const handleEdit = (index) => {
    setProducts([cleanProduct(savedProducts[index])]);
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // DELETE CONFIRM
const confirmDelete = async () => {
  const updated = savedProducts
    .filter((_, i) => i !== deleteIndex)
    .map((p) => cleanProduct(p));

  setSavedProducts(updated);
  setIsModalOpen(false);

  toast.success("Deleted successfully");

  try {
    await setDoc(
      doc(db, "websites", "globalbiomedicalorg", "pages", "products"),
      { products: updated }
    );
  } catch (err) {
    toast.error("Delete failed");
  }
};
  // TOGGLE PUBLISH
const togglePublish = async (index) => {
  const updated = savedProducts.map((p, i) =>
    i === index
      ? { ...p, isPublished: !p.isPublished }
      : p
  );

 
  setSavedProducts(updated);

 
  toast.success(updated[index].isPublished ? "Product Visible" : "Product Hidden");

  try {
    await setDoc(
      doc(db, "websites", "globalbiomedicalorg", "pages", "products"),
      { products: updated }
    );
  } catch (err) {
    toast.error("Failed to update");

    // rollback (optional)
    setSavedProducts(savedProducts);
  }
};

  return (
    <div className="main">
      <h1 className="heading">Product Page</h1>

      {/* FORM */}
      <div className="card">
        <h2>{editIndex !== null ? "Edit Product" : "Add Product"}</h2>
{products.map((item, i) => (
  <div className="form-row" key={i}>
    <input
      placeholder="Product Name"
      value={item.title}
      onChange={(e) => handleChange(i, "title", e.target.value)}
    />

    <input
      placeholder="Price"
      value={item.price}
      onChange={(e) => handleChange(i, "price", e.target.value)}
    />

    <input
      placeholder="Description"
      value={item.desc}
      onChange={(e) => handleChange(i, "desc", e.target.value)}
    />

    <input
      placeholder="Capacity"
      value={item.capacity}
      onChange={(e) => handleChange(i, "capacity", e.target.value)}
    />

    <input
      placeholder="Throughput"
      value={item.throughput}
      onChange={(e) => handleChange(i, "throughput", e.target.value)}
    />

    <input
      placeholder="Instrument Name"
      value={item.instrument}
      onChange={(e) => handleChange(i, "instrument", e.target.value)}
    />

    <input
      placeholder="Model Name/Number"
      value={item.model}
      onChange={(e) => handleChange(i, "model", e.target.value)}
    />

    <input
      placeholder="Usage/Application"
      value={item.usage}
      onChange={(e) => handleChange(i, "usage", e.target.value)}
    />

    <input
      placeholder="Brand"
      value={item.brand}
      onChange={(e) => handleChange(i, "brand", e.target.value)}
    />

    <input
      placeholder="Parameters"
      value={item.parameters}
      onChange={(e) => handleChange(i, "parameters", e.target.value)}
    />

    <input
      placeholder="Automation"
      value={item.automation}
      onChange={(e) => handleChange(i, "automation", e.target.value)}
    />

    <input
      placeholder="Availability"
      value={item.availability}
      onChange={(e) => handleChange(i, "availability", e.target.value)}
    />

    <input
      placeholder="Size"
      value={item.size}
      onChange={(e) => handleChange(i, "size", e.target.value)}
    />
    <input
    key={item.image || i}
  type="file"
  accept="image/*"
  onChange={(e) => handleImageUpload(i, e.target.files[0])}
/>
{/* {item.image && (
<span
  style={{ marginLeft: "8px", cursor: "pointer" }}
  onClick={() => setImageModal(item.image)}
>
  <ImageIcon size={16} />
</span>
)} */}

    <button className="delete-btn" onClick={() => deleteProduct(i)}>Delete</button>
  </div>
))}

        <div className="actions">
          <button onClick={addProduct}>+ Add</button>
          <button className="add-btn" onClick={saveProducts}>
            {editIndex !== null ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* TABLE */}
   <div className="preview">
  <div className="header-row">
    <h2 className="title">Saved Products</h2>

    <div>
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleExcelImport}
        style={{ display: "none" }}
        id="excelUpload"
      />

      <button
        className="import-btn"
        onClick={() => document.getElementById("excelUpload").click()}
      >
        <FileUp  size={16} style={{ marginRight: "6px" }} />
         Import
      </button>
    </div>
  </div>
      <table className="product-table">
        <thead>
          <tr>
            <th>Create At</th>
            <th>Product</th>
            <th>Price ₹</th>
            <th>Description</th>
            <th>Status</th>
            <th>Visibility</th>
            <th>Actions</th>
          </tr>
        </thead>

<tbody>
  {paginatedProducts.map((item, i) => (
    <React.Fragment key={item.id || i}>
      
      {/* MAIN ROW */}
      <tr
        className="main-row"
onClick={() =>
  setActiveId(activeId === (item.id || i) ? null : (item.id || i))
}
      >
        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>

        <td className="product-title">
          {item.title?.length > 20
            ? item.title.slice(0, 20) + "..."
            : item.title}
        </td>

        <td>₹ {item.price}</td>

        <td>
          {item.desc?.length > 30
            ? item.desc.slice(0, 30) + "..."
            : item.desc}
        </td>

        <td>
          <span className={`status ${item.isPublished ? "published" : "unpublished"}`}>
            {item.isPublished ? "● Published" : "● Hidden"}
          </span>
        </td>

        <td>
          <button
            className={`toggle-btn ${item.isPublished ? "unpublish" : "publish"}`}
onClick={(e) => {
  e.stopPropagation();
  const realIndex = (currentPage - 1) * itemsPerPage + i;
  togglePublish(realIndex);
}}
          >
            {item.isPublished ? "Hide" : "Show"}
          </button>
        </td>

        <td className="action-buttons">
          <button
            className="edit"
onClick={(e) => {
  e.stopPropagation();
  const realIndex = (currentPage - 1) * itemsPerPage + i;
  handleEdit(realIndex);
}}
          >
            <Pencil size={16} />
          </button>

          <button
            className="delete"
onClick={(e) => {
  e.stopPropagation();
  const realIndex = (currentPage - 1) * itemsPerPage + i;
  setDeleteIndex(realIndex);
  setIsModalOpen(true);
}}
          >
            <Trash2 size={16} />
          </button>
        </td>
      </tr>

      {/* DETAIL ROW */}
     {activeId === (item.id || i) && (
        <tr className="detail-row-fixed">
          <td colSpan="7">
             <div className="details-wrapper">
            <div className="details">
              <p><b>Title:</b> {item.title}</p>
              <p><b>Price:</b> ₹{item.price}</p>
              <p><b>Description:</b> {item.desc}</p>
              <p><b>Capacity:</b> {item.capacity}</p>
              <p><b>Throughput:</b> {item.throughput}</p>
              <p><b>Instrument:</b> {item.instrument}</p>
              <p><b>Model:</b> {item.model}</p>
              <p><b>Usage:</b> {item.usage}</p>
              <p><b>Brand:</b> {item.brand}</p>
              <p><b>Automation:</b> {item.automation}</p>
              <p><b>Availability:</b> {item.availability}</p>
              <p><b>Size:</b> {item.size}</p>
              <p>
  <b>Image:</b>{" "}
  {item.image ? (
    <span
      style={{
        marginLeft: "8px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color: "#4f46e5",
        fontWeight: "500"
      }}
      onClick={() => setImageModal(item.image)}
    >
      <ImageIcon size={18} />
    </span>
  ) : (
    "-"
  )}
</p>
            </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  ))}
</tbody>
      </table>
    </div>
    <div className="pagination-card">
    <div className="pagination-wrapper">

  {/* Items per page */}
  <div className="page-size">
    <span>Per Page:</span>
    <select
      value={itemsPerPage}
      onChange={(e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1); // reset page
      }}
    >
      <option value={10}>10 items</option>
      <option value={25}>25 items</option>
      <option value={50}>50 items</option>
      <option value={100}>100 items</option>
    </select>
  </div>
    <div className="pagination">

  {/* Prev */}
  <button
    className="nav-btn"
    disabled={currentPage === 1}
    onClick={() => setCurrentPage((p) => p - 1)}
  >
    ◀
  </button>

  {/* Previous Page */}
  {currentPage > 1 && (
    <button
      className="page-btn"
      onClick={() => setCurrentPage(currentPage - 1)}
    >
      {currentPage - 1}
    </button>
  )}

  {/* Current Page */}
  <button className="page-btn active">
    {currentPage}
  </button>

  {/* Next Page */}
  {currentPage < totalPages && (
    <button
      className="page-btn"
      onClick={() => setCurrentPage(currentPage + 1)}
    >
      {currentPage + 1}
    </button>
  )}

  {/* Next */}
  <button
    className="nav-btn"
    disabled={currentPage === totalPages}
    onClick={() => setCurrentPage((p) => p + 1)}
  >
    ▶
  </button>

</div>
</div>
</div>

      {/* MODAL */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="modal-box"
        overlayClassName="modal-overlay"
      >
        <h2>Delete Product</h2>
        <p>Are you sure?</p>

        <div className="modal-actions">
          <button className="cancel-btn"onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="delete-btn" onClick={confirmDelete}>
            Delete
          </button>
        </div>
      </Modal>
      <Modal
  isOpen={!!imageModal}
  onRequestClose={() => setImageModal(null)}
  className="image-modal"
  overlayClassName="modal-overlay"
>
  <img src={imageModal} alt="preview" className="full-img" />
</Modal>
    </div>
  );
}
