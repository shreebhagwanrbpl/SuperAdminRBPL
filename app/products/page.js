"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "@/lib/sqliteStorage";
import Modal from "react-modal";
import toast, { Toaster } from "react-hot-toast";
import {
  Pencil,
  Trash2,
  Upload,
  FileUp,
  FileDown,
  X,
  Minus,
  Maximize2,
  Terminal,
  Globe,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Image as ImageIcon,
  Database,
  Search
} from "lucide-react";
import ExcelJS from "exceljs";
import "./products.css";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  COMPANY_WEBSITES,
  COMPANIES,
  getCompanyDisplayName,
  slugify,
  fetchCompanyProducts,
  saveCompanyCategory,
  saveCompanySubcategory,
  saveCompanyProduct,
  saveCompanyProductsBatch,
  updateProductWebsiteVisibility,
  bulkUpdateProductsWebsiteVisibility,
  deleteCompanyProduct,
  deleteCompanyProductsBatch,
  toggleProductPublish,
  bulkEnableProductsOnWebsites,
  getProductImageStoragePath,
  getProductVideoStoragePath,
  getProductPdfStoragePath,
  syncAllCompanyProductsToWebsites,
  fetchCompanyCategories
} from "@/lib/companyCatalog";
import { applyWatermarkClientSide, getWatermarkDisplayText } from "@/lib/websiteWatermarks";
import { runCompanyCatalogMigration } from "@/lib/migrateCompanyCatalog";
import { useTaskManager } from "../src/context/TaskManagerContext";

const CategoryProduct = dynamic(() => import("./CategoryProduct"), {
  ssr: false,
});

