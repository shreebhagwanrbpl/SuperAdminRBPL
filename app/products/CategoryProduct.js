"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Modal from "react-modal";
import PortalModal from "../components/PortalModal";
import {
    Pencil,
    Trash2,
    Image as ImageIcon,
    FileUp,
    FileDown,
    X,
    Minus,
    Maximize2,
    Terminal,
    Upload,
    Check,
    Globe,
    Layers,
    Search,
    RefreshCw,
    Eye,
    EyeOff
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import "./CategoryProduct.css";
import {
    COMPANY_WEBSITES,
    COMPANIES,
    getCompanyDisplayName,
    slugify,
    fetchCompanyCategories,
    fetchCompanySubcategories,
    fetchCompanyProducts,
    saveCompanyCategory,
    saveCompanySubcategory,
    saveCompanyProduct,
    saveCompanyProductsBatch,
    updateProductWebsiteVisibility,
    bulkUpdateProductsWebsiteVisibility,
    updateCategoryWebsiteVisibility,
    bulkUpdateCategoriesWebsiteVisibility,
    updateSubcategoryWebsiteVisibility,
    bulkUpdateSubcategoriesWebsiteVisibility,
    deleteCompanyCategory,
    deleteCompanySubcategory,
    deleteCompanyProduct,
    deleteCompanyProductsBatch,
    toggleProductPublish,
    bulkEnableProductsOnWebsites,
    bulkEnableCategoryOnWebsites,
    bulkEnableSubcategoryOnWebsites,
    getProductImageStoragePath,
    getProductVideoStoragePath,
    getProductPdfStoragePath,
    getCachedCompanyCategories,
    invalidateCompanyCategoriesCache,
    syncAllCompanyProductsToWebsites
} from "@/lib/companyCatalog";
import { applyWatermarkClientSide, getWatermarkDisplayText } from "@/lib/websiteWatermarks";
import { useTaskManager } from "../src/context/TaskManagerContext";

export default function CategoryProduct({ onBack }) {
    const { startCategoryProductCopy } = useTaskManager();

    // Company & Website selection
    const [selectedCompany, setSelectedCompany] = useState("human");
    const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState("");
    const currentWebsite = COMPANY_WEBSITES[selectedCompany]?.[0] || "";

    // Categories and subcategories state
    const [categories, setCategories] = useState(() => getCachedCompanyCategories("human") || []);
    const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState(null);
    const [subCategoryProducts, setSubCategoryProducts] = useState([]);
    const [isProductsLoading, setIsProductsLoading] = useState(false);

    // Modals and Inputs
    const [showCategoryInput, setShowCategoryInput] = useState(false);
    const [categoryName, setCategoryName] = useState("");
    const [categorySaving, setCategorySaving] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState("");

    const [isSubCategoryEditModalOpen, setIsSubCategoryEditModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState(null);
    const [editingSubCategoryParent, setEditingSubCategoryParent] = useState(null);
    const [editSubCategoryName, setEditSubCategoryName] = useState("");

    const [showSubCategoryInput, setShowSubCategoryInput] = useState(false);
    const [subCategoryName, setSubCategoryName] = useState("");

    // Selected websites for new creations
    const [selectedWebsites, setSelectedWebsites] = useState(["all"]);

    // Product Form State
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
    const [activeId, setActiveId] = useState(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkMode, setBulkMode] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [deleteConfirmState, setDeleteConfirmState] = useState(null); // { type: 'category' | 'subcategory', item, parentCategory?, title, message }
    const [imageModal, setImageModal] = useState(null);

    // Watermark preview state
    const [isGeneratingWatermark, setIsGeneratingWatermark] = useState(false);
    const [watermarkProgress, setWatermarkProgress] = useState(0);
    const [watermarkStatusText, setWatermarkStatusText] = useState("");
    const [watermarkCurrentTitle, setWatermarkCurrentTitle] = useState("");

    // Website Visibility modal state (Products, Categories & Subcategories)
    const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
    const [visibilityTarget, setVisibilityTarget] = useState(null); // { type: 'product' | 'bulk_products' | 'category' | 'bulk_categories' | 'subcategory' | 'bulk_subcategories', item?, items?, parentCategory? }
    const [visibilityCascade, setVisibilityCascade] = useState(true);
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

    // Multi-Category / Multi-Subcategory Selection State for Visibility
    const [isCategorySelectMode, setIsCategorySelectMode] = useState(false);
    const [selectedCategoryIdsForVis, setSelectedCategoryIdsForVis] = useState([]);
    const [selectedSubcategoryKeysForVis, setSelectedSubcategoryKeysForVis] = useState([]); // [{ categoryId, subcategoryId, name }]

    // Export / Import
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportScope, setExportScope] = useState("all");
    const [exportSelectedCategoryIds, setExportSelectedCategoryIds] = useState([]);
    const [isExporting, setIsExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importingCategoryId, setImportingCategoryId] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportMinimized, setIsImportMinimized] = useState(false);
    const [stagedFiles, setStagedFiles] = useState([]);
    const [importStatusText, setImportStatusText] = useState("");
    const [importStats, setImportStats] = useState(null);
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

    // Load master categories on company change
    const loadCategories = async (company = selectedCompany, force = false) => {
        const cached = getCachedCompanyCategories(company);
        if (cached && !force) {
            setCategories(cached);
        } else {
            setIsCategoriesLoading(true);
        }
        try {
            const cats = await fetchCompanyCategories(company, true, force);
            setCategories(cats);
        } catch (err) {
            console.error("Error loading categories:", err);
            toast.error("Failed to load categories");
        } finally {
            setIsCategoriesLoading(false);
        }
    };

    useEffect(() => {
        loadCategories(selectedCompany);
        setSelectedCategory(null);
        setSelectedSubCategory(null);
        setSubCategoryProducts([]);
        setSelectedProducts([]);
        setIsSelectionMode(false);
        setEditIndex(null);
        setEditingProductId(null);
    }, [selectedCompany]);

    // Filter categories based on website filter
    const filteredCategories = useMemo(() => {
        if (!selectedWebsiteFilter || selectedWebsiteFilter === "all") {
            return categories;
        }
        return categories
            .filter((cat) => {
                const cWebsites = Array.isArray(cat.websiteIds) && cat.websiteIds.length > 0 ? cat.websiteIds : ["all"];
                return cWebsites.includes("all") || cWebsites.includes(selectedWebsiteFilter);
            })
            .map((cat) => ({
                ...cat,
                subcategories: (cat.subcategories || []).filter((sub) => {
                    const sWebsites = Array.isArray(sub.websiteIds) && sub.websiteIds.length > 0 ? sub.websiteIds : ["all"];
                    return sWebsites.includes("all") || sWebsites.includes(selectedWebsiteFilter);
                }),
            }));
    }, [categories, selectedWebsiteFilter]);

    // Load products when a subcategory is selected
    const loadSubCategoryProducts = async (subCatId, catId) => {
        if (!subCatId || !catId) return;
        setIsProductsLoading(true);
        try {
            const prods = await fetchCompanyProducts(selectedCompany, {
                categoryId: catId,
                subcategoryId: subCatId,
                websiteFilter: selectedWebsiteFilter || null,
            });
            setSubCategoryProducts(prods);
        } catch (err) {
            console.error("Error loading subcategory products:", err);
            toast.error("Failed to load products");
        } finally {
            setIsProductsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedCategory && selectedSubCategory) {
            loadSubCategoryProducts(selectedSubCategory.id, selectedCategory.id);
        } else {
            setSubCategoryProducts([]);
        }
        setSelectedProducts([]);
        setIsSelectionMode(false);
        setCurrentPage(1);
    }, [selectedCategory?.id, selectedSubCategory?.id, selectedWebsiteFilter, selectedCompany]);

    // Handle Category Expansion / Selection
    const handleCategoryClick = (cat) => {
        if (expandedCategory === cat.id && selectedCategory?.id === cat.id) {
            setExpandedCategory(null);
            return;
        }
        setExpandedCategory(cat.id);
        setSelectedCategory(cat);
        setSelectedSubCategory(null);
        setSubCategoryProducts([]);
        setIsSelectionMode(false);
    };

    const handleSubCategoryClick = (sub) => {
        setSelectedSubCategory(sub);
        setEditIndex(null);
        setEditingProductId(null);
        setIsSelectionMode(false);
    };

    // Category CRUD
    const handleCategorySave = async () => {
        if (!categoryName.trim()) {
            toast.error("Please enter category name");
            return;
        }
        setCategorySaving(true);
        try {
            const targetWebsites = selectedWebsites.includes("all")
                ? COMPANY_WEBSITES[selectedCompany] || []
                : selectedWebsites;

            const saved = await saveCompanyCategory(
                selectedCompany,
                {
                    name: categoryName.trim(),
                    category: categoryName.trim(),
                    slug: slugify(categoryName.trim()),
                },
                targetWebsites
            );

            await loadCategories(selectedCompany, true);
            setCategoryName("");
            setShowCategoryInput(false);
            toast.success(`Category "${saved.name}" added to master catalog`);
        } catch (err) {
            console.error("Failed to save category:", err);
            toast.error("Failed to add category");
        } finally {
            setCategorySaving(false);
        }
    };

    const updateCategoryName = async () => {
        if (!editingCategory || !editCategoryName.trim()) return;
        try {
            await saveCompanyCategory(
                selectedCompany,
                {
                    ...editingCategory,
                    name: editCategoryName.trim(),
                    category: editCategoryName.trim(),
                },
                editingCategory.websiteIds
            );

            await loadCategories(selectedCompany, true);
            if (selectedCategory?.id === editingCategory.id) {
                setSelectedCategory((prev) => ({
                    ...prev,
                    name: editCategoryName.trim(),
                    category: editCategoryName.trim(),
                }));
            }
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
            toast.success("Category updated");
        } catch (err) {
            console.error(err);
            toast.error("Update failed");
        }
    };

    // Category & Subcategory Delete Confirmation Modal Triggers
    const promptDeleteCategory = (cat) => {
        const targetCat = cat || editingCategory || selectedCategory;
        if (!targetCat) return;
        const catName = targetCat.name || targetCat.category || "this category";
        setDeleteConfirmState({
            isOpen: true,
            type: "category",
            item: targetCat,
            parentCategory: null,
            title: "Delete Category",
            name: catName,
            message: `Are you sure you want to delete category "${catName}"? All subcategories and products in this category will also be permanently deleted from the catalog.`,
        });
    };

    const promptDeleteSubCategory = (sub, parentCat) => {
        const targetSub = sub || selectedSubCategory;
        const targetParent = parentCat || selectedCategory;
        if (!targetSub || !targetParent) return;
        const subName = targetSub.name || targetSub.subCategory || "this subcategory";
        const parentName = targetParent.name || targetParent.category || "category";
        setDeleteConfirmState({
            isOpen: true,
            type: "subcategory",
            item: targetSub,
            parentCategory: targetParent,
            title: "Delete Subcategory",
            name: subName,
            parentName: parentName,
            message: `Are you sure you want to delete subcategory "${subName}" under "${parentName}"? All products in this subcategory will also be removed.`,
        });
    };

    // Unified Delete Confirmation Handler
    const handleConfirmDelete = async () => {
        if (!deleteConfirmState || !deleteConfirmState.item) return;
        const { type, item, parentCategory } = deleteConfirmState;
        setDeleteConfirmState(null);

        if (type === "category") {
            const catId = item.id;
            const catName = item.name || item.category || "Category";

            // 1. Instant Optimistic UI Update (0ms)
            setCategories((prev) => prev.filter((c) => c.id !== catId));
            if (selectedCategory?.id === catId) {
                setSelectedCategory(null);
                setSelectedSubCategory(null);
                setSubCategoryProducts([]);
            }
            if (isCategoryModalOpen) {
                setIsCategoryModalOpen(false);
                setEditingCategory(null);
            }
            toast.success(`Category "${catName}" deleted`);

            // 2. Perform backend delete in background
            try {
                await deleteCompanyCategory(selectedCompany, catId);
            } catch (err) {
                console.error(err);
                toast.error("Delete failed on server");
                loadCategories(selectedCompany, true);
            }
        } else if (type === "subcategory") {
            const subId = item.id;
            const subName = item.name || item.subCategory || "Subcategory";
            const catId = parentCategory?.id || selectedCategory?.id;
            if (!catId) return;

            // 1. Instant Optimistic UI Update (0ms)
            setCategories((prev) =>
                prev.map((c) => {
                    if (c.id === catId) {
                        return {
                            ...c,
                            subcategories: (c.subcategories || []).filter((s) => s.id !== subId),
                        };
                    }
                    return c;
                })
            );
            setSelectedCategory((prev) => {
                if (!prev || prev.id !== catId) return prev;
                return {
                    ...prev,
                    subcategories: (prev.subcategories || []).filter((s) => s.id !== subId),
                };
            });
            if (selectedSubCategory?.id === subId) {
                setSelectedSubCategory(null);
                setSubCategoryProducts([]);
            }
            toast.success(`Subcategory "${subName}" deleted`);

            // 2. Perform backend delete in background
            try {
                await deleteCompanySubcategory(selectedCompany, catId, subId);
            } catch (err) {
                console.error(err);
                toast.error("Delete failed on server");
                loadCategories(selectedCompany, true);
            }
        }
    };

    // Backward-compatibility aliases
    const deleteCategory = () => promptDeleteCategory(editingCategory || selectedCategory);
    const deleteSubCategory = () => promptDeleteSubCategory(selectedSubCategory, selectedCategory);

    // Subcategory CRUD
    const handleSubCategorySave = async () => {
        if (!selectedCategory) {
            toast.error("Please select a category first");
            return;
        }
        if (!subCategoryName.trim()) {
            toast.error("Enter subcategory name");
            return;
        }

        try {
            const targetWebsites = selectedWebsites.includes("all")
                ? COMPANY_WEBSITES[selectedCompany] || []
                : selectedWebsites;

            const saved = await saveCompanySubcategory(
                selectedCompany,
                selectedCategory.id,
                {
                    name: subCategoryName.trim(),
                    subCategory: subCategoryName.trim(),
                    slug: slugify(subCategoryName.trim()),
                },
                targetWebsites
            );

            await loadCategories(selectedCompany, true);
            // Refresh selected category's subcategories list
            const freshSubs = await fetchCompanySubcategories(selectedCompany, selectedCategory.id);
            setSelectedCategory((prev) => ({ ...prev, subcategories: freshSubs }));

            setSubCategoryName("");
            setShowSubCategoryInput(false);
            toast.success(`Subcategory "${saved.name}" added to master catalog`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to add subcategory");
        }
    };

    const handleOpenEditSubCategory = (sub, parentCat) => {
        const targetSub = sub || selectedSubCategory;
        const targetParent = parentCat || selectedCategory;
        if (!targetSub || !targetParent) return;
        setEditingSubCategory(targetSub);
        setEditingSubCategoryParent(targetParent);
        setEditSubCategoryName(targetSub.name || targetSub.subCategory || "");
        setIsSubCategoryEditModalOpen(true);
    };

    const handleSaveSubCategoryName = async () => {
        if (!editingSubCategory || !editSubCategoryName.trim()) return;
        const targetParent = editingSubCategoryParent || selectedCategory;
        if (!targetParent) return;

        try {
            const newName = editSubCategoryName.trim();
            await saveCompanySubcategory(
                selectedCompany,
                targetParent.id,
                {
                    ...editingSubCategory,
                    name: newName,
                    subCategory: newName,
                    slug: slugify(newName),
                },
                editingSubCategory.websiteIds
            );

            await loadCategories(selectedCompany, true);
            const freshSubs = await fetchCompanySubcategories(selectedCompany, targetParent.id);
            setSelectedCategory((prev) => (prev && prev.id === targetParent.id ? { ...prev, subcategories: freshSubs } : prev));
            if (selectedSubCategory?.id === editingSubCategory.id) {
                setSelectedSubCategory((prev) => ({ ...prev, name: newName, subCategory: newName }));
            }
            setIsSubCategoryEditModalOpen(false);
            setEditingSubCategory(null);
            setEditingSubCategoryParent(null);
            toast.success("Subcategory updated");
        } catch (err) {
            console.error(err);
            toast.error("Update failed");
        }
    };

    const editSubCategory = () => handleOpenEditSubCategory(selectedSubCategory, selectedCategory);

    // Product Form Inputs
    const handleChange = (index, field, value) => {
        const updated = [...products];
        updated[index][field] = value;
        setProducts(updated);
    };

    // Media Uploads (Company-Centric Storage Paths)
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
            const currentImgs = Array.isArray(updated[index].images) ? updated[index].images : [];
            updated[index].images = [...currentImgs, downloadUrl];
            setProducts(updated);
            toast.success("Image uploaded to company storage");
        } catch (err) {
            console.error("Upload error:", err);
            toast.error("Image upload failed");
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
            console.error(err);
            toast.error("PDF upload failed");
        } finally {
            setImageUploading(false);
        }
    };

    // Save Category Product
    const saveCategoryProduct = async () => {
        if (!selectedCategory || !selectedSubCategory) {
            toast.error("Please select a category and subcategory first");
            return;
        }
        if (!products[0].title.trim()) {
            toast.error("Please enter product title");
            return;
        }

        setSaving(true);
        try {
            const prefix = (selectedSubCategory.name || selectedSubCategory.subCategory || "CP")
                .split(" ")
                .map((w) => w[0]?.toUpperCase())
                .join("")
                .replace(/[^\w]/g, "") || "CP";

            const nextCatNum = subCategoryProducts.length + 1;
            const targetWebsites = selectedWebsites.includes("all")
                ? COMPANY_WEBSITES[selectedCompany] || []
                : selectedWebsites;

            const prodPayload = {
                id: editingProductId || crypto.randomUUID(),
                categoryProductId: products[0].categoryProductId || `${prefix}-${nextCatNum}`,
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
                categoryId: selectedCategory.id,
                subcategoryId: selectedSubCategory.id,
                companyId: selectedCompany,
                type: "category",
                images: products[0].images || [],
                originalImages: products[0].images || [],
                video: products[0].video || "",
                pdf: products[0].pdf || "",
                isPublished: true,
                websiteIds: targetWebsites,
            };

            await saveCompanyProduct(selectedCompany, prodPayload, targetWebsites);
            await loadSubCategoryProducts(selectedSubCategory.id, selectedCategory.id);

            // Reset form
            setProducts([
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
                    images: [],
                    video: "",
                    pdf: "",
                },
            ]);
            setEditIndex(null);
            setEditingProductId(null);
            toast.success(editingProductId ? "Product updated in master catalog" : "Product added to master catalog");
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
                categoryProductId: prod.categoryProductId || "",
                images: Array.isArray(prod.images) ? prod.images : prod.image ? [prod.image] : [],
                video: prod.video || "",
                pdf: prod.pdf || "",
            },
        ]);
        const companySites = COMPANY_WEBSITES[selectedCompany] || [];
        const wIds = Array.isArray(prod.websiteIds)
            ? (prod.websiteIds.includes("all") ? companySites : prod.websiteIds)
            : companySites;
        setSelectedWebsites(wIds);
        window.scrollTo({ top: 300, behavior: "smooth" });
    };

    const handleOpenProductVisibility = (prod) => {
        setVisibilityTarget({ type: "product", item: prod });
        const companySites = COMPANY_WEBSITES[selectedCompany] || [];
        const cur = Array.isArray(prod.websiteIds) && prod.websiteIds.length > 0
            ? (prod.websiteIds.includes("all") ? companySites : prod.websiteIds)
            : companySites;
        setVisibilitySelectedWebsites(cur);
        setVisibilitySearch("");
        setIsVisibilityModalOpen(true);
    };

    const handleOpenBulkVisibility = () => {
        if (selectedProducts.length === 0) {
            toast.error("Please select products first");
            return;
        }
        setVisibilityTarget({ type: "bulk_products", items: selectedProducts });
        setVisibilitySelectedWebsites(COMPANY_WEBSITES[selectedCompany] || []);
        setVisibilitySearch("");
        setIsVisibilityModalOpen(true);
    };

    const handleOpenCategoryVisibility = (cat) => {
        setVisibilityTarget({ type: "category", item: cat });
        const companySites = COMPANY_WEBSITES[selectedCompany] || [];
        const cur = Array.isArray(cat.websiteIds) && cat.websiteIds.length > 0
            ? (cat.websiteIds.includes("all") ? companySites : cat.websiteIds)
            : companySites;
        setVisibilitySelectedWebsites(cur);
        setVisibilityCascade(true);
        setVisibilitySearch("");
        setIsVisibilityModalOpen(true);
    };

    const handleOpenSubcategoryVisibility = (sub, parentCat) => {
        setVisibilityTarget({ type: "subcategory", item: sub, parentCategory: parentCat });
        const companySites = COMPANY_WEBSITES[selectedCompany] || [];
        const cur = Array.isArray(sub.websiteIds) && sub.websiteIds.length > 0
            ? (sub.websiteIds.includes("all") ? companySites : sub.websiteIds)
            : (Array.isArray(parentCat?.websiteIds) && parentCat.websiteIds.length > 0
                ? (parentCat.websiteIds.includes("all") ? companySites : parentCat.websiteIds)
                : companySites);
        setVisibilitySelectedWebsites(cur);
        setVisibilityCascade(true);
        setVisibilitySearch("");
        setIsVisibilityModalOpen(true);
    };

    const handleToggleCategorySelect = (cat) => {
        const isCurrentlySelected = selectedCategoryIdsForVis.includes(cat.id);
        const catSubs = (cat.subcategories || []).map((sub) => ({
            categoryId: cat.id,
            subcategoryId: sub.id,
            name: sub.name || sub.subCategory,
            categoryName: cat.name || cat.category,
        }));

        if (isCurrentlySelected) {
            // Uncheck category -> also uncheck all its subcategories
            setSelectedCategoryIdsForVis((prev) => prev.filter((id) => id !== cat.id));
            setSelectedSubcategoryKeysForVis((prev) => prev.filter((s) => s.categoryId !== cat.id));
        } else {
            // Check category -> auto check all its subcategories
            setSelectedCategoryIdsForVis((prev) => [...prev, cat.id]);
            setSelectedSubcategoryKeysForVis((prev) => [
                ...prev.filter((s) => s.categoryId !== cat.id),
                ...catSubs,
            ]);
            // Auto expand so user sees selected subcategories
            setExpandedCategory(cat.id);
        }
    };

    const handleToggleSubcategorySelect = (sub, cat) => {
        const isSubSelected = selectedSubcategoryKeysForVis.some(
            (s) => s.categoryId === cat.id && s.subcategoryId === sub.id
        );
        const catSubs = cat.subcategories || [];

        if (isSubSelected) {
            // Unselect this subcategory
            const nextSubs = selectedSubcategoryKeysForVis.filter(
                (s) => !(s.categoryId === cat.id && s.subcategoryId === sub.id)
            );
            setSelectedSubcategoryKeysForVis(nextSubs);
            // If the parent category was checked, uncheck it since not all subs are selected now
            setSelectedCategoryIdsForVis((prev) => prev.filter((id) => id !== cat.id));
        } else {
            // Select this subcategory
            const newSubObj = {
                categoryId: cat.id,
                subcategoryId: sub.id,
                name: sub.name || sub.subCategory,
                categoryName: cat.name || cat.category,
            };
            const nextSubs = [...selectedSubcategoryKeysForVis, newSubObj];
            setSelectedSubcategoryKeysForVis(nextSubs);

            // If all subcategories of this category are now selected, check the category too
            const allCatSubsSelected = catSubs.length > 0 && catSubs.every((s) =>
                s.id === sub.id || nextSubs.some((ns) => ns.categoryId === cat.id && ns.subcategoryId === s.id)
            );
            if (allCatSubsSelected && !selectedCategoryIdsForVis.includes(cat.id)) {
                setSelectedCategoryIdsForVis((prev) => [...prev, cat.id]);
            }
        }
    };

    const handleSelectAllBulk = () => {
        const allCatIds = filteredCategories.map((c) => c.id);
        const allSubs = [];
        filteredCategories.forEach((c) => {
            (c.subcategories || []).forEach((s) => {
                allSubs.push({
                    categoryId: c.id,
                    subcategoryId: s.id,
                    name: s.name || s.subCategory,
                    categoryName: c.name || c.category,
                });
            });
        });
        setSelectedCategoryIdsForVis(allCatIds);
        setSelectedSubcategoryKeysForVis(allSubs);
    };

    const handleDeselectAllBulk = () => {
        setSelectedCategoryIdsForVis([]);
        setSelectedSubcategoryKeysForVis([]);
    };

    const handleOpenBulkCategoryVisibility = () => {
        if (selectedCategoryIdsForVis.length === 0 && selectedSubcategoryKeysForVis.length === 0) {
            toast.error("Please select at least one category or subcategory");
            return;
        }
        if (selectedCategoryIdsForVis.length > 0 && selectedSubcategoryKeysForVis.length > 0) {
            setVisibilityTarget({
                type: "bulk_mixed",
                categories: selectedCategoryIdsForVis,
                subcategories: selectedSubcategoryKeysForVis,
            });
        } else if (selectedCategoryIdsForVis.length > 0) {
            setVisibilityTarget({ type: "bulk_categories", items: selectedCategoryIdsForVis });
        } else {
            setVisibilityTarget({ type: "bulk_subcategories", items: selectedSubcategoryKeysForVis });
        }
        setVisibilitySelectedWebsites(COMPANY_WEBSITES[selectedCompany] || []);
        setVisibilityCascade(true);
        setVisibilitySearch("");
        setIsVisibilityModalOpen(true);
    };

    const visibilityModalInfo = useMemo(() => {
        if (!visibilityTarget) {
            return {
                title: "Website Visibility Manager",
                subtitle: `Bulk update website visibility for ${selectedProducts.length} selected products`,
                isCascadable: false,
                cascadeLabel: "",
            };
        }
        const { type, item, items, categories: mixedCats, subcategories: mixedSubs, parentCategory } = visibilityTarget;
        if (type === "category") {
            return {
                title: `Category: "${item?.name || item?.category || "Category"}"`,
                subtitle: `Configure which website frontends display this category and its nested contents`,
                isCascadable: true,
                cascadeLabel: "Cascade to all subcategories & products inside this category",
            };
        }
        if (type === "bulk_categories") {
            return {
                title: `Bulk Categories (${(items || []).length} Categories)`,
                subtitle: `Configure website visibility for ${(items || []).length} selected categories`,
                isCascadable: true,
                cascadeLabel: "Cascade to all subcategories & products inside these categories",
            };
        }
        if (type === "subcategory") {
            return {
                title: `Subcategory: "${item?.name || item?.subCategory || "Subcategory"}"`,
                subtitle: `Parent: "${parentCategory?.name || parentCategory?.category || "Category"}" • Configure which websites display this subcategory`,
                isCascadable: true,
                cascadeLabel: "Cascade to all products inside this subcategory",
            };
        }
        if (type === "bulk_subcategories") {
            return {
                title: `Bulk Subcategories (${(items || []).length} Subcategories)`,
                subtitle: `Configure website visibility for ${(items || []).length} selected subcategories`,
                isCascadable: true,
                cascadeLabel: "Cascade to all products inside these subcategories",
            };
        }
        if (type === "bulk_mixed") {
            const catCount = (mixedCats || []).length;
            const subCount = (mixedSubs || []).length;
            return {
                title: `Bulk Visibility (${catCount} Categories, ${subCount} Subcategories)`,
                subtitle: `Configure website visibility for ${catCount} categories and ${subCount} subcategories`,
                isCascadable: true,
                cascadeLabel: "Cascade to all nested subcategories & products",
            };
        }
        if (type === "product") {
            return {
                title: `Product: "${item?.title || item?.name || "Product"}"`,
                subtitle: `Configure which website frontends will display this product`,
                isCascadable: false,
                cascadeLabel: "",
            };
        }
        return {
            title: `Bulk Products Visibility (${(items || selectedProducts).length} Products)`,
            subtitle: `Configure website visibility for ${(items || selectedProducts).length} selected products`,
            isCascadable: false,
            cascadeLabel: "",
        };
    }, [visibilityTarget, selectedProducts]);

    const handleSaveVisibility = async () => {
        setIsSavingVisibility(true);
        const sitesToSave = visibilitySelectedWebsites;
        const target = visibilityTarget;

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
            percent: 5,
            title: "Updating Website Visibility",
            text: "Applying instant changes...",
        });

        // ==========================================
        // 1. INSTANT OPTIMISTIC UI UPDATES (0ms delay)
        // ==========================================
        if (target?.type === "category") {
            const cat = target.item;
            setCategories((prev) =>
                prev.map((c) => {
                    if (c.id === cat.id) {
                        return {
                            ...c,
                            websiteIds: sitesToSave,
                            subcategories: visibilityCascade
                                ? (c.subcategories || []).map((s) => ({ ...s, websiteIds: sitesToSave }))
                                : c.subcategories,
                        };
                    }
                    return c;
                })
            );
            if (selectedCategory?.id === cat.id && visibilityCascade) {
                setSubCategoryProducts((prev) => prev.map((p) => ({ ...p, websiteIds: sitesToSave })));
            }
        } else if (target?.type === "bulk_categories") {
            const catIds = target.items || [];
            const catIdSet = new Set(catIds);
            setCategories((prev) =>
                prev.map((c) => {
                    if (catIdSet.has(c.id)) {
                        return {
                            ...c,
                            websiteIds: sitesToSave,
                            subcategories: visibilityCascade
                                ? (c.subcategories || []).map((s) => ({ ...s, websiteIds: sitesToSave }))
                                : c.subcategories,
                        };
                    }
                    return c;
                })
            );
            if (selectedCategory && catIdSet.has(selectedCategory.id) && visibilityCascade) {
                setSubCategoryProducts((prev) => prev.map((p) => ({ ...p, websiteIds: sitesToSave })));
            }
            setSelectedCategoryIdsForVis([]);
            setIsCategorySelectMode(false);
        } else if (target?.type === "subcategory") {
            const sub = target.item;
            const parentCat = target.parentCategory || selectedCategory;
            setCategories((prev) =>
                prev.map((c) => {
                    if (c.id === parentCat?.id) {
                        return {
                            ...c,
                            subcategories: (c.subcategories || []).map((s) =>
                                s.id === sub.id ? { ...s, websiteIds: sitesToSave } : s
                            ),
                        };
                    }
                    return c;
                })
            );
            if (selectedSubCategory?.id === sub.id && visibilityCascade) {
                setSubCategoryProducts((prev) => prev.map((p) => ({ ...p, websiteIds: sitesToSave })));
            }
        } else if (target?.type === "bulk_subcategories") {
            const subItems = target.items || [];
            const subKeySet = new Set(subItems.map((s) => `${s.categoryId || s.catId}:::${s.subcategoryId || s.subId || s.id}`));
            setCategories((prev) =>
                prev.map((c) => ({
                    ...c,
                    subcategories: (c.subcategories || []).map((s) => {
                        const key = `${c.id}:::${s.id}`;
                        return subKeySet.has(key) ? { ...s, websiteIds: sitesToSave } : s;
                    }),
                }))
            );
            if (selectedSubCategory && visibilityCascade) {
                setSubCategoryProducts((prev) => prev.map((p) => ({ ...p, websiteIds: sitesToSave })));
            }
            setSelectedSubcategoryKeysForVis([]);
            setIsCategorySelectMode(false);
        } else if (target?.type === "bulk_mixed") {
            const catIds = target.categories || [];
            const subItems = target.subcategories || [];
            const catIdSet = new Set(catIds);
            const subKeySet = new Set(subItems.map((s) => `${s.categoryId || s.catId}:::${s.subcategoryId || s.subId || s.id}`));
            setCategories((prev) =>
                prev.map((c) => {
                    const isCatSelected = catIdSet.has(c.id);
                    return {
                        ...c,
                        websiteIds: isCatSelected ? sitesToSave : c.websiteIds,
                        subcategories: (c.subcategories || []).map((s) => {
                            const key = `${c.id}:::${s.id}`;
                            const isSubSelected = isCatSelected || subKeySet.has(key);
                            return isSubSelected ? { ...s, websiteIds: sitesToSave } : s;
                        }),
                    };
                })
            );
            if (selectedSubCategory && visibilityCascade) {
                setSubCategoryProducts((prev) => prev.map((p) => ({ ...p, websiteIds: sitesToSave })));
            }
            setSelectedCategoryIdsForVis([]);
            setSelectedSubcategoryKeysForVis([]);
            setIsCategorySelectMode(false);
        } else if (target?.type === "product") {
            const prod = target.item;
            setSubCategoryProducts((prev) => {
                if (selectedWebsiteFilter && selectedWebsiteFilter !== "all" && !sitesToSave.includes(selectedWebsiteFilter)) {
                    return prev.filter((p) => p.id !== prod.id && p.categoryProductId !== prod.id);
                }
                return prev.map((p) => (p.id === prod.id || p.categoryProductId === prod.id ? { ...p, websiteIds: sitesToSave } : p));
            });
        } else {
            // Bulk products
            const targetSet = new Set(selectedProducts);
            setSubCategoryProducts((prev) => {
                if (selectedWebsiteFilter && selectedWebsiteFilter !== "all" && !sitesToSave.includes(selectedWebsiteFilter)) {
                    return prev.filter((p) => !targetSet.has(p.id) && !targetSet.has(p.categoryProductId));
                }
                return prev.map((p) => (targetSet.has(p.id) || targetSet.has(p.categoryProductId) ? { ...p, websiteIds: sitesToSave } : p));
            });
            setSelectedProducts([]);
        }

        const toastId = toast.loading("Syncing website visibility...");

        // ==========================================
        // 2. PARALLEL BACKGROUND SYNC WITH PROGRESS %
        // ==========================================
        try {
            if (target?.type === "category") {
                const cat = target.item;
                await updateCategoryWebsiteVisibility(
                    selectedCompany,
                    cat.id,
                    sitesToSave,
                    {
                        cascadeToSubcategories: visibilityCascade,
                        cascadeToProducts: visibilityCascade,
                    },
                    updateProgress
                );
                toast.success(`Updated website visibility for category "${cat.name || cat.category}"`, { id: toastId });
            } else if (target?.type === "bulk_categories") {
                const catIds = target.items || [];
                await bulkUpdateCategoriesWebsiteVisibility(
                    selectedCompany,
                    catIds,
                    sitesToSave,
                    {
                        cascadeToSubcategories: visibilityCascade,
                        cascadeToProducts: visibilityCascade,
                    },
                    updateProgress
                );
                toast.success(`Updated visibility for ${catIds.length} categories!`, { id: toastId });
            } else if (target?.type === "subcategory") {
                const sub = target.item;
                const parentCat = target.parentCategory || selectedCategory;
                await updateSubcategoryWebsiteVisibility(
                    selectedCompany,
                    parentCat?.id,
                    sub.id,
                    sitesToSave,
                    {
                        cascadeToProducts: visibilityCascade,
                    },
                    updateProgress
                );
                toast.success(`Updated website visibility for subcategory "${sub.name || sub.subCategory}"`, { id: toastId });
            } else if (target?.type === "bulk_subcategories") {
                const subItems = target.items || [];
                await bulkUpdateSubcategoriesWebsiteVisibility(
                    selectedCompany,
                    subItems,
                    sitesToSave,
                    {
                        cascadeToProducts: visibilityCascade,
                    },
                    updateProgress
                );
                toast.success(`Updated visibility for ${subItems.length} subcategories!`, { id: toastId });
            } else if (target?.type === "bulk_mixed") {
                const catIds = target.categories || [];
                const subItems = target.subcategories || [];
                if (catIds.length > 0) {
                    await bulkUpdateCategoriesWebsiteVisibility(
                        selectedCompany,
                        catIds,
                        sitesToSave,
                        {
                            cascadeToSubcategories: visibilityCascade,
                            cascadeToProducts: visibilityCascade,
                        },
                        (pct, msg) => updateProgress(pct * 0.5, msg)
                    );
                }
                if (subItems.length > 0) {
                    await bulkUpdateSubcategoriesWebsiteVisibility(
                        selectedCompany,
                        subItems,
                        sitesToSave,
                        {
                            cascadeToProducts: visibilityCascade,
                        },
                        (pct, msg) => updateProgress(50 + pct * 0.5, msg)
                    );
                }
                toast.success(`Updated visibility for ${catIds.length} categories & ${subItems.length} subcategories!`, { id: toastId });
            } else if (target?.type === "product") {
                const prod = target.item;
                const targetObj = {
                    ...prod,
                    categoryId: selectedCategory?.id || prod.categoryId,
                    subcategoryId: selectedSubCategory?.id || prod.subcategoryId,
                    category: selectedCategory?.category || selectedCategory?.name || prod.category,
                    subCategory: selectedSubCategory?.subCategory || selectedSubCategory?.name || prod.subCategory,
                    type: "category",
                };
                await updateProductWebsiteVisibility(selectedCompany, targetObj, sitesToSave, updateProgress);
                toast.success(`Updated website visibility for "${prod.title || prod.name}"`, { id: toastId });
            } else {
                // Bulk products (default)
                const targetObjects = subCategoryProducts
                    .filter((p) => selectedProducts.includes(p.id) || selectedProducts.includes(p.categoryProductId))
                    .map((p) => ({
                        ...p,
                        categoryId: selectedCategory?.id || p.categoryId,
                        subcategoryId: selectedSubCategory?.id || p.subcategoryId,
                        category: selectedCategory?.category || selectedCategory?.name || p.category,
                        subCategory: selectedSubCategory?.subCategory || selectedSubCategory?.name || p.subCategory,
                        type: "category",
                    }));
                await bulkUpdateProductsWebsiteVisibility(
                    selectedCompany,
                    targetObjects.length > 0 ? targetObjects : selectedProducts,
                    sitesToSave,
                    updateProgress
                );
                toast.success(`Updated visibility for ${selectedProducts.length} products!`, { id: toastId });
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

        if (!cat) cat = fallbackCat || selectedCategory?.name || selectedCategory?.category || "General Category";
        if (!sub) sub = fallbackSub || selectedSubCategory?.name || selectedSubCategory?.subCategory || (fileName || "").replace(/\.xlsx?$/i, "").trim() || "General";

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
            const groupName = category || "General Category";
            if (!map[groupName]) map[groupName] = [];
            map[groupName].push({ file, subCategory });
        }
        return map;
    }, [stagedFiles, selectedCategory, selectedSubCategory]);

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

    // Run Batch Excel Import for Category Products with Multi-File Concurrency (4x) & 32x Image Concurrency
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
                    parseCategoryAndSubcategoryFromPath(
                        file.webkitRelativePath,
                        file.name,
                        selectedCategory?.name || selectedCategory?.category || "",
                        selectedSubCategory?.name || selectedSubCategory?.subCategory || ""
                    );

                setActiveImportFile(file.name);
                setFileStatuses((prev) => ({
                    ...prev,
                    [fileKey]: { status: "processing", count: 0, error: null },
                }));

                addImportLog(`📁 [${folderCategory}] Parsing "${file.name}"...`, "folder");

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
                                    `import-cat-${Date.now()}-${fileIdx}-${rowNumber}`,
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
                    const formatted = [];
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
                            selectedCategory?.name ||
                            selectedCategory?.category ||
                            "General Category";

                        const subCategory =
                            getValue("sub category").trim() ||
                            getValue("subcategory").trim() ||
                            folderSubcategory ||
                            selectedSubCategory?.name ||
                            selectedSubCategory?.subCategory ||
                            "General";

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

                        formatted.push({
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
                            type: "category",
                            websiteIds: COMPANY_WEBSITES[selectedCompany] || [],
                        });
                    }

                    // Step 3: Register Categories & Subcategories in parallel, then batch save products
                    if (formatted.length > 0) {
                        const uniqueCats = new Map();
                        const uniqueSubcats = new Map();

                        for (const cp of formatted) {
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

                        // Atomic batch write across master & primary website
                        await saveCompanyProductsBatch(selectedCompany, formatted, COMPANY_WEBSITES[selectedCompany] || []);

                        totalProductsCount += formatted.length;
                        successfulFilesCount++;

                        addImportLog(`💾 Saved ${formatted.length} product(s) from "${file.name}"`, "db");
                        setFileStatuses((prev) => ({
                            ...prev,
                            [fileKey]: { status: "completed", count: formatted.length, error: null },
                        }));
                    } else {
                        addImportLog(`⚠️ No products found in "${file.name}"`, "warning");
                        setFileStatuses((prev) => ({
                            ...prev,
                            [fileKey]: { status: "completed", count: 0, error: "0 products" },
                        }));
                    }
                } catch (fileErr) {
                    console.error(`Error processing file ${file.name}:`, fileErr);
                    errors.push(`${file.name}: ${fileErr.message || "Parse failed"}`);
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
            setImportStatusText(`Completed! ${totalProductsCount} products imported across ${successfulFilesCount} files.`);
            setImportStats({
                totalFiles: stagedFiles.length,
                filesCount: successfulFilesCount,
                productsCount: totalProductsCount,
                errors,
            });
            addImportLog(
                `🎉 Category Import Complete! Total ${totalProductsCount} products added across ${successfulFilesCount} files in record time!`,
                "success"
            );

            await loadCategories(selectedCompany);
            if (selectedSubCategory && selectedCategory) {
                await loadSubCategoryProducts(selectedSubCategory.id, selectedCategory.id);
            }
            toast.success(`Batch import complete! Added ${totalProductsCount} products across ${successfulFilesCount} files.`);
        } catch (err) {
            console.error("Batch Excel import error:", err);
            toast.error("Import failed: " + (err.message || "Unknown error"));
            addImportLog(`❌ Batch process stopped: ${err.message || "Fatal error"}`, "error");
        } finally {
            setImporting(false);
        }
    };

    // Download Demo Excel Template for Category Products
    const downloadDemoExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("CategoryProducts");

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
                title: "Automated Chemistry Analyzer",
                price: "75000",
                desc: "High throughput biochemistry analyzer",
                capacity: "200 Tests",
                throughput: "120/hr",
                instrument: "Biochemistry",
                model: "CHEM-200",
                usage: "Clinical Laboratory",
                brand: getCompanyDisplayName(selectedCompany),
                parameters: "Full Profile",
                automation: "Fully Automatic",
                availability: "In Stock",
                size: "Large",
                category: selectedCategory?.name || selectedCategory?.category || "Clinical Chemistry",
                subCategory: selectedSubCategory?.name || selectedSubCategory?.subCategory || "Analyzers",
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
            a.download = `${selectedCompany}-Category-Products-Demo.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Demo download error:", err);
            toast.error("Failed to generate demo excel");
        }
    };

    // Export Category Products to Excel
    const executeExportExcel = async () => {
        setIsExporting(true);
        try {
            let productsToExport = [];
            let filename = `${selectedCompany}-products`;

            if (exportScope === "selected" && selectedProducts.length > 0) {
                productsToExport = subCategoryProducts.filter((p) => selectedProducts.includes(p.id)).map(p => ({
                    ...p,
                    category: selectedCategory?.name || selectedCategory?.category || p.category || "",
                    subCategory: selectedSubCategory?.name || selectedSubCategory?.subCategory || p.subCategory || "",
                }));
                filename = `${selectedCompany}-selected-products`;
            } else if (exportScope === "current" && selectedSubCategory) {
                productsToExport = subCategoryProducts.map((p) => ({
                    ...p,
                    category: selectedCategory?.name || selectedCategory?.category || p.category || "",
                    subCategory: selectedSubCategory?.name || selectedSubCategory?.subCategory || p.subCategory || "",
                }));
                filename = `${selectedCompany}-${slugify(selectedCategory?.name || "category")}-${slugify(selectedSubCategory?.name || "sub")}`;
            } else if (exportScope === "category" && selectedCategory) {
                const catProds = await fetchCompanyProducts(selectedCompany, {
                    type: "category",
                    categoryId: selectedCategory.id,
                });
                productsToExport = catProds.map((p) => ({
                    ...p,
                    category: selectedCategory.name || selectedCategory.category || p.category || "",
                }));
                filename = `${selectedCompany}-${slugify(selectedCategory.name || "category")}`;
            } else if (exportScope === "custom" && exportSelectedCategoryIds.length > 0) {
                const allProds = await fetchCompanyProducts(selectedCompany, { type: "category" });
                productsToExport = allProds.filter((p) => exportSelectedCategoryIds.includes(p.categoryId));
                filename = `${selectedCompany}-selected-categories`;
            } else {
                // "all" - Full company catalog
                productsToExport = await fetchCompanyProducts(selectedCompany, { type: "category" });
                filename = `${selectedCompany}-All-Category-Products`;
            }

            if (!productsToExport || productsToExport.length === 0) {
                toast.error("No category products found to export");
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("CategoryProducts");

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

            // Build map for category IDs to human readable names
            const catMap = {};
            categories.forEach((c) => {
                catMap[c.id] = c.name || c.category || c.id;
            });

            productsToExport.forEach((prod) => {
                const catName = prod.category || catMap[prod.categoryId] || selectedCategory?.name || "";
                const subName = prod.subCategory || prod.subcategory || selectedSubCategory?.name || "";
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
                    category: catName,
                    subCategory: subName,
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
            a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

            setIsExportModalOpen(false);
            toast.success(`Successfully exported ${productsToExport.length} products to Excel!`);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Export failed: " + (err.message || "Unknown error"));
        } finally {
            setIsExporting(false);
        }
    };

    // Product Actions
    const togglePublish = async (index) => {
        const prod = subCategoryProducts[index];
        if (!prod) return;
        const newStatus = !prod.isPublished;
        // 1. Instant optimistic update (0ms delay)
        setSubCategoryProducts((prev) =>
            prev.map((p, i) => (i === index ? { ...p, isPublished: newStatus } : p))
        );
        toast.success(newStatus ? "Product visible on enabled websites" : "Product hidden from websites");

        // 2. Parallel background sync
        try {
            await toggleProductPublish(selectedCompany, prod.id, newStatus, {
                categoryId: selectedCategory?.id || prod.categoryId,
                subcategoryId: selectedSubCategory?.id || prod.subcategoryId,
            });
        } catch (err) {
            console.error("Failed to toggle publish:", err);
            // Rollback on error
            setSubCategoryProducts((prev) =>
                prev.map((p, i) => (i === index ? { ...p, isPublished: !newStatus } : p))
            );
            toast.error("Failed to update visibility");
        }
    };

    const confirmDelete = async () => {
        const prod = subCategoryProducts[deleteIndex];
        if (!prod) return;
        try {
            await deleteCompanyProduct(selectedCompany, prod.id, {
                categoryId: selectedCategory?.id || prod.categoryId,
                subcategoryId: selectedSubCategory?.id || prod.subcategoryId,
            });
            setSubCategoryProducts((prev) => prev.filter((_, i) => i !== deleteIndex));
            setIsModalOpen(false);
            setDeleteIndex(null);
            toast.success("Product deleted from subcategory");
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const deleteSelectedProducts = async () => {
        if (selectedProducts.length === 0) return toast.error("Select products first");
        try {
            await deleteCompanyProductsBatch(selectedCompany, selectedProducts, {
                categoryId: selectedCategory?.id,
                subcategoryId: selectedSubCategory?.id,
            });
            setSubCategoryProducts((prev) => prev.filter((p) => !selectedProducts.includes(p.id)));
            setSelectedProducts([]);
            toast.success(`${selectedProducts.length} products deleted from subcategory`);
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const deleteAllProducts = async () => {
        try {
            const allIds = subCategoryProducts.map((p) => p.id);
            await deleteCompanyProductsBatch(selectedCompany, allIds, {
                categoryId: selectedCategory?.id,
                subcategoryId: selectedSubCategory?.id,
            });
            setSubCategoryProducts([]);
            setSelectedProducts([]);
            setIsDeleteAllModalOpen(false);
            toast.success("All products deleted from this subcategory");
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const handleSelectProduct = (id) => {
        setSelectedProducts((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    // Website Visibility / Enable on Websites Modal
    const handleOpenCopyModal = () => {
        if (selectedProducts.length === 0 && subCategoryProducts.length === 0) {
            toast.error("No products available to enable on websites");
            return;
        }
        setSelectedCopyProductIds(selectedProducts.length > 0 ? selectedProducts : subCategoryProducts.map((p) => p.id));
        setCopyDestSites([]);
        setIsCopyModalOpen(true);
    };

    const handleStartEnableWebsites = async () => {
        if (copyDestSites.length === 0) {
            toast.error("Please select at least one destination website");
            return;
        }
        try {
            // Enable category & subcategory on destination websites
            if (selectedCategory) {
                await bulkEnableCategoryOnWebsites(selectedCompany, selectedCategory.id, copyDestSites);
            }
            if (selectedCategory && selectedSubCategory) {
                await bulkEnableSubcategoryOnWebsites(selectedCompany, selectedCategory.id, selectedSubCategory.id, copyDestSites);
            }
            // Enable products on destination websites without cloning
            await bulkEnableProductsOnWebsites(selectedCompany, selectedCopyProductIds, copyDestSites);

            await loadCategories(selectedCompany);
            await loadSubCategoryProducts(selectedSubCategory.id, selectedCategory.id);

            setIsCopyModalOpen(false);
            setCopyDestSites([]);
            toast.success(`Enabled ${selectedCopyProductIds.length} products across ${copyDestSites.length} website(s)`);
        } catch (err) {
            console.error("Enable error:", err);
            toast.error("Failed to update website visibility");
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
                await loadCategories(selectedCompany, true);
                if (selectedSubCategory && selectedCategory) {
                    await loadSubCategoryProducts(selectedSubCategory.id, selectedCategory.id);
                }
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

    // Display-time watermark generator / preview
    const generateWatermarks = async () => {
        setIsGeneratingWatermark(true);
        setWatermarkProgress(20);
        const companyName = getCompanyDisplayName(selectedCompany);
        setWatermarkStatusText(`Rendering dynamic display watermarks with company name: ${companyName}...`);

        try {
            setWatermarkProgress(60);
            await new Promise((r) => setTimeout(r, 600));
            setWatermarkProgress(100);
            setWatermarkStatusText(`Display watermarks applied using company: ${companyName}`);
            toast.success(`Display watermarks active for ${companyName}`);
        } catch (err) {
            toast.error("Watermark preview failed");
        } finally {
            setTimeout(() => {
                setIsGeneratingWatermark(false);
            }, 400);
        }
    };

    // Pagination
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return subCategoryProducts.slice(start, start + itemsPerPage);
    }, [subCategoryProducts, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(subCategoryProducts.length / itemsPerPage) || 1;

    return (
        <div className="main" style={{ marginLeft: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            {/* TOP SECTION: Categories Sidebar (Left) + Form & Controls Area (Right) */}
            <div className="category-top-layout">
                {/* Left Categories Sidebar (Bounded to form height) */}
                <div className="category-sidebar">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #eee",
                            paddingBottom: "10px",
                            marginBottom: "10px",
                        }}
                    >
                        <h3
                            style={{
                                margin: 0,
                                fontSize: "16px",
                                fontWeight: "700",
                                color: "#4f46e5",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <span>Categories</span>
                            <span
                                style={{
                                    fontSize: "12px",
                                    background: "#eef2ff",
                                    color: "#4f46e5",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontWeight: "600",
                                }}
                            >
                                {filteredCategories.length}
                            </span>
                        </h3>

                        <button
                            type="button"
                            title="Toggle multi-category select for website visibility"
                            onClick={() => {
                                setIsCategorySelectMode(!isCategorySelectMode);
                                setSelectedCategoryIdsForVis([]);
                                setSelectedSubcategoryKeysForVis([]);
                            }}
                            style={{
                                background: isCategorySelectMode ? "#4f46e5" : "#f1f5f9",
                                border: isCategorySelectMode ? "1px solid #4338ca" : "1px solid #cbd5e1",
                                borderRadius: "7px",
                                padding: "6px 14px",
                                cursor: "pointer",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: isCategorySelectMode ? "#ffffff" : "#334155",
                                fontWeight: "600",
                                transition: "all 0.15s ease",
                            }}
                        >
                            <Layers size={14} />
                            <span>{isCategorySelectMode ? "Exit Bulk Mode" : "Bulk Select"}</span>
                        </button>
                    </div>

                    {/* Company Master Badge */}
                    <div
                        style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#4f46e5",
                            background: "#eef2ff",
                            border: "1px solid #c7d2fe",
                            padding: "5px 8px",
                            borderRadius: "6px",
                            marginBottom: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        <Globe size={13} />
                        <span>
                            {selectedWebsiteFilter
                                ? `Filter: ${selectedWebsiteFilter}`
                                : `Company: ${getCompanyDisplayName(selectedCompany)}`}
                        </span>
                    </div>

                    {/* Bulk Selection Action Box for Categories / Subcategories */}
                    {isCategorySelectMode && (
                        <div
                            style={{
                                background: "#eff6ff",
                                border: "1px solid #93c5fd",
                                borderRadius: "8px",
                                padding: "8px 10px",
                                marginBottom: "10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "11px", fontWeight: "700", color: "#1e40af" }}>
                                    {selectedCategoryIdsForVis.length} Cats, {selectedSubcategoryKeysForVis.length} Subs
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const totalCats = filteredCategories.length;
                                        if (selectedCategoryIdsForVis.length === totalCats && totalCats > 0) {
                                            handleDeselectAllBulk();
                                        } else {
                                            handleSelectAllBulk();
                                        }
                                    }}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#2563eb",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        padding: 0,
                                        textDecoration: "underline",
                                    }}
                                >
                                    {selectedCategoryIdsForVis.length === filteredCategories.length && filteredCategories.length > 0
                                        ? "Deselect All"
                                        : "Select All"}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenBulkCategoryVisibility}
                                disabled={selectedCategoryIdsForVis.length === 0 && selectedSubcategoryKeysForVis.length === 0}
                                style={{
                                    width: "100%",
                                    padding: "6px 10px",
                                    background: selectedCategoryIdsForVis.length > 0 || selectedSubcategoryKeysForVis.length > 0 ? "#2563eb" : "#94a3b8",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    cursor: selectedCategoryIdsForVis.length > 0 || selectedSubcategoryKeysForVis.length > 0 ? "pointer" : "not-allowed",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                }}
                            >
                                <Globe size={13} />
                                <span>Set Website Visibility</span>
                            </button>
                        </div>
                    )}

                    {/* Categories List (Scrollable) */}
                    <div className="categories-list-scroll">
                        {isCategoriesLoading && categories.length === 0 ? (
                            <div style={{ padding: "12px", color: "#6b7280", fontSize: "13px" }}>
                                Loading categories...
                            </div>
                        ) : filteredCategories.length === 0 ? (
                            <div style={{ padding: "12px", color: "#9ca3af", fontSize: "13px" }}>
                                No categories found.
                            </div>
                        ) : (
                            filteredCategories.map((cat) => {
                                const isExpanded = expandedCategory === cat.id;
                                const isSelected = selectedCategory?.id === cat.id;

                                return (
                                    <div key={cat.id} className="category-group" style={{ marginBottom: "6px" }}>
                                        <div
                                            className={`category-item ${isSelected ? "active" : ""}`}
                                            onClick={() => handleCategoryClick(cat)}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "7px 10px",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                background: isSelected ? "#e0e7ff" : "#f8fafc",
                                                fontWeight: isSelected ? "600" : "500",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                                                {isCategorySelectMode && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCategoryIdsForVis.includes(cat.id)}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleCategorySelect(cat);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ cursor: "pointer" }}
                                                    />
                                                )}
                                                <span style={{ fontSize: "13px", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {cat.name || cat.category}
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", gap: "4px", alignItems: "center", marginLeft: "6px" }}>
                                                <button
                                                    type="button"
                                                    title="Manage Website Visibility for this Category"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenCategoryVisibility(cat);
                                                    }}
                                                    style={{
                                                        background: "transparent",
                                                        border: "none",
                                                        color: "#4f46e5",
                                                        cursor: "pointer",
                                                        padding: "2px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <Globe size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Edit Category Name"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingCategory(cat);
                                                        setEditCategoryName(cat.name || cat.category);
                                                        setIsCategoryModalOpen(true);
                                                    }}
                                                    style={{
                                                        background: "transparent",
                                                        border: "none",
                                                        color: "#64748b",
                                                        cursor: "pointer",
                                                        padding: "2px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Delete Category"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        promptDeleteCategory(cat);
                                                    }}
                                                    style={{
                                                        background: "transparent",
                                                        border: "none",
                                                        color: "#ef4444",
                                                        cursor: "pointer",
                                                        padding: "2px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Subcategories list */}
                                        {isExpanded && (
                                            <div
                                                className="subcategories-list"
                                                style={{
                                                    paddingLeft: "14px",
                                                    marginTop: "4px",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "4px",
                                                }}
                                            >
                                                {(cat.subcategories || []).map((sub) => {
                                                    const isSubSelected = selectedSubCategory?.id === sub.id;
                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            onClick={() => handleSubCategoryClick(sub)}
                                                            style={{
                                                                padding: "5px 8px",
                                                                borderRadius: "6px",
                                                                fontSize: "12px",
                                                                cursor: "pointer",
                                                                background: isSubSelected ? "#4f46e5" : "#f1f5f9",
                                                                color: isSubSelected ? "#ffffff" : "#334155",
                                                                fontWeight: isSubSelected ? "600" : "400",
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                alignItems: "center",
                                                            }}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                                                                {isCategorySelectMode && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedSubcategoryKeysForVis.some((s) => s.categoryId === cat.id && s.subcategoryId === sub.id)}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            handleToggleSubcategorySelect(sub, cat);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{ cursor: "pointer" }}
                                                                    />
                                                                )}
                                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {sub.name || sub.subCategory}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                                <button
                                                                    type="button"
                                                                    title="Manage Website Visibility for this Subcategory"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenSubcategoryVisibility(sub, cat);
                                                                    }}
                                                                    style={{
                                                                        background: "transparent",
                                                                        border: "none",
                                                                        color: isSubSelected ? "#bfdbfe" : "#4f46e5",
                                                                        cursor: "pointer",
                                                                        padding: "2px",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                    }}
                                                                >
                                                                    <Globe size={12} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Edit Subcategory Name"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenEditSubCategory(sub, cat);
                                                                    }}
                                                                    style={{
                                                                        background: "transparent",
                                                                        border: "none",
                                                                        color: isSubSelected ? "#e2e8f0" : "#64748b",
                                                                        cursor: "pointer",
                                                                        padding: "2px",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                    }}
                                                                >
                                                                    <Pencil size={12} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Delete Subcategory"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        promptDeleteSubCategory(sub, cat);
                                                                    }}
                                                                    style={{
                                                                        background: "transparent",
                                                                        border: "none",
                                                                        color: isSubSelected ? "#fca5a5" : "#ef4444",
                                                                        cursor: "pointer",
                                                                        padding: "2px",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                    }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Add Subcategory Button */}
                                                <button
                                                    type="button"
                                                    title="Add a new subcategory to this category"
                                                    onClick={() => setShowSubCategoryInput(true)}
                                                    style={{
                                                        background: "#eef2ff",
                                                        border: "1px dashed #6366f1",
                                                        borderRadius: "6px",
                                                        color: "#4f46e5",
                                                        padding: "4px 8px",
                                                        fontSize: "11px",
                                                        fontWeight: "600",
                                                        cursor: "pointer",
                                                        marginTop: "4px",
                                                    }}
                                                >
                                                    + Add Subcategory
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Add Category Section */}
                    <div style={{ marginTop: "12px" }}>
                        {!showCategoryInput ? (
                            <button
                                type="button"
                                className="add-category-btn"
                                title="Add a new master category"
                                onClick={() => setShowCategoryInput(true)}
                                style={{
                                    width: "100%",
                                    padding: "8px",
                                    borderRadius: "8px",
                                    background: "#4f46e5",
                                    color: "white",
                                    border: "none",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                }}
                            >
                                + Add Category
                            </button>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <input
                                    type="text"
                                    placeholder="Category Name"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    style={{
                                        padding: "7px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "13px",
                                    }}
                                />
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        type="button"
                                        title="Save Category"
                                        onClick={handleCategorySave}
                                        disabled={categorySaving}
                                        style={{
                                            flex: 1,
                                            padding: "6px",
                                            background: "#10b981",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontWeight: "600",
                                            fontSize: "12px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {categorySaving ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        title="Cancel"
                                        onClick={() => setShowCategoryInput(false)}
                                        style={{
                                            padding: "6px 12px",
                                            background: "#e2e8f0",
                                            color: "#334155",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            cursor: "pointer",
                                            fontWeight: "500",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Form & Controls Area */}
                <div className="category-form-area">
                    {/* Top Controls Bar */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "white",
                            padding: "12px 18px",
                            borderRadius: "10px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                            marginBottom: "16px",
                            flexWrap: "wrap",
                            gap: "10px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            {/* Company Switcher */}
                            <div>
                                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", display: "block" }}>
                                    Company:
                                </label>
                                <select
                                    value={selectedCompany}
                                    onChange={(e) => {
                                        setSelectedCompany(e.target.value);
                                        setSelectedWebsiteFilter("");
                                    }}
                                    style={{
                                        padding: "6px 10px",
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
                                    value={selectedWebsiteFilter}
                                    onChange={(e) => setSelectedWebsiteFilter(e.target.value)}
                                    style={{
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "13px",
                                        fontWeight: "500",
                                        color: "#1e293b",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="">All Company Websites</option>
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
                                title="Bulk import products from Excel file (.xlsx)"
                                onClick={() => {
                                    setStagedFiles([]);
                                    setImportStats(null);
                                    setImportStatusText("");
                                    setIsImportModalOpen(true);
                                }}
                                disabled={importing}
                                style={{
                                    padding: "7px 12px",
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
                                <span>{importing ? `Importing ${importProgress}%` : "Import Excel"}</span>
                            </button>

                            <button
                                type="button"
                                className="import-btn"
                                title="Download template Excel file with sample columns"
                                onClick={downloadDemoExcel}
                                style={{
                                    padding: "7px 12px",
                                    background: "#475569",
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
                                <span>Download Demo</span>
                            </button>

                            <button
                                type="button"
                                className="import-btn"
                                title="Export products to Excel file (.xlsx)"
                                onClick={() => {
                                    if (selectedProducts.length > 0) {
                                        setExportScope("selected");
                                    } else if (selectedSubCategory) {
                                        setExportScope("current");
                                    } else if (selectedCategory) {
                                        setExportScope("category");
                                    } else {
                                        setExportScope("all");
                                    }
                                    setIsExportModalOpen(true);
                                }}
                                style={{
                                    padding: "7px 12px",
                                    background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
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
                                <FileDown size={14} />
                                <span>Export Excel</span>
                            </button>

                            <button
                                type="button"
                                title="Apply company watermark to product images"
                                onClick={generateWatermarks}
                                disabled={isGeneratingWatermark}
                                style={{
                                    padding: "7px 12px",
                                    background: "#6366f1",
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
                                <span>💧</span>
                                <span>{isGeneratingWatermark ? "Applying..." : "Company Watermark"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Subcategory Input Modal / Bar */}
                    {showSubCategoryInput && (
                        <div
                            style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                padding: "12px 14px",
                                borderRadius: "8px",
                                marginBottom: "14px",
                                display: "flex",
                                gap: "10px",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                                New Subcategory for "{selectedCategory?.name || selectedCategory?.category}":
                            </span>
                            <input
                                type="text"
                                placeholder="Subcategory Name"
                                value={subCategoryName}
                                onChange={(e) => setSubCategoryName(e.target.value)}
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "13px",
                                    flex: 1,
                                }}
                            />
                            <button
                                type="button"
                                title="Save Subcategory"
                                onClick={handleSubCategorySave}
                                style={{
                                    padding: "6px 14px",
                                    background: "#10b981",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                }}
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                title="Cancel"
                                onClick={() => setShowSubCategoryInput(false)}
                                style={{
                                    padding: "6px 10px",
                                    background: "#e2e8f0",
                                    color: "#334155",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Current Breadcrumb Header */}
                    {selectedCategory && (
                        <div
                            style={{
                                background: "#f1f5f9",
                                padding: "10px 14px",
                                borderRadius: "8px",
                                marginBottom: "14px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                                <span>{selectedCategory.name || selectedCategory.category}</span>
                                {selectedSubCategory && (
                                    <>
                                        <span style={{ margin: "0 6px", color: "#94a3b8" }}>&gt;</span>
                                        <span style={{ color: "#4f46e5" }}>
                                            {selectedSubCategory.name || selectedSubCategory.subCategory}
                                        </span>
                                    </>
                                )}
                            </div>

                            {selectedSubCategory && (
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        type="button"
                                        title="Edit Subcategory Name"
                                        onClick={() => handleOpenEditSubCategory(selectedSubCategory, selectedCategory)}
                                        style={{
                                            padding: "4px 8px",
                                            background: "white",
                                            color: "#334155",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: "500",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                        }}
                                    >
                                        <Pencil size={12} />
                                        <span>Edit Subcategory</span>
                                    </button>
                                    <button
                                        type="button"
                                        title="Delete Subcategory"
                                        onClick={() => promptDeleteSubCategory(selectedSubCategory, selectedCategory)}
                                        style={{
                                            padding: "4px 8px",
                                            background: "#fee2e2",
                                            color: "#dc2626",
                                            border: "1px solid #fca5a5",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: "600",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                        }}
                                    >
                                        <Trash2 size={12} />
                                        <span>Delete Subcategory</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Product Form (Add / Edit) */}
                    {selectedSubCategory ? (
                        <div
                            style={{
                                background: "white",
                                padding: "16px",
                                borderRadius: "10px",
                                border: "1px solid #e2e8f0",
                                marginBottom: "0",
                            }}
                        >
                            <h4
                                style={{
                                    margin: "0 0 12px 0",
                                    fontSize: "15px",
                                    fontWeight: "700",
                                    color: "#1e293b",
                                }}
                            >
                                {editingProductId ? "Edit Master Product" : "Add Master Product"}
                            </h4>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Title *</label>
                                    <input
                                        type="text"
                                        placeholder="Product Title"
                                        value={products[0].title}
                                        onChange={(e) => handleChange(0, "title", e.target.value)}
                                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Price</label>
                                    <input
                                        type="text"
                                        placeholder="Price"
                                        value={products[0].price}
                                        onChange={(e) => handleChange(0, "price", e.target.value)}
                                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Brand</label>
                                    <input
                                        type="text"
                                        placeholder="Brand"
                                        value={products[0].brand}
                                        onChange={(e) => handleChange(0, "brand", e.target.value)}
                                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Model</label>
                                    <input
                                        type="text"
                                        placeholder="Model"
                                        value={products[0].model}
                                        onChange={(e) => handleChange(0, "model", e.target.value)}
                                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Capacity</label>
                                    <input
                                        type="text"
                                        placeholder="Capacity"
                                        value={products[0].capacity}
                                        onChange={(e) => handleChange(0, "capacity", e.target.value)}
                                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Throughput</label>
                                    <input
                                        type="text"
                                        placeholder="Throughput"
                                        value={products[0].throughput}
                                        onChange={(e) => handleChange(0, "throughput", e.target.value)}
                                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: "10px" }}>
                                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Description</label>
                                <textarea
                                    placeholder="Product Description"
                                    rows={2}
                                    value={products[0].desc}
                                    onChange={(e) => handleChange(0, "desc", e.target.value)}
                                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                />
                            </div>

                            {/* Media Uploads */}
                            <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block" }}>
                                        Upload Image:
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(0, e.target.files?.[0])}
                                        style={{ fontSize: "12px" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block" }}>
                                        Upload Video:
                                    </label>
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={(e) => handleVideoUpload(0, e.target.files?.[0])}
                                        style={{ fontSize: "12px" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block" }}>
                                        Upload PDF:
                                    </label>
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => handlePdfUpload(0, e.target.files?.[0])}
                                        style={{ fontSize: "12px" }}
                                    />
                                </div>
                            </div>

                            {/* Image previews */}
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

                            {/* Target Websites Visibility Selector in Form */}
                            <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Globe size={14} color="#4f46e5" />
                                        <span>Target Websites Visibility:</span>
                                    </div>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedWebsites(COMPANY_WEBSITES[selectedCompany] || [])}
                                            style={{
                                                padding: "3px 8px",
                                                background: (COMPANY_WEBSITES[selectedCompany] || []).length > 0 && selectedWebsites.length === (COMPANY_WEBSITES[selectedCompany] || []).length ? "#4f46e5" : "#e2e8f0",
                                                color: (COMPANY_WEBSITES[selectedCompany] || []).length > 0 && selectedWebsites.length === (COMPANY_WEBSITES[selectedCompany] || []).length ? "white" : "#475569",
                                                border: "none",
                                                borderRadius: "4px",
                                                fontSize: "11px",
                                                fontWeight: "600",
                                                cursor: "pointer",
                                            }}
                                        >
                                            All Websites
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedWebsites([])}
                                            style={{
                                                padding: "3px 8px",
                                                background: selectedWebsites.length === 0 ? "#ef4444" : "#e2e8f0",
                                                color: selectedWebsites.length === 0 ? "white" : "#475569",
                                                border: "none",
                                                borderRadius: "4px",
                                                fontSize: "11px",
                                                fontWeight: "500",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                    {(COMPANY_WEBSITES[selectedCompany] || []).map((site) => {
                                        const isChecked = selectedWebsites.includes(site);
                                        return (
                                            <label
                                                key={site}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    fontSize: "11px",
                                                    padding: "4px 8px",
                                                    borderRadius: "6px",
                                                    border: isChecked ? "1px solid #818cf8" : "1px solid #cbd5e1",
                                                    background: isChecked ? "#eef2ff" : "white",
                                                    color: isChecked ? "#3730a3" : "#64748b",
                                                    cursor: "pointer",
                                                    fontWeight: isChecked ? "600" : "400",
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedWebsites((prev) => [...prev.filter((s) => s !== site), site]);
                                                        } else {
                                                            setSelectedWebsites((prev) => prev.filter((s) => s !== site));
                                                        }
                                                    }}
                                                />
                                                <span>{site}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div style={{ marginTop: "6px", fontSize: "11px", color: "#64748b" }}>
                                    {selectedWebsites.length === (COMPANY_WEBSITES[selectedCompany] || []).length
                                        ? `✓ Visible on all ${(COMPANY_WEBSITES[selectedCompany] || []).length} websites`
                                        : selectedWebsites.length === 0
                                            ? `⚠️ Hidden from all websites (0 selected)`
                                            : `✓ Visible on ${selectedWebsites.length} of ${(COMPANY_WEBSITES[selectedCompany] || []).length} websites`}
                                </div>
                            </div>

                            {/* Save / Cancel Buttons */}
                            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                                <button
                                    type="button"
                                    onClick={saveCategoryProduct}
                                    disabled={saving || imageUploading}
                                    style={{
                                        padding: "8px 18px",
                                        background: "#4f46e5",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontWeight: "600",
                                        fontSize: "13px",
                                        cursor: "pointer",
                                    }}
                                >
                                    {saving ? "Saving Master Product..." : editingProductId ? "Update Product" : "Save Product"}
                                </button>

                                {editingProductId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingProductId(null);
                                            setEditIndex(null);
                                            setProducts([
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
                                            fontWeight: "500",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                background: "white",
                                padding: "32px 20px",
                                borderRadius: "10px",
                                border: "1px dashed #cbd5e1",
                                textAlign: "center",
                                color: "#64748b",
                            }}
                        >
                            <div style={{ fontSize: "28px", marginBottom: "8px" }}>📁</div>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b", marginBottom: "4px" }}>
                                Select a Category &amp; Subcategory
                            </div>
                            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                                Click on any category and subcategory in the sidebar to add products and manage items.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM SECTION: Full Width Products Table (Spans 100% width across the whole container) */}
            {selectedSubCategory && (
                <div className="category-bottom-table-container">
                    <div
                        style={{
                            background: "white",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            overflow: "hidden",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                    >
                        {/* Table Actions Header */}
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
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ fontWeight: "700", fontSize: "14px", color: "#1e293b" }}>
                                    Products ({subCategoryProducts.length})
                                </span>

                                {/* Select Mode Toggle Button */}
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
                                        padding: "5px 12px",
                                        background: isSelectionMode ? "#4f46e5" : "#f1f5f9",
                                        color: isSelectionMode ? "#ffffff" : "#334155",
                                        border: isSelectionMode ? "none" : "1px solid #cbd5e1",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <Check size={14} />
                                    <span>{isSelectionMode ? "Done Selecting" : "Select"}</span>
                                </button>

                                {isSelectionMode && (
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                                        {selectedProducts.length} item(s) selected
                                    </span>
                                )}
                            </div>

                            {/* Bulk Actions Header Controls (Visible when Selection Mode is ON) */}
                            {isSelectionMode && (
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedProducts.length === subCategoryProducts.length) {
                                                setSelectedProducts([]);
                                            } else {
                                                setSelectedProducts(subCategoryProducts.map((p) => p.id));
                                            }
                                        }}
                                        style={{
                                            padding: "5px 10px",
                                            background: "#f8fafc",
                                            color: "#334155",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontWeight: "500",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {selectedProducts.length === subCategoryProducts.length ? "Deselect All" : "Select All"}
                                    </button>

                                    {selectedProducts.length > 0 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleOpenBulkVisibility}
                                                style={{
                                                    padding: "6px 12px",
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
                                                <Globe size={14} />
                                                <span>Set Websites Visibility ({selectedProducts.length})</span>
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
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Products Table */}
                        {isProductsLoading ? (
                            <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                                Loading master products...
                            </div>
                        ) : paginatedProducts.length === 0 ? (
                            <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                                No products in this subcategory.
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto", width: "100%" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    <thead>
                                        <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                                            {isSelectionMode && (
                                                <th style={{ width: "36px", padding: "10px 14px" }}>
                                                    <input
                                                        type="checkbox"
                                                        title="Select all products on page"
                                                        checked={
                                                            paginatedProducts.length > 0 &&
                                                            paginatedProducts.every((p) => selectedProducts.includes(p.id))
                                                        }
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const pageIds = paginatedProducts.map((p) => p.id);
                                                                setSelectedProducts((prev) => Array.from(new Set([...prev, ...pageIds])));
                                                            } else {
                                                                setSelectedProducts([]);
                                                            }
                                                        }}
                                                    />
                                                </th>
                                            )}
                                            <th style={{ padding: "10px 14px" }}>Image</th>
                                            <th style={{ padding: "10px 14px" }}>Product ID</th>
                                            <th style={{ padding: "10px 14px" }}>Title</th>
                                            <th style={{ padding: "10px 14px" }}>Price</th>
                                            <th style={{ padding: "10px 14px" }}>Brand / Model</th>
                                            <th style={{ padding: "10px 14px" }}>Websites Visibility</th>
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

                                            const companySites = COMPANY_WEBSITES[selectedCompany] || [];
                                            const isAll = !prod.websiteIds || prod.websiteIds.length === 0 || prod.websiteIds.includes("all");
                                            const activeCount = isAll ? companySites.length : prod.websiteIds.filter((s) => companySites.includes(s)).length;

                                            return (
                                                <React.Fragment key={prod.id || index}>
                                                    <tr
                                                        onClick={() => setActiveId(isExpanded ? null : prod.id)}
                                                        title="Click to toggle full product details"
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
                                                                    title="Select product for bulk action"
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
                                                                    title="Product Image"
                                                                    style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
                                                                />
                                                            ) : (
                                                                <div
                                                                    title="No Image"
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
                                                            {prod.categoryProductId || prod.productId || "-"}
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
                                                                title="Manage website visibility for this product"
                                                                style={{
                                                                    fontSize: "11px",
                                                                    padding: "4px 9px",
                                                                    background: isAll ? "#ecfdf5" : activeCount > 0 ? "#eff6ff" : "#fef2f2",
                                                                    color: isAll ? "#059669" : activeCount > 0 ? "#2563eb" : "#dc2626",
                                                                    border: isAll ? "1px solid #a7f3d0" : activeCount > 0 ? "1px solid #bfdbfe" : "1px solid #fecaca",
                                                                    borderRadius: "20px",
                                                                    fontWeight: "600",
                                                                    cursor: "pointer",
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    gap: "5px",
                                                                    transition: "all 0.15s ease",
                                                                }}
                                                            >
                                                                <Globe size={12} />
                                                                <span>
                                                                    {isAll ? `All Sites (${companySites.length})` : `${activeCount}/${companySites.length} Sites`}
                                                                </span>
                                                            </button>
                                                        </td>
                                                        <td style={{ padding: "10px 14px" }}>
                                                            <button
                                                                type="button"
                                                                title={prod.isPublished ? "Active on websites - Click to hide" : "Hidden - Click to publish on websites"}
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
                                                                    title="Edit Product"
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
                                                                    title="Delete Product"
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
                                                                                    ID: {prod.categoryProductId || prod.productId || prod.id}
                                                                                </span>
                                                                                <span style={{ fontSize: "12px", fontWeight: "700", padding: "2px 8px", background: "#dcfce7", color: "#15803d", borderRadius: "12px" }}>
                                                                                    {prod.price ? `₹${prod.price}` : "Price N/A"}
                                                                                </span>
                                                                                <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", background: prod.isPublished ? "#ecfdf5" : "#fef2f2", color: prod.isPublished ? "#059669" : "#dc2626", borderRadius: "12px" }}>
                                                                                    {prod.isPublished ? "● Active on Web" : "○ Hidden"}
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                                                                                Category: <strong>{selectedCategory?.name || selectedCategory?.category || prod.category || "-"}</strong> &bull; Subcategory: <strong>{selectedSubCategory?.name || selectedSubCategory?.subCategory || prod.subCategory || "-"}</strong>
                                                                            </div>
                                                                        </div>

                                                                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                                            <button
                                                                                type="button"
                                                                                title="Edit Product Details"
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
                                                                                title="Close product details"
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

                                                                    {/* Attributes Grid (Standard + Excel Data) */}
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
                                                                                <a href={prod.video} target="_blank" rel="noreferrer" title="Open product video in new tab" style={{ color: "#2563eb", fontWeight: "600", textDecoration: "underline" }}>
                                                                                    🎥 Open Video
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                        {prod.pdf && (
                                                                            <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                                                                                <span style={{ color: "#64748b", display: "block", fontSize: "11px" }}>PDF Brochure</span>
                                                                                <a href={prod.pdf} target="_blank" rel="noreferrer" title="Open product PDF brochure in new tab" style={{ color: "#dc2626", fontWeight: "600", textDecoration: "underline" }}>
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
                                                                                    "updatedAt", "categoryProductId", "productId"
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
                                                                                        title="Click to view image in full screen"
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
                                                                            ENABLED WEBSITES ({isAll ? `All ${companySites.length} websites` : `${activeCount} website(s)`}):
                                                                        </span>
                                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                                            {(isAll ? companySites : (prod.websiteIds || [])).map((site) => (
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

                        {/* Pagination Controls */}
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
                                            fontSize: "12px",
                                            fontWeight: "500",
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
                                            fontSize: "12px",
                                            fontWeight: "500",
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

            {/* Edit Category Modal */}
            <PortalModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)}>
                <div style={{ padding: "20px", width: "360px" }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "700" }}>Edit Category</h3>
                    <input
                        type="text"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        placeholder="Category Name"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "14px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <button
                            type="button"
                            title="Delete Category"
                            onClick={() => {
                                setIsCategoryModalOpen(false);
                                promptDeleteCategory(editingCategory);
                            }}
                            style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                        >
                            Delete
                        </button>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                type="button"
                                title="Cancel"
                                onClick={() => setIsCategoryModalOpen(false)}
                                style={{ padding: "6px 12px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "500" }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                title="Save Category Name"
                                onClick={updateCategoryName}
                                style={{ padding: "6px 14px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </PortalModal>

            {/* Edit Subcategory Modal */}
            <PortalModal isOpen={isSubCategoryEditModalOpen} onClose={() => setIsSubCategoryEditModalOpen(false)}>
                <div style={{ padding: "20px", width: "360px" }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "700" }}>Edit Subcategory</h3>
                    <input
                        type="text"
                        value={editSubCategoryName}
                        onChange={(e) => setEditSubCategoryName(e.target.value)}
                        placeholder="Subcategory Name"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "14px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <button
                            type="button"
                            title="Delete Subcategory"
                            onClick={() => {
                                setIsSubCategoryEditModalOpen(false);
                                promptDeleteSubCategory(editingSubCategory, editingSubCategoryParent || selectedCategory);
                            }}
                            style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                        >
                            Delete
                        </button>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                type="button"
                                title="Cancel"
                                onClick={() => setIsSubCategoryEditModalOpen(false)}
                                style={{ padding: "6px 12px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "500" }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                title="Save Subcategory Name"
                                onClick={handleSaveSubCategoryName}
                                style={{ padding: "6px 14px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </PortalModal>

            {/* Category & Subcategory Delete Confirmation Modal */}
            <PortalModal isOpen={Boolean(deleteConfirmState?.isOpen)} onClose={() => setDeleteConfirmState(null)}>
                <div style={{ padding: "24px", width: "400px", maxWidth: "90vw", textAlign: "center" }}>
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "#fee2e2",
                            color: "#dc2626",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 14px auto",
                        }}
                    >
                        <Trash2 size={24} />
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "17px", fontWeight: "700" }}>
                        {deleteConfirmState?.title || "Confirm Delete"}
                    </h3>
                    <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                        {deleteConfirmState?.message}
                    </p>
                    {deleteConfirmState?.name && (
                        <div
                            style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#1e293b",
                                marginBottom: "18px",
                            }}
                        >
                            {deleteConfirmState.type === "subcategory" ? "Subcategory: " : "Category: "}
                            <span style={{ color: "#dc2626" }}>{deleteConfirmState.name}</span>
                            {deleteConfirmState.parentName && (
                                <span style={{ color: "#64748b", fontSize: "12px", display: "block", marginTop: "2px", fontWeight: "400" }}>
                                    Parent Category: {deleteConfirmState.parentName}
                                </span>
                            )}
                        </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                        <button
                            type="button"
                            title="Cancel"
                            onClick={() => setDeleteConfirmState(null)}
                            style={{
                                flex: 1,
                                padding: "8px 16px",
                                background: "#f1f5f9",
                                color: "#475569",
                                border: "1px solid #cbd5e1",
                                borderRadius: "7px",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "13px",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            title="Permanently Delete"
                            onClick={handleConfirmDelete}
                            style={{
                                flex: 1,
                                padding: "8px 16px",
                                background: "#dc2626",
                                color: "white",
                                border: "none",
                                borderRadius: "7px",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "13px",
                                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                            }}
                        >
                            Yes, Delete
                        </button>
                    </div>
                </div>
            </PortalModal>

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
                            title="Cancel"
                            onClick={() => setIsModalOpen(false)}
                            style={{ padding: "6px 14px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500" }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            title="Delete Product"
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
                                <span>{visibilityModalInfo.title}</span>
                            </h3>
                            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                                {visibilityModalInfo.subtitle}
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

                    {/* Cascade to children option (for categories & subcategories) */}
                    {visibilityModalInfo.isCascadable && (
                        <div
                            style={{
                                margin: "0 0 12px 0",
                                padding: "10px 14px",
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                            }}
                        >
                            <input
                                type="checkbox"
                                id="cascadeVisibilityToggle"
                                checked={visibilityCascade}
                                onChange={(e) => setVisibilityCascade(e.target.checked)}
                                style={{ marginTop: "3px", cursor: "pointer", width: "16px", height: "16px" }}
                            />
                            <label htmlFor="cascadeVisibilityToggle" style={{ fontSize: "12px", color: "#166534", cursor: "pointer", flex: 1 }}>
                                <strong>{visibilityModalInfo.cascadeLabel}</strong>
                                <div style={{ fontSize: "11px", color: "#15803d", marginTop: "2px" }}>
                                    When enabled, nested child items automatically inherit these website visibility settings.
                                </div>
                            </label>
                        </div>
                    )}

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
                                style={{ padding: "8px 14px", background: "#e2e8f0", border: "none", borderRadius: "6px", fontSize: "13px", cursor: isSavingVisibility ? "not-allowed" : "pointer" }}
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

            {/* Export Excel Modal */}
            <PortalModal isOpen={isExportModalOpen} onClose={() => !isExporting && setIsExportModalOpen(false)}>
                <div style={{ background: "white", padding: "22px", borderRadius: "12px", width: "520px", maxWidth: "95vw" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FileDown size={18} color="#0284c7" />
                            <span>Export Products to Excel (.xlsx)</span>
                        </h3>
                        <button
                            type="button"
                            onClick={() => setIsExportModalOpen(false)}
                            disabled={isExporting}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0", lineHeight: "1.4" }}>
                        Select the scope of category products to export. The exported Excel matches the exact columns required for importing back seamlessly.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                        {/* Scope 1: Current Subcategory */}
                        {selectedSubCategory && (
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: exportScope === "current" ? "2px solid #0284c7" : "1px solid #e2e8f0", background: exportScope === "current" ? "#f0f9ff" : "white", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="exportScope"
                                    checked={exportScope === "current"}
                                    onChange={() => setExportScope("current")}
                                />
                                <div>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                        Current Subcategory: {selectedCategory?.name || selectedCategory?.category} &gt; {selectedSubCategory?.name || selectedSubCategory?.subCategory}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        Export all {subCategoryProducts.length} product(s) in this subcategory
                                    </div>
                                </div>
                            </label>
                        )}

                        {/* Scope 2: Selected Products */}
                        {selectedProducts.length > 0 && (
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: exportScope === "selected" ? "2px solid #0284c7" : "1px solid #e2e8f0", background: exportScope === "selected" ? "#f0f9ff" : "white", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="exportScope"
                                    checked={exportScope === "selected"}
                                    onChange={() => setExportScope("selected")}
                                />
                                <div>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                        Selected Table Products ({selectedProducts.length})
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        Export only the {selectedProducts.length} checked item(s)
                                    </div>
                                </div>
                            </label>
                        )}

                        {/* Scope 3: Current Category */}
                        {selectedCategory && (
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: exportScope === "category" ? "2px solid #0284c7" : "1px solid #e2e8f0", background: exportScope === "category" ? "#f0f9ff" : "white", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="exportScope"
                                    checked={exportScope === "category"}
                                    onChange={() => setExportScope("category")}
                                />
                                <div>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                        Entire Category: "{selectedCategory?.name || selectedCategory?.category}"
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        Export all subcategories and products under this category
                                    </div>
                                </div>
                            </label>
                        )}

                        {/* Scope 4: All Categories */}
                        <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: exportScope === "all" ? "2px solid #0284c7" : "1px solid #e2e8f0", background: exportScope === "all" ? "#f0f9ff" : "white", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="exportScope"
                                checked={exportScope === "all"}
                                onChange={() => setExportScope("all")}
                            />
                            <div>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                    All Categories &amp; Subcategories ({getCompanyDisplayName(selectedCompany)})
                                </div>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>
                                    Export complete category catalog with all products &amp; details
                                </div>
                            </div>
                        </label>

                        {/* Scope 5: Specific Categories */}
                        <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: exportScope === "custom" ? "2px solid #0284c7" : "1px solid #e2e8f0", background: exportScope === "custom" ? "#f0f9ff" : "white", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="exportScope"
                                checked={exportScope === "custom"}
                                onChange={() => setExportScope("custom")}
                            />
                            <div>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                    Choose Specific Categories
                                </div>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>
                                    Select one or multiple categories from list below
                                </div>
                            </div>
                        </label>

                        {exportScope === "custom" && (
                            <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px", background: "#f8fafc" }}>
                                {categories.map((c) => {
                                    const isChecked = exportSelectedCategoryIds.includes(c.id);
                                    return (
                                        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setExportSelectedCategoryIds((prev) => [...prev, c.id]);
                                                    } else {
                                                        setExportSelectedCategoryIds((prev) => prev.filter((id) => id !== c.id));
                                                    }
                                                }}
                                            />
                                            <span>{c.name || c.category || c.id}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setIsExportModalOpen(false)}
                            disabled={isExporting}
                            style={{ padding: "8px 16px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "500" }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={executeExportExcel}
                            disabled={isExporting || (exportScope === "custom" && exportSelectedCategoryIds.length === 0)}
                            style={{
                                padding: "8px 20px",
                                background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "6px",
                                fontWeight: "600",
                                cursor: isExporting ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <FileDown size={15} />
                            <span>{isExporting ? "Exporting..." : "Download Excel (.xlsx)"}</span>
                        </button>
                    </div>
                </div>
            </PortalModal>

            {/* Batch & Folder Excel Import Modal */}
            <PortalModal isOpen={isImportModalOpen && !isImportMinimized} onClose={() => !importing && setIsImportModalOpen(false)}>
                <div style={{ background: "white", padding: "24px", borderRadius: "12px", width: "650px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#16a34a", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FileUp size={18} color="#16a34a" />
                            <span>Turbo Category &amp; Excel Importer</span>
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

                    {/* Hidden Inputs */}
                    <input
                        type="file"
                        id="categoryBatchFilesInput"
                        accept=".xlsx, .xls"
                        multiple
                        onChange={handleFilesSelected}
                        style={{ display: "none" }}
                    />
                    <input
                        type="file"
                        id="categoryBatchFolderInput"
                        webkitdirectory=""
                        directory=""
                        multiple
                        onChange={handleFilesSelected}
                        style={{ display: "none" }}
                    />

                    {/* Drag and Drop Zone / Buttons (Hidden while actively importing) */}
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
                                    onClick={() => document.getElementById("categoryBatchFolderInput")?.click()}
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
                                    onClick={() => document.getElementById("categoryBatchFilesInput")?.click()}
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

                    {/* Active Progress Section */}
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

            {/* Floating Live Visibility Progress Card (Bottom-Right) */}
            {visibilityProgress.active && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "24px",
                        right: isImportMinimized && (importing || importStats) ? "400px" : "24px",
                        zIndex: 99999,
                        width: "350px",
                        maxWidth: "92vw",
                        background: "linear-gradient(145deg, #0f172a, #1e293b)",
                        border: "1px solid #334155",
                        borderRadius: "14px",
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
                        padding: "16px",
                        color: "#ffffff",
                        animation: "slideInUp 0.3s ease",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                                style={{
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "50%",
                                    background: visibilityProgress.percent === 100 ? "#22c55e" : "#3b82f6",
                                    boxShadow: visibilityProgress.percent === 100 ? "0 0 10px #22c55e" : "0 0 10px #3b82f6",
                                    animation: visibilityProgress.percent < 100 ? "pulse 1.5s infinite" : "none",
                                }}
                            />
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#f8fafc" }}>
                                {visibilityProgress.title || "Website Visibility Sync"}
                            </span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "700", fontFamily: "monospace", color: "#4ade80" }}>
                            {visibilityProgress.percent}%
                        </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {visibilityProgress.text || "Synchronizing..."}
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: "6px", background: "#334155", borderRadius: "10px", overflow: "hidden" }}>
                        <div
                            style={{
                                width: `${visibilityProgress.percent}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #16a34a, #22c55e, #38bdf8)",
                                borderRadius: "10px",
                                transition: "width 0.25s ease",
                            }}
                        />
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