"use client";
import { db } from "@/lib/firebase";
import React from "react";
import { FileUp } from "lucide-react";
import Modal from "react-modal";
import { Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { X } from "lucide-react";
import "./CategoryProduct.css"
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    writeBatch
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { getWatermarkDisplayText } from "@/lib/websiteWatermarks";

const mapConcurrent = async (items, concurrency, fn) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (index < items.length) {
            const i = index++;
            results[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return results;
};

const applyWatermarkClientSide = (imageUrl, websiteText) => {
    return new Promise((resolve) => {
        if (!imageUrl || typeof imageUrl !== "string") {
            return resolve(imageUrl);
        }

        const img = new Image();
        img.crossOrigin = "anonymous";

        const timeout = setTimeout(() => {
            resolve(imageUrl);
        }, 1000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement("canvas");
                let width = img.naturalWidth || img.width || 800;
                let height = img.naturalHeight || img.height || 800;

                const maxDim = 800;
                if (width > maxDim || height > maxDim) {
                    if (width >= height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

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

                const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
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

const watermarkSingleImage = async (imgUrl, site) => {
    if (!imgUrl || typeof imgUrl !== "string") return imgUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const res = await fetch("/api/generate-watermark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: imgUrl, website: site }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.watermarkedImage) {
                return data.watermarkedImage;
            }
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn("API watermark fallback to client canvas:", err);
    }

    const siteText = getWatermarkDisplayText(site);
    return applyWatermarkClientSide(imgUrl, siteText);
};
const COMPANY_WEBSITES = {
    human: [
        "humanbiomedicalorg",
        "humanbiomedicalin",
        "humanbiomedicalsin",
        "humanbiomedicalsorg",
        "humanbiomedicalscoin",
        "humanbiomedicalcom",
    ],

    global: [
        "globalbiomedicalorg",
        "globalbiomedicalsin"
    ],

    rajbiosis: [
        "indiandiagnostic",
        "centralbiomedicals",
        "ozonexco",
        "aozellocom"

    ],


    qlyte: [
        "qlyte"
    ]
};
export default function CategoryProduct({ onBack }) {
    const pathname = usePathname();
    const pathParts = pathname.split("/").filter(Boolean);
    const [selectedCompany, setSelectedCompany] =
        useState("human");
    const [selectedWebsiteFilter, setSelectedWebsiteFilter] =
        useState("");
    const currentWebsite =
        COMPANY_WEBSITES[selectedCompany]?.[0] || "";
    const [categorySaving, setCategorySaving] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [bulkMode, setBulkMode] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [showCategoryInput, setShowCategoryInput] = useState(false);
    const [showSubCategoryInput, setShowSubCategoryInput] = useState(false);
    const [categoryName, setCategoryName] = useState("");
    const [categories, setCategories] = useState([]);
    const [importingCategoryId, setImportingCategoryId] = useState(null);
    const [subCategoryName, setSubCategoryName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [categoryAction, setCategoryAction] = useState("edit");
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [activeId, setActiveId] = useState(null);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [deleteIndex, setDeleteIndex] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageModal, setImageModal] = useState(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [showSubCategoryPage, setShowSubCategoryPage] =
        useState(false);
    const [selectedWebsites, setSelectedWebsites] =
        useState(["all"]);
    const router = useRouter();
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
            pdf: ""
        }
    ]);

    const [saving, setSaving] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isGeneratingWatermark, setIsGeneratingWatermark] = useState(false);
    const [watermarkProgress, setWatermarkProgress] = useState(0);
    const [watermarkStatusText, setWatermarkStatusText] = useState("");
    const [watermarkCurrentTitle, setWatermarkCurrentTitle] = useState("");

    const resetOriginalWatermarks = async () => {
        if (!selectedCategory || !selectedSubCategory) {
            toast.error("Please select a Category and Subcategory first");
            return;
        }
        try {
            const subCatProducts = selectedSubCategory.products || [];
            const restoredProducts = subCatProducts.map((p) => {
                const cleanOrigs = (Array.isArray(p.originalImages) ? p.originalImages : [])
                    .filter((url) => typeof url === "string" && !url.includes("watermarked_products") && !url.startsWith("data:image"));
                return {
                    ...p,
                    images: cleanOrigs.length > 0 ? cleanOrigs : (p.images || []),
                };
            });

            setSelectedSubCategory((prev) => prev ? { ...prev, products: restoredProducts } : null);

            const subCatRef = doc(
                db,
                "websites",
                selectedCategory.website || currentWebsite,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id,
                "subcategories",
                selectedSubCategory.id
            );
            await setDoc(subCatRef, { products: restoredProducts }, { merge: true });
            toast.success("Restored original images successfully!");
        } catch (err) {
            console.error("Reset watermark error:", err);
            toast.error("Failed to restore original images");
        }
    };

    const generateWatermarks = async () => {
        setIsGeneratingWatermark(true);
        setWatermarkProgress(5);
        setWatermarkStatusText("Preparing watermark generation...");
        setWatermarkCurrentTitle("");

        try {
            const targetWebsites = selectedWebsiteFilter
                ? [selectedWebsiteFilter]
                : COMPANY_WEBSITES[selectedCompany] || [];

            const totalWebsites = targetWebsites.length;

            for (let wIdx = 0; wIdx < totalWebsites; wIdx++) {
                const site = targetWebsites[wIdx];
                const baseProgress = Math.round((wIdx / totalWebsites) * 90);

                setWatermarkStatusText(`Applying watermark for ${site}...`);

                // Bulk Category Watermark Processing across all categories for selected site
                const categoriesRef = collection(
                    db,
                    "websites",
                    site,
                    "pages",
                    "categoryproducts",
                    "categories"
                );
                const categoriesSnap = await getDocs(categoriesRef);
                const totalCats = categoriesSnap.docs.length;

                for (let cIdx = 0; cIdx < totalCats; cIdx++) {
                    const catDoc = categoriesSnap.docs[cIdx];
                    const catData = catDoc.data();
                    const catProgress = baseProgress + Math.round(((cIdx + 1) / Math.max(1, totalCats)) * (90 / Math.max(1, totalWebsites)));
                    setWatermarkProgress(Math.min(95, catProgress));
                    setWatermarkStatusText(`Applying watermark: ${catData.category || catDoc.id} (${cIdx + 1}/${totalCats})...`);

                    const subCatsRef = collection(
                        db,
                        "websites",
                        site,
                        "pages",
                        "categoryproducts",
                        "categories",
                        catDoc.id,
                        "subcategories"
                    );
                    const subCatsSnap = await getDocs(subCatsRef);

                    await mapConcurrent(subCatsSnap.docs, 6, async (subCatDoc) => {
                        const subCatData = subCatDoc.data();
                        const subCatProducts = subCatData.products || [];
                        if (subCatProducts.length === 0) return;

                        // Step 1: Direct Server API Watermarking & Storage Upload
                        const watermarkedProds = await mapConcurrent(
                            subCatProducts,
                            10,
                            async (product, pIdx) => {
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

                                setWatermarkCurrentTitle(product.title || `${catData.category || 'Category'} #${pIdx + 1}`);

                                const watermarkedStorageUrls = await mapConcurrent(
                                    sourceImages,
                                    6,
                                    (imgUrl) => watermarkSingleImage(imgUrl, site)
                                );

                                return {
                                    ...product,
                                    originalImages: cleanOriginals.length > 0 ? cleanOriginals : (product.originalImages || sourceImages),
                                    images: watermarkedStorageUrls,
                                };
                            }
                        );

                        // Live UI update if currently viewing this subcategory
                        if (selectedSubCategory?.id === subCatDoc.id) {
                            setSelectedSubCategory((prev) =>
                                prev ? { ...prev, products: watermarkedProds } : null
                            );
                        }

                        // Direct Firestore Save (Zero base64 payload, tiny 10KB doc size)
                        try {
                            await setDoc(subCatDoc.ref, { products: watermarkedProds }, { merge: true });
                        } catch (e) {
                            console.error("Storage sync error for subcategory:", subCatDoc.id, e);
                        }
                    });
                }
            }

            await fetchCategories();
            setWatermarkProgress(100);
            setWatermarkStatusText("All category watermarks applied successfully!");
            toast.success("All category watermarks applied successfully!");
        } catch (error) {
            console.error("Watermark error:", error);
            toast.error("Failed to generate watermarks");
        } finally {
            setTimeout(() => {
                setIsGeneratingWatermark(false);
            }, 300);
        }
    };

    const fetchCategories = async () => {

        const websites =
            COMPANY_WEBSITES[selectedCompany] || [];

        if (!websites.length) {
            setCategories([]);
            return;
        }

        let allCategories = [];

        for (const site of websites) {

            const snap = await getDocs(
                collection(
                    db,
                    "websites",
                    site,
                    "pages",
                    "categoryproducts",
                    "categories"
                )
            );

            const siteCategories = snap.docs.map((docSnap) => ({
                id: docSnap.id,
                website: site,
                subcategories: [],
                ...docSnap.data(),
            }));

            allCategories.push(...siteCategories);
        }

        setCategories(allCategories);
    };
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);
    const handleEdit = (index) => {
        const product = selectedSubCategory.products[index];

        setProducts([
            {
                title: product.title || "",
                price: product.price || "",
                desc: product.desc || "",
                capacity: product.capacity || "",
                throughput: product.throughput || "",
                instrument: product.instrument || "",
                model: product.model || "",
                usage: product.usage || "",
                brand: product.brand || "",
                parameters: product.parameters || "",
                automation: product.automation || "",
                availability: product.availability || "",
                size: product.size || "",
                images: product.images || [],
                video: product.video || "",
                pdf: product.pdf || "",
            }
        ]);

        const realIndex =
            (currentPage - 1) * itemsPerPage + index;

        setEditIndex(realIndex);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };
    const handleMultipleImagesUpload = async (e) => {
        const file = e.target.files[0];

        if (!file) return;
        setUploadProgress(0);
        try {
            setImageUploading(true);
            setUploadProgress(25);
            const imageRef = ref(
                storage,
                `websites/${currentWebsite}/category-products/${selectedCategory.id}/${selectedSubCategory.id}/${Date.now()}-${file.name}`
            );

            await uploadBytes(imageRef, file);
            setUploadProgress(75);
            const imageUrl = await getDownloadURL(imageRef);
            setUploadProgress(100);
            setProducts(prev => [
                {
                    ...prev[0],
                    images: [imageUrl]
                }
            ]);
            console.log("Uploaded URL:", imageUrl);
            toast.success("Image Uploaded Successfully");
        } catch (error) {
            console.error(error);
            toast.error("Image Upload Failed");
        } finally {
            setTimeout(() => {
                setImageUploading(false);
                setUploadProgress(0);
            }, 500);
        }
    };
    const updateCategoryName = async () => {
        try {
            await setDoc(
                doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    editingCategory.id
                ),
                {
                    category: editCategoryName
                },
                { merge: true }
            );

            await fetchCategories();

            setSelectedCategory(prev => ({
                ...prev,
                category: editCategoryName
            }));

            toast.success("Category Updated");
            setIsCategoryModalOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Update Failed");
        }
    };
    const deleteSubCategory = async () => {

        if (!selectedSubCategory) return;

        try {

            await deleteDoc(
                doc(
                    db,
                    "websites",
                    selectedCategory.website,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    selectedSubCategory.id
                )
            );

            const subSnap = await getDocs(
                collection(
                    db,
                    "websites",
                    selectedCategory.website,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories"
                )
            );

            const subcategories = subSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            setSelectedCategory(prev => ({
                ...prev,
                subcategories,
            }));

            setSelectedSubCategory(null);

            toast.success("Subcategory Deleted");

        } catch (err) {

            console.error(err);
            toast.error("Delete Failed");

        }

    };
    const editSubCategory = async () => {

        const name = prompt(
            "Subcategory Name",
            selectedSubCategory.subCategory
        );

        if (!name) return;

        await setDoc(
            doc(
                db,
                "websites",
                selectedCategory.website,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id,
                "subcategories",
                selectedSubCategory.id
            ),
            {
                subCategory: name,
            },
            {
                merge: true,
            }
        );
        const subSnap = await getDocs(
            collection(
                db,
                "websites",
                selectedCategory.website,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id,
                "subcategories"
            )
        );

        const subcategories = subSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        setSelectedCategory(prev => ({
            ...prev,
            subcategories,
        }));

        const updatedSub = subcategories.find(
            s => s.id === selectedSubCategory.id
        );

        setSelectedSubCategory(updatedSub);
        toast.success("Updated");

    };
    const deleteCategory = async () => {
        try {

            const websitesToDelete =
                editingCategory?.website
                    ? [editingCategory.website]
                    : [currentWebsite];
            for (const site of websitesToDelete) {

                const batch = writeBatch(db);

                // Delete all subcategories first
                const subSnap = await getDocs(
                    collection(
                        db,
                        "websites",
                        site,
                        "pages",
                        "categoryproducts",
                        "categories",
                        editingCategory.id,
                        "subcategories"
                    )
                );

                subSnap.forEach((subDoc) => {
                    batch.delete(subDoc.ref);
                });

                // Delete category document
                batch.delete(
                    doc(
                        db,
                        "websites",
                        site,
                        "pages",
                        "categoryproducts",
                        "categories",
                        editingCategory.id
                    )
                );

                await batch.commit();
            }

            await fetchCategories();

            setSelectedCategory(null);
            setSelectedSubCategory(null);
            setIsCategoryModalOpen(false);

            toast.success(
                websitesToDelete.length > 1
                    ? "Category Deleted From All Websites"
                    : "Category Deleted"
            );

        } catch (err) {

            console.error(err);
            toast.error("Delete Failed");
        }
    };
    const togglePublish = async (index) => {
        const updated = selectedSubCategory.products.map((p, i) =>
            i === index
                ? { ...p, isPublished: !p.isPublished }
                : p
        );

        setSelectedSubCategory(prev => ({
            ...prev,
            products: updated
        }));

        toast.success(updated[index].isPublished ? "Product Visible" : "Product Hidden");

        try {
            await setDoc(
                doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    selectedSubCategory.id
                ),
                {
                    products: updated
                },
                {
                    merge: true
                }
            );
        } catch (err) {
            toast.error("Failed to update");

        }
    };
    const confirmDelete = async () => {
        const updated = selectedSubCategory.products.filter(
            (_, i) => i !== deleteIndex
        );
        setSelectedSubCategory(prev => ({
            ...prev,
            products: updated
        }));
        setIsModalOpen(false);

        toast.success("Deleted successfully");

        try {
            await setDoc(
                doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    selectedSubCategory.id
                ),
                { products: updated },
                { merge: true }
            );
        } catch (err) {
            toast.error("Delete failed");
        }
    };
    const handleSelectProduct = (id) => {
        setSelectedProducts((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id]
        );
    };

    useEffect(() => {

        if (selectedCompany) {
            fetchCategories();
        }

    }, [selectedCompany]);

    const deleteSelectedProducts = async () => {
        if (selectedProducts.length === 0) {
            return toast.error("Select products first");
        }

        const updated = selectedSubCategory.products.filter(
            (p) => !selectedProducts.includes(p.id)
        );

        try {
            await setDoc(
                doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    selectedSubCategory.id
                ),
                { products: updated },
                { merge: true }
            );

            setSelectedSubCategory(prev => ({
                ...prev,
                products: updated
            }));
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
                doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    selectedSubCategory.id
                ),
                { products: [] },
                { merge: true }
            );

            setSelectedSubCategory(prev => ({
                ...prev,
                products: []
            }));

            setSelectedProducts([]);

            toast.success("All products deleted");
        } catch (err) {
            console.error(err);
            toast.error("Delete failed");
        }
    };

    const handleCategorySave = async () => {

        try {

            setCategorySaving(true);

            if (!categoryName.trim()) {
                toast.error("Please enter category name");
                return;
            }

            const slug = categoryName
                .toLowerCase()
                .replace(/\s+/g, "-");

            const websites =
                selectedWebsites.includes("all")
                    ? COMPANY_WEBSITES[selectedCompany]
                    : selectedWebsites;

            if (websites.length === 0) {
                toast.error("Select Website");
                return;
            }

            for (const site of websites) {

                await setDoc(
                    doc(
                        db,
                        "websites",
                        site,
                        "pages",
                        "categoryproducts",
                        "categories",
                        slug
                    ),
                    {
                        id: slug,
                        category: categoryName,
                        website: site,
                        websites,
                        createdAt: new Date().toISOString(),
                    }
                );
            }

            await fetchCategories();

            toast.success(
                `Category Added In ${websites.length} Website(s)`
            );

            setCategoryName("");
            setShowCategoryInput(false);

        } catch (err) {

            console.error(err);

            toast.error("Failed to add category");

        } finally {

            setCategorySaving(false);

        }
    };

    const handleSubCategorySave = async () => {

        if (!selectedCategory) {
            toast.error("Please select a category");
            return;
        }

        if (!subCategoryName.trim()) {
            toast.error("Enter Subcategory Name");
            return;
        }

        try {

            const slug = subCategoryName
                .toLowerCase()
                .trim()
                .replace(/\s+/g, "-")
                .replace(/[^\w-]/g, "");

            await setDoc(
                doc(
                    db,
                    "websites",
                    selectedCategory.website,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    slug
                ),
                {
                    id: slug,
                    subCategory: subCategoryName,
                    products: [],
                    createdAt: new Date().toISOString(),
                },
                {
                    merge: true,
                }
            );

            const subSnap = await getDocs(
                collection(
                    db,
                    "websites",
                    selectedCategory.website,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories"
                )
            );

            const subcategories = subSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            setSelectedCategory(prev => ({
                ...prev,
                subcategories,
            }));

            setSubCategoryName("");
            setShowSubCategoryInput(false);

            toast.success("Subcategory Added");

        } catch (err) {

            console.error(err);
            toast.error("Failed");

        }
    };

    const paginatedProducts =
        selectedSubCategory?.products?.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        ) || [];

    const totalPages = Math.ceil(
        (selectedSubCategory?.products?.length || 0) /
        itemsPerPage
    );
    const saveCategoryProduct = async () => {

        if (!selectedCategory || !selectedSubCategory) {
            toast.error("Please select a subcategory");
            return;
        }

        setSaving(true);

        try {

            const websites = [selectedCategory.website];

            for (const site of websites) {

                const docRef = doc(
                    db,
                    "websites",
                    site,
                    "pages",
                    "categoryproducts",
                    "categories",
                    selectedCategory.id,
                    "subcategories",
                    selectedSubCategory.id
                );

                const snap = await getDoc(docRef);

                const existingProducts =
                    snap.exists()
                        ? snap.data().products || []
                        : [];

                const prefix =
                    selectedSubCategory.subCategory
                        .split(" ")
                        .map(word => word[0]?.toUpperCase())
                        .join("");

                const nextCategoryId =
                    existingProducts.length + 1;

                const newProduct = {
                    id: crypto.randomUUID(),
                    categoryProductId: `${prefix}-${nextCategoryId}`,

                    title: products[0].title,
                    slug: (products[0].title || "")
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, "-")
                        .replace(/[^\w-]/g, ""),

                    price: products[0].price,
                    desc: products[0].desc,
                    capacity: products[0].capacity,
                    throughput: products[0].throughput,
                    instrument: products[0].instrument,
                    model: products[0].model,
                    usage: products[0].usage,
                    brand: products[0].brand,
                    parameters: products[0].parameters,
                    automation: products[0].automation,
                    availability: products[0].availability,
                    size: products[0].size,

                    images: products[0].images || [],
                    video: products[0].video || "",
                    pdf: products[0].pdf || "",

                    createdAt: new Date().toISOString(),
                    isPublished: true,
                };

                let updatedProducts;

                if (editIndex !== null) {

                    updatedProducts = existingProducts.map((p, i) =>
                        i === editIndex
                            ? {
                                ...p,

                                categoryProductId:
                                    p.categoryProductId,

                                title: products[0].title,
                                slug: (products[0].title || "")
                                    .toLowerCase()
                                    .trim()
                                    .replace(/\s+/g, "-")
                                    .replace(/[^\w-]/g, ""),
                                price: products[0].price,
                                desc: products[0].desc,
                                capacity: products[0].capacity,
                                throughput: products[0].throughput,
                                instrument: products[0].instrument,
                                model: products[0].model,
                                usage: products[0].usage,
                                brand: products[0].brand,
                                parameters: products[0].parameters,
                                automation: products[0].automation,
                                availability: products[0].availability,
                                size: products[0].size,

                                images: products[0].images || [],
                                video: products[0].video || "",
                                pdf: products[0].pdf || "",
                            }
                            : p
                    );

                } else {

                    updatedProducts = [
                        newProduct,
                        ...existingProducts,
                    ];
                }

                await setDoc(
                    docRef,
                    {
                        products: updatedProducts
                    },
                    {
                        merge: true
                    }
                );
            }

            const currentDocRef = doc(
                db,
                "websites",
                currentWebsite,
                "pages",
                "categoryproducts",
                "categories",
                selectedCategory.id,
                "subcategories",
                selectedSubCategory.id
            );

            const currentSnap =
                await getDoc(currentDocRef);

            setSelectedSubCategory(prev => ({
                ...prev,
                products: currentSnap.data()?.products || []
            }));

            await fetchCategories();

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
                    pdf: ""
                }
            ]);

            const imageInput =
                document.getElementById(
                    "productImage"
                );

            if (imageInput) {
                imageInput.value = "";
            }

            setEditIndex(null);

            toast.success(
                editIndex !== null
                    ? "Product Updated In All Websites"
                    : "Product Saved In All Websites"
            );

        } catch (err) {

            console.error(err);

            toast.error("Save Failed");

        } finally {

            setSaving(false);
        }
    };
    const handleExcelImport = async (e) => {

        setImportingCategoryId(selectedCategory.id);

        setImporting(true);

        setImportProgress(0);

        const file = e.target.files[0];

        if (!file) return;

        try {
            const workbook = new ExcelJS.Workbook();

            const buffer = await file.arrayBuffer();

            await workbook.xlsx.load(buffer);

            const worksheet = workbook.getWorksheet(1);
            console.log("Row Count =", worksheet.rowCount);

            for (let i = 1; i <= worksheet.rowCount; i++) {
                console.log(i, worksheet.getRow(i).values);
            }
            const rowsCount = worksheet.rowCount - 1;

            const headers = {};

            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[
                    cell.value?.toString().trim().toLowerCase()
                ] = colNumber;
            });


            const slugify = (text = "") =>
                text
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, "-")
                    .replace(/[^\w-]/g, "");

            const categoryCache = {};
            const subCategoryCache = {};
            const pendingWrites = {};

            for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

                const row = worksheet.getRow(rowNumber);



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

                const title = getValue("title").trim();
                const desc = getValue("desc").trim();
                const brand = getValue("brand").trim();

                const hasData = [
                    title,
                    desc,
                    brand,
                    getValue("price").trim(),
                    getValue("capacity").trim(),
                    getValue("throughput").trim(),
                    getValue("instrument").trim(),
                    getValue("model").trim(),
                    getValue("usage").trim(),
                ].some(value => value !== "");
                console.log("Row =", rowNumber, "Sub =", subCategory);
                if (!hasData) {
                    continue;
                }

                const categoryName = getValue("category").trim();
                const subCategoryName = getValue("sub category").trim();

                if (!categoryName || !subCategoryName) continue;

                const categoryId = slugify(categoryName);
                const subCategoryId = slugify(subCategoryName);


                const categoryRef = doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    categoryId
                );

                if (!categoryCache[categoryId]) {

                    categoryCache[categoryId] = true;

                    await setDoc(
                        categoryRef,
                        {
                            id: categoryId,
                            category: categoryName,
                            website: currentWebsite,
                            createdAt: new Date().toISOString(),
                        },
                        {
                            merge: true,
                        }
                    );

                }

                const subCategoryRef = doc(
                    db,
                    "websites",
                    currentWebsite,
                    "pages",
                    "categoryproducts",
                    "categories",
                    categoryId,
                    "subcategories",
                    subCategoryId
                );

                const cacheKey = `${categoryId}-${subCategoryId}`;

                let existingProducts = [];

                if (subCategoryCache[cacheKey]) {

                    existingProducts = subCategoryCache[cacheKey];

                } else {

                    const subSnap = await getDoc(subCategoryRef);

                    existingProducts = subSnap.exists()
                        ? [...(subSnap.data().products || [])]
                        : [];

                    subCategoryCache[cacheKey] = existingProducts;

                }

                const product = {

                    id: crypto.randomUUID(),

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

                    slug: slugify(getValue("title")),

                    images: getValue("images")
                        ? getValue("images")
                            .split(",")
                            .map(url => url.trim())
                            .filter(Boolean)
                        : [],

                    video: getValue("video") || "",

                    pdf: getValue("pdf") || "",

                    createdAt: new Date().toISOString(),

                    isPublished: true,

                };

                const writeKey = `${categoryId}-${subCategoryId}`;

                if (!pendingWrites[writeKey]) {
                    pendingWrites[writeKey] = {
                        subCategoryRef,
                        subCategoryId,
                        subCategoryName,
                        products: [...existingProducts],
                    };
                }

                pendingWrites[writeKey].products.unshift(product);

                const processed = rowNumber - 1;

                if (processed % 10 === 0 || processed === rowsCount) {
                    setImportProgress(
                        Math.round((processed / rowsCount) * 100)
                    );
                }
            }


            await Promise.all(
                Object.values(pendingWrites).map((item) =>
                    setDoc(
                        item.subCategoryRef,
                        {
                            id: item.subCategoryId,
                            subCategory: item.subCategoryName,
                            products: item.products,
                        },
                        { merge: true }
                    )
                )
            );


            toast.success("Products Imported Successfully");
        } catch (err) {
            console.error(err);
            toast.error("Import failed ");
        } finally {
            setImporting(false);
            setImportingCategoryId(null);
        }
    };
    if (
        showSubCategoryPage &&
        selectedCategory
    ) {
        return (
            <SubCategoryPage
                currentWebsite={currentWebsite}
                selectedCategory={selectedCategory}
                onBack={() =>
                    setShowSubCategoryPage(false)
                }
            />
        );
    }

    return (
        <>
            <div className="main">

                <div className="category-wrapper">
                    <div className="category-sidebar">
                        <h3
                            style={{
                                marginBottom: "8px",
                                fontSize: "18px",
                                fontWeight: "700",
                                color: "#4f46e5",
                                borderBottom: "1px solid #eee",
                                paddingBottom: "10px",
                            }}
                        >
                            Categories
                        </h3>

                        <div
                            style={{
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#4f46e5",
                                background: "#eef2ff",
                                border: "1px solid #c7d2fe",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                marginBottom: "14px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                wordBreak: "break-all"
                            }}
                        >
                            <span style={{ fontSize: "14px" }}>🌐</span>
                            <span>
                                {selectedWebsiteFilter
                                    ? getWatermarkDisplayText(selectedWebsiteFilter)
                                    : `${selectedCompany.toUpperCase()} (All Websites)`}
                            </span>
                        </div>

                        <div className="categories-list-scroll">
                            {categories
                                .filter((cat) => {
                                    if (!selectedWebsiteFilter) return true;
                                    return cat.website === selectedWebsiteFilter;
                                })
                                .map((cat) => (
                                    <div key={`${cat.website}-${cat.id}`}>

                                        {/* CATEGORY */}
                                        <div
                                            onClick={async () => {

                                                const currentWebsite =
                                                    selectedWebsiteFilter
                                                        ? selectedWebsiteFilter
                                                        : cat.website;

                                                try {

                                                    const subSnap = await getDocs(
                                                        collection(
                                                            db,
                                                            "websites",
                                                            currentWebsite,
                                                            "pages",
                                                            "categoryproducts",
                                                            "categories",
                                                            cat.id,
                                                            "subcategories"
                                                        )
                                                    );

                                                    const subcategories = subSnap.docs.map((docSnap) => ({
                                                        id: docSnap.id,
                                                        ...docSnap.data(),
                                                    }));

                                                    setSelectedCategory({
                                                        ...cat,
                                                        website: currentWebsite,
                                                        subcategories,
                                                    });
                                                    setExpandedCategory(
                                                        expandedCategory === cat.id ? null : cat.id
                                                    );
                                                    setSelectedSubCategory(null);

                                                } catch (err) {

                                                    console.error(err);
                                                    toast.error("Failed to load category");

                                                }
                                            }}
                                            style={{
                                                padding: "10px",
                                                marginBottom: "8px",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                background:
                                                    selectedCategory?.id === cat.id &&
                                                        selectedCategory?.website === cat.website
                                                        ? "#4f46e5"
                                                        : "#f5f5f5",
                                                color:
                                                    selectedCategory?.id === cat.id &&
                                                        selectedCategory?.website === cat.website
                                                        ? "#fff"
                                                        : "#000",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <span>{cat.category}</span>

                                                <span>
                                                    {expandedCategory === cat.id ? "▼" : "▶"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* SUBCATEGORIES */}
                                        {expandedCategory === cat.id &&
                                            selectedCategory?.subcategories?.length > 0 && (

                                                <div
                                                    style={{
                                                        marginLeft: "20px",
                                                        marginBottom: "10px",
                                                    }}
                                                >
                                                    {selectedCategory.subcategories.map((sub) => (

                                                        <div
                                                            key={sub.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedSubCategory(sub);
                                                            }}
                                                            style={{
                                                                padding: "8px 10px",
                                                                marginBottom: "6px",
                                                                borderRadius: "6px",
                                                                cursor: "pointer",
                                                                background:
                                                                    selectedSubCategory?.id === sub.id
                                                                        ? "linear-gradient(90deg,#16a34a,#22c55e)"
                                                                        : "#f8fafc",

                                                                border:
                                                                    selectedSubCategory?.id === sub.id
                                                                        ? "1px solid #16a34a"
                                                                        : "1px solid #e5e7eb",

                                                                fontWeight:
                                                                    selectedSubCategory?.id === sub.id
                                                                        ? "700"
                                                                        : "500",
                                                                color:
                                                                    selectedSubCategory?.id === sub.id
                                                                        ? "#fff"
                                                                        : "#000",
                                                            }}
                                                        >
                                                            📁 {sub.subCategory}
                                                        </div>

                                                    ))}
                                                </div>

                                            )}

                                    </div>
                                ))}
                        </div>
                    </div>
                    <div className="category-content">

                        <div className="card">

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "20px"
                                }}
                            >
                                <h2
                                    style={{
                                        margin: 0,
                                        color: "#4f46e5"
                                    }}
                                >
                                    Category Management
                                </h2>

                                <button
                                    className="back-btn"
                                    onClick={onBack}
                                >
                                    ← Back To Products
                                </button>
                            </div>

                            {/* Row 1 */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    flexWrap: "wrap",
                                    marginBottom: "20px",
                                }}
                            >

                                <select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    className="company-select"
                                    style={{
                                        width: "220px",
                                        height: "42px"
                                    }}
                                >
                                    <option value="human">Human Biomedical</option>
                                    <option value="global">Global Biomedical</option>
                                    <option value="rajbiosis">RajBiosis</option>
                                    <option value="qlyte">Qlyte</option>
                                </select>

                                <button
                                    className="add-btn"
                                    onClick={() => setShowCategoryInput(true)}
                                >
                                    + Add Category
                                </button>
                                <button
                                    className="add-btn"
                                    onClick={() => {
                                        if (!selectedCategory) {
                                            toast.error("Select Category First");
                                            return;
                                        }
                                        setShowSubCategoryInput(true);
                                    }}
                                >
                                    + Add Subcategory
                                </button>

                                <button
                                    className="add-btn"
                                    onClick={generateWatermarks}
                                    disabled={isGeneratingWatermark}
                                >
                                    {isGeneratingWatermark ? "Generating Watermark..." : "Generate Watermark"}
                                </button>

                            </div>

                            {/* Row 2 */}
                            <div
                                style={{
                                    marginBottom: "20px",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: "600",
                                        marginBottom: "10px"
                                    }}
                                >
                                    Connected Websites
                                </div>
                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "#666",
                                        marginBottom: "8px"
                                    }}
                                >
                                    Click a website to view only its categories
                                </div>



                                <div className="sites-grid">
                                    {COMPANY_WEBSITES[selectedCompany]?.map((site) => (
                                        <div
                                            key={site}
                                            className="site-badge"
                                            onClick={() =>
                                                setSelectedWebsiteFilter(
                                                    selectedWebsiteFilter === site
                                                        ? ""
                                                        : site
                                                )
                                            }
                                            style={{
                                                cursor: "pointer",
                                                background:
                                                    selectedWebsiteFilter === site
                                                        ? "#4f46e5"
                                                        : "",
                                                color:
                                                    selectedWebsiteFilter === site
                                                        ? "#fff"
                                                        : "",
                                            }}
                                        >
                                            {site}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Row 3 */}
                            {showCategoryInput && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        flexWrap: "wrap",
                                        paddingTop: "15px",
                                        borderTop: "1px solid #eee",
                                    }}
                                >

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                            minWidth: "250px"
                                        }}
                                    >
                                        <strong>Select Websites</strong>

                                        <label
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                fontWeight: "600"
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedWebsites.includes("all")}
                                                onChange={(e) => {

                                                    if (e.target.checked) {
                                                        setSelectedWebsites(["all"]);
                                                    } else {
                                                        setSelectedWebsites([]);
                                                    }

                                                }}
                                            />
                                            All Websites
                                        </label>

                                        {COMPANY_WEBSITES[selectedCompany]?.map(
                                            (site) => (
                                                <label
                                                    key={site}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px"
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedWebsites.includes(site)}
                                                        onChange={(e) => {

                                                            let updated =
                                                                selectedWebsites.filter(
                                                                    s => s !== "all"
                                                                );

                                                            if (e.target.checked) {
                                                                updated.push(site);
                                                            } else {
                                                                updated =
                                                                    updated.filter(
                                                                        s => s !== site
                                                                    );
                                                            }

                                                            setSelectedWebsites(updated);

                                                        }}
                                                    />

                                                    {site}
                                                </label>
                                            )
                                        )}
                                    </div>
                                    {selectedWebsites.length > 0 && (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Category Name"
                                                value={categoryName}
                                                onChange={(e) =>
                                                    setCategoryName(e.target.value)
                                                }
                                                style={{
                                                    width: "250px",
                                                    height: "42px",
                                                }}
                                            />

                                            <button
                                                onClick={handleCategorySave}
                                                className="category-save-icon"
                                                disabled={categorySaving}
                                                style={{
                                                    opacity: categorySaving ? 0.7 : 1,
                                                    cursor: categorySaving ? "not-allowed" : "pointer"
                                                }}
                                            >
                                                {categorySaving ? (
                                                    <span className="spinner-icon">⏳</span>
                                                ) : (
                                                    "✓"
                                                )}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setShowCategoryInput(false);
                                                    setCategoryName("");
                                                }}
                                                className="category-close-icon"
                                            >
                                                ✕
                                            </button>
                                        </>
                                    )}

                                </div>
                            )}
                            {showSubCategoryInput && (

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        marginTop: "15px",
                                        alignItems: "center",
                                    }}
                                >

                                    <input
                                        type="text"
                                        placeholder="Subcategory Name"
                                        value={subCategoryName}
                                        onChange={(e) =>
                                            setSubCategoryName(e.target.value)
                                        }
                                        style={{
                                            width: "250px",
                                            height: "42px",
                                        }}
                                    />

                                    <button
                                        className="category-save-icon"
                                        onClick={handleSubCategorySave}
                                    >
                                        ✓
                                    </button>

                                    <button
                                        className="category-close-icon"
                                        onClick={() => {
                                            setShowSubCategoryInput(false);
                                            setSubCategoryName("");
                                        }}
                                    >
                                        ✕
                                    </button>

                                </div>

                            )}
                        </div>




                        {/* Category Buttons */}
                        {/* {categories.length > 0 && (
                    <div className="card">
                        <h2>All Categories</h2>

                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                                marginTop: "20px",
                            }}
                        >
                            {categories.map((cat) => (
                                <button
                                    key={editingCategory.id}
                                    className="categories-btn"
                                    onClick={async () => {
                                        const snap = await getDoc(
                                            doc(
                                                db,
                                                "websites",
                                                currentWebsite,
                                                "pages",
                                                "categoryproducts",
                                                "categories",
                                                editingCategory.id
                                            )
                                        );

                                        setSelectedCategory({
                                            ...cat,
                                            products: snap.data()?.products || [],
                                        });
                                    }}
                                >
                                    {cat.category || editingCategory.id.replace(/-/g, " ")}
                                </button>
                            ))}
                        </div>
                    </div>
                )} */}

                        {/* Product Form */}
                        {selectedCategory && selectedSubCategory && (
                            <div className="card">
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "20px",
                                    }}
                                >
                                    <div>
                                        <h2>Add Product</h2>

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                                marginTop: "5px",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <div>
                                                <p style={{ margin: 0 }}>
                                                    Category :
                                                    <strong> {selectedCategory.category}</strong>
                                                </p>

                                                <p
                                                    style={{
                                                        margin: "6px 0 0",
                                                        color: "#16a34a",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Subcategory :
                                                    <strong>
                                                        {" "}
                                                        {selectedSubCategory?.subCategory || "Not Selected"}
                                                    </strong>
                                                </p>
                                            </div>

                                            {/* Category Edit */}
                                            <button
                                                className="category-icon-btn"
                                                title="Edit Category"
                                                onClick={() => {
                                                    setCategoryAction("edit");
                                                    setEditingCategory(selectedCategory);
                                                    setEditCategoryName(
                                                        selectedCategory.category || ""
                                                    );
                                                    setIsCategoryModalOpen(true);
                                                }}
                                            >
                                                <Pencil size={16} />
                                            </button>

                                            {/* Category Delete */}
                                            <button
                                                className="category-icon-btn delete"
                                                title="Delete Category"
                                                onClick={() => {
                                                    setCategoryAction("delete");
                                                    setEditingCategory(selectedCategory);
                                                    setIsCategoryModalOpen(true);
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>

                                            {/* Subcategory Edit */}
                                            <button
                                                className="category-icon-btn"
                                                title="Edit Subcategory"
                                                onClick={editSubCategory}
                                                disabled={!selectedSubCategory}
                                            >
                                                <Pencil size={16} />
                                            </button>

                                            {/* Subcategory Delete */}
                                            <button
                                                className="category-icon-btn delete"
                                                title="Delete Subcategory"
                                                onClick={deleteSubCategory}
                                                disabled={!selectedSubCategory}
                                            >
                                                <Trash2 size={16} />
                                            </button>

                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                        }}
                                    >
                                        <input
                                            id="categoryImport"
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={handleExcelImport}
                                            style={{ display: "none" }}
                                        />

                                        <button
                                            className="import-btn"
                                            onClick={() =>
                                                document
                                                    .getElementById("categoryImport")
                                                    .click()
                                            }
                                            disabled={
                                                importing &&
                                                importingCategoryId === selectedCategory?.id
                                            }
                                        >
                                            <FileUp
                                                size={16}
                                                style={{ marginRight: "6px" }}
                                            />

                                            {importing &&
                                                importingCategoryId === selectedCategory?.id
                                                ? `Importing ${importProgress}`
                                                : "Import Excel"}
                                        </button>

                                        <button
                                            className="add-btn"
                                            onClick={generateWatermarks}
                                            disabled={isGeneratingWatermark}
                                        >
                                            {isGeneratingWatermark ? "Generating Watermark..." : "Generate Watermark"}
                                        </button>

                                        <button
                                            className="add-btn"
                                            onClick={resetOriginalWatermarks}
                                            style={{ background: "#4b5563" }}
                                            title="Reset to clean original product images"
                                        >
                                            Reset Images
                                        </button>

                                        <button
                                            title="Close Form"
                                            onClick={() => {
                                                setSelectedCategory(null);
                                                setSelectedSubCategory(null);
                                            }}
                                            style={{
                                                width: "52px",
                                                height: "42px",
                                                border: "none",
                                                borderRadius: "8px",
                                                background: "#ef4444",
                                                color: "#fff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                boxShadow: "0 4px 12px rgba(239,68,68,.25)",
                                            }}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <input
                                        type="text"
                                        placeholder="Product Name"
                                        value={products[0].title}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].title = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Price"
                                        value={products[0].price}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].price = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Description"
                                        value={products[0].desc}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].desc = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Capacity"
                                        value={products[0].capacity}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].capacity = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Throughput"
                                        value={products[0].throughput}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].throughput = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Instrument Name"
                                        value={products[0].instrument}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].instrument = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Model Name/Number"
                                        value={products[0].model}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].model = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Usage/Application"
                                        value={products[0].usage}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].usage = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Brand"
                                        value={products[0].brand}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].brand = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Parameters"
                                        value={products[0].parameters}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].parameters = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Automation"
                                        value={products[0].automation}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].automation = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Availability"
                                        value={products[0].availability}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].availability = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="Size"
                                        value={products[0].size}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].size = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Video URL"
                                        value={products[0].video}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].video = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />

                                    <input
                                        type="text"
                                        placeholder="PDF URL"
                                        value={products[0].pdf}
                                        onChange={(e) => {
                                            const updated = [...products];
                                            updated[0].pdf = e.target.value;
                                            setProducts(updated);
                                        }}
                                    />
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginTop: "20px",
                                    }}
                                >
                                    <div className="image-upload-box">
                                        <input
                                            id="productImage"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleMultipleImagesUpload}
                                        />

                                        {products[0].images?.length > 0 && (
                                            <div
                                                className="image-file-name"
                                                onClick={() => setImageModal(products[0].images?.[0])}
                                            >
                                                📷 Click to View Image
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="add-btn"
                                        onClick={saveCategoryProduct}
                                        disabled={saving || imageUploading}
                                    >
                                        {imageUploading
                                            ? `Uploading ${uploadProgress}%`
                                            : saving
                                                ? "Saving..."
                                                : editIndex !== null
                                                    ? "Update Product"
                                                    : "Save Product"}
                                    </button>
                                </div>

                            </div>
                        )}

                        {/* Product List */}

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
                                <b> {selectedSubCategory?.products?.length || 0} products</b>
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
                        <Modal
                            isOpen={!!imageModal}
                            onRequestClose={() => setImageModal(null)}
                            className="image-modal"
                            overlayClassName="modal-overlay"
                        >
                            <img src={imageModal} alt="preview" className="full-img" />
                        </Modal>
                        <Modal
                            isOpen={isCategoryModalOpen}
                            onRequestClose={() =>
                                setIsCategoryModalOpen(false)
                            }
                            className="modal-box"
                            overlayClassName="modal-overlay"
                        >
                            {categoryAction === "edit" ? (
                                <>
                                    <h2>Edit Category</h2>

                                    <input
                                        type="text"
                                        value={editCategoryName}
                                        onChange={(e) =>
                                            setEditCategoryName(e.target.value)
                                        }
                                        style={{
                                            width: "100%",
                                            marginTop: "15px",
                                        }}
                                    />

                                    <div className="modal-actions">
                                        <button
                                            className="cancel-btn"
                                            onClick={() =>
                                                setIsCategoryModalOpen(false)
                                            }
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            className="add-btn"
                                            onClick={updateCategoryName}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2>Delete Category</h2>

                                    <p>
                                        Are you sure you want to delete
                                        <b> {editingCategory?.category}</b> ?
                                    </p>

                                    <div className="modal-actions">
                                        <button
                                            className="cancel-btn"
                                            onClick={() =>
                                                setIsCategoryModalOpen(false)
                                            }
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            className="delete-btn"
                                            onClick={deleteCategory}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </Modal>
                    </div>
                </div>
                {selectedSubCategory &&
                    selectedSubCategory.products &&
                    selectedSubCategory.products.length > 0 && (
                        <>
                            <div className="preview">
                                <div className="header-row">

                                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>

                                        {/* <input
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
                                    </button> */}

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
                                                            selectedSubCategory.products.map((p) => p.id)
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
                                                            selectedProducts.length === selectedSubCategory?.products?.length &&
                                                            selectedSubCategory?.products?.length > 0
                                                        }
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedProducts(
                                                                    selectedSubCategory.products.map((p) => p.id)
                                                                );
                                                            } else {
                                                                setSelectedProducts([]);
                                                            }
                                                        }}
                                                    />
                                                </th>
                                            )}
                                            <th>Category ID</th>
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
                                                    <td>{item.categoryProductId || "-"}</td>
                                                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                                                    <td>
                                                        {(item.images?.[0] || item.image) ? (
                                                            <img
                                                                src={item.images?.[0] || item.image}
                                                                alt={item.title}
                                                                className="product-thumb"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setImageModal(item.images?.[0] || item.image);
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
                                                                    <p><b>Brand:</b> {item.brand}</p>
                                                                    <p><b>Automation:</b> {item.automation}</p>
                                                                    <p><b>Availability:</b> {item.availability}</p>
                                                                    <p><b>Size:</b> {item.size}</p>
                                                                    <p>
                                                                        <b>Video:</b>{" "}
                                                                        {item.video ? (
                                                                            <a href={item.video} target="_blank" rel="noreferrer">
                                                                                Open Video
                                                                            </a>
                                                                        ) : (
                                                                            "No Video"
                                                                        )}
                                                                    </p>

                                                                    <p>
                                                                        <b>PDF:</b>{" "}
                                                                        {item.pdf ? (
                                                                            <a href={item.pdf} target="_blank" rel="noreferrer">
                                                                                Open PDF
                                                                            </a>
                                                                        ) : (
                                                                            "No PDF"
                                                                        )}
                                                                    </p>
                                                                    <div
                                                                        style={{
                                                                            gridColumn: "1 / -1",
                                                                            marginTop: "10px"
                                                                        }}
                                                                    >
                                                                        <b>Images ({item.images?.length || 0})</b>

                                                                        <div
                                                                            style={{
                                                                                display: "flex",
                                                                                gap: "8px",
                                                                                flexWrap: "wrap",
                                                                                marginTop: "10px"
                                                                            }}
                                                                        >
                                                                            {item.images?.length > 0 ? (
                                                                                item.images.map((img, index) => (
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
                                                                                ))
                                                                            ) : (
                                                                                <span>No Images</span>
                                                                            )}
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
                        </>
                    )}
            </div>

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
                            <FileUp size={36} color="#2563eb" style={{ animation: "pulse 1.5s infinite" }} />
                        </div>
                        <h3 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "22px", fontWeight: "700" }}>
                            Generating Category Watermarks
                        </h3>
                        <p style={{ margin: "0 0 24px 0", color: "#475569", fontSize: "15px", fontWeight: "500" }}>
                            {watermarkStatusText || "Processing category product images..."}
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
        </>
    );
}