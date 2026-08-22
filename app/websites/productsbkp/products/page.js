"use client";
import React from "react";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Modal from "react-modal";
import toast, { Toaster } from "react-hot-toast";
import { Pencil, Trash2, Upload, FileUp } from "lucide-react";
import ExcelJS from "exceljs";
import { storage } from "@/lib/firebase";
import "./products.css"
import { usePathname } from "next/navigation";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
  uploadBytesResumable,
  listAll
} from "firebase/storage";
import dynamic from "next/dynamic";
import { getWatermarkDisplayText } from "@/lib/websiteWatermarks";

const applyWatermarkClientSide = (imageUrl, websiteText) => {
  return new Promise((resolve) => {
    if (!imageUrl || typeof imageUrl !== "string") {
      return resolve(imageUrl);
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      resolve(imageUrl);
    }, 4000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 800;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.font = "600 18px 'Segoe UI', Roboto, sans-serif";

        ctx.translate(width / 2, height / 2);
        ctx.rotate((-25 * Math.PI) / 180);

        const text = websiteText;
        const textWidth = ctx.measureText(text).width + 70;
        const stepY = 90;

        const diagonal = Math.sqrt(width * width + height * height) * 1.5;
        const startX = -diagonal;
        const endX = diagonal;
        const startY = -diagonal;
        const endY = diagonal;

        let row = 0;
        for (let y = startY; y < endY; y += stepY) {
          const offsetX = (row % 2) * (textWidth / 2);
          for (let x = startX; x < endX; x += textWidth) {
            ctx.fillText(text, x + offsetX, y);
          }
          row++;
        }

        ctx.restore();

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        resolve(dataUrl);
      } catch (err) {
        console.error("Canvas watermark error:", err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
};

const CategoryProduct = dynamic(
  () => import("./CategoryProduct"),
  {
    ssr: false,
  }
);
const COMPANY_WEBSITES = {
  human: [
    "humanbiomedicalorg",
    "humanbiomedicalin",
    "humanbiomedicalsin",
    "humanbiomedicalsorg",
    "humanbiomedicalscoin",
    "humanbiomedicalcom",
    "humanbiomedicalsnet"
  ],

  global: [
    "globalbiomedicalorg",
    "globalbiomedicalsin",
    "globalbiomedicalsnet"
  ],

  rajbiosis: [
    "indiandiagnostic",
    "centralbiomedicals",
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
    "rajbiosisltd",
    "glucostripscom",
    "glucometersin",
    "humarilabin",
    "safekitin",
    "haemoglobinstripcom",
    "haemoglobinstripscom",
    "hemoglobinmetercom",
    "rajbiosiscoin",
    "clinicalchemistryin",
    "humarilabcom",
    "globalhealthkartcom",
    "medicalsjobportalcom",
    "hemoglobinstripcom",
    "tublerin",
    "haemoglobinmetercom",
    "hemoglobinstripin",
    "rajbiosisinfo",
    "cliakitscom",
  ],


  qlyte: [
    "qlyte"
  ]
};

export default function Products() {
  const [selectedCompany, setSelectedCompany] =
    useState("human");

  const [selectedWebsite, setSelectedWebsite] =
    useState("all");
  const currentWebsite =
    selectedWebsite === "all"
      ? COMPANY_WEBSITES[selectedCompany]?.[0]
      : selectedWebsite;

  const [isGeneratingWatermark, setIsGeneratingWatermark] = useState(false);
  const [watermarkProgress, setWatermarkProgress] = useState(0);
  const [watermarkStatusText, setWatermarkStatusText] = useState("");
  const [watermarkCurrentTitle, setWatermarkCurrentTitle] = useState("");

  const generateWatermarksForWebsite = async (targetWebsite, productsList, onProgress) => {
    if (!productsList || productsList.length === 0) return productsList;

    const updatedProducts = [];
    const totalProducts = productsList.length;

    for (let pIndex = 0; pIndex < totalProducts; pIndex++) {
      const product = productsList[pIndex];

      if (onProgress) {
        onProgress(pIndex, totalProducts, product.title || `Product #${product.productId || pIndex + 1}`);
      }

      const images = Array.isArray(product.images)
        ? product.images
        : product.image
          ? [product.image]
          : [];

      if (images.length === 0) {
        updatedProducts.push(product);
        continue;
      }

      const watermarkedImages = [];
      for (let imgIndex = 0; imgIndex < images.length; imgIndex++) {
        const imgUrl = images[imgIndex];
        if (!imgUrl) continue;

        try {
          const res = await fetch("/api/generate-watermark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: imgUrl, website: targetWebsite }),
          });
          const data = await res.json();

          if (data.success && data.watermarkedImage) {
            // Upload to Firebase Storage
            const blobRes = await fetch(data.watermarkedImage);
            const blob = await blobRes.blob();
            const filename = `${product.productId || product.id || Date.now()}_${imgIndex}_wm.jpg`;
            const storageRef = ref(storage, `watermarked_products/${targetWebsite}/${filename}`);
            await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(storageRef);
            watermarkedImages.push(downloadUrl);
          } else {
            watermarkedImages.push(imgUrl);
          }
        } catch (err) {
          console.error("Watermark generation error for image:", err);
          watermarkedImages.push(imgUrl);
        }
      }

      updatedProducts.push({
        ...product,
        images: watermarkedImages,
      });
    }

    if (onProgress) {
      onProgress(totalProducts, totalProducts, "Completed website processing");
    }

    return updatedProducts;
  };

  const generateWatermarks = async () => {
    setIsGeneratingWatermark(true);
    setWatermarkProgress(15);
    setWatermarkStatusText("Applying instant website watermarks...");
    setWatermarkCurrentTitle("");

    try {
      const targetWebsites =
        selectedWebsite === "all"
          ? COMPANY_WEBSITES[selectedCompany] || []
          : [selectedWebsite];

      const totalWebsites = targetWebsites.length;

      for (let wIdx = 0; wIdx < totalWebsites; wIdx++) {
        const site = targetWebsites[wIdx];

        setWatermarkStatusText(`Applying watermark for ${site}...`);
        setWatermarkProgress(Math.round(((wIdx + 1) / totalWebsites) * 90));

        const docRef = doc(db, "websites", site, "pages", "products");
        const snap = await getDoc(docRef);
        const siteProducts = snap.exists() ? snap.data().products || [] : [];

        if (siteProducts.length === 0) continue;

        // Direct Server-Side Watermark Generation & Storage Upload (Zero Base64 in Firestore)
        const watermarkedProds = await Promise.all(
          siteProducts.map(async (product, pIdx) => {
            const allCandidateUrls = [
              ...(Array.isArray(product.originalImages) ? product.originalImages : []),
              ...(Array.isArray(product.images) ? product.images : []),
              ...(product.image ? [product.image] : [])
            ];

            const cleanOriginals = allCandidateUrls.filter(
              (url) => typeof url === "string" && !url.includes("watermarked_products") && !url.startsWith("data:image")
            );

            const sourceImages = cleanOriginals.length > 0 ? cleanOriginals : allCandidateUrls;
            if (sourceImages.length === 0) return product;

            setWatermarkCurrentTitle(product.title || `Product #${pIdx + 1}`);

            const watermarkedStorageUrls = await Promise.all(
              sourceImages.map(async (imgUrl) => {
                try {
                  const res = await fetch("/api/generate-watermark", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl: imgUrl, website: site }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.watermarkedImage) {
                      return data.watermarkedImage;
                    }
                  }
                } catch (e) {
                  console.error("Watermark API error:", e);
                }
                return imgUrl;
              })
            );

            return {
              ...product,
              originalImages: cleanOriginals.length > 0 ? cleanOriginals : (product.originalImages || sourceImages),
              images: watermarkedStorageUrls,
            };
          })
        );

        if (site === currentWebsite || selectedWebsite === "all" || site === selectedWebsite) {
          setSavedProducts(watermarkedProds);
        }

        // Save directly to Firestore (clean HTTPS Storage URLs only, 10KB doc size)
        await setDoc(docRef, { products: watermarkedProds });
      }

      setWatermarkProgress(100);
      setWatermarkStatusText("Watermarks applied successfully!");
      toast.success("Watermarks applied successfully!");
    } catch (error) {
      console.error("Watermark error:", error);
      toast.error("Failed to generate watermarks");
    } finally {
      setTimeout(() => {
        setIsGeneratingWatermark(false);
      }, 300);
    }
  };
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
  const [importingCompany, setImportingCompany] = useState("");
  const [replaceImages, setReplaceImages] = useState(true);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyToWebsites, setCopyToWebsites] = useState([]);
  const [copyLoading, setCopyLoading] = useState(false);
  const [showCategoryPage, setShowCategoryPage] = useState(false);

  useEffect(() => {
    setSelectedWebsite("all");
  }, [selectedCompany]);

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
      imagePaths: [],
      video: "",
      pdf: "",
    }
  ]);
  const cleanProduct = (p) => {
    const rawImgs = Array.isArray(p.images) ? p.images : p.image ? [p.image] : [];
    const cleanOrigs = (Array.isArray(p.originalImages) ? p.originalImages : rawImgs).filter(
      (url) => typeof url === "string" && !url.includes("watermarked_products") && !url.startsWith("data:image")
    );

    return {
      id: p.id || crypto.randomUUID(),
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
      originalImages: cleanOrigs.length > 0 ? cleanOrigs : (p.originalImages || rawImgs),
      images: rawImgs,
      imagePaths: Array.isArray(p.imagePaths) ? p.imagePaths : [],
      video: p.video || "",
      pdf: p.pdf || "",
      createdAt: p.createdAt ? p.createdAt : new Date().toISOString(),
      isPublished: typeof p.isPublished === "boolean" ? p.isPublished : true,
    };
  };
  const saveToAllWebsites = async (productsData) => {
    await Promise.all(
      COMPANY_WEBSITES[selectedCompany].map((website) =>
        setDoc(
          doc(
            db,
            "websites",
            website,
            "pages",
            "products"
          ),
          {
            products: productsData,
          }
        )
      )
    );
  };

  const saveProductsData = async (productsData) => {

    // All Websites
    if (selectedWebsite === "all") {
      await Promise.all(
        COMPANY_WEBSITES[selectedCompany].map((website) =>
          setDoc(
            doc(
              db,
              "websites",
              website,
              "pages",
              "products"
            ),
            {
              products: productsData,
            }
          )
        )
      );

      return;
    }

    // Single Website
    await setDoc(
      doc(
        db,
        "websites",
        selectedWebsite,
        "pages",
        "products"
      ),
      {
        products: productsData,
      }
    );
  };
  const copyProductsToWebsites = async () => {
    if (copyToWebsites.length === 0) {
      toast.error("Select at least one website");
      return;
    }

    setCopyLoading(true);

    try {

      // Source products
      const sourceSnap = await getDoc(
        doc(
          db,
          "websites",
          currentWebsite,
          "pages",
          "products"
        )
      );

      const sourceProducts =
        sourceSnap.exists()
          ? sourceSnap.data().products || []
          : [];

      for (const website of copyToWebsites) {

        const destinationRef = doc(
          db,
          "websites",
          website,
          "pages",
          "products"
        );

        const destinationSnap = await getDoc(destinationRef);

        const destinationProducts =
          destinationSnap.exists()
            ? destinationSnap.data().products || []
            : [];

        let maxProductId =
          destinationProducts.length > 0
            ? Math.max(
              ...destinationProducts.map((p) =>
                Number(p.productId || 0)
              )
            )
            : 0;

        const newProducts = [];

        for (const product of sourceProducts) {

          const alreadyExists =
            destinationProducts.some((p) => {

              const slug1 = (p.slug || "").trim().toLowerCase();
              const slug2 = (product.slug || "").trim().toLowerCase();

              const title1 = (p.title || "").trim().toLowerCase();
              const title2 = (product.title || "").trim().toLowerCase();

              return slug1 === slug2 || title1 === title2;
            });

          if (alreadyExists) continue;

          maxProductId++;

          newProducts.push({
            ...product,
            id: crypto.randomUUID(),
            productId: maxProductId,
          });
        }

        await setDoc(destinationRef, {
          products: [
            ...destinationProducts,
            ...newProducts,
          ],
        });
      }

      toast.success("Products copied successfully");

      setCopyToWebsites([]);
      setIsCopyModalOpen(false);

    } catch (err) {
      console.error(err);
      toast.error("Copy failed");
    } finally {
      setCopyLoading(false);
    }
  };
  const getWorkingWebsite = () => {
    return selectedWebsite === "all"
      ? COMPANY_WEBSITES[selectedCompany][0]
      : selectedWebsite;
  };
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
        doc(
          db,
          "websites",
          currentWebsite,
          "pages",
          "products"
        )
      );

      if (snap.exists()) {
        const products = (snap.data().products || []).map((p) => ({
          ...p,
          title:
            typeof p.title === "object"
              ? p.title?.text ||
              p.title?.richText?.map(x => x.text).join("") ||
              ""
              : p.title || "",

          desc:
            typeof p.desc === "object"
              ? p.desc?.text ||
              p.desc?.richText?.map(x => x.text).join("") ||
              ""
              : p.desc || "",
        }));

        setSavedProducts(products);
      } else {
        setSavedProducts([]);
      }
    };

    fetchData();

  }, [currentWebsite]);


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

      await saveProductsData(updated);

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

      await saveProductsData([]);

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
    const docRef = doc(
      db,
      "websites",
      getWorkingWebsite(),
      "pages",
      "products"
    );
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
      await saveProductsData(
        updatedProducts.map((p) => cleanProduct(p))
      );

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

  const getFirebaseImageMap = async (
    category,
    subCategory
  ) => {

    const imageMap = {};

    try {

      const folderRef = ref(
        storage,
        `${category}/${subCategory}`
      );

      const files = await listAll(folderRef);
      console.log("Folder:", folderRef.fullPath);
      console.log("Total Images:", files.items.length);
      const urls = [];

      for (const file of files.items) {
        const url = await getDownloadURL(file);

        urls.push({
          name: file.name.toLowerCase(),
          fullPath: file.fullPath.toLowerCase(),
          url,
        });
      }

      imageMap[subCategory.toLowerCase()] = urls;

    } catch (err) {

      console.log("Folder not found", subCategory);

    }

    return imageMap;
  };
  const loadExcelFile = async (file) => {

    const workbook = new ExcelJS.Workbook();

    const buffer = await file.arrayBuffer();

    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1);

    const headers = {};

    worksheet.getRow(1).eachCell((cell, colNumber) => {

      headers[
        cell.value?.toString().trim().toLowerCase()
      ] = colNumber;

    });

    return {
      worksheet,
      headers,
      rowsCount: worksheet.rowCount - 1,
    };

  };

  const buildImageMap = async (
    replaceImages,
    worksheet,
    headers,
    fileSubCategory
  ) => {

    if (!replaceImages) {
      return {};
    }

    const firstCategory = worksheet
      .getRow(2)
      .getCell(headers["category"])
      .value;

    if (!firstCategory) {
      return {};
    }

    const imageMap = await getFirebaseImageMap(
      String(firstCategory).trim(),
      fileSubCategory
    );


    return imageMap;

  };
  const parseExcelRow = (
    row,
    headers,
    imageMap,
    imageIndexMap,
    replaceImages,
    fileSubCategory
  ) => {

    const getValue = (key) => {

      const col = headers[key];

      if (!col) return "";

      const value = row.getCell(col).value;

      if (value == null) return "";

      if (typeof value === "object") {
        return (
          value.text ||
          value.richText?.map(t => t.text).join("") ||
          ""
        );
      }

      return String(value);

    };

    const imageUrls = [
      ...new Set(
        getValue("images")
          .split(/\r?\n|,/)
          .map(url => url.trim())
          .filter(url => /^https?:\/\//i.test(url))
      )
    ];
    const imageFileNames = imageUrls.map(url =>
      url
        .split("/")
        .pop()
        .split("?")[0]
        .toLowerCase()
    );
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
    ].some(Boolean);

    if (!hasData) {
      return null;
    }

    const category = getValue("category").trim();
    const subCategory =
      getValue("sub category").trim() ||
      fileSubCategory;

    let images = imageUrls;

    if (replaceImages && subCategory) {

      const key = subCategory.toLowerCase();

      const firebaseImages = imageMap[key] || [];
      console.log("SubCategory:", key);
      console.log("Firebase Images:", firebaseImages);
      // 1st Priority - Exact filename match
      const exactMatches = firebaseImages.filter(img =>
        imageFileNames.includes(img.name.toLowerCase())
      );

      if (exactMatches.length > 0) {
        images = exactMatches.map(img => img.url);
      } else {
        const normalize = (str = "") =>
          String(str)
            .toLowerCase()
            .replace(/^https?:\/\/.*\//, "")       // URL remove
            .replace(/\?.*$/, "")                  // query remove
            .replace(/\.(jpg|jpeg|png|webp)$/i, "")
            .replace(/500x500|250x250|1000x1000/gi, "")
            .replace(/[-_]/g, " ")
            .replace(/\d+x\d+/g, "")
            .replace(/[^a-z0-9]/g, " ")
            .replace(/\s+/g, " ")
            .trim();


        const stopWords = [
          "blood",
          "collection",
          "set",
          "for",
          "with",
          "and",
          "the",
          "of",
          "in",
          "size",
          "plastic",
          "clinical",
          "hospital",
          "laboratory"
        ];

        const words = normalize(getValue("title"))
          .split(" ")
          .filter(word => word.length > 1);

        const titleText = normalize(getValue("title"));
        console.log("Excel Title:", getValue("title"));
        const scored = firebaseImages
          .map((img) => {

            const imageName = normalize(
              `${img.name} ${img.fullPath}`
            );

            let score = 0;

            // Title words
            for (const word of words) {
              if (imageName.includes(word)) {
                score += 2;
              }
            }

            // Full title match bonus
            if (titleText && imageName.includes(titleText)) {
              score += 20;
            }

            // Reverse match bonus
            if (titleText && titleText.includes(imageName)) {
              score += 10;
            }
            console.log({
              excel: getValue("title"),
              image: img.name,
              score,
            });
            return {
              ...img,
              score,
            };
          })
          .sort((a, b) => b.score - a.score);

        if (scored.length && scored[0].score > 0) {
          images = [scored[0].url];
        }

      }
    }
    return {

      id: crypto.randomUUID(),

      category,

      subCategory,

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

      images,

      video: getValue("video").trim(),

      pdf: getValue("pdf").trim(),

      createdAt: new Date().toISOString(),

      isPublished: true,

    };

  };
  const handleExcelImport = async (e) => {
    setImporting(true);
    setImportingCompany(selectedCompany);
    setImportProgress(0);

    const files = Array.from(e.target.files || []);


    if (files.length === 0) {
      setImporting(false);
      setImportingCompany("");
      return;
    }

    try {
      for (const file of files) {

        const fileSubCategory = file.name
          .replace(/\.xlsx?$/i, "")
          .trim();
        const {
          worksheet,
          headers,
          rowsCount,
        } = await loadExcelFile(file);

        const formatted = [];
        const imageIndexMap = {};
        const imageMap = await buildImageMap(
          replaceImages,
          worksheet,
          headers,
          fileSubCategory
        );

        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

          const row = worksheet.getRow(rowNumber);
          const product = parseExcelRow(
            row,
            headers,
            imageMap,
            imageIndexMap,
            replaceImages,
            fileSubCategory
          );

          if (!product) continue;

          formatted.push(product);

          setImportProgress(rowNumber - 1);

          // Optional
          setImportPercent(
            Math.round(((rowNumber - 1) / rowsCount) * 100)
          );
        }

        const docRef = doc(
          db,
          "websites",
          getWorkingWebsite(),
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
        const subCategoryCache = {};
        const pendingWrites = {};
        const subCategoryPromises = {};
        const updated = [
          ...existing,
          ...normalProducts,
        ];
        for (const website of COMPANY_WEBSITES[selectedCompany]) {

          for (const product of categoryProducts) {

            const categorySlug = product.category
              .toLowerCase()
              .replace(/\s+/g, "-");

            const categoryRef = doc(
              db,
              "websites",
              website,
              "pages",
              "categoryproducts",
              "categories",
              categorySlug
            );

            // const categorySnap = await getDoc(categoryRef);

            // const existingCategoryProducts =
            //   categorySnap.exists()
            //     ? categorySnap.data().products || []
            //     : [];

            const subCategorySlug = (product.subCategory || "General")
              .toLowerCase()
              .replace(/\s+/g, "-");

            const subCategoryRef = doc(
              db,
              "websites",
              website,
              "pages",
              "categoryproducts",
              "categories",
              categorySlug,
              "subcategories",
              subCategorySlug
            );

            const cacheKey = `${website}-${categorySlug}-${subCategorySlug}`;

            let existingSubProducts = [];

            if (subCategoryCache[cacheKey]) {

              existingSubProducts = subCategoryCache[cacheKey];

            } else {

              if (!subCategoryPromises[cacheKey]) {
                subCategoryPromises[cacheKey] = getDoc(subCategoryRef);
              }

              const subCategorySnap = await subCategoryPromises[cacheKey];

              existingSubProducts =
                subCategorySnap.exists()
                  ? [...(subCategorySnap.data().products || [])]
                  : [];

              subCategoryCache[cacheKey] = existingSubProducts;

            }

            const prefix = product.category
              .split(" ")
              .map(word => word[0]?.toUpperCase())
              .join("");

            // const nextCategoryId =
            //   existingCategoryProducts.length + 1;

            // Category document create/update
            // await setDoc(
            //   categoryRef,
            //   {
            //     id: categorySlug,
            //     category: product.category,
            //   },
            //   { merge: true }
            // );
            const writeKey = `${website}-${categorySlug}-${subCategorySlug}`;

            if (!pendingWrites[writeKey]) {
              pendingWrites[writeKey] = {
                categoryRef,
                subCategoryRef,
                category: product.category,
                subCategory: product.subCategory || "General",
                products: [...existingSubProducts],
              };
            }

            pendingWrites[writeKey].products.push({
              ...product,
              categoryProductId: `${prefix}-${pendingWrites[writeKey].products.length + 1}`,
            });
            // Subcategory document create/update
            // await setDoc(
            //   subCategoryRef,
            //   {
            //     id: subCategorySlug,
            //     subCategory: product.subCategory || "General",

            //     products: [
            //       ...existingSubProducts,
            //       {
            //         ...product,
            //         categoryProductId: `${prefix}-${existingSubProducts.length + 1}`,
            //       }
            //     ]
            //   },
            //   { merge: true }
            // );
          }
        }
        await Promise.all(
          Object.values(pendingWrites).flatMap((item) => [
            setDoc(
              item.categoryRef,
              {
                id: item.categoryRef.id,
                category: item.category,
              },
              { merge: true }
            ),

            setDoc(
              item.subCategoryRef,
              {
                id: item.subCategoryRef.id,
                subCategory: item.subCategory,
                products: item.products,
              },
              { merge: true }
            )
          ])
        );
        await saveProductsData(updated);

        setSavedProducts(updated);

        toast.success("Products Imported Successfully");
      }
    } catch (err) {
      console.error(err);
      toast.error("Import failed ");
    } finally {
      setImporting(false);
      setImportingCompany("");
      setImportProgress(0);

      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const downloadDemoExcel = async () => {
    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet("Products");

    const columns = [
      { header: "title", key: "title", width: 35 },
      { header: "price", key: "price", width: 15 },
      { header: "desc", key: "desc", width: 50 },
      { header: "capacity", key: "capacity", width: 35 },
      { header: "throughput", key: "throughput", width: 20 },
      { header: "instrument", key: "instrument", width: 35 },
      { header: "model", key: "model", width: 20 },
      { header: "usage", key: "usage", width: 20 },
      { header: "brand", key: "brand", width: 20 },
      { header: "parameters", key: "parameters", width: 25 },
      { header: "automation", key: "automation", width: 25 },
      { header: "availability", key: "availability", width: 20 },
      { header: "size", key: "size", width: 30 },
      { header: "category", key: "category", width: 25 },
      { header: "video", key: "video", width: 50 },
      { header: "pdf", key: "pdf", width: 50 },
    ];
    columns.push({
      header: "images",
      key: "images",
      width: 80,
    });
    worksheet.columns = columns;


    const demoRow = {
      title: "Chemiluminescence Immunoassay Analyzer CLIA 200",
      price: "1235157",
      desc: "Fully automatic bench-top chemiluminescence immunoassay analyzer for clinical diagnostics.",
      capacity: "Automatic pipetting, microplate incubation, washing & detection",
      throughput: "142 T/h",
      instrument: "Fully Automated CLIA Analyzer",
      model: "CLIA 200",
      usage: "Clinic",
      brand: "Addcare / ADC",
      parameters: "",
      automation: "Fully Automatic",
      availability: "Limited Stock",
      size: "Bench-top (1085 × 580 mm)",
      category: "",
      video: "https://example.com/video.mp4",
      pdf: "https://example.com/brochure.pdf",
    };

    demoRow.images = `https://example.com/image1.jpg
https://example.com/image2.jpg
https://example.com/image3.jpg`;

    worksheet.addRow(demoRow);


    const imageCell = worksheet.getCell("Q2");

    imageCell.alignment = {
      wrapText: true,
    };

    worksheet.getRow(2).height = 60;

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
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const imageRef = ref(
          storage,
          `${currentWebsite}/products/${Date.now()}-${file.name}`
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
        paths.push(imageRef.fullPath);
      }

      const updated = [...products];
      const oldPaths = updated[index].imagePaths || [];

      for (const path of oldPaths) {
        try {
          await deleteObject(ref(storage, path));
        } catch (err) {
          console.log("Old image delete failed:", err);
        }
      }

      updated[index].images = urls;
      updated[index].imagePaths = paths;
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
        `${currentWebsite}/videos/${Date.now()}-${file.name}`
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
        `${currentWebsite}/pdfs/${Date.now()}-${file.name}`
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

    try {

      await saveProductsData(updated);

      toast.success("Deleted successfully");

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

    try {

      await saveProductsData(updated);

      toast.success(
        updated[index].isPublished
          ? "Product Visible"
          : "Product Hidden"
      );

    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const pathname = usePathname();
  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  if (showCategoryPage) {
    return (
      <div
        style={{
          // marginLeft: "180px",
          padding: "20px",
        }}
      >
        <CategoryProduct
          onBack={() => setShowCategoryPage(false)}
        />
      </div>
    );
  }

  return (

    <div
      style={{
        // marginLeft: "280px",
        padding: "20px",
      }}
    >

      <h1>Company Products</h1>

      <div className="company-selector-card">
        <div className="company-selector-header">
          <h3>Select Company</h3>
          <button
            className="add-btn"
            onClick={() => setIsCopyModalOpen(true)}
          >
            Copy Products
          </button>
          <button
            className="add-btn"
            onClick={() => setShowCategoryPage(true)}
          >
            Category Products
          </button>

        </div>
        <select
          value={selectedCompany}
          disabled={importing}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="company-select"
        >

          <option value="human">Human Biomedical</option>
          <option value="global">Global Biomedical</option>
          <option value="rajbiosis">RajBiosis</option>
          <option value="qlyte">Qlyte</option>
        </select>
        <div style={{ marginTop: "15px" }}>
          <h4 style={{ marginBottom: "8px" }}>Select Website</h4>

          <select
            value={selectedWebsite}
            onChange={(e) => setSelectedWebsite(e.target.value)}
            className="company-select"
          >
            <option value="all">All Websites</option>

            {COMPANY_WEBSITES[selectedCompany].map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </div>
        <div className="company-sites">
          <span className="sites-label">Connected Websites</span>

          <div className="sites-grid">
            {COMPANY_WEBSITES[selectedCompany]?.map((site) => (
              <div key={site} className="site-badge">
                {site}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRODUCT PAGE START */}

      {/* <div className="top-header">

        <div className="page-path">
          {pathParts.map((part, index) => (
            <span key={index}>
              {part.charAt(0).toUpperCase() + part.slice(1)}
              {index !== pathParts.length - 1 && " > "}
            </span>
          ))}
        </div>

        <h1 className="heading">Product Page</h1>

      </div> */}


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
                  key={`img-${fileInputKey}`}
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
                  key={`video-${fileInputKey}`}
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
                  key={`pdf-${fileInputKey}`}
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
              multiple
              onChange={handleExcelImport}
              style={{ display: "none" }}
              id="excelUpload"
            />
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={replaceImages}
                  onChange={(e) => setReplaceImages(e.target.checked)}
                />
                Replace Images from Firebase Storage
              </label>
            </div>

            <button
              className="import-btn"
              onClick={() => document.getElementById("excelUpload").click()}
              disabled={importing && importingCompany === selectedCompany}
            >
              <FileUp size={16} style={{ marginRight: "6px" }} />

              {importing && importingCompany === selectedCompany
                ? `Importing ${importProgress} Products...`
                : "Import"}
            </button>

            <button
              className="add-btn"
              onClick={generateWatermarks}
              disabled={isGeneratingWatermark}
            >
              {isGeneratingWatermark ? "Generating Watermark..." : "Generate Watermark"}
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

      <Modal
        isOpen={isCopyModalOpen}
        onRequestClose={() => setIsCopyModalOpen(false)}
        className="modal-box"
        overlayClassName="modal-overlay"
      ><h2>Copy Products</h2>

        <p style={{ marginBottom: "15px" }}>
          Select destination website(s)
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          {COMPANY_WEBSITES[selectedCompany].map((site) => (
            <label
              key={site}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <input
                type="checkbox"
                disabled={site === currentWebsite}
                checked={copyToWebsites.includes(site)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setCopyToWebsites((prev) => [...prev, site]);
                  } else {
                    setCopyToWebsites((prev) =>
                      prev.filter((x) => x !== site)
                    );
                  }
                }}
              />

              {site}

              {site === currentWebsite && (
                <span style={{ color: "#888" }}>
                  (Current Website)
                </span>
              )}
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button
            className="cancel-btn"
            onClick={() => {
              setCopyToWebsites([]);
              setIsCopyModalOpen(false);
            }}
          >
            Cancel
          </button>

          <button
            className="add-btn"
            disabled={
              copyLoading || copyToWebsites.length === 0
            }
            onClick={copyProductsToWebsites}
          >
            {copyLoading ? "Copying..." : "Copy Products"}
          </button>
        </div></Modal>

      {/* WATERMARK PROGRESS MODAL */}
      {isGeneratingWatermark && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              padding: "36px",
              width: "90%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              textAlign: "center",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ marginBottom: "20px", display: "inline-flex", padding: "16px", background: "#eff6ff", borderRadius: "50%" }}>
              <Upload size={36} color="#2563eb" style={{ animation: "pulse 1.5s infinite" }} />
            </div>
            <h3 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "22px", fontWeight: "700" }}>
              Generating Watermarks
            </h3>
            <p style={{ margin: "0 0 24px 0", color: "#475569", fontSize: "15px", fontWeight: "500" }}>
              {watermarkStatusText || "Processing product images..."}
            </p>

            {/* Progress Bar Container */}
            <div
              style={{
                width: "100%",
                height: "18px",
                backgroundColor: "#e2e8f0",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "14px",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${watermarkProgress}%`,
                  backgroundColor: "#2563eb",
                  borderRadius: "10px",
                  transition: "width 0.4s ease-out",
                  backgroundImage: "linear-gradient(45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent)",
                  backgroundSize: "1rem 1rem",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "600", color: "#334155" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                {watermarkCurrentTitle ? `${watermarkCurrentTitle}` : "Processing..."}
              </span>
              <span style={{ color: "#2563eb", fontWeight: "700" }}>{watermarkProgress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}