const PortalModal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal-container" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default function Products() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "products";

  const [selectedCompany, setSelectedCompany] = useState("human");
  const [selectedWebsite, setSelectedWebsite] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("active_selected_website");
      if (saved) return saved;
    }
    return "all";
  });

  const [savedProducts, setSavedProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Form State
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
    },
  ]);
  const [editIndex, setEditIndex] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Table, Pagination, Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [imageModal, setImageModal] = useState(null);

  // Watermark Preview State
  const [isGeneratingWatermark, setIsGeneratingWatermark] = useState(false);
  const [watermarkProgress, setWatermarkProgress] = useState(0);
  const [watermarkStatusText, setWatermarkStatusText] = useState("");

  // Website Visibility modal state
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
  const [visibilityTargetProduct, setVisibilityTargetProduct] = useState(null);
  const [visibilitySelectedWebsites, setVisibilitySelectedWebsites] = useState(["all"]);
  const [visibilitySearch, setVisibilitySearch] = useState("");
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [visibilityProgress, setVisibilityProgress] = useState({
    active: false,
    percent: 0,
    title: "",
    text: "",
  });
  const [isSyncingWebsites, setIsSyncingWebsites] = useState(false);

  // Migration Modal & State
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");
  const [migrationStats, setMigrationStats] = useState(null);

  // Selected websites for new creation
  const [selectedCreationWebsites, setSelectedCreationWebsites] = useState(["all"]);

  // Excel Import States (Supports Multiple Files & Folders + Live Logs + Minimized Background Mode)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportMinimized, setIsImportMinimized] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");
  const [importStats, setImportStats] = useState(null);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [importLogs, setImportLogs] = useState([]);
  const [fileStatuses, setFileStatuses] = useState({});
  const [activeImportFile, setActiveImportFile] = useState("");
  const importLogEndRef = useRef(null);

  useEffect(() => {
    if (importLogEndRef.current) {
      importLogEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [importLogs]);

  // Fetch Master Normal Products
  const loadMasterProducts = async (company = selectedCompany, websiteFilter = selectedWebsite) => {
    setIsLoadingProducts(true);
    try {
      const prods = await fetchCompanyProducts(company, {
        type: "normal",
        websiteFilter: websiteFilter === "all" ? null : websiteFilter,
      });
      setSavedProducts(prods);
    } catch (err) {
      console.error("Error loading products:", err);
      toast.error("Failed to load products");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadMasterProducts(selectedCompany, selectedWebsite);
    if (selectedCompany) {
      fetchCompanyCategories(selectedCompany, true).catch(() => { });
    }
    setSelectedProducts([]);
    setEditIndex(null);
    setEditingProductId(null);
    setCurrentPage(1);
  }, [selectedCompany, selectedWebsite]);

  // Handle Form Change
  const handleChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  // Upload Media
  const handleImageUpload = async (index, file) => {
    if (!file) return;
    setImageUploading(true);
    setUploadProgress(25);
    try {
      const prodId = editingProductId || crypto.randomUUID();
      const storagePath = getProductImageStoragePath(selectedCompany, prodId, file.name);
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      setUploadProgress(75);
      const downloadUrl = await getDownloadURL(storageRef);
      setUploadProgress(100);

      const updated = [...products];
      const curImgs = Array.isArray(updated[index].images) ? updated[index].images : [];
      updated[index].images = [...curImgs, downloadUrl];
      setProducts(updated);
      toast.success("Image uploaded to company storage");
    } catch (err) {
      console.error("Image upload failed:", err);
      toast.error("Upload failed");
    } finally {
      setTimeout(() => {
        setImageUploading(false);
        setUploadProgress(0);
      }, 400);
    }
  };

  const handleVideoUpload = async (index, file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const prodId = editingProductId || crypto.randomUUID();
      const storagePath = getProductVideoStoragePath(selectedCompany, prodId, file.name);
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const updated = [...products];
      updated[index].video = downloadUrl;
      setProducts(updated);
      toast.success("Video uploaded to company storage");
    } catch (err) {
      toast.error("Video upload failed");
    } finally {
      setImageUploading(false);
    }
  };

  const handlePdfUpload = async (index, file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const prodId = editingProductId || crypto.randomUUID();
      const storagePath = getProductPdfStoragePath(selectedCompany, prodId, file.name);
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const updated = [...products];
      updated[index].pdf = downloadUrl;
      setProducts(updated);
      toast.success("PDF uploaded to company storage");
    } catch (err) {
      toast.error("PDF upload failed");
    } finally {
      setImageUploading(false);
    }
  };

  // Save Product (Master Record + Visibility Mappings)
  const handleSaveProduct = async () => {
    if (!products[0].title.trim()) {
      toast.error("Please enter product title");
      return;
    }

    setSaving(true);
    try {
      const targetWebsites = selectedCreationWebsites.includes("all")
        ? COMPANY_WEBSITES[selectedCompany] || []
        : selectedCreationWebsites;

      const nextNum = savedProducts.length + 1;
      const prodPayload = {
        id: editingProductId || crypto.randomUUID(),
        productId: products[0].productId || String(nextNum),
        title: products[0].title.trim(),
        name: products[0].title.trim(),
        slug: slugify(products[0].title.trim()),
        price: products[0].price || "",
        desc: products[0].desc || "",
        description: products[0].desc || "",
        capacity: products[0].capacity || "",
        throughput: products[0].throughput || "",
        instrument: products[0].instrument || "",
        model: products[0].model || "",
        usage: products[0].usage || "",
        brand: products[0].brand || "",
        parameters: products[0].parameters || "",
        automation: products[0].automation || "",
        availability: products[0].availability || "",
        size: products[0].size || "",
        companyId: selectedCompany,
        categoryId: null,
        subcategoryId: null,
        type: "normal",
        images: products[0].images || [],
        originalImages: products[0].images || [],
        video: products[0].video || "",
        pdf: products[0].pdf || "",
        isPublished: true,
        websiteIds: targetWebsites,
      };

      await saveCompanyProduct(selectedCompany, prodPayload, targetWebsites);
      await loadMasterProducts(selectedCompany, selectedWebsite);

      // Reset form
      setProducts([
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
        },
      ]);
      setEditIndex(null);
      setEditingProductId(null);
      toast.success(editingProductId ? "Product updated in master catalog" : "Product saved to master catalog");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = (prod, index) => {
    setEditingProductId(prod.id);
    setEditIndex(index);
    setProducts([
      {
        productId: prod.productId || "",
        title: prod.title || prod.name || "",
        price: prod.price || "",
        desc: prod.desc || prod.description || "",
        capacity: prod.capacity || "",
        throughput: prod.throughput || "",
        instrument: prod.instrument || "",
        model: prod.model || "",
        usage: prod.usage || "",
        brand: prod.brand || "",
        parameters: prod.parameters || "",
        automation: prod.automation || "",
        availability: prod.availability || "",
        size: prod.size || "",
        images: Array.isArray(prod.images) ? prod.images : [],
        video: prod.video || "",
        pdf: prod.pdf || "",
      },
    ]);
    const compSites = COMPANY_WEBSITES[selectedCompany] || [];
    const wIds = Array.isArray(prod.websiteIds)
      ? (prod.websiteIds.includes("all") ? compSites : prod.websiteIds)
      : compSites;
    setSelectedCreationWebsites(wIds);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenProductVisibility = (prod) => {
    setVisibilityTargetProduct(prod);
    const compSites = COMPANY_WEBSITES[selectedCompany] || [];
    const cur = Array.isArray(prod.websiteIds)
      ? (prod.websiteIds.includes("all") ? compSites : prod.websiteIds)
      : compSites;
    setVisibilitySelectedWebsites(cur);
    setVisibilitySearch("");
    setIsVisibilityModalOpen(true);
  };

  const handleOpenBulkVisibility = () => {
    if (selectedProducts.length === 0) {
      toast.error("Please select products first");
      return;
    }
    setVisibilityTargetProduct(null);
    setVisibilitySelectedWebsites(COMPANY_WEBSITES[selectedCompany] || []);
    setVisibilitySearch("");
    setIsVisibilityModalOpen(true);
  };

  const handleSaveVisibility = async () => {
    setIsSavingVisibility(true);
    const sitesToSave = visibilitySelectedWebsites;

    const updateProgress = (pct, msg) => {
      setVisibilityProgress((prev) => ({
        active: true,
        percent: Math.min(100, Math.max(prev?.percent || 0, Math.round(pct))),
        title: "Updating Website Visibility",
        text: msg || "Syncing with website frontends...",
      }));
    };

    setVisibilityProgress({
      active: true,
      percent: 10,
      title: "Updating Website Visibility",
      text: "Applying instant changes...",
    });

    // 1. Instant optimistic UI update (0ms delay)
    if (visibilityTargetProduct) {
      setSavedProducts((prev) => {
        if (selectedWebsite !== "all" && !sitesToSave.includes(selectedWebsite)) {
          return prev.filter((p) => p.id !== visibilityTargetProduct.id && p.productId !== visibilityTargetProduct.id);
        }
        return prev.map((p) => (p.id === visibilityTargetProduct.id || p.productId === visibilityTargetProduct.id ? { ...p, websiteIds: sitesToSave } : p));
      });
    } else {
      const targetSet = new Set(selectedProducts);
      setSavedProducts((prev) => {
        if (selectedWebsite !== "all" && !sitesToSave.includes(selectedWebsite)) {
          return prev.filter((p) => !targetSet.has(p.id) && !targetSet.has(p.productId));
        }
        return prev.map((p) => (targetSet.has(p.id) || targetSet.has(p.productId) ? { ...p, websiteIds: sitesToSave } : p));
      });
      setSelectedProducts([]);
    }

    const toastId = toast.loading(visibilityTargetProduct ? "Saving visibility..." : `Saving visibility for products...`);

    // 2. Parallel background sync
    try {
      if (visibilityTargetProduct) {
        const targetObj = { ...visibilityTargetProduct, type: "normal" };
        await updateProductWebsiteVisibility(selectedCompany, targetObj, sitesToSave, updateProgress);
        toast.success(`Updated website visibility for "${visibilityTargetProduct.title || visibilityTargetProduct.name}"`, { id: toastId });
      } else {
        const targetObjects = savedProducts
          .filter((p) => selectedProducts.includes(p.id) || selectedProducts.includes(p.productId))
          .map((p) => ({ ...p, type: "normal" }));
        await bulkUpdateProductsWebsiteVisibility(
          selectedCompany,
          targetObjects.length > 0 ? targetObjects : selectedProducts,
          sitesToSave,
          updateProgress
        );
        toast.success(`Updated visibility for products!`, { id: toastId });
      }

      updateProgress(100, "Visibility updated successfully!");
      setTimeout(() => {
        setIsVisibilityModalOpen(false);
        setVisibilityProgress({ active: false, percent: 0, title: "", text: "" });
      }, 600);
    } catch (err) {
      console.error("Error updating visibility:", err);
      toast.error("Failed to update visibility", { id: toastId });
      setVisibilityProgress({ active: false, percent: 0, title: "", text: "" });
    } finally {
      setIsSavingVisibility(false);
    }
  };

  const handleSyncAllWebsites = async () => {
    setIsSyncingWebsites(true);
    const toastId = toast.loading("Starting catalog sync to all websites...");
    try {
      const res = await syncAllCompanyProductsToWebsites(selectedCompany, (p) => {
        toast.loading(p.step, { id: toastId });
      });
      if (res.success) {
        toast.success(`Successfully synced ${res.count} products to all ${getCompanyDisplayName(selectedCompany)} websites!`, { id: toastId });
        await loadMasterProducts(selectedCompany, selectedWebsite);
      } else {
        toast.error(res.error || "Failed to sync products", { id: toastId });
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Failed to sync products across websites", { id: toastId });
    } finally {
      setIsSyncingWebsites(false);
    }
  };

  // Smart path & filename parser to detect Category and Subcategory
  const parseCategoryAndSubcategoryFromPath = (relPath, fileName, fallbackCat = "", fallbackSub = "") => {
    const parts = (relPath || "").split(/[\/\\]+/).filter(Boolean);
    let cat = "";
    let sub = "";

    if (parts.length === 1) {
      cat = fallbackCat || "";
      sub = parts[0].replace(/\.xlsx?$/i, "").trim();
    } else if (parts.length === 2) {
      cat = parts[0].trim();
      sub = parts[1].replace(/\.xlsx?$/i, "").trim();
    } else if (parts.length === 3) {
      cat = parts[parts.length - 2].trim();
      sub = parts[parts.length - 1].replace(/\.xlsx?$/i, "").trim();
    } else if (parts.length >= 4) {
      cat = parts[parts.length - 3].trim();
      sub = parts[parts.length - 2].trim();
    }

    if (!cat) cat = fallbackCat || "";
    if (!sub) sub = fallbackSub || (fileName || "").replace(/\.xlsx?$/i, "").trim();

    return { category: cat, subCategory: sub };
  };

  // Group staged files by detected category
  const stagedGroupedByCategory = useMemo(() => {
    const map = {};
    for (const file of stagedFiles) {
      const { category, subCategory } = parseCategoryAndSubcategoryFromPath(
        file.webkitRelativePath,
        file.name
      );
      const groupName = category || "General (No Folder Category)";
      if (!map[groupName]) map[groupName] = [];
      map[groupName].push({ file, subCategory });
    }
    return map;
  }, [stagedFiles]);

  // Handle Selection of Multiple Files or Entire Folders (Appends to queue)
  const handleFilesSelected = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    const validExcelFiles = rawFiles.filter(
      (f) => /\.(xlsx|xls)$/i.test(f.name) && !f.name.startsWith("~$")
    );

    if (validExcelFiles.length === 0) {
      toast.error("No valid .xlsx or .xls files found");
      return;
    }

    setStagedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => f.webkitRelativePath || f.name));
      const newItems = validExcelFiles.filter(
        (f) => !existingKeys.has(f.webkitRelativePath || f.name)
      );
      const combined = [...prev, ...newItems];
      setImportStatusText(`${combined.length} file(s) loaded across folders.`);
      return combined;
    });
    setIsImportModalOpen(true);
    setImportStats(null);
    if (e.target) e.target.value = "";
  };

  // Handle Drag and Drop of multiple folders and files
  const handleFolderDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const readEntry = async (entry, path = "") => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file(
            (f) => {
              const fullRelPath = path ? `${path}/${f.name}` : f.name;
              Object.defineProperty(f, "webkitRelativePath", {
                value: fullRelPath,
                writable: true,
                configurable: true,
              });
              resolve([f]);
            },
            () => resolve([])
          );
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntriesBatch = () =>
          new Promise((resolve) => dirReader.readEntries(resolve, () => resolve([])));
        let entries = [];
        let batch = await readEntriesBatch();
        while (batch && batch.length > 0) {
          entries = entries.concat(batch);
          batch = await readEntriesBatch();
        }
        const files = [];
        for (const subEntry of entries) {
          const subFiles = await readEntry(subEntry, path ? `${path}/${entry.name}` : entry.name);
          files.push(...subFiles);
        }
        return files;
      }
      return [];
    };

    let allFiles = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          const files = await readEntry(entry);
          allFiles.push(...files);
        }
      } else if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) allFiles.push(f);
      }
    }

    const validExcelFiles = allFiles.filter(
      (f) => /\.(xlsx|xls)$/i.test(f.name) && !f.name.startsWith("~$")
    );

    if (validExcelFiles.length === 0) {
      toast.error("No valid .xlsx or .xls files found in dropped items");
      return;
    }

    setStagedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => f.webkitRelativePath || f.name));
      const newItems = validExcelFiles.filter(
        (f) => !existingKeys.has(f.webkitRelativePath || f.name)
      );
      const combined = [...prev, ...newItems];
      setImportStatusText(`${combined.length} file(s) loaded from dropped folders.`);
      return combined;
    });
    setIsImportModalOpen(true);
    setImportStats(null);
    toast.success(`Loaded ${validExcelFiles.length} file(s) across folders!`);
  };

  // Append a structured log entry
  const addImportLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString();
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      image: "🖼️",
      db: "💾",
      file: "📄",
      folder: "📁",
      speed: "⚡",
    };
    const icon = icons[type] || "ℹ️";
    setImportLogs((prev) => [...prev.slice(-400), { time, message, icon, type }]);
  };

  // High-performance async pool for parallel tasks
  const runAsyncPool = async (limit, items, fn) => {
    const results = [];
    const executing = [];
    for (const item of items) {
      const p = Promise.resolve().then(() => fn(item));
      results.push(p);
      if (limit <= items.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(results);
  };

  // Run Batch Excel Import for Normal & Category Products with Multi-File Concurrency (4x) & 32x Image Concurrency
  const runBatchExcelImport = async () => {
    if (stagedFiles.length === 0) {
      toast.error("Please select Excel file(s) first");
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportStats(null);
    setImportLogs([]);

    // Initialize file statuses
    const initialStatuses = {};
    stagedFiles.forEach((f) => {
      const key = f.webkitRelativePath || f.name;
      initialStatuses[key] = { status: "pending", count: 0, error: null };
    });
    setFileStatuses(initialStatuses);

    addImportLog(
      `⚡ Launching Turbo Concurrent Importer for ${stagedFiles.length} file(s) under ${getCompanyDisplayName(selectedCompany)} (4x Parallel Files + 32x Parallel Images)...`,
      "speed"
    );

    let totalProductsCount = 0;
    let successfulFilesCount = 0;
    let completedFiles = 0;
    const totalFiles = stagedFiles.length;
    const errors = [];
    const cachedCategories = new Set();
    const cachedSubcategories = new Set();

    const indexedFiles = stagedFiles.map((file, idx) => ({ file, fileIdx: idx }));

    try {
      await runAsyncPool(4, indexedFiles, async ({ file, fileIdx }) => {
        const fileKey = file.webkitRelativePath || file.name;
        const { category: folderCategory, subCategory: folderSubcategory } =
          parseCategoryAndSubcategoryFromPath(file.webkitRelativePath, file.name);

        setActiveImportFile(file.name);
        setFileStatuses((prev) => ({
          ...prev,
          [fileKey]: { status: "processing", count: 0, error: null },
        }));

        addImportLog(`📁 [${folderCategory || "General"}] Parsing "${file.name}"...`, "folder");

        try {
          const workbook = new ExcelJS.Workbook();
          const buffer = await file.arrayBuffer();
          await workbook.xlsx.load(buffer);

          const worksheet = workbook.getWorksheet(1);
          if (!worksheet) {
            addImportLog(`⚠️ Skipping ${file.name}: No worksheet found`, "warning");
            setFileStatuses((prev) => ({
              ...prev,
              [fileKey]: { status: "error", count: 0, error: "No worksheet found" },
            }));
            completedFiles++;
            setImportProgress(Math.min(99, Math.round((completedFiles / totalFiles) * 100)));
            return;
          }

          const headers = {};
          worksheet.getRow(1).eachCell((cell, colNumber) => {
            const headerName = cell.value?.toString().trim().toLowerCase();
            if (headerName) headers[headerName] = colNumber;
          });

          const imageMap = {};
          worksheet.getImages().forEach((img) => {
            const media = workbook.model.media?.find((m) => m.index === img.imageId);
            if (media) imageMap[img.imageId] = media;
          });

          // Step 1: Collect embedded images & upload with 32x concurrency
          const rowsWithImages = [];
          for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const currentImage = worksheet.getImages().find(
              (img) => img.range.tl.nativeRow + 1 === rowNumber
            );
            if (currentImage) {
              const image = imageMap[currentImage.imageId];
              if (image?.buffer) {
                rowsWithImages.push({ rowNumber, buffer: image.buffer });
              }
            }
          }

          const uploadedImageMap = {};
          if (rowsWithImages.length > 0) {
            addImportLog(`🖼️ Uploading ${rowsWithImages.length} images for "${file.name}" (32x concurrency)...`, "image");
            await runAsyncPool(32, rowsWithImages, async ({ rowNumber, buffer: imgBuf }) => {
              try {
                const blob = new Blob([imgBuf]);
                const storagePath = getProductImageStoragePath(
                  selectedCompany,
                  `import-${Date.now()}-${fileIdx}-${rowNumber}`,
                  `img-${rowNumber}.png`
                );
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, blob);
                uploadedImageMap[rowNumber] = await getDownloadURL(storageRef);
              } catch (imgErr) {
                console.warn(`Image upload failed for row ${rowNumber}:`, imgErr);
              }
            });
          }

          // Step 2: Parse rows
          const fileProducts = [];
          for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            const imageUrl = uploadedImageMap[rowNumber] || "";

            const getValue = (key) => {
              const col = headers[key];
              if (!col) return "";
              const val = row.getCell(col).value;
              if (val == null) return "";
              if (typeof val === "object") {
                return val.text || val.richText?.map((t) => t.text).join("") || "";
              }
              return String(val);
            };

            const title = getValue("title").trim() || getValue("product title").trim() || getValue("name").trim();
            const desc = getValue("desc").trim() || getValue("description").trim();
            const brand = getValue("brand").trim();
            const price = getValue("price").trim();
            const capacity = getValue("capacity").trim();
            const throughput = getValue("throughput").trim();
            const instrument = getValue("instrument").trim();
            const model = getValue("model").trim();
            const usage = getValue("usage").trim();
            const parameters = getValue("parameters").trim();
            const automation = getValue("automation").trim();
            const availability = getValue("availability").trim();
            const size = getValue("size").trim();

            const category =
              getValue("category").trim() ||
              folderCategory ||
              "";

            const subCategory =
              getValue("sub category").trim() ||
              getValue("subcategory").trim() ||
              folderSubcategory ||
              "";

            const video = getValue("video").trim();
            const pdf = getValue("pdf").trim();

            const rawImages = getValue("images") || getValue("image");
            const cellImageUrls = rawImages
              ? rawImages
                .split(/[\r\n,]+/)
                .map((u) => u.trim())
                .filter((u) => /^https?:\/\//i.test(u))
              : [];

            const allImages = imageUrl ? [imageUrl, ...cellImageUrls] : cellImageUrls;

            const hasData = [title, desc, brand, price, capacity, throughput, instrument, model, usage].some(
              (v) => v !== ""
            );
            if (!hasData) continue;

            fileProducts.push({
              id: crypto.randomUUID(),
              title: title || "Untitled Product",
              name: title || "Untitled Product",
              slug: slugify(title || "untitled-product"),
              price,
              desc,
              description: desc,
              capacity,
              throughput,
              instrument,
              model,
              usage,
              brand,
              parameters,
              automation,
              availability,
              size,
              category,
              subCategory,
              images: allImages,
              originalImages: allImages,
              video,
              pdf,
              createdAt: new Date().toISOString(),
              isPublished: true,
              companyId: selectedCompany,
              websiteIds: COMPANY_WEBSITES[selectedCompany] || [],
            });
          }

          // Step 3: Save Products in parallel batches
          if (fileProducts.length > 0) {
            const normalProducts = fileProducts.filter((p) => !p.category);
            const categoryProducts = fileProducts.filter((p) => p.category);

            // Save Normal Products
            if (normalProducts.length > 0) {
              normalProducts.forEach((np, i) => {
                np.productId = String(totalProductsCount + i + 1);
                np.type = "normal";
              });
              await saveCompanyProductsBatch(selectedCompany, normalProducts, COMPANY_WEBSITES[selectedCompany] || []);
            }

            // Save Category Products with Parallel Category / Subcategory Creation
            if (categoryProducts.length > 0) {
              const uniqueCats = new Map();
              const uniqueSubcats = new Map();

              for (const cp of categoryProducts) {
                const categorySlug = slugify(cp.category);
                const subCategorySlug = slugify(cp.subCategory || "General");

                if (!cachedCategories.has(categorySlug)) {
                  uniqueCats.set(categorySlug, cp.category);
                  cachedCategories.add(categorySlug);
                }

                const subcatKey = `${categorySlug}::${subCategorySlug}`;
                if (!cachedSubcategories.has(subcatKey)) {
                  uniqueSubcats.set(subcatKey, { categorySlug, subCategorySlug, name: cp.subCategory || "General" });
                  cachedSubcategories.add(subcatKey);
                }

                const prefix = cp.category
                  .split(" ")
                  .map((w) => w[0]?.toUpperCase())
                  .join("")
                  .replace(/[^\w]/g, "") || "CP";

                cp.type = "category";
                cp.categoryId = categorySlug;
                cp.subcategoryId = subCategorySlug;
                cp.categoryProductId = `${prefix}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
              }

              if (uniqueCats.size > 0) {
                await Promise.all(
                  Array.from(uniqueCats.entries()).map(([catSlug, catName]) =>
                    saveCompanyCategory(
                      selectedCompany,
                      {
                        id: catSlug,
                        name: catName,
                        category: catName,
                        slug: catSlug,
                        companyId: selectedCompany,
                        websiteIds: COMPANY_WEBSITES[selectedCompany] || [],
                      },
                      COMPANY_WEBSITES[selectedCompany] || []
                    )
                  )
                );
              }

              if (uniqueSubcats.size > 0) {
                await Promise.all(
                  Array.from(uniqueSubcats.values()).map(({ categorySlug, subCategorySlug, name }) =>
                    saveCompanySubcategory(
                      selectedCompany,
                      categorySlug,
                      {
                        id: subCategorySlug,
                        name,
                        subCategory: name,
                        slug: subCategorySlug,
                        categoryId: categorySlug,
                        companyId: selectedCompany,
                        websiteIds: COMPANY_WEBSITES[selectedCompany] || [],
                      },
                      COMPANY_WEBSITES[selectedCompany] || []
                    )
                  )
                );
              }

              // Atomic batch write across website documents and master
              await saveCompanyProductsBatch(selectedCompany, categoryProducts, COMPANY_WEBSITES[selectedCompany] || []);
            }

            totalProductsCount += fileProducts.length;
            successfulFilesCount++;

            addImportLog(`💾 Saved ${fileProducts.length} product(s) from "${file.name}"`, "db");
            setFileStatuses((prev) => ({
              ...prev,
              [fileKey]: { status: "completed", count: fileProducts.length, error: null },
            }));
          } else {
            addImportLog(`⚠️ No product rows found in "${file.name}"`, "warning");
            setFileStatuses((prev) => ({
              ...prev,
              [fileKey]: { status: "completed", count: 0, error: "0 products" },
            }));
          }
        } catch (fileErr) {
          console.error(`Error in ${file.name}:`, fileErr);
          errors.push(`${file.name}: ${fileErr.message || "Failed"}`);
          addImportLog(`❌ Error in "${file.name}": ${fileErr.message || "Parse failed"}`, "error");
          setFileStatuses((prev) => ({
            ...prev,
            [fileKey]: { status: "error", count: 0, error: fileErr.message || "Error" },
          }));
        } finally {
          completedFiles++;
          const progressPct = Math.min(99, Math.round((completedFiles / totalFiles) * 100));
          setImportProgress(progressPct);
          setImportStatusText(`Imported ${completedFiles} of ${totalFiles} file(s) (${totalProductsCount} products saved)...`);
        }
      });

      setImportProgress(100);
      setImportStats({
        filesCount: successfulFilesCount,
        totalFiles: stagedFiles.length,
        productsCount: totalProductsCount,
        errors,
      });
      setImportStatusText(
        `Batch Complete: ${successfulFilesCount} of ${stagedFiles.length} files imported (${totalProductsCount} products).`
      );
      addImportLog(
        `🎉 Batch Import Complete! Total ${totalProductsCount} products added across ${successfulFilesCount} files in record time!`,
        "success"
      );
      await loadMasterProducts(selectedCompany, selectedWebsite);
      toast.success(`Successfully imported ${totalProductsCount} products from ${successfulFilesCount} files!`);
    } catch (err) {
      console.error("Batch import error:", err);
      toast.error("Import failed: " + (err.message || "Unknown error"));
      addImportLog(`❌ Batch process stopped: ${err.message || "Fatal error"}`, "error");
    } finally {
      setImporting(false);
    }
  };

  // Download Demo Excel Template
  const downloadDemoExcel = async () => {
    try {
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
        { header: "sub category", key: "subCategory", width: 25 },
        { header: "video", key: "video", width: 30 },
        { header: "pdf", key: "pdf", width: 30 },
      ];

      worksheet.addRow({
        title: "CBC Analyzer",
        price: "50000",
        desc: "High performance automated blood analyzer",
        capacity: "100 Tests",
        throughput: "60/hr",
        instrument: "Analyzer",
        model: "CBC-100",
        usage: "Laboratory",
        brand: getCompanyDisplayName(selectedCompany),
        parameters: "3 Part Differential",
        automation: "Fully Automatic",
        availability: "In Stock",
        size: "Medium",
        category: "",
        subCategory: "",
        video: "",
        pdf: "",
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedCompany}-Products-Demo.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Demo download error:", err);
      toast.error("Failed to generate demo excel");
    }
  };

  // Export Normal Products to Excel
  const executeExportExcel = async () => {
    try {
      const prodsToExport = selectedProducts.length > 0
        ? savedProducts.filter((p) => selectedProducts.includes(p.id))
        : savedProducts;

      if (prodsToExport.length === 0) {
        toast.error("No normal products to export");
        return;
      }

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
        { header: "sub category", key: "subCategory", width: 25 },
        { header: "images", key: "images", width: 45 },
        { header: "video", key: "video", width: 30 },
        { header: "pdf", key: "pdf", width: 30 },
      ];

      prodsToExport.forEach((prod) => {
        const imagesStr = Array.isArray(prod.images)
          ? prod.images.join(", ")
          : prod.image || "";

        worksheet.addRow({
          title: prod.title || prod.name || "",
          price: prod.price || "",
          desc: prod.desc || prod.description || "",
          capacity: prod.capacity || "",
          throughput: prod.throughput || "",
          instrument: prod.instrument || "",
          model: prod.model || "",
          usage: prod.usage || "",
          brand: prod.brand || getCompanyDisplayName(selectedCompany),
          parameters: prod.parameters || "",
          automation: prod.automation || "",
          availability: prod.availability || "",
          size: prod.size || "",
          category: "",
          subCategory: "",
          images: imagesStr,
          video: prod.video || "",
          pdf: prod.pdf || "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedCompany}-Normal-Products-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${prodsToExport.length} normal products to Excel!`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed: " + (err.message || "Unknown error"));
    }
  };

  const togglePublish = async (index) => {
    const prod = savedProducts[index];
    if (!prod) return;
    const newStatus = !prod.isPublished;
    // 1. Instant optimistic update (0ms delay)
    setSavedProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, isPublished: newStatus } : p))
    );
    toast.success(newStatus ? "Product visible on enabled websites" : "Product hidden from websites");

    // 2. Parallel background sync
    try {
      await toggleProductPublish(selectedCompany, prod.id, newStatus);
    } catch (err) {
      console.error("Failed to toggle publish:", err);
      // Rollback on error
      setSavedProducts((prev) =>
        prev.map((p, i) => (i === index ? { ...p, isPublished: !newStatus } : p))
      );
      toast.error("Failed to update visibility");
    }
  };

  const confirmDelete = async () => {
    const prod = savedProducts[deleteIndex];
    if (!prod) return;
    try {
      await deleteCompanyProduct(selectedCompany, prod.id);
      setSavedProducts((prev) => prev.filter((_, i) => i !== deleteIndex));
      setIsModalOpen(false);
      setDeleteIndex(null);
      toast.success("Product deleted from master catalog");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const deleteSelectedProducts = async () => {
    if (selectedProducts.length === 0) return toast.error("Select products first");
    try {
      await deleteCompanyProductsBatch(selectedCompany, selectedProducts);
      setSavedProducts((prev) => prev.filter((p) => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
      toast.success(`${selectedProducts.length} products deleted`);
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const deleteAllProducts = async () => {
    try {
      const allIds = savedProducts.map((p) => p.id);
      await deleteCompanyProductsBatch(selectedCompany, allIds);
      setSavedProducts([]);
      setSelectedProducts([]);
      setIsDeleteAllModalOpen(false);
      toast.success("All master products deleted");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleSelectProduct = (id) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Visibility / Enable on Websites
  const handleOpenCopyModal = () => {
    if (selectedProducts.length === 0 && savedProducts.length === 0) {
      toast.error("No products available to enable on websites");
      return;
    }
    setCopyToWebsites([]);
    setIsCopyModalOpen(true);
  };

  const handleStartEnableWebsites = async () => {
    if (copyToWebsites.length === 0) {
      toast.error("Please select at least one destination website");
      return;
    }

    const prodIdsToEnable = selectedProducts.length > 0 ? selectedProducts : savedProducts.map((p) => p.id);
    try {
      await bulkEnableProductsOnWebsites(selectedCompany, prodIdsToEnable, copyToWebsites);
      await loadMasterProducts(selectedCompany, selectedWebsite);
      setIsCopyModalOpen(false);
      setCopyToWebsites([]);
      toast.success(`Enabled ${prodIdsToEnable.length} products across ${copyToWebsites.length} website(s)`);
    } catch (err) {
      console.error("Enable error:", err);
      toast.error("Failed to update website visibility");
    }
  };

  // Dynamic Company Display Watermark
  const generateWatermarks = async () => {
    setIsGeneratingWatermark(true);
    setWatermarkProgress(25);
    const companyName = getCompanyDisplayName(selectedCompany);
    setWatermarkStatusText(`Applying company watermark for ${companyName}...`);

    try {
      setWatermarkProgress(75);
      await new Promise((r) => setTimeout(r, 500));
      setWatermarkProgress(100);
      setWatermarkStatusText(`Watermarks dynamically active for ${companyName}`);
      toast.success(`Dynamic watermarks active: "${companyName}"`);
    } catch (err) {
      toast.error("Watermark preview failed");
    } finally {
      setTimeout(() => {
        setIsGeneratingWatermark(false);
      }, 400);
    }
  };

  // Run Migration Tool
  const handleRunMigration = async () => {
    setIsMigrating(true);
    setMigrationStatus("Starting safe migration of existing website data to Company Master Catalog...");
    setMigrationStats(null);
    try {
      const stats = await runCompanyCatalogMigration((progress) => {
        setMigrationStatus(progress.step || "Migrating data...");
      });
      setMigrationStats(stats);
      setMigrationStatus("Migration completed successfully!");
      toast.success("Data migrated to Company Master Catalog!");
      await loadMasterProducts(selectedCompany, selectedWebsite);
    } catch (err) {
      console.error("Migration error:", err);
      setMigrationStatus(`Migration error: ${err.message || err}`);
      toast.error("Migration encountered an error");
    } finally {
      setIsMigrating(false);
    }
  };

  // Pagination
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return savedProducts.slice(start, start + itemsPerPage);
  }, [savedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(savedProducts.length / itemsPerPage) || 1;

  return (
    <div className="main" style={{ marginLeft: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      <Toaster position="top-right" />

      {/* Header Bar with Tabs and Controls */}
      <div className="product-top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => router.push("/products?tab=products")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "products" ? "#4f46e5" : "#e2e8f0",
              color: activeTab === "products" ? "white" : "#334155",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Normal Products
          </button>
          <button
            type="button"
            onClick={() => router.push("/products?tab=category")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "category" ? "#4f46e5" : "#e2e8f0",
              color: activeTab === "category" ? "white" : "#334155",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Category Products
          </button>
        </div>

        {/* Global Action Tools */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setIsMigrationModalOpen(true)}
            style={{
              padding: "8px 14px",
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Database size={15} />
            <span>Migrate Data to Master</span>
          </button>
        </div>
      </div>

      {/* Render Category Products View if Tab is active */}
      {activeTab === "category" ? (
        <CategoryProduct onBack={() => router.push("/products?tab=products")} />
      ) : (
        /* Normal Products View */
        <div>
          {/* Company & Filter Header Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "white",
              padding: "14px 18px",
              borderRadius: "10px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              {/* Company Switcher */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block" }}>
                  Company:
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setSelectedWebsite("all");
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <option value="human">Human Biomedical</option>
                  <option value="global">Global Biomedical</option>
                  <option value="rajbiosis">RajBiosis</option>
                </select>
              </div>

              {/* Website Visibility Filter */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block" }}>
                  Website Filter:
                </label>
                <select
                  value={selectedWebsite}
                  onChange={(e) => {
                    setSelectedWebsite(e.target.value);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("active_selected_website", e.target.value);
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Company Websites</option>
                  {(COMPANY_WEBSITES[selectedCompany] || []).map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="import-btn"
                onClick={() => setIsImportModalOpen(true)}
                style={{
                  padding: "7px 14px",
                  background: "linear-gradient(135deg, #16a34a, #22c55e)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileUp size={14} />
                <span>Import Excel / Folder</span>
              </button>

              <button
                type="button"
                className="import-btn"
                onClick={downloadDemoExcel}
                style={{
                  padding: "7px 14px",
                  background: "#475569",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Download Demo</span>
              </button>

              <button
                type="button"
                className="import-btn"
                onClick={executeExportExcel}
                style={{
                  padding: "7px 14px",
                  background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileDown size={14} />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={generateWatermarks}
                disabled={isGeneratingWatermark}
                style={{
                  padding: "7px 14px",
                  background: "#6366f1",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>💧</span>
                <span>{isGeneratingWatermark ? "Applying..." : "Company Watermark"}</span>
              </button>
            </div>
          </div>

          {/* Add / Edit Form */}
          <div
            style={{
              background: "white",
              padding: "18px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              marginBottom: "16px",
            }}
          >
            <h4 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>
              {editingProductId ? "Edit Master Normal Product" : "Add Master Normal Product"}
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Product ID / Code</label>
                <input
                  type="text"
                  placeholder="e.g. 101, PROD-200"
                  value={products[0].productId || ""}
                  onChange={(e) => handleChange(0, "productId", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Title *</label>
                <input
                  type="text"
                  placeholder="Product Title"
                  value={products[0].title || ""}
                  onChange={(e) => handleChange(0, "title", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Price (₹)</label>
                <input
                  type="text"
                  placeholder="Price"
                  value={products[0].price || ""}
                  onChange={(e) => handleChange(0, "price", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Brand</label>
                <input
                  type="text"
                  placeholder="Brand"
                  value={products[0].brand || ""}
                  onChange={(e) => handleChange(0, "brand", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Model</label>
                <input
                  type="text"
                  placeholder="Model"
                  value={products[0].model || ""}
                  onChange={(e) => handleChange(0, "model", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Capacity</label>
                <input
                  type="text"
                  placeholder="Capacity (e.g. 200 Tests)"
                  value={products[0].capacity || ""}
                  onChange={(e) => handleChange(0, "capacity", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Throughput</label>
                <input
                  type="text"
                  placeholder="Throughput (e.g. 120/hr)"
                  value={products[0].throughput || ""}
                  onChange={(e) => handleChange(0, "throughput", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Instrument Type</label>
                <input
                  type="text"
                  placeholder="e.g. Biochemistry, Hematology"
                  value={products[0].instrument || ""}
                  onChange={(e) => handleChange(0, "instrument", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Usage / Application</label>
                <input
                  type="text"
                  placeholder="e.g. Clinical Laboratory, Hospital"
                  value={products[0].usage || ""}
                  onChange={(e) => handleChange(0, "usage", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Parameters Tested</label>
                <input
                  type="text"
                  placeholder="e.g. Full Profile, Electrolytes"
                  value={products[0].parameters || ""}
                  onChange={(e) => handleChange(0, "parameters", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Automation Grade</label>
                <input
                  type="text"
                  placeholder="e.g. Fully Automatic, Semi-Automatic"
                  value={products[0].automation || ""}
                  onChange={(e) => handleChange(0, "automation", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Stock Availability</label>
                <input
                  type="text"
                  placeholder="e.g. In Stock, Ready to Ship"
                  value={products[0].availability || ""}
                  onChange={(e) => handleChange(0, "availability", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Size / Dimensions</label>
                <input
                  type="text"
                  placeholder="e.g. Large, Compact, Benchtop"
                  value={products[0].size || ""}
                  onChange={(e) => handleChange(0, "size", e.target.value)}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
            </div>

            <div style={{ marginTop: "10px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Description</label>
              <textarea
                placeholder="Product Description"
                rows={2}
                value={products[0].desc || ""}
                onChange={(e) => handleChange(0, "desc", e.target.value)}
                style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            {/* Media & Documents (URLs + File Uploads) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px", marginTop: "10px" }}>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>
                  🎥 Video URL / File:
                </label>
                <input
                  type="text"
                  placeholder="Video Link (e.g. YouTube, Cloud URL)"
                  value={products[0].video || ""}
                  onChange={(e) => handleChange(0, "video", e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "5px", border: "1px solid #cbd5e1", marginBottom: "6px", fontSize: "12px" }}
                />
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideoUpload(0, e.target.files?.[0])}
                  style={{ fontSize: "11px" }}
                />
              </div>

              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>
                  📄 PDF Brochure URL / File:
                </label>
                <input
                  type="text"
                  placeholder="PDF Document Link"
                  value={products[0].pdf || ""}
                  onChange={(e) => handleChange(0, "pdf", e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "5px", border: "1px solid #cbd5e1", marginBottom: "6px", fontSize: "12px" }}
                />
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handlePdfUpload(0, e.target.files?.[0])}
                  style={{ fontSize: "11px" }}
                />
              </div>

              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>
                  🖼️ Upload Images:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(0, e.target.files?.[0])}
                  style={{ fontSize: "11px" }}
                />
              </div>
            </div>

            {/* Previews */}
            {products[0].images && products[0].images.length > 0 && (
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                {products[0].images.map((imgUrl, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img
                      src={imgUrl}
                      alt="preview"
                      style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ddd" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...products];
                        updated[0].images = updated[0].images.filter((_, idx) => idx !== i);
                        setProducts(updated);
                      }}
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "16px",
                        height: "16px",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Target Websites Selector for New/Edit Product */}
            <div style={{ marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🌐</span> Target Websites Visibility
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedCreationWebsites([...(COMPANY_WEBSITES[selectedCompany] || [])])}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: "600",
                      background: (COMPANY_WEBSITES[selectedCompany] || []).length > 0 && selectedCreationWebsites.length === (COMPANY_WEBSITES[selectedCompany] || []).length ? "#4f46e5" : "#e2e8f0",
                      color: (COMPANY_WEBSITES[selectedCompany] || []).length > 0 && selectedCreationWebsites.length === (COMPANY_WEBSITES[selectedCompany] || []).length ? "#fff" : "#475569",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    All Websites ({COMPANY_WEBSITES[selectedCompany]?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCreationWebsites([])}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: selectedCreationWebsites.length === 0 ? "600" : "400",
                      background: selectedCreationWebsites.length === 0 ? "#fee2e2" : "#e2e8f0",
                      color: selectedCreationWebsites.length === 0 ? "#dc2626" : "#475569",
                      border: selectedCreationWebsites.length === 0 ? "1px solid #fca5a5" : "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Clear (Hide All)
                  </button>
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 10px 0" }}>
                Product is saved once in database. Choose which website frontends will display this product.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                {(COMPANY_WEBSITES[selectedCompany] || []).map((site) => {
                  const isChecked = selectedCreationWebsites.includes(site);
                  return (
                    <label
                      key={site}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: isChecked ? "#eff6ff" : "#ffffff",
                        border: isChecked ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCreationWebsites((prev) => [...prev.filter((s) => s !== site), site]);
                          } else {
                            setSelectedCreationWebsites((prev) => prev.filter((s) => s !== site));
                          }
                        }}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving || imageUploading}
                style={{
                  padding: "8px 20px",
                  background: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving Master Record..." : editingProductId ? "Update Product" : "Save Product"}
              </button>

              {editingProductId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProductId(null);
                    setEditIndex(null);
                    setProducts([
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
                      },
                    ]);
                  }}
                  style={{
                    padding: "8px 14px",
                    background: "#e2e8f0",
                    color: "#334155",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          {/* Master Products Table */}
          <div style={{ background: "white", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontWeight: "700", fontSize: "14px", color: "#1e293b" }}>
                  Master Products ({savedProducts.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isSelectionMode) {
                      setIsSelectionMode(false);
                      setSelectedProducts([]);
                    } else {
                      setIsSelectionMode(true);
                    }
                  }}
                  style={{
                    padding: "4px 10px",
                    background: isSelectionMode ? "#fee2e2" : "#f1f5f9",
                    color: isSelectionMode ? "#dc2626" : "#334155",
                    border: `1px solid ${isSelectionMode ? "#fca5a5" : "#cbd5e1"}`,
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span>{isSelectionMode ? "✕" : "☑"}</span>
                  <span>{isSelectionMode ? "Cancel Select" : "Select"}</span>
                </button>
                {isSelectionMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProducts.length === savedProducts.length) {
                        setSelectedProducts([]);
                      } else {
                        setSelectedProducts(savedProducts.map((p) => p.id));
                      }
                    }}
                    style={{
                      padding: "4px 10px",
                      background: "#e0e7ff",
                      color: "#4338ca",
                      border: "1px solid #c7d2fe",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {selectedProducts.length === savedProducts.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {selectedProducts.length > 0 && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleOpenBulkVisibility}
                    style={{
                      padding: "6px 12px",
                      background: "#e0e7ff",
                      color: "#4338ca",
                      border: "1px solid #c7d2fe",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span>🌐</span> Set Visibility ({selectedProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedProducts}
                    style={{
                      padding: "6px 12px",
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fca5a5",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Delete Selected ({selectedProducts.length})
                  </button>
                </div>
              )}
            </div>

            {isLoadingProducts ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                Loading master products...
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                No master products found for this company.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                      {isSelectionMode && (
                        <th style={{ padding: "10px 14px", width: "40px" }}>
                          <input
                            type="checkbox"
                            checked={selectedProducts.length === savedProducts.length && savedProducts.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts(savedProducts.map((p) => p.id));
                              } else {
                                setSelectedProducts([]);
                              }
                            }}
                          />
                        </th>
                      )}
                      <th style={{ padding: "10px 14px" }}>Image</th>
                      <th style={{ padding: "10px 14px" }}>ID</th>
                      <th style={{ padding: "10px 14px" }}>Title</th>
                      <th style={{ padding: "10px 14px" }}>Price</th>
                      <th style={{ padding: "10px 14px" }}>Brand / Model</th>
                      <th style={{ padding: "10px 14px" }}>Enabled Websites</th>
                      <th style={{ padding: "10px 14px" }}>Status</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((prod, index) => {
                      const globalIndex = (currentPage - 1) * itemsPerPage + index;
                      const isSelected = selectedProducts.includes(prod.id);
                      const isExpanded = activeId === prod.id;
                      const imgUrl = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : null;

                      const siteIds = Array.isArray(prod.websiteIds) ? prod.websiteIds : [];
                      const isAll = siteIds.includes("all") || siteIds.length === 0;
                      const totalSites = COMPANY_WEBSITES[selectedCompany]?.length || 0;
                      const activeCount = isAll ? totalSites : siteIds.length;

                      return (
                        <React.Fragment key={prod.id || index}>
                          <tr
                            onClick={() => setActiveId(isExpanded ? null : prod.id)}
                            style={{
                              borderBottom: isExpanded ? "none" : "1px solid #f1f5f9",
                              background: isSelected ? "#f0fdf4" : isExpanded ? "#f8fafc" : "white",
                              cursor: "pointer",
                              transition: "background 0.15s ease",
                            }}
                          >
                            {isSelectionMode && (
                              <td
                                style={{ padding: "10px 14px" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectProduct(prod.id)}
                                />
                              </td>
                            )}
                            <td style={{ padding: "10px 14px" }}>
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt=""
                                  style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "40px",
                                    height: "40px",
                                    background: "#f1f5f9",
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#94a3b8",
                                  }}
                                >
                                  <ImageIcon size={18} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: "600", color: "#475569" }}>
                              {prod.productId || "-"}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: "600", color: "#1e293b" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{prod.title || prod.name}</span>
                                <span style={{ fontSize: "11px", color: isExpanded ? "#4f46e5" : "#94a3b8" }}>
                                  {isExpanded ? "▲" : "▼"}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "10px 14px", color: "#059669", fontWeight: "600" }}>
                              {prod.price ? `₹${prod.price}` : "-"}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#64748b" }}>
                              {[prod.brand, prod.model].filter(Boolean).join(" / ") || "-"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProductVisibility(prod);
                                }}
                                title="Click to configure website visibility"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "11px",
                                  padding: "4px 8px",
                                  background: isAll ? "#ecfdf5" : "#eff6ff",
                                  color: isAll ? "#059669" : "#2563eb",
                                  border: isAll ? "1px solid #a7f3d0" : "1px solid #bfdbfe",
                                  borderRadius: "6px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>🌐</span>
                                <span>{isAll ? `All Sites (${totalSites})` : `${siteIds.length}/${totalSites} Sites`}</span>
                              </button>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePublish(globalIndex);
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: prod.isPublished ? "#10b981" : "#94a3b8",
                                }}
                              >
                                {prod.isPublished ? <Eye size={18} /> : <EyeOff size={18} />}
                              </button>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditProduct(prod, globalIndex);
                                  }}
                                  style={{
                                    background: "#f1f5f9",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "5px",
                                    cursor: "pointer",
                                    color: "#475569",
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteIndex(globalIndex);
                                    setIsModalOpen(true);
                                  }}
                                  style={{
                                    background: "#fee2e2",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "5px",
                                    cursor: "pointer",
                                    color: "#dc2626",
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED FULL PRODUCT DETAIL ROW */}
                          {isExpanded && (
                            <tr className="detail-row-fixed" style={{ background: "#f8fafc" }}>
                              <td colSpan={isSelectionMode ? 9 : 8} style={{ padding: 0 }}>
                                <div style={{ padding: "16px 20px", borderBottom: "2px solid #e2e8f0", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>

                                  {/* Top Header */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                                        <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                                          {prod.title || prod.name || "Untitled Product"}
                                        </span>
                                        <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", background: "#e0e7ff", color: "#4338ca", borderRadius: "12px" }}>
                                          ID: {prod.productId || prod.id}
                                        </span>
                                        <span style={{ fontSize: "12px", fontWeight: "700", padding: "2px 8px", background: "#dcfce7", color: "#15803d", borderRadius: "12px" }}>
                                          {prod.price ? `₹${prod.price}` : "Price N/A"}
                                        </span>
                                        <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", background: prod.isPublished ? "#ecfdf5" : "#fef2f2", color: prod.isPublished ? "#059669" : "#dc2626", borderRadius: "12px" }}>
                                          {prod.isPublished ? "● Active on Web" : "○ Hidden"}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        Company: <strong style={{ textTransform: "capitalize" }}>{selectedCompany}</strong>
                                      </div>
                                    </div>

                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditProduct(prod, globalIndex);
                                        }}
                                        style={{
                                          padding: "5px 12px",
                                          background: "#4f46e5",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: "600",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "5px",
                                        }}
                                      >
                                        <Pencil size={13} />
                                        <span>Edit Product</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveId(null);
                                        }}
                                        style={{
                                          padding: "5px 10px",
                                          background: "#ffffff",
                                          color: "#475569",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          cursor: "pointer",
                                          fontWeight: "500",
                                        }}
                                      >
                                        ✕ Close Details
                                      </button>
                                    </div>
                                  </div>

                                  {/* Attributes Grid (Standard + Dynamic Excel Columns) */}
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                                      gap: "10px",
                                      marginBottom: "14px",
                                    }}
                                  >
                                    {prod.brand && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Brand</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.brand}</strong>
                                      </div>
                                    )}
                                    {prod.model && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Model</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.model}</strong>
                                      </div>
                                    )}
                                    {prod.capacity && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Capacity</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.capacity}</strong>
                                      </div>
                                    )}
                                    {prod.throughput && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Throughput</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.throughput}</strong>
                                      </div>
                                    )}
                                    {prod.instrument && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Instrument</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.instrument}</strong>
                                      </div>
                                    )}
                                    {prod.usage && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Usage</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.usage}</strong>
                                      </div>
                                    )}
                                    {prod.parameters && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Parameters</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.parameters}</strong>
                                      </div>
                                    )}
                                    {prod.automation && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Automation</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.automation}</strong>
                                      </div>
                                    )}
                                    {prod.availability && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Availability</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.availability}</strong>
                                      </div>
                                    )}
                                    {prod.size && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Size</span>
                                        <strong style={{ color: "#1e293b" }}>{prod.size}</strong>
                                      </div>
                                    )}
                                    {prod.video && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Video</span>
                                        <a href={prod.video} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: "600", textDecoration: "underline" }}>
                                          🎥 Open Video
                                        </a>
                                      </div>
                                    )}
                                    {prod.pdf && (
                                      <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>PDF Brochure</span>
                                        <a href={prod.pdf} target="_blank" rel="noreferrer" style={{ color: "#dc2626", fontWeight: "600", textDecoration: "underline" }}>
                                          📄 View PDF
                                        </a>
                                      </div>
                                    )}

                                    {/* Any other dynamic Excel attributes imported */}
                                    {Object.entries(prod)
                                      .filter(([k, v]) =>
                                        ![
                                          "id", "_id", "title", "name", "price", "brand", "model", "capacity",
                                          "throughput", "instrument", "usage", "parameters", "automation",
                                          "availability", "size", "video", "pdf", "desc", "description",
                                          "images", "image", "websiteIds", "isPublished", "category",
                                          "subCategory", "categoryId", "subCategoryId", "company", "createdAt",
                                          "updatedAt", "productId"
                                        ].includes(k) &&
                                        (typeof v === "string" || typeof v === "number" || typeof v === "boolean") &&
                                        v !== "" && v !== null && v !== undefined
                                      )
                                      .map(([key, val]) => (
                                        <div key={key} style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                          <span style={{ color: "#64748b", display: "block", fontSize: "11px", textTransform: "capitalize" }}>
                                            {key.replace(/([A-Z])/g, " $1")}
                                          </span>
                                          <strong style={{ color: "#1e293b" }}>{String(val)}</strong>
                                        </div>
                                      ))}
                                  </div>

                                  {/* Description */}
                                  {(prod.desc || prod.description) && (
                                    <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "4px" }}>
                                        PRODUCT DESCRIPTION
                                      </span>
                                      <p style={{ margin: 0, fontSize: "13px", color: "#334155", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                                        {prod.desc || prod.description}
                                      </p>
                                    </div>
                                  )}

                                  {/* All Images Gallery */}
                                  {Array.isArray(prod.images) && prod.images.length > 0 && (
                                    <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "8px" }}>
                                        PRODUCT IMAGES ({prod.images.length}) &bull; Click image to zoom:
                                      </span>
                                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                        {prod.images.map((img, imgIdx) => (
                                          <div
                                            key={imgIdx}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setImageModal(img);
                                            }}
                                            style={{
                                              position: "relative",
                                              width: "65px",
                                              height: "65px",
                                              borderRadius: "8px",
                                              border: "1px solid #cbd5e1",
                                              overflow: "hidden",
                                              cursor: "pointer",
                                              background: "#f8fafc",
                                              transition: "transform 0.15s ease",
                                            }}
                                          >
                                            <img
                                              src={img}
                                              alt={`Product ${imgIdx + 1}`}
                                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Enabled Websites */}
                                  <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "6px" }}>
                                      ENABLED WEBSITES ({isAll ? `All ${totalSites} websites` : `${activeCount} website(s)`}):
                                    </span>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                      {(isAll ? (COMPANY_WEBSITES[selectedCompany] || []) : siteIds).map((site) => (
                                        <span
                                          key={site}
                                          style={{
                                            fontSize: "11px",
                                            padding: "3px 8px",
                                            borderRadius: "6px",
                                            background: "#eff6ff",
                                            color: "#1d4ed8",
                                            border: "1px solid #bfdbfe",
                                            fontWeight: "500",
                                          }}
                                        >
                                          🌐 {site}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      color: "#334155",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      color: "#334155",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      <PortalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div style={{ padding: "20px", width: "340px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 8px 0", color: "#1e293b", fontSize: "16px" }}>Confirm Delete</h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
            Are you sure you want to delete this master product?
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ padding: "6px 14px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              style={{ padding: "6px 16px", background: "#dc2626", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
            >
              Delete
            </button>
          </div>
        </div>
      </PortalModal>

      {/* Modern Website Visibility Manager Modal */}
      <PortalModal isOpen={isVisibilityModalOpen} onClose={() => !isSavingVisibility && setIsVisibilityModalOpen(false)}>
        <div style={{ background: "white", padding: "24px", borderRadius: "14px", width: "560px", maxWidth: "95vw", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={18} color="#4f46e5" />
                <span>Website Visibility Manager</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                {visibilityTargetProduct
                  ? `Configure which websites display "${visibilityTargetProduct.title || visibilityTargetProduct.name}"`
                  : `Bulk update website visibility for ${selectedProducts.length} selected products`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsVisibilityModalOpen(false)}
              disabled={isSavingVisibility}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Search & Quick Select Bar */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={14} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search websites..."
                value={visibilitySearch}
                onChange={(e) => setVisibilitySearch(e.target.value)}
                style={{ width: "100%", padding: "7px 10px 7px 30px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
              />
            </div>
            <button
              type="button"
              onClick={() => setVisibilitySelectedWebsites([...(COMPANY_WEBSITES[selectedCompany] || [])])}
              style={{
                padding: "7px 12px",
                background: (COMPANY_WEBSITES[selectedCompany] || []).length > 0 && (COMPANY_WEBSITES[selectedCompany] || []).every((s) => visibilitySelectedWebsites.includes(s)) ? "#4f46e5" : "#f1f5f9",
                color: (COMPANY_WEBSITES[selectedCompany] || []).length > 0 && (COMPANY_WEBSITES[selectedCompany] || []).every((s) => visibilitySelectedWebsites.includes(s)) ? "white" : "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              All Websites
            </button>
            <button
              type="button"
              onClick={() => setVisibilitySelectedWebsites([])}
              style={{
                padding: "7px 12px",
                background: visibilitySelectedWebsites.length === 0 ? "#fee2e2" : "#f8fafc",
                color: visibilitySelectedWebsites.length === 0 ? "#dc2626" : "#64748b",
                border: visibilitySelectedWebsites.length === 0 ? "1px solid #fca5a5" : "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: visibilitySelectedWebsites.length === 0 ? "600" : "400",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Clear (Hide All)
            </button>
          </div>

          {/* Website Checkbox Cards Grid */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "10px",
              background: "#f8fafc",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "8px",
              maxHeight: "320px",
            }}
          >
            {(COMPANY_WEBSITES[selectedCompany] || [])
              .filter((site) => site.toLowerCase().includes(visibilitySearch.toLowerCase()))
              .map((site) => {
                const isChecked = visibilitySelectedWebsites.includes(site);
                return (
                  <div
                    key={site}
                    onClick={() => {
                      if (isChecked) {
                        setVisibilitySelectedWebsites(visibilitySelectedWebsites.filter((s) => s !== site));
                      } else {
                        setVisibilitySelectedWebsites([...visibilitySelectedWebsites, site]);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: isChecked ? "#ffffff" : "#f1f5f9",
                      border: isChecked ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isChecked ? "0 2px 4px rgba(79, 70, 229, 0.1)" : "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => { }}
                      style={{ cursor: "pointer" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: isChecked ? "#1e1b4b" : "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {site}
                      </div>
                      <div style={{ fontSize: "10px", color: isChecked ? "#4f46e5" : "#94a3b8" }}>
                        {isChecked ? "✓ Active on Website" : "Hidden"}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Real-time Progress Bar & Status (while updating) */}
          {(isSavingVisibility || visibilityProgress.active) && (
            <div
              style={{
                marginTop: "14px",
                padding: "12px 14px",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "8px",
                animation: "slideInUp 0.25s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      border: "2px solid #22c55e",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  {visibilityProgress.text || "Synchronizing website visibility..."}
                </span>
                <span style={{ fontSize: "13px", fontWeight: "700", fontFamily: "monospace", color: "#15803d" }}>
                  {visibilityProgress.percent}%
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#dcfce7", borderRadius: "10px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${visibilityProgress.percent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #16a34a, #22c55e, #10b981)",
                    borderRadius: "10px",
                    transition: "width 0.25s ease-out",
                    boxShadow: "0 0 8px rgba(34, 197, 94, 0.4)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {visibilitySelectedWebsites.length === (COMPANY_WEBSITES[selectedCompany] || []).length
                ? `✓ Active on all ${(COMPANY_WEBSITES[selectedCompany] || []).length} websites`
                : visibilitySelectedWebsites.length === 0
                  ? `⚠️ Hidden from all websites (0 selected)`
                  : `Active on ${visibilitySelectedWebsites.length} of ${(COMPANY_WEBSITES[selectedCompany] || []).length} websites`}
            </span>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setIsVisibilityModalOpen(false)}
                disabled={isSavingVisibility}
                style={{ padding: "8px 14px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", fontSize: "13px", cursor: isSavingVisibility ? "not-allowed" : "pointer", fontWeight: "600" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVisibility}
                disabled={isSavingVisibility}
                style={{
                  padding: "8px 20px",
                  background: isSavingVisibility ? "linear-gradient(135deg, #16a34a, #22c55e)" : "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: isSavingVisibility ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: isSavingVisibility ? "0 0 10px rgba(34, 197, 94, 0.4)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {isSavingVisibility ? (
                  <>
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        border: "2px solid #ffffff",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span>Saving ({visibilityProgress.percent}%)</span>
                  </>
                ) : (
                  <span>Save Visibility</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </PortalModal>

      {/* Migration Modal */}
      <PortalModal isOpen={isMigrationModalOpen} onClose={() => !isMigrating && setIsMigrationModalOpen(false)}>
        <div style={{ padding: "24px", width: "560px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "700", color: "#059669", display: "flex", alignItems: "center", gap: "8px" }}>
            <Database size={20} />
            <span>Migrate Legacy Data to Company Master Catalog</span>
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
            This tool safely reads all existing products, categories, and subcategories from website-level documents, consolidates duplicate copies into company-level master records, and creates lightweight visibility mappings.
            <br />
            <strong>Non-destructive & Idempotent:</strong> Existing data is preserved and can be run multiple times safely.
          </p>

          {migrationStatus && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "13px",
                color: "#166534",
                marginBottom: "14px",
                fontWeight: "500",
              }}
            >
              {migrationStatus}
            </div>
          )}

          {migrationStats && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", marginBottom: "14px", fontSize: "12px" }}>
              <div style={{ fontWeight: "700", marginBottom: "8px", color: "#1e293b" }}>Migration Summary:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", color: "#475569" }}>
                <div>Websites Scanned: <strong>{migrationStats.websitesScanned}</strong></div>
                <div>Legacy Products Scanned: <strong>{migrationStats.legacyNormalProductsFound + migrationStats.legacyCategoryProductsFound}</strong></div>
                <div>Master Categories Created: <strong>{migrationStats.masterCategoriesCreated}</strong></div>
                <div>Master Subcategories Created: <strong>{migrationStats.masterSubcategoriesCreated}</strong></div>
                <div>Master Products Created: <strong>{migrationStats.masterProductsCreated}</strong></div>
                <div>Companies Processed: <strong>{migrationStats.companiesProcessed}</strong></div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsMigrationModalOpen(false)}
              disabled={isMigrating}
              style={{ padding: "7px 14px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", cursor: isMigrating ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600" }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRunMigration}
              disabled={isMigrating}
              style={{
                padding: "7px 20px",
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                cursor: isMigrating ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              {isMigrating ? "Migrating Data..." : "Run Migration"}
            </button>
          </div>
        </div>
      </PortalModal>

      {/* Batch & Folder Excel Import Modal */}
      <PortalModal isOpen={isImportModalOpen && !isImportMinimized} onClose={() => !importing && setIsImportModalOpen(false)}>
        <div style={{ background: "white", padding: "24px", borderRadius: "12px", width: "650px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#16a34a", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileUp size={18} />
              <span>Turbo Multi-Folder &amp; Excel Importer</span>
              <span style={{ fontSize: "11px", background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "20px", fontWeight: "600" }}>
                ⚡ 16x Turbo Speed
              </span>
            </h3>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setIsImportMinimized(true)}
                title="Minimize to Background (continue working elsewhere)"
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#475569",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                <Minus size={14} />
                <span>Minimize</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setStagedFiles([]);
                  setImportStats(null);
                }}
                disabled={importing}
                style={{ background: "transparent", border: "none", cursor: importing ? "not-allowed" : "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 14px 0", lineHeight: "1.4" }}>
            Select or drag &amp; drop multiple category folders (or Excel files). The system automatically creates categories, subcategories, uploads images in parallel, and imports products with live logs.
          </p>

          {/* Hidden File Inputs */}
          <input
            type="file"
            id="batchExcelFilesInput"
            accept=".xlsx, .xls"
            multiple
            onChange={handleFilesSelected}
            style={{ display: "none" }}
          />
          <input
            type="file"
            id="batchExcelFolderInput"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFilesSelected}
            style={{ display: "none" }}
          />

          {/* Drag and Drop Zone / Buttons (Hidden while actively importing to save vertical space) */}
          {!importing && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleFolderDrop}
              style={{
                padding: "16px 14px",
                background: isDraggingOver ? "#f0fdf4" : "#f8fafc",
                border: isDraggingOver ? "2px dashed #16a34a" : "2px dashed #cbd5e1",
                borderRadius: "10px",
                marginBottom: "14px",
                textAlign: "center",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>📂</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "2px" }}>
                Drag &amp; Drop Multiple Folders or Excel Files Here
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "10px" }}>
                Drop 1 or 25+ category folders directly from Windows Explorer
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => document.getElementById("batchExcelFolderInput")?.click()}
                  disabled={importing}
                  style={{
                    padding: "7px 14px",
                    background: "#4f46e5",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📁</span>
                  <span>+ Add Category Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => document.getElementById("batchExcelFilesInput")?.click()}
                  disabled={importing}
                  style={{
                    padding: "7px 14px",
                    background: "#0284c7",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📑</span>
                  <span>+ Add Excel Files</span>
                </button>
              </div>
            </div>
          )}

          {/* Categorized Staged Files Breakdown */}
          {stagedFiles.length > 0 && !importing && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>
                  Loaded Categories ({Object.keys(stagedGroupedByCategory).length}) &bull; Total Files ({stagedFiles.length}):
                </span>
                <button
                  type="button"
                  onClick={() => setStagedFiles([])}
                  disabled={importing}
                  style={{ background: "transparent", border: "none", color: "#dc2626", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                >
                  Clear All
                </button>
              </div>
              <div
                style={{
                  maxHeight: "130px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {Object.entries(stagedGroupedByCategory).map(([catName, fileList], catIdx) => (
                  <div key={catIdx} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span>📁</span>
                      <span style={{ color: "#4f46e5" }}>{catName}</span>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "500" }}>({fileList.length} subcategory file{fileList.length > 1 ? "s" : ""})</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", paddingLeft: "16px" }}>
                      {fileList.map((item, fileIdx) => (
                        <span key={fileIdx} style={{ fontSize: "11px", background: "#f1f5f9", color: "#334155", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                          📄 {item.subCategory}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Progress Bar */}
          {importing && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", color: "#166534", marginBottom: "6px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite" }} />
                  {importStatusText || "Processing batch import..."}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700" }}>{importProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "10px", background: "#dcfce7", borderRadius: "10px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${importProgress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #16a34a, #22c55e, #10b981)",
                    borderRadius: "10px",
                    transition: "width 0.25s ease-out",
                    boxShadow: "0 0 8px rgba(34, 197, 94, 0.4)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Live Activity Terminal Logs */}
          {(importing || importLogs.length > 0) && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Terminal size={14} color="#16a34a" />
                  <span>Real-Time Terminal Logs:</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {importing && (
                    <span style={{ fontSize: "11px", color: "#16a34a", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                      <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
                      Parallel Engine Live
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setImportLogs([])}
                    style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "11px", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                style={{
                  height: "150px",
                  overflowY: "auto",
                  background: "#0b0f19",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "11px",
                  lineHeight: "1.6",
                  color: "#e2e8f0",
                }}
              >
                {importLogs.map((log, idx) => {
                  let textColor = "#e2e8f0";
                  if (log.type === "success") textColor = "#4ade80";
                  else if (log.type === "error") textColor = "#f87171";
                  else if (log.type === "warning") textColor = "#fbbf24";
                  else if (log.type === "image") textColor = "#38bdf8";
                  else if (log.type === "db") textColor = "#c084fc";
                  else if (log.type === "folder") textColor = "#818cf8";
                  else if (log.type === "speed") textColor = "#fde047";

                  return (
                    <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "flex-start", marginBottom: "2px" }}>
                      <span style={{ color: "#64748b", flexShrink: 0 }}>[{log.time}]</span>
                      <span style={{ flexShrink: 0 }}>{log.icon}</span>
                      <span style={{ color: textColor, wordBreak: "break-word" }}>{log.message}</span>
                    </div>
                  );
                })}
                <div ref={importLogEndRef} />
              </div>
            </div>
          )}

          {/* Per-File Status Table Breakdown */}
          {(importing || importStats) && stagedFiles.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                Files Status ({stagedFiles.filter(f => fileStatuses[f.webkitRelativePath || f.name]?.status === "completed").length}/{stagedFiles.length} Finished):
              </div>
              <div style={{ maxHeight: "110px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 8px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "4px" }}>
                {stagedFiles.map((f, idx) => {
                  const fileKey = f.webkitRelativePath || f.name;
                  const st = fileStatuses[fileKey] || { status: "pending", count: 0 };
                  const { category, subCategory } = parseCategoryAndSubcategoryFromPath(f.webkitRelativePath, f.name);

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 8px",
                        background: st.status === "processing" ? "#eff6ff" : "#ffffff",
                        border: st.status === "processing" ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "11px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#4f46e5", fontWeight: "600" }}>[{category}]</span>
                        <span style={{ color: "#334155" }}>{f.name}</span>
                      </div>
                      <div>
                        {st.status === "processing" && (
                          <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", fontSize: "10px" }}>
                            ⚡ In Progress
                          </span>
                        )}
                        {st.status === "completed" && (
                          <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", fontSize: "10px" }}>
                            ✓ Done ({st.count} prods)
                          </span>
                        )}
                        {st.status === "error" && (
                          <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", fontSize: "10px" }}>
                            ✕ Failed
                          </span>
                        )}
                        {st.status === "pending" && (
                          <span style={{ background: "#f1f5f9", color: "#64748b", padding: "2px 6px", borderRadius: "4px", fontWeight: "500", fontSize: "10px" }}>
                            ⏳ Queued
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary / Stats after completion */}
          {importStats && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "12px", marginBottom: "14px", fontSize: "12px", color: "#166534" }}>
              <div style={{ fontWeight: "700", marginBottom: "4px" }}>✅ Import Summary:</div>
              <div>Files Processed: <strong>{importStats.filesCount} of {importStats.totalFiles}</strong></div>
              <div>Total Products Added: <strong>{importStats.productsCount}</strong></div>
              {importStats.errors?.length > 0 && (
                <div style={{ marginTop: "6px", color: "#dc2626" }}>
                  <strong>Errors ({importStats.errors.length}):</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {importStats.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {importing ? (
              <button
                type="button"
                onClick={() => setIsImportMinimized(true)}
                style={{
                  padding: "8px 14px",
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Minus size={14} />
                <span>Run in Background (Minimize)</span>
              </button>
            ) : <div />}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setStagedFiles([]);
                  setImportStats(null);
                }}
                disabled={importing}
                style={{
                  padding: "8px 16px",
                  background: "#e2e8f0",
                  color: "#334155",
                  border: "none",
                  borderRadius: "6px",
                  cursor: importing ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
              >
                {importStats ? "Done" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={runBatchExcelImport}
                disabled={importing || stagedFiles.length === 0}
                style={{
                  padding: "8px 22px",
                  background: "linear-gradient(135deg, #16a34a, #22c55e)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "600",
                  cursor: importing || stagedFiles.length === 0 ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileUp size={15} />
                <span>{importing ? `Importing... (${importProgress}%)` : `Start Turbo Import (${stagedFiles.length} files)`}</span>
              </button>
            </div>
          </div>
        </div>
      </PortalModal>

      {/* Floating Minimized Excel Import Widget */}
      {isImportMinimized && (importing || importStats) && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
            width: "360px",
            maxWidth: "92vw",
            background: "linear-gradient(145deg, #0f172a, #1e293b)",
            border: "1px solid #334155",
            borderRadius: "14px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            padding: "16px",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: importing ? "#22c55e" : "#3b82f6",
                  boxShadow: importing ? "0 0 10px #22c55e" : "0 0 10px #3b82f6",
                  animation: importing ? "pulse 1.5s infinite" : "none",
                }}
              />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#f8fafc" }}>
                {importing ? "Importing in Background..." : "Import Completed"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsImportMinimized(false);
                  setIsImportModalOpen(true);
                }}
                style={{
                  background: "#3b82f6",
                  border: "none",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Maximize2 size={12} />
                <span>View Logs</span>
              </button>
              {!importing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsImportMinimized(false);
                    setImportStats(null);
                  }}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {importStatusText || "Processing files..."}
          </div>

          {/* Progress Bar */}
          <div style={{ width: "100%", height: "6px", background: "#334155", borderRadius: "10px", overflow: "hidden", marginBottom: "8px" }}>
            <div
              style={{
                width: `${importProgress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #16a34a, #22c55e)",
                borderRadius: "10px",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#cbd5e1" }}>
            <span>Progress: <strong>{importProgress}%</strong></span>
            <span>
              {importStats
                ? `✅ ${importStats.productsCount} products added`
                : `${stagedFiles.filter(f => fileStatuses[f.webkitRelativePath || f.name]?.status === "completed").length}/${stagedFiles.length} files`}
            </span>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      <PortalModal isOpen={!!imageModal} onClose={() => setImageModal(null)}>
        <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#0f172a", padding: "16px", borderRadius: "12px" }}>
          <button
            type="button"
            onClick={() => setImageModal(null)}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0,0,0,0.6)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            <X size={16} />
          </button>
          {imageModal && (
            <img
              src={imageModal}
              alt="Product Zoom"
              style={{ maxWidth: "85vw", maxHeight: "80vh", objectFit: "contain", borderRadius: "8px" }}
            />
          )}
        </div>
      </PortalModal>
    </div>
  );
}