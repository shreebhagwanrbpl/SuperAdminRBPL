"use client";
import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Modal from "react-modal";
import "./products.css";
import toast, { Toaster } from "react-hot-toast";
import { Pencil, Trash2, Upload, FileUp } from "lucide-react";
import ExcelJS from "exceljs";
import { storage } from "@/lib/firebase";
import CategoryProduct from "./CategoryProduct";
import { usePathname } from "next/navigation";
import { useSearchParams, useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";

export default function ProductPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [openIndex, setOpenIndex] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [importPercent, setImportPercent] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [imageGallery, setImageGallery] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [products, setProducts] = useState([
    {
      productId: "",
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
      images: [],
      video: "",
      pdf: "",
    }
  ]);
  const cleanProduct = (p) => ({
    productId: p.productId || null,
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
    images: Array.isArray(p.images)
      ? p.images
      : p.image
        ? [p.image]
        : [],

    video: p.video || "",
    pdf: p.pdf || "",
    createdAt: p.createdAt ? p.createdAt : new Date().toISOString(),
    isPublished: typeof p.isPublished === "boolean" ? p.isPublished : true,
  });
  const [savedProducts, setSavedProducts] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [imageModal, setImageModal] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleSelectProduct = (id) => {
    setSelectedProducts((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };
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
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab =
    searchParams.get("tab") || "products";
  // LOAD DATA
  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDoc(
        doc(db, "websites", "qlyte", "pages", "products")
      );

      if (snap.exists()) {
        const products = (snap.data().products || []).map((p) => ({
          ...p,
          title: typeof p.title === "object"
            ? p.title?.text || p.title?.richText?.map(x => x.text).join("") || ""
            : p.title || "",

          desc: typeof p.desc === "object"
            ? p.desc?.text || p.desc?.richText?.map(x => x.text).join("") || ""
            : p.desc || "",
        }));

        setSavedProducts(products);
      }
    };

    fetchData();
  }, []);
  useEffect(() => {
    setActiveId(null);
  }, [savedProducts, currentPage, itemsPerPage]);
  const deleteSelectedProducts = async () => {
    if (selectedProducts.length === 0) {
      return toast.error("Select products first");
    }

    const updated = savedProducts.filter(
      (p) => !selectedProducts.includes(p.id)
    );

    try {
      await setDoc(
        doc(db, "websites", "qlyte", "pages", "products"),
        { products: updated }
      );

      setSavedProducts(updated);
      setSelectedProducts([]);

      toast.success(
        `${selectedProducts.length} products deleted`
      );
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };
  const deleteAllProducts = async () => {
    try {
      await setDoc(
        doc(db, "websites", "qlyte", "pages", "products"),
        { products: [] }
      );

      setSavedProducts([]);
      setSelectedProducts([]);

      toast.success("All products deleted");
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };
  // INPUT CHANGE
  const handleChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  // ADD FIELD
  const addProduct = () => {
    setProducts([...products, {
      productId: "",
      title: "", price: "", desc: "", capacity: "",
      throughput: "",
      instrument: "",
      model: "",
      usage: "",
      brand: "",
      parameters: "",
      automation: "",
      availability: "",
      size: "",
      images: [],
      video: "",
      pdf: ""
    }]);
  };

  // DELETE FIELD (FORM)
  const deleteProduct = (index) => {
    if (products.length === 1) return toast.error("At least one required");
    setProducts(products.filter((_, i) => i !== index));
  };

  // SAVE / UPDATE
  const saveProducts = async () => {
    const isEditing = editIndex !== null;
    const docRef = doc(db, "websites", "qlyte", "pages", "products");

    const snap = await getDoc(docRef);
    let existing = snap.exists()
      ? (snap.data().products || []).map((p) => cleanProduct(p))
      : [];

    let updatedProducts = [];
    const maxProductId =
      existing.length > 0
        ? Math.max(
          ...existing.map((p) =>
            Number(p.productId || 0)
          )
        )
        : 0;
    if (isEditing) {
      const currentEditIndex = editIndex;

      updatedProducts = [...existing];

      updatedProducts[currentEditIndex] = {
        ...existing[currentEditIndex],
        ...cleanProduct(products[0]),
        id: existing[currentEditIndex].id,
        productId:
          existing[currentEditIndex].productId,
        isPublished: existing[currentEditIndex].isPublished,
      };
    } else {
      const newProducts = products.map((p, index) => ({
        ...cleanProduct(p),

        id: crypto.randomUUID(),

        productId: maxProductId + index + 1,

        createdAt: new Date().toISOString(),

        isPublished: true,
      }));

      updatedProducts = [
        ...existing,
        ...newProducts,
      ];
    }

    setSaving(true);

    try {
      await setDoc(docRef, {
        products: updatedProducts.map((p) => cleanProduct(p)),
      });

      setSavedProducts(updatedProducts);

      setProducts([{
        productId: "",
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
        images: [],
        video: "",
        pdf: ""
      }]);
      setFileInputKey(prev => prev + 1);
      setEditIndex(null);

      toast.success(
        isEditing
          ? "Updated Successfully"
          : "Saved Successfully"
      );

    } catch (error) {
      toast.error("Something went wrong");
      console.error(error);

    } finally {
      setSaving(false);
    }

  };
  const handleExcelImport = async (e) => {
    setImporting(true);
    setImportProgress(0);
    const file = e.target.files[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();

      const buffer = await file.arrayBuffer();

      await workbook.xlsx.load(buffer);

      const worksheet = workbook.getWorksheet(1);
      const rowsCount = worksheet.rowCount - 1;

      const headers = {};

      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[
          cell.value?.toString().trim().toLowerCase()
        ] = colNumber;
      });
      const imageMap = {};

      // 🔥 Extract Images
      // worksheet.getImages().forEach((img) => {
      //   imageMap[img.range.tl.nativeRow + 1] = img.imageId;
      // });
      worksheet.getImages().forEach((img) => {
        const media = workbook.model.media.find(
          (m) => m.index === img.imageId
        );

        imageMap[img.imageId] = media;
      });

      const formatted = [];

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);

        let imageUrl = "";

        // 🔥 If image exists in row
        const currentImage = worksheet.getImages().find(
          (img) => img.range.tl.nativeRow + 1 === rowNumber
        );

        if (currentImage) {
          const image = imageMap[currentImage.imageId];

          if (image?.buffer) {
            const blob = new Blob([image.buffer]);

            const imageRef = ref(
              storage,
              `qlyte/products/${Date.now()}-${rowNumber}.png`
            );

            await uploadBytes(imageRef, blob);

            imageUrl = await getDownloadURL(imageRef);
            console.log("IMAGE URL:", imageUrl);
          }
        }

        const getValue = (key) => {
          const col = headers[key];

          if (!col) return "";

          const value = row.getCell(col).value;

          if (value == null) return "";

          if (typeof value === "object") {
            return value.text || value.richText?.map(t => t.text).join("") || "";
          }

          return String(value);
        };
        const hasData = [
          getValue("title").trim(),
          getValue("desc").trim(),
          getValue("brand").trim(),
          getValue("price").trim(),
          getValue("capacity").trim(),
          getValue("throughput").trim(),
          getValue("instrument").trim(),
          getValue("parameters").trim(),
          getValue("model").trim(),
          getValue("usage").trim(),
        ].some(value => value !== "");
        const category = getValue("category").trim();
        if (!hasData) {
          continue;
        }
        formatted.push({
          id: crypto.randomUUID(),

          category,

          title: getValue("title"),

          price: getValue("price"),

          desc: getValue("desc"),

          capacity: getValue("capacity"),

          throughput: getValue("throughput"),

          instrument: getValue("instrument"),

          model: getValue("model"),

          usage: getValue("usage"),

          brand: getValue("brand"),

          parameters: getValue("parameters"),

          automation: getValue("automation"),

          availability: getValue("availability"),

          size: getValue("size"),

          slug: getValue("title")
            ?.toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, ""),

          images: imageUrl ? [imageUrl] : [],
          video: "",
          pdf: "",

          createdAt: new Date().toISOString(),

          isPublished: true,
        });
        const processed = rowNumber - 1;

        setImportProgress(processed);


      }

      const docRef = doc(
        db,
        "websites",
        "qlyte",
        "pages",
        "products"
      );

      const snap = await getDoc(docRef);

      const existing =
        snap.exists() ? snap.data().products || [] : [];
      const maxProductId =
        existing.length > 0
          ? Math.max(
            ...existing.map((p) =>
              Number(p.productId || 0)
            )
          )
          : 0;

      let normalCounter = maxProductId;

      const normalProducts = formatted
        .filter((p) => !p.category)
        .map((item) => ({
          ...item,
          productId: ++normalCounter,
        }));

      const categoryProducts = formatted.filter(
        (p) => p.category
      );
      const updated = [
        ...existing,
        ...normalProducts,
      ];
      for (const product of categoryProducts) {

        const categorySlug = product.category
          .toLowerCase()
          .replace(/\s+/g, "-");

        const categoryRef = doc(
          db,
          "websites",
          "qlyte",
          "pages",
          "categoryproducts",
          "categories",
          categorySlug
        );

        const categorySnap = await getDoc(categoryRef);

        const existingCategoryProducts =
          categorySnap.exists()
            ? categorySnap.data().products || []
            : [];

        const prefix = product.category
          .split(" ")
          .map(word => word[0]?.toUpperCase())
          .join("");

        const nextCategoryId =
          existingCategoryProducts.length + 1;

        await setDoc(
          categoryRef,
          {
            id: categorySlug,
            category: product.category,

            products: [
              ...existingCategoryProducts,
              {
                ...product,

                categoryProductId:
                  `${prefix}-${nextCategoryId}`,
              }
            ]
          },
          { merge: true }
        );
      }
      await setDoc(docRef, {
        products: updated,
      });

      setSavedProducts(updated);

      toast.success("Excel imported with images ");
    } catch (err) {
      console.error(err);
      toast.error("Import failed ");
    } finally {
      setImporting(false);
    }
  };

  const downloadDemoExcel = async () => {
    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet("Products");

    worksheet.columns = [
      { header: "title", key: "title", width: 30 },
      { header: "price", key: "price", width: 15 },
      { header: "desc", key: "desc", width: 40 },
      { header: "capacity", key: "capacity", width: 20 },
      { header: "throughput", key: "throughput", width: 20 },
      { header: "instrument", key: "instrument", width: 20 },
      { header: "model", key: "model", width: 20 },
      { header: "usage", key: "usage", width: 20 },
      { header: "brand", key: "brand", width: 20 },
      { header: "parameters", key: "parameters", width: 20 },
      { header: "automation", key: "automation", width: 20 },
      { header: "availability", key: "availability", width: 20 },
      { header: "size", key: "size", width: 20 },
      { header: "category", key: "category", width: 25 },
    ];

    worksheet.addRow({
      title: "CBC Analyzer",
      price: "50000",
      desc: "Demo Product",
      capacity: "100 Tests",
      throughput: "60/hr",
      instrument: "Analyzer",
      model: "CBC-100",
      usage: "Lab",
      brand: "Human",
      parameters: "3 Part",
      automation: "Semi Auto",
      availability: "In Stock",
      size: "Medium",
      category: "Hematology"
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob(
      [buffer],
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    );

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "Products-Demo.xlsx";

    a.click();

    window.URL.revokeObjectURL(url);
  };
  const handleMultipleImagesUpload = async (index, files) => {
    if (!files?.length) return;

    setImageUploading(true);
    setUploadProgress(0);

    try {
      const urls = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const imageRef = ref(
          storage,
          `qlyte/products/${Date.now()}-${file.name}`
        );

        const uploadTask = uploadBytesResumable(imageRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setUploadProgress(progress);
            },
            reject,
            resolve
          );
        });

        const url = await getDownloadURL(imageRef);
        urls.push(url);
      }

      const updated = [...products];

      updated[index].images = [
        ...(updated[index].images || []),
        ...urls,
      ];

      setProducts(updated);
    } catch (err) {
      console.error(err);
      toast.error("Image upload failed");
    } finally {
      setImageUploading(false);
      setUploadProgress(0);
    }
  };
  const handleVideoUpload = async (index, file) => {
    if (!file) return;

    setImageUploading(true);

    try {
      const videoRef = ref(
        storage,
        `qlyte/videos/${Date.now()}-${file.name}`
      );

      await uploadBytes(videoRef, file);

      const videoUrl = await getDownloadURL(videoRef);

      const updated = [...products];
      updated[index].video = videoUrl;

      setProducts(updated);

      toast.success("Video uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Video upload failed");
    } finally {
      setImageUploading(false);
    }
  };
  const handlePdfUpload = async (index, file) => {
    if (!file) return;

    setImageUploading(true);

    try {
      const pdfRef = ref(
        storage,
        `qlyte/pdfs/${Date.now()}-${file.name}`
      );

      await uploadBytes(pdfRef, file);

      const pdfUrl = await getDownloadURL(pdfRef);

      const updated = [...products];
      updated[index].pdf = pdfUrl;

      setProducts(updated);

      toast.success("PDF uploaded");
    } catch (err) {
      console.error(err);
      toast.error("PDF upload failed");
    } finally {
      setImageUploading(false);
    }
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
        doc(db, "websites", "qlyte", "pages", "products"),
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
        doc(db, "websites", "qlyte", "pages", "products"),
        { products: updated }
      );
    } catch (err) {
      toast.error("Failed to update");

      // rollback (optional)
      setSavedProducts(savedProducts);
    }
  };

  const pathname = usePathname();
  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  return (
    <div className="main">
      <div className="tabs-wrapper">
        <button
          className={activeTab === "products" ? "tab active" : "tab"}
          onClick={() => router.push("?tab=products")}
        >
          Products
        </button>

        <button
          className={activeTab === "categories" ? "tab active" : "tab"}
          onClick={() => router.push("?tab=categories")}
        >
          Categories
        </button>
      </div>
      {activeTab === "products" && (
        <>
          <div className="top-header">

            <div className="page-path">
              {pathParts.map((part, index) => (
                <span key={index}>
                  {part.charAt(0).toUpperCase() + part.slice(1)}
                  {index !== pathParts.length - 1 && " > "}
                </span>
              ))}
            </div>

            <h1 className="heading">Product Page</h1>

          </div>


          {/* FORM */}
          <div className="card">
            <h2>{editIndex !== null ? "Edit Product" : "Add Product"}</h2>

            {products.map((item, i) => (
              <div key={i} className="product-form-card">

                {/* Product Fields */}
                <div className="form-row">
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
                </div>

                {/* Media Upload Section */}
                <div className="media-section">

                  {/* Images */}
                  <div className="media-card">
                    <label>📷 Product Images</label>

                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) =>
                        handleMultipleImagesUpload(
                          i,
                          Array.from(e.target.files)
                        )
                      }
                    />

                    {item.images?.length > 0 && (
                      <span className="upload-link">
                        {item.images.length} Images Uploaded
                      </span>
                    )}
                  </div>

                  {/* Video */}
                  <div className="media-card">
                    <label>🎥 Product Video</label>

                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) =>
                        handleVideoUpload(i, e.target.files[0])
                      }
                    />

                    {item.video && (
                      <span className="upload-link">
                        Video Uploaded ✓
                      </span>
                    )}
                  </div>

                  {/* PDF */}
                  <div className="media-card">
                    <label>📄 PDF Brochure</label>

                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        handlePdfUpload(i, e.target.files[0])
                      }
                    />

                    {item.pdf && (
                      <a
                        href={item.pdf}
                        target="_blank"
                        rel="noreferrer"
                        className="upload-link"
                      >
                        View PDF
                      </a>
                    )}
                  </div>

                </div>

              </div>
            ))}



            <div className="actions">
              <button onClick={addProduct}>+ Add</button>
              <button
                className="add-btn"
                onClick={saveProducts}
                disabled={saving || imageUploading}
              >
                {imageUploading
                  ? `Uploading ${uploadProgress}%`
                  : saving
                    ? "Processing..."
                    : editIndex !== null
                      ? "Update"
                      : "Save"}
              </button>

            </div>

          </div>

          {/* TABLE */}
          <div className="preview">
            <div className="header-row">

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>

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
                  disabled={importing}
                >
                  <FileUp size={16} style={{ marginRight: "6px" }} />

                  {importing
                    ? `Importing ${importProgress}`
                    : "Import"}
                </button>
                <button
                  className="import-btn"
                  onClick={downloadDemoExcel}
                >
                  Download Demo
                </button>
                {!bulkMode ? (
                  <button
                    className="bulk-btn"
                    onClick={() => setBulkMode(true)}
                  >
                    Bulk Actions
                  </button>
                ) : (
                  <>
                    <button
                      className="delete-selected-btn"
                      onClick={deleteSelectedProducts}
                    >
                      Delete Selected ({selectedProducts.length})
                    </button>

                    <button
                      className="delete-all-btn"
                      onClick={() => {
                        setBulkMode(true);

                        setSelectedProducts(
                          savedProducts.map((p) => p.id)
                        );

                        setIsDeleteAllModalOpen(true);
                      }}
                    >
                      Delete All
                    </button>

                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setBulkMode(false);
                        setSelectedProducts([]);
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}

              </div>

            </div>
            <table className="product-table">
              <thead>
                <tr>
                  {bulkMode && (
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          selectedProducts.length === savedProducts.length &&
                          savedProducts.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(
                              savedProducts.map((p) => p.id)
                            );
                          } else {
                            setSelectedProducts([]);
                          }
                        }}
                      />
                    </th>
                  )}
                  <th>Product ID</th>
                  <th>Create At</th>
                  <th>Image</th>
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
                      {bulkMode && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(item.id)}
                            onChange={() =>
                              handleSelectProduct(item.id)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      )}
                      <td>{item.productId || "-"}</td>
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                      <td>
                        {item.images?.length > 0 ? (
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="product-thumb"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageModal(item.images[0]);
                            }}
                          />
                        ) : (
                          <div className="no-image">
                            {item.title
                              ? item.title
                                .split(" ")
                                .slice(0, 2)
                                .join(" ")
                              : "No Img"}
                          </div>
                        )}
                      </td>
                      <td className="product-title">
                        {String(item.title || "").length > 20
                          ? String(item.title).slice(0, 20) + "..."
                          : String(item.title || "")}
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

                              <p><b>Title:</b> {String(item.title || "")}</p>
                              <p><b>Price:</b> ₹{item.price}</p>
                              <p><b>Description:</b> {String(item.desc || "")}</p>
                              <p><b>Capacity:</b> {item.capacity}</p>
                              <p><b>Throughput:</b> {item.throughput}</p>
                              <p><b>Instrument:</b> {item.instrument}</p>
                              <p><b>Model:</b> {item.model}</p>
                              <p><b>Usage:</b> {item.usage}</p>
                              <p><b>Parameters:</b> {item.parameters}</p>
                              <p><b>Brand:</b> {item.brand}</p>
                              <p><b>Automation:</b> {item.automation}</p>
                              <p><b>Availability:</b> {item.availability}</p>
                              <p><b>Size:</b> {item.size}</p>

                              <p>
                                <b>Video:</b>{" "}
                                {item.video ? (
                                  <a
                                    href={item.video}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View Video
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </p>

                              <p>
                                <b>PDF:</b>{" "}
                                {item.pdf ? (
                                  <a
                                    href={item.pdf}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </p>

                              {/* Images Row */}
                              <div
                                style={{
                                  gridColumn: "1 / -1",
                                  marginTop: "10px",
                                  background: "#fff",
                                  border: "1px solid #eee",
                                  borderRadius: "10px",
                                  padding: "12px"
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "600",
                                    marginBottom: "10px"
                                  }}
                                >
                                  Images ({item.images?.length || 0})
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap"
                                  }}
                                >
                                  {item.images?.map((img, index) => (
                                    <img
                                      key={index}
                                      src={img}
                                      alt={`product-${index}`}
                                      onClick={() => setImageModal(img)}
                                      style={{
                                        width: "45px",
                                        height: "45px",
                                        objectFit: "cover",
                                        borderRadius: "6px",
                                        border: "1px solid #ddd",
                                        cursor: "pointer"
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>

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
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="delete-btn" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </Modal>
          <Modal
            isOpen={isDeleteAllModalOpen}
            onRequestClose={() => setIsDeleteAllModalOpen(false)}
            className="modal-box"
            overlayClassName="modal-overlay"
          >
            <h2>Delete All Products</h2>

            <p>
              Are you sure you want to delete permanently
              <b> {savedProducts.length} products</b>?
            </p>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setIsDeleteAllModalOpen(false);
                  setSelectedProducts([]);
                }}
              >
                Cancel
              </button>

              <button
                className="delete-btn"
                onClick={async () => {
                  await deleteAllProducts();
                  setIsDeleteAllModalOpen(false);
                }}
              >
                Delete All
              </button>
            </div>
          </Modal>
          {/* <Modal
            isOpen={imageGallery.length > 0}
            onRequestClose={() => {
              setImageGallery([]);
              setCurrentImageIndex(0);
            }}
            className="image-modal"
            overlayClassName="modal-overlay"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px"
              }}
            >
              <button
                disabled={currentImageIndex === 0}
                onClick={() =>
                  setCurrentImageIndex((prev) => prev - 1)
                }
              >
                ◀
              </button>

              <img
                src={imageGallery[currentImageIndex]}
                alt=""
                className="full-img"
              />

              <button
                disabled={
                  currentImageIndex === imageGallery.length - 1
                }
                onClick={() =>
                  setCurrentImageIndex((prev) => prev + 1)
                }
              >
                ▶
              </button>
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: "10px"
              }}
            >
              {currentImageIndex + 1} / {imageGallery.length}
            </p>
          </Modal> */}
          <Modal
            isOpen={!!imageModal}
            onRequestClose={() => setImageModal(null)}
            className="image-modal"
            overlayClassName="modal-overlay"
          >
            <img src={imageModal} alt="preview" className="full-img" />
          </Modal>
        </>
      )}
      {activeTab === "categories" && (
        <CategoryProduct />
      )}
    </div>
  );
}
