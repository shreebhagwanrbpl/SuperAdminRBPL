"use client";

import { useState, useEffect, useRef } from "react";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Modal from "react-modal";
import "./home.css";
import toast from "react-hot-toast";
import { usePathname } from "next/navigation";
import {
    Image as ImageIcon,
    Video,
    Upload,
    Trash2,
    Plus,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    Play,
    Pause,
    Eye,
    X,
    Layers,
    Sparkles,
    Film,
    ExternalLink
} from "lucide-react";

// 🔥 EXACT HERO MEDIA DIMENSION CONSTANTS
const HERO_MEDIA_WIDTH = 1900;
const HERO_MEDIA_HEIGHT = 700;

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
        "globalhealthkartcom",
        "tublerin",
        "clinidixcom",
        "oleturcom",
        "indiandiagnosticscom",
        "cliakitsin",
        "radioimmunoassaycoin",
        "centralbiomedicalsin",
        "diagnostatcom",
        "diagnosticbloomcom",
        "diagnotexcom",
        "biohaloscom",
        "diagnosticsbloomcom",
        "globalhealthdirectorycom",
        "humanbiomedicalscom",
        "dxgelcom",
        "globalhealthcartcom",
        "medflixbiomedicalcom",
        "medflixbiomedicalscom",
        "qlysercom",
        "ichromain",
        "spinreactin",
        "rajvedcom",
        "coolpacksin",
        "hamarilabcom",
    ],
    qlyte: [
        "qlyte"
    ]
};

export default function HomePage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [btn1Text, setBtn1Text] = useState("");
    const [btn1Link, setBtn1Link] = useState("");
    const [btn2Text, setBtn2Text] = useState("");
    const [btn2Link, setBtn2Link] = useState("");

    // Media list: Array of { id, type: 'image'|'video', url, storagePath?, name? }
    const [mediaList, setMediaList] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [manualUrl, setManualUrl] = useState("");
    const [manualMediaType, setManualMediaType] = useState("image");

    const [allWebsiteData, setAllWebsiteData] = useState([]);
    const [savedData, setSavedData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedWebsite, setSelectedWebsite] = useState("");

    // Lightbox / Full view modal
    const [previewModalItem, setPreviewModalItem] = useState(null);

    // Carousel Live Preview State
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const fileInputRef = useRef(null);
    const videoInputRef = useRef(null);

    const websites = COMPANY_WEBSITES[selectedCompany] || [];

    const getTargetWebsites = () => {
        if (selectedWebsite === "all") {
            return COMPANY_WEBSITES[selectedCompany] || [];
        }
        return selectedWebsite ? [selectedWebsite] : [];
    };

    useEffect(() => {
        Modal.setAppElement("body");
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedCompany, selectedWebsite]);

    // Live Carousel Auto-Play Timer
    useEffect(() => {
        if (!isAutoPlaying || mediaList.length <= 1) return;

        const interval = setInterval(() => {
            setActiveSlideIndex((prev) => (prev + 1) % mediaList.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [isAutoPlaying, mediaList.length]);

    // Auto adjust active slide if mediaList length decreases
    useEffect(() => {
        if (activeSlideIndex >= mediaList.length && mediaList.length > 0) {
            setActiveSlideIndex(mediaList.length - 1);
        } else if (mediaList.length === 0) {
            setActiveSlideIndex(0);
        }
    }, [mediaList.length, activeSlideIndex]);

    // Parse Firestore Data into standard media items
    const parseMediaFromData = (d) => {
        const list = [];
        if (Array.isArray(d?.media) && d.media.length > 0) {
            d.media.forEach((item, idx) => {
                const url = typeof item === "string" ? item : item.url;
                const type = item.type || (url?.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) ? "video" : "image");
                if (url) {
                    list.push({
                        id: `media-${idx}-${Date.now()}`,
                        type,
                        url,
                        storagePath: item.storagePath || ""
                    });
                }
            });
        } else {
            // Images array
            if (Array.isArray(d?.images) && d.images.length > 0) {
                d.images.forEach((url, idx) => {
                    if (url) {
                        list.push({
                            id: `img-${idx}-${Date.now()}`,
                            type: "image",
                            url
                        });
                    }
                });
            } else if (d?.imageUrl || d?.image) {
                const img = d.imageUrl || d.image;
                if (img) {
                    list.push({
                        id: `img-0-${Date.now()}`,
                        type: "image",
                        url: img
                    });
                }
            }

            // Videos
            if (Array.isArray(d?.videos) && d.videos.length > 0) {
                d.videos.forEach((vUrl, idx) => {
                    if (vUrl) {
                        list.push({
                            id: `vid-${idx}-${Date.now()}`,
                            type: "video",
                            url: vUrl
                        });
                    }
                });
            } else if (d?.videoUrl) {
                list.push({
                    id: `vid-0-${Date.now()}`,
                    type: "video",
                    url: d.videoUrl
                });
            }
        }
        return list;
    };

    // 🔥 LOAD DATA
    const fetchData = async () => {
        if (!selectedCompany) {
            setAllWebsiteData([]);
            setSavedData(null);
            return;
        }

        if (selectedWebsite === "all") {
            const dataList = [];
            for (const website of COMPANY_WEBSITES[selectedCompany]) {
                try {
                    const snap = await getDoc(
                        doc(db, "websites", website, "pages", "home")
                    );
                    if (snap.exists()) {
                        dataList.push({
                            website,
                            ...snap.data(),
                        });
                    }
                } catch (e) {
                    console.error("Error fetching for website:", website, e);
                }
            }

            setAllWebsiteData(dataList);
            setSavedData(null);
            return;
        }

        if (!selectedWebsite) {
            setSavedData(null);
            return;
        }

        try {
            const snap = await getDoc(
                doc(db, "websites", selectedWebsite, "pages", "home")
            );

            if (snap.exists()) {
                const d = snap.data();
                setSavedData(d);
                populateForm(d);
            } else {
                setSavedData(null);
                resetForm();
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setSavedData(null);
            resetForm();
        }
    };

    const populateForm = (d) => {
        setTitle(d.title || "");
        setDescription(d.description || "");
        setBtn1Text(d.button1Text || "");
        setBtn1Link(d.button1Link || "");
        setBtn2Text(d.button2Text || "");
        setBtn2Link(d.button2Link || "");
        setMediaList(parseMediaFromData(d));
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setBtn1Text("");
        setBtn1Link("");
        setBtn2Text("");
        setBtn2Link("");
        setMediaList([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (videoInputRef.current) videoInputRef.current.value = "";
        setActiveSlideIndex(0);
    };

    // 🔥 IMAGE DIMENSION VALIDATION (EXACTLY 1900 × 700)
    const validateImageDimensions = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                return reject(new Error("No image selected."));
            }

            const isImageFormat = /\.(jpe?g|png|webp)$/i.test(file.name) || file.type?.startsWith("image/");
            if (!isImageFormat) {
                return reject(new Error("Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP."));
            }

            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;

                console.log("IMAGE ACTUAL DIMENSIONS:", {
                    name: file.name,
                    type: file.type,
                    width,
                    height
                });

                URL.revokeObjectURL(objectUrl);

                if (width === HERO_MEDIA_WIDTH && height === HERO_MEDIA_HEIGHT) {
                    resolve(true);
                } else {
                    reject(
                        new Error(
                            `Invalid image size. Detected ${width} × ${height} px. Please upload exactly ${HERO_MEDIA_WIDTH} × ${HERO_MEDIA_HEIGHT} px.`
                        )
                    );
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Failed to read image."));
            };

            img.src = objectUrl;
        });
    };

    // 🔥 VIDEO DIMENSION VALIDATION (EXACTLY 1900 × 700)
    const validateVideoDimensions = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                return reject(new Error("No video selected."));
            }

            const isVideoFormat = /\.(mp4|webm)$/i.test(file.name) || ["video/mp4", "video/webm"].includes(file.type);
            if (!isVideoFormat) {
                return reject(new Error("Invalid video format. Supported formats: MP4, WEBM."));
            }

            const objectUrl = URL.createObjectURL(file);
            const video = document.createElement("video");
            video.preload = "metadata";

            video.onloadedmetadata = () => {
                const width = video.videoWidth;
                const height = video.videoHeight;

                console.log("VIDEO ACTUAL DIMENSIONS:", {
                    name: file.name,
                    type: file.type,
                    width,
                    height
                });

                URL.revokeObjectURL(objectUrl);

                if (width === HERO_MEDIA_WIDTH && height === HERO_MEDIA_HEIGHT) {
                    resolve(true);
                } else {
                    reject(
                        new Error(
                            `Invalid video size. Detected ${width} × ${height} px. Please upload exactly ${HERO_MEDIA_WIDTH} × ${HERO_MEDIA_HEIGHT} px.`
                        )
                    );
                }
            };

            video.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Failed to read video metadata."));
            };

            video.src = objectUrl;
        });
    };

    // 🔥 SINGLE COMBINED VALIDATION FUNCTION
    const validateMediaFile = async (file, type) => {
        if (type === "image") {
            return await validateImageDimensions(file);
        }
        if (type === "video") {
            return await validateVideoDimensions(file);
        }
        return true;
    };

    // 🔥 MULTIPLE FILE UPLOAD TO FIREBASE STORAGE WITH STRICT DIMENSION VALIDATION
    const handleFilesUpload = async (files, type = "image") => {
        if (!files || files.length === 0) return;

        // 1. Strict validation of dimensions and formats BEFORE any upload
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                await validateMediaFile(file, type);
            } catch (validationError) {
                toast.error(validationError.message);
                if (fileInputRef.current) fileInputRef.current.value = "";
                if (videoInputRef.current) videoInputRef.current.value = "";
                return;
            }
        }

        const targetFolder = selectedWebsite && selectedWebsite !== "all"
            ? selectedWebsite
            : (selectedCompany || "common");

        setUploading(true);
        setUploadProgress(10);
        const toastId = toast.loading(`Uploading ${files.length} ${type}(s)...`);

        const newItems = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                const storagePath = `websites/${targetFolder}/home/${Date.now()}-${i}-${sanitizedName}`;
                const storageRef = ref(storage, storagePath);

                const uploadTask = uploadBytesResumable(storageRef, file);

                await new Promise((resolve, reject) => {
                    uploadTask.on(
                        "state_changed",
                        (snapshot) => {
                            const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                            const overall = Math.round(((i + prog / 100) / files.length) * 100);
                            setUploadProgress(overall);
                        },
                        reject,
                        resolve
                    );
                });

                const downloadUrl = await getDownloadURL(storageRef);
                newItems.push({
                    id: `${type}-${Date.now()}-${i}`,
                    type,
                    url: downloadUrl,
                    storagePath,
                    name: file.name
                });
            }

            setMediaList((prev) => [...prev, ...newItems]);
            toast.success(`Uploaded ${newItems.length} ${type}(s) successfully!`, { id: toastId });
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(`Failed to upload ${type}: ${error.message || "Storage error"}`, { id: toastId });
        } finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (videoInputRef.current) videoInputRef.current.value = "";
        }
    };

    // Add Direct URL
    const handleAddManualUrl = (e) => {
        e.preventDefault();
        if (!manualUrl.trim()) {
            toast.error("Please enter a valid URL");
            return;
        }

        const newItem = {
            id: `manual-${Date.now()}`,
            type: manualMediaType,
            url: manualUrl.trim(),
            name: manualUrl.split("/").pop() || `${manualMediaType} URL`
        };

        setMediaList((prev) => [...prev, newItem]);
        setManualUrl("");
        toast.success(`Added ${manualMediaType} slide`);
    };

    // Slide Management Handlers
    const handleRemoveSlide = (index) => {
        setMediaList((prev) => prev.filter((_, idx) => idx !== index));
        toast.success("Slide removed");
    };

    const handleMoveSlide = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= mediaList.length) return;

        setMediaList((prev) => {
            const copy = [...prev];
            const [moved] = copy.splice(index, 1);
            copy.splice(newIndex, 0, moved);
            return copy;
        });

        setActiveSlideIndex(newIndex);
    };

    const handleSetCover = (index) => {
        if (index === 0) return;
        setMediaList((prev) => {
            const copy = [...prev];
            const [selected] = copy.splice(index, 1);
            copy.unshift(selected);
            return copy;
        });
        setActiveSlideIndex(0);
        toast.success("Set as 1st Cover Slide");
    };

    // 🔥 SAVE DATA TO FIRESTORE
    const saveData = async () => {
        const targets = getTargetWebsites();
        if (targets.length === 0) {
            toast.error("Please select a website first");
            return;
        }

        const id = toast.loading(`Saving data for ${targets.length} website(s)...`);

        try {
            const imagesOnly = mediaList.filter((m) => m.type === "image").map((m) => m.url);
            const videosOnly = mediaList.filter((m) => m.type === "video").map((m) => m.url);
            const mediaArray = mediaList.map((m) => ({
                type: m.type,
                url: m.url,
                storagePath: m.storagePath || "",
                name: m.name || ""
            }));

            const firstImage = imagesOnly[0] || (mediaList[0]?.type === "image" ? mediaList[0].url : "");
            const firstVideo = videosOnly[0] || (mediaList[0]?.type === "video" ? mediaList[0].url : "");

            const newData = {
                title,
                description,
                media: mediaArray,
                images: imagesOnly,
                imageUrl: firstImage,
                image: firstImage,
                videoUrl: firstVideo,
                videos: videosOnly,
                button1Text: btn1Text,
                button1Link: btn1Link,
                button2Text: btn2Text,
                button2Link: btn2Link,
                updatedAt: new Date().toISOString(),
            };

            for (const website of targets) {
                await setDoc(
                    doc(db, "websites", website, "pages", "home"),
                    newData,
                    { merge: true }
                );
            }

            setSavedData(newData);
            toast.success("Home Page Carousel saved successfully!", { id });
            fetchData();
        } catch (err) {
            console.error("Save error:", err);
            toast.error("Error saving data: " + (err.message || "Unknown error"), { id });
        }
    };

    // EDIT
    const handleEdit = () => {
        if (!savedData) return;
        populateForm(savedData);
        window.scrollTo({ top: 400, behavior: "smooth" });
        toast("Loaded data into editor", { icon: "✏️" });
    };

    // DELETE CONFIRM
    const confirmDelete = async () => {
        const targets = getTargetWebsites();
        if (targets.length === 0) return;

        const id = toast.loading("Deleting data...");
        try {
            for (const website of targets) {
                await deleteDoc(
                    doc(db, "websites", website, "pages", "home")
                );
            }

            setSavedData(null);
            resetForm();
            setShowModal(false);
            toast.success("Deleted successfully", { id });
            fetchData();
        } catch (err) {
            console.error("Delete error:", err);
            toast.error("Delete failed: " + err.message, { id });
        }
    };

    const pathname = usePathname();
    const pathParts = pathname.split("/").filter(Boolean);

    return (
        <div className="wrapper">
            <div className="main">
                {/* Header */}
                <div className="top-header">
                    <div className="page-path">
                        {pathParts.map((part, index) => (
                            <span key={index}>
                                {part.charAt(0).toUpperCase() + part.slice(1)}
                                {index !== pathParts.length - 1 && " > "}
                            </span>
                        ))}
                    </div>
                    <h1 className="heading">Home Page Admin & Hero Carousel</h1>
                </div>

                {/* Company & Website Selection */}
                <div className="card selection-card">
                    <div className="card-header-flex">
                        <h2>Select Website</h2>
                        <span className="badge-info">Target: {selectedWebsite === "all" ? "All Websites" : selectedWebsite || "None"}</span>
                    </div>

                    <div className="select-row">
                        <div className="select-group">
                            <label>Company</label>
                            <select
                                className="company-select"
                                value={selectedCompany}
                                onChange={(e) => {
                                    setSelectedCompany(e.target.value);
                                    setSelectedWebsite("");
                                    setSavedData(null);
                                    resetForm();
                                }}
                            >
                                <option value="">-- Please Select Company --</option>
                                <option value="human">Human Biomedical</option>
                                <option value="global">Global Biomedical</option>
                                <option value="rajbiosis">RajBiosis</option>
                                <option value="qlyte">Qlyte</option>
                            </select>
                        </div>

                        {selectedCompany && (
                            <div className="select-group">
                                <label>Website</label>
                                <select
                                    className="website-select"
                                    value={selectedWebsite}
                                    onChange={(e) => {
                                        setSelectedWebsite(e.target.value);
                                    }}
                                >
                                    <option value="">-- Select Website --</option>
                                    <option value="all">🌟 All Websites in {selectedCompany} ({websites.length})</option>
                                    {websites.map((site) => (
                                        <option key={site} value={site}>
                                            {site}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* FORM & CAROUSEL MANAGER */}
                {selectedCompany && selectedWebsite && (
                    <div className="form-preview-grid">
                        {/* LEFT COLUMN: HERO SETTINGS & MEDIA UPLOADER */}
                        <div className="form-column">
                            {/* Hero Text Card */}
                            <div className="card">
                                <div className="card-header-flex">
                                    <h2>
                                        <Sparkles className="icon-gold" size={20} />
                                        Hero Banner Content
                                    </h2>
                                    <span className="card-hint">Texts & CTA Links</span>
                                </div>

                                <div className="input-group">
                                    <label>Hero Title / Main Heading</label>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. World-Class Biomedical Solutions"
                                        className="styled-input"
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Hero Subtitle / Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="e.g. Delivering high-precision diagnostic and healthcare instruments across the globe."
                                        className="styled-textarea"
                                    />
                                </div>

                                <div className="buttons-grid">
                                    <div className="input-group">
                                        <label>Button 1 Label</label>
                                        <input
                                            value={btn1Text}
                                            onChange={(e) => setBtn1Text(e.target.value)}
                                            placeholder="e.g. Explore Products"
                                            className="styled-input"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Button 1 Link / URL</label>
                                        <input
                                            value={btn1Link}
                                            onChange={(e) => setBtn1Link(e.target.value)}
                                            placeholder="e.g. /products"
                                            className="styled-input"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Button 2 Label</label>
                                        <input
                                            value={btn2Text}
                                            onChange={(e) => setBtn2Text(e.target.value)}
                                            placeholder="e.g. Contact Us"
                                            className="styled-input"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Button 2 Link / URL</label>
                                        <input
                                            value={btn2Link}
                                            onChange={(e) => setBtn2Link(e.target.value)}
                                            placeholder="e.g. /contact"
                                            className="styled-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Carousel Media Manager Card */}
                            <div className="card">
                                <div className="card-header-flex">
                                    <h2>
                                        <Layers className="icon-indigo" size={20} />
                                        Carousel Media Slides ({mediaList.length})
                                    </h2>
                                    <span className="badge-count">
                                        {mediaList.filter(m => m.type === 'image').length} Images, {mediaList.filter(m => m.type === 'video').length} Videos
                                    </span>
                                </div>

                                <p className="section-description">
                                    Upload multiple images or videos for your home page hero carousel. Drag or reorder slides using the arrow buttons.
                                    <br />
                                    <span style={{ fontSize: "12.5px", color: "#475569", display: "inline-block", marginTop: "4px" }}>
                                        • <strong>Image Requirement:</strong> Exactly <strong>1900 × 700 px</strong> (JPG, JPEG, PNG, WEBP)
                                        <br />
                                        • <strong>Video Requirement:</strong> Exactly <strong>1900 × 700 px</strong> (MP4, WEBM)
                                    </span>
                                </p>

                                {/* Upload Action Buttons */}
                                <div className="upload-buttons-bar">
                                    <input
                                        type="file"
                                        multiple
                                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/jpg,image/png,image/webp"
                                        ref={fileInputRef}
                                        style={{ display: "none" }}
                                        onChange={(e) => handleFilesUpload(e.target.files, "image")}
                                    />
                                    <input
                                        type="file"
                                        multiple
                                        accept=".mp4,.webm,video/mp4,video/webm"
                                        ref={videoInputRef}
                                        style={{ display: "none" }}
                                        onChange={(e) => handleFilesUpload(e.target.files, "video")}
                                    />

                                    <button
                                        type="button"
                                        className="btn-upload-media btn-upload-image"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        <ImageIcon size={18} />
                                        <span>Upload Images (1900 × 700 px)</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="btn-upload-media btn-upload-video"
                                        onClick={() => videoInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        <Film size={18} />
                                        <span>Upload Videos (1900 × 700 px)</span>
                                    </button>
                                </div>

                                {/* Upload Progress Indicator */}
                                {uploading && (
                                    <div className="upload-progress-box">
                                        <div className="progress-label">
                                            <span>Uploading media to Firebase Storage...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Manual URL Add Section */}
                                <div className="manual-url-box">
                                    <div className="manual-url-flex">
                                        <select
                                            value={manualMediaType}
                                            onChange={(e) => setManualMediaType(e.target.value)}
                                            className="manual-type-select"
                                        >
                                            <option value="image">Image URL</option>
                                            <option value="video">Video URL</option>
                                        </select>
                                        <input
                                            type="url"
                                            value={manualUrl}
                                            onChange={(e) => setManualUrl(e.target.value)}
                                            placeholder="Paste image or video link (https://...)"
                                            className="manual-url-input"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddManualUrl}
                                            className="btn-add-url"
                                        >
                                            <Plus size={16} />
                                            <span>Add Slide</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Slides Grid */}
                                {mediaList.length === 0 ? (
                                    <div className="empty-media-state">
                                        <Upload size={36} className="empty-icon" />
                                        <h4>No Carousel Slides Added</h4>
                                        <p>Click &quot;Upload Images&quot; or &quot;Upload Videos&quot; above to add slides to the carousel.</p>
                                    </div>
                                ) : (
                                    <div className="media-slides-grid">
                                        {mediaList.map((item, index) => (
                                            <div
                                                key={item.id || index}
                                                className={`media-slide-card ${activeSlideIndex === index ? "active-slide-card" : ""}`}
                                            >
                                                {/* Header Badge */}
                                                <div className="slide-card-header">
                                                    <span className="slide-num-badge">
                                                        #{index + 1} {index === 0 && <strong className="cover-tag">COVER</strong>}
                                                    </span>
                                                    <span className={`media-type-tag ${item.type}`}>
                                                        {item.type === "video" ? <Video size={12} /> : <ImageIcon size={12} />}
                                                        {item.type.toUpperCase()}
                                                    </span>
                                                </div>

                                                {/* Preview Thumbnail */}
                                                <div
                                                    className="slide-thumbnail-wrapper"
                                                    onClick={() => setActiveSlideIndex(index)}
                                                >
                                                    {item.type === "video" ? (
                                                        <video
                                                            src={item.url}
                                                            className="slide-thumbnail-media"
                                                            muted
                                                            preload="metadata"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={item.url}
                                                            alt={`Slide ${index + 1}`}
                                                            className="slide-thumbnail-media"
                                                            onError={(e) => {
                                                                e.target.src = "https://placehold.co/400x250?text=Invalid+Image";
                                                            }}
                                                        />
                                                    )}
                                                    <div className="slide-preview-overlay">
                                                        <button
                                                            type="button"
                                                            className="btn-overlay-action"
                                                            title="View Full Size"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPreviewModalItem(item);
                                                            }}
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div className="slide-card-actions">
                                                    <button
                                                        type="button"
                                                        className="slide-btn"
                                                        title="Move Left"
                                                        disabled={index === 0}
                                                        onClick={() => handleMoveSlide(index, -1)}
                                                    >
                                                        <ArrowLeft size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="slide-btn"
                                                        title="Move Right"
                                                        disabled={index === mediaList.length - 1}
                                                        onClick={() => handleMoveSlide(index, 1)}
                                                    >
                                                        <ArrowRight size={14} />
                                                    </button>
                                                    {index !== 0 && (
                                                        <button
                                                            type="button"
                                                            className="slide-btn btn-make-cover"
                                                            title="Set as First Slide"
                                                            onClick={() => handleSetCover(index)}
                                                        >
                                                            Cover
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="slide-btn btn-delete-slide"
                                                        title="Delete Slide"
                                                        onClick={() => handleRemoveSlide(index)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Save Button Bar */}
                                <div className="save-actions-bar">
                                    <button
                                        type="button"
                                        className="btn-save-main"
                                        onClick={saveData}
                                        disabled={uploading}
                                    >
                                        <Sparkles size={18} />
                                        <span>Save Home Page Carousel</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-reset-form"
                                        onClick={resetForm}
                                    >
                                        Reset Form
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: INTERACTIVE LIVE CAROUSEL PREVIEW */}
                        <div className="preview-column">
                            <div className="card live-preview-card">
                                <div className="card-header-flex">
                                    <h2>
                                        <Play className="icon-green" size={20} />
                                        Live Hero Carousel Preview
                                    </h2>
                                    <div className="preview-controls">
                                        <button
                                            type="button"
                                            className="btn-autoplay-toggle"
                                            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                                            title={isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}
                                        >
                                            {isAutoPlaying ? <Pause size={14} /> : <Play size={14} />}
                                            <span>{isAutoPlaying ? "Auto: ON" : "Auto: OFF"}</span>
                                        </button>
                                    </div>
                                </div>

                                <p className="preview-subtitle">
                                    Preview of how the hero carousel banner and buttons will render on the live website.
                                </p>

                                {/* Live Carousel Stage */}
                                <div className="live-carousel-container">
                                    {mediaList.length === 0 ? (
                                        <div className="carousel-placeholder">
                                            <ImageIcon size={48} className="placeholder-icon" />
                                            <h3>No Media Added Yet</h3>
                                            <p>Upload carousel images or videos to see the live preview.</p>
                                        </div>
                                    ) : (
                                        <div className="carousel-viewport">
                                            {/* Media Slide */}
                                            {mediaList[activeSlideIndex]?.type === "video" ? (
                                                <video
                                                    key={mediaList[activeSlideIndex]?.url}
                                                    src={mediaList[activeSlideIndex]?.url}
                                                    className="carousel-active-media"
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <img
                                                    key={mediaList[activeSlideIndex]?.url}
                                                    src={mediaList[activeSlideIndex]?.url}
                                                    alt={`Slide ${activeSlideIndex + 1}`}
                                                    className="carousel-active-media"
                                                />
                                            )}

                                            {/* Gradient Overlay */}
                                            <div className="carousel-gradient-overlay" />

                                            {/* Overlay Content */}
                                            <div className="carousel-text-overlay">
                                                <span className="live-badge">
                                                    {mediaList[activeSlideIndex]?.type === "video" ? "FEATURED VIDEO" : "FEATURED BANNER"}
                                                </span>
                                                <h1 className="hero-preview-title">
                                                    {title || "Your Hero Title Goes Here"}
                                                </h1>
                                                <p className="hero-preview-desc">
                                                    {description || "Your hero description and company intro will appear right here over the dynamic carousel banner."}
                                                </p>

                                                <div className="hero-preview-buttons">
                                                    {btn1Text && (
                                                        <a
                                                            href={btn1Link || "#"}
                                                            onClick={(e) => e.preventDefault()}
                                                            className="hero-btn-primary"
                                                        >
                                                            {btn1Text}
                                                        </a>
                                                    )}
                                                    {btn2Text && (
                                                        <a
                                                            href={btn2Link || "#"}
                                                            onClick={(e) => e.preventDefault()}
                                                            className="hero-btn-secondary"
                                                        >
                                                            {btn2Text}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Navigation Arrows */}
                                            {mediaList.length > 1 && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="carousel-nav-arrow arrow-left"
                                                        onClick={() =>
                                                            setActiveSlideIndex(
                                                                (prev) => (prev - 1 + mediaList.length) % mediaList.length
                                                            )
                                                        }
                                                    >
                                                        <ChevronLeft size={24} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="carousel-nav-arrow arrow-right"
                                                        onClick={() =>
                                                            setActiveSlideIndex((prev) => (prev + 1) % mediaList.length)
                                                        }
                                                    >
                                                        <ChevronRight size={24} />
                                                    </button>
                                                </>
                                            )}

                                            {/* Dot Indicators */}
                                            {mediaList.length > 1 && (
                                                <div className="carousel-pagination-dots">
                                                    {mediaList.map((_, dotIdx) => (
                                                        <button
                                                            key={dotIdx}
                                                            type="button"
                                                            className={`carousel-dot ${activeSlideIndex === dotIdx ? "active-dot" : ""}`}
                                                            onClick={() => setActiveSlideIndex(dotIdx)}
                                                        />
                                                    ))}
                                                </div>
                                            )}

                                            {/* Slide Counter */}
                                            <div className="carousel-counter-badge">
                                                {activeSlideIndex + 1} / {mediaList.length}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔥 DATABASE SAVED PREVIEWS SECTION */}
                {selectedCompany && selectedWebsite && (
                    <div className="saved-data-section">
                        {selectedWebsite === "all" ? (
                            <div>
                                <div className="section-header-flex">
                                    <h2>All Websites in &quot;{selectedCompany.toUpperCase()}&quot; ({allWebsiteData.length})</h2>
                                    <span className="badge-count-pill">{allWebsiteData.length} Websites Configured</span>
                                </div>

                                {allWebsiteData.length === 0 ? (
                                    <div className="card no-data-card">
                                        <p className="no-data">No Home Page data found for websites in this company.</p>
                                    </div>
                                ) : (
                                    <div className="all-sites-grid">
                                        {allWebsiteData.map((item) => {
                                            const itemMedia = parseMediaFromData(item);
                                            return (
                                                <div key={item.website} className="card website-preview-card">
                                                    <div className="website-card-header">
                                                        <div className="website-title-badge">
                                                            <span className="site-name">{item.website}</span>
                                                            <span className="media-count-tag">
                                                                {itemMedia.length} Slides ({itemMedia.filter(m => m.type === 'image').length} Img, {itemMedia.filter(m => m.type === 'video').length} Vid)
                                                            </span>
                                                        </div>
                                                        <div className="action-buttons">
                                                            <button
                                                                className="edit-btn"
                                                                onClick={() => {
                                                                    setSelectedWebsite(item.website);
                                                                    setSavedData(item);
                                                                    populateForm(item);
                                                                    window.scrollTo({ top: 400, behavior: "smooth" });
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="delete-btn"
                                                                onClick={() => {
                                                                    setSelectedWebsite(item.website);
                                                                    setShowModal(true);
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="website-card-body">
                                                        {/* Media Thumbnails Row */}
                                                        {itemMedia.length > 0 && (
                                                            <div className="table-media-gallery">
                                                                {itemMedia.map((m, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="mini-thumb-wrap"
                                                                        onClick={() => setPreviewModalItem(m)}
                                                                    >
                                                                        {m.type === "video" ? (
                                                                            <div className="mini-video-wrap">
                                                                                <Video size={14} className="mini-video-icon" />
                                                                                <video src={m.url} className="mini-thumb" preload="metadata" />
                                                                            </div>
                                                                        ) : (
                                                                            <img src={m.url} alt={`Slide ${idx + 1}`} className="mini-thumb" />
                                                                        )}
                                                                        {idx === 0 && <span className="mini-cover-badge">1</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="preview-details-grid">
                                                            <div className="detail-item">
                                                                <strong>Title:</strong>
                                                                <span>{item.title || "-"}</span>
                                                            </div>
                                                            <div className="detail-item">
                                                                <strong>Description:</strong>
                                                                <span>{item.description || "-"}</span>
                                                            </div>
                                                            <div className="detail-item">
                                                                <strong>Button 1:</strong>
                                                                <span>{item.button1Text ? `${item.button1Text} (${item.button1Link || '#'})` : "-"}</span>
                                                            </div>
                                                            <div className="detail-item">
                                                                <strong>Button 2:</strong>
                                                                <span>{item.button2Text ? `${item.button2Text} (${item.button2Link || '#'})` : "-"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="card single-site-preview-card">
                                <div className="card-header-flex">
                                    <h2>Website Saved Data: <span className="site-name-highlight">{selectedWebsite}</span></h2>
                                    {savedData && (
                                        <div className="action-buttons">
                                            <button className="edit-btn" onClick={handleEdit}>Edit</button>
                                            <button className="delete-btn" onClick={() => setShowModal(true)}>Delete</button>
                                        </div>
                                    )}
                                </div>

                                {!savedData ? (
                                    <div className="no-data">
                                        <p>No Home Page configuration saved yet for <strong>{selectedWebsite}</strong>. Use the form above to add carousel slides and save.</p>
                                    </div>
                                ) : (
                                    <div className="saved-content-display">
                                        {/* Saved Carousel Slides */}
                                        {(() => {
                                            const itemMedia = parseMediaFromData(savedData);
                                            return (
                                                <div>
                                                    <div className="saved-slides-header">
                                                        <h3>Saved Carousel Slides ({itemMedia.length})</h3>
                                                    </div>
                                                    <div className="table-media-gallery large-gallery">
                                                        {itemMedia.map((m, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="mini-thumb-wrap large-thumb-wrap"
                                                                onClick={() => setPreviewModalItem(m)}
                                                            >
                                                                {m.type === "video" ? (
                                                                    <div className="mini-video-wrap">
                                                                        <Video size={18} className="mini-video-icon" />
                                                                        <video src={m.url} className="mini-thumb large-thumb" preload="metadata" />
                                                                    </div>
                                                                ) : (
                                                                    <img src={m.url} alt={`Slide ${idx + 1}`} className="mini-thumb large-thumb" />
                                                                )}
                                                                <span className="mini-cover-badge">Slide {idx + 1} {idx === 0 ? "(Cover)" : ""}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <table className="saved-data-table">
                                                        <tbody>
                                                            <tr>
                                                                <th style={{ width: "160px" }}>Title</th>
                                                                <td><strong>{savedData.title || "-"}</strong></td>
                                                            </tr>
                                                            <tr>
                                                                <th>Description</th>
                                                                <td>{savedData.description || "-"}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>Button 1</th>
                                                                <td>{savedData.button1Text ? `${savedData.button1Text} -> ${savedData.button1Link}` : "-"}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>Button 2</th>
                                                                <td>{savedData.button2Text ? `${savedData.button2Text} -> ${savedData.button2Link}` : "-"}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 🔥 LIGHTBOX / FULL VIEW MODAL */}
            <Modal
                isOpen={!!previewModalItem}
                onRequestClose={() => setPreviewModalItem(null)}
                className="modal-media-lightbox"
                overlayClassName="modal-overlay"
            >
                <div className="lightbox-content">
                    <button
                        className="lightbox-close-btn"
                        onClick={() => setPreviewModalItem(null)}
                    >
                        <X size={20} />
                    </button>
                    {previewModalItem?.type === "video" ? (
                        <video
                            src={previewModalItem.url}
                            controls
                            autoPlay
                            className="lightbox-media"
                        />
                    ) : (
                        <img
                            src={previewModalItem?.url}
                            alt="Full Preview"
                            className="lightbox-media"
                        />
                    )}
                    <div className="lightbox-footer">
                        <span className="lightbox-tag">{previewModalItem?.type.toUpperCase()}</span>
                        <a
                            href={previewModalItem?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="lightbox-link"
                        >
                            Open Original <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </Modal>

            {/* 🔥 DELETE MODAL */}
            <Modal
                isOpen={showModal}
                onRequestClose={() => setShowModal(false)}
                className="modal-box"
                overlayClassName="modal-overlay"
            >
                <h2>Delete Home Page Data?</h2>
                <p>Are you sure you want to delete the home page data and carousel configuration for <strong>{selectedWebsite === 'all' ? `All websites in ${selectedCompany}` : selectedWebsite}</strong>?</p>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                    <button className="delete-btn" onClick={confirmDelete}>
                        Yes, Delete
                    </button>
                </div>
            </Modal>
        </div>
    );
}