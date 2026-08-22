"use client";

import "./district.css";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
  getCountFromServer,
} from "firebase/firestore";
import { usePathname } from "next/navigation";

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
  ],

  qlyte: ["qlyte"],
};

const FILE_STORAGE_KEY = "districtJson";
const UPLOADED_FILES_STORAGE_KEY = "districtUploadedFiles";
const BATCH_SIZE = 450;

const normalizeSlug = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const getDistrictKey = (item) =>
  normalizeSlug(item?.slug || item?.district || "");

const getFileKey = (file) =>
  `${file.name}::${file.size}::${file.lastModified}`;

export default function Page() {
  const [jsonData, setJsonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [selectedFileKey, setSelectedFileKey] = useState("");
  const [districts, setDistricts] = useState([]);
  const [allWebsiteDistricts, setAllWebsiteDistricts] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [openWebsite, setOpenWebsite] = useState(null);
  const [selectedWebsite, setSelectedWebsite] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    completed: 0,
    total: 0,
    website: "",
    added: 0,
    skipped: 0,
  });

  const websites = COMPANY_WEBSITES[selectedCompany] || [];

  const getTargetWebsites = () => {
    if (selectedWebsite === "all") {
      return COMPANY_WEBSITES[selectedCompany] || [];
    }

    return selectedWebsite ? [selectedWebsite] : [];
  };

  const clearSelectedFile = () => {
    setJsonData([]);
    setFileName("");
    setSelectedFileKey("");
    localStorage.removeItem(FILE_STORAGE_KEY);
  };

  const clearWebsiteData = () => {
    setDistricts([]);
    setAllWebsiteDistricts([]);
    setOpenWebsite(null);
  };

  const getUploadedFileRegistry = () => {
    try {
      const saved = localStorage.getItem(UPLOADED_FILES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const saveUploadedFileRegistry = (registry) => {
    localStorage.setItem(
      UPLOADED_FILES_STORAGE_KEY,
      JSON.stringify(registry)
    );
  };

  const isFileAlreadyUploaded = (fileKey, targetWebsites) => {
    if (!fileKey || !targetWebsites.length) return false;

    const registry = getUploadedFileRegistry();

    return targetWebsites.every(
      (website) =>
        Array.isArray(registry[website]) &&
        registry[website].includes(fileKey)
    );
  };

  const markFileUploaded = (fileKey, targetWebsites) => {
    if (!fileKey) return;

    const registry = getUploadedFileRegistry();

    targetWebsites.forEach((website) => {
      const current = Array.isArray(registry[website])
        ? registry[website]
        : [];

      if (!current.includes(fileKey)) {
        registry[website] = [...current, fileKey];
      }
    });

    saveUploadedFileRegistry(registry);
  };

  // JSON Upload / File Selection
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];

    // Allow choosing the same file again after clearing it.
    e.target.value = "";

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Please choose a JSON file.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        toast.error("JSON Array Required");
        return;
      }

      if (parsed.length === 0) {
        toast.error("JSON file contains no districts.");
        return;
      }

      const cleaned = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          ...item,
          slug: item.slug || normalizeSlug(item.district),
        }))
        .filter((item) => item.slug);

      if (cleaned.length === 0) {
        toast.error("No valid district records found in JSON.");
        return;
      }

      const fileKey = getFileKey(file);
      const targetWebsites = getTargetWebsites();

      if (
        selectedCompany &&
        selectedWebsite &&
        isFileAlreadyUploaded(fileKey, targetWebsites)
      ) {
        toast.error(
          selectedWebsite === "all"
            ? "This exact JSON file has already been uploaded to all selected websites."
            : "This exact JSON file has already been uploaded to this website."
        );
        return;
      }

      setJsonData(cleaned);
      setFileName(file.name);
      setSelectedFileKey(fileKey);

      localStorage.setItem(
        FILE_STORAGE_KEY,
        JSON.stringify({
          data: cleaned,
          fileName: file.name,
          fileKey,
        })
      );

      toast.success(`${cleaned.length} district records loaded.`);
    } catch (error) {
      console.error("Invalid JSON:", error);
      toast.error("Invalid JSON file.");
      clearSelectedFile();
    }
  };

  // Always load current Firestore data.
  const loadDistricts = async () => {
    if (!selectedCompany || !selectedWebsite) {
      clearWebsiteData();
      return;
    }

    try {
      setRefreshing(true);

      if (selectedWebsite === "all") {
        const targetWebsites = COMPANY_WEBSITES[selectedCompany] || [];

        // Fetch counts using getCountFromServer instead of full document reads
        const results = await Promise.all(
          targetWebsites.map(async (website) => {
            try {
              const collRef = collection(db, "websites", website, "districts");
              const snapshot = await getCountFromServer(collRef);
              return {
                website,
                districts: [],
                count: snapshot.data().count,
                loaded: false,
              };
            } catch (err) {
              console.error(`Failed to get count for ${website}:`, err);
              return {
                website,
                districts: [],
                count: 0,
                loaded: false,
              };
            }
          })
        );

        setAllWebsiteDistricts(results);
        setDistricts([]);
        return;
      }

      const snap = await getDocs(
        collection(db, "websites", selectedWebsite, "districts")
      );

      const data = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setDistricts(data);
      setAllWebsiteDistricts([]);
    } catch (err) {
      console.error("Failed to load districts:", err);
      toast.error("Failed to load latest district data.");
      clearWebsiteData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleWebsite = async (website) => {
    if (openWebsite === website) {
      setOpenWebsite(null);
      return;
    }

    setOpenWebsite(website);

    const siteData = allWebsiteDistricts.find((s) => s.website === website);
    if (siteData && !siteData.loaded) {
      try {
        const snap = await getDocs(
          collection(db, "websites", website, "districts")
        );
        const docsData = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setAllWebsiteDistricts((prev) =>
          prev.map((s) =>
            s.website === website
              ? {
                ...s,
                districts: docsData,
                count: docsData.length,
                loaded: true,
              }
              : s
          )
        );
      } catch (err) {
        console.error("Failed to load districts for website:", website, err);
        toast.error(`Failed to load districts for ${website}`);
      }
    }
  };

  const handleDeleteDistrict = async (website, districtId) => {
    if (!window.confirm("Are you sure you want to delete this district?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "websites", website, "districts", districtId));
      toast.success("District deleted successfully");

      // Update state immediately so it disappears from the UI
      if (selectedWebsite === "all") {
        setAllWebsiteDistricts((prev) =>
          prev.map((s) =>
            s.website === website
              ? {
                ...s,
                districts: s.districts.filter((d) => (d.id || d.slug) !== districtId),
                count: Math.max(0, (s.count || 1) - 1),
              }
              : s
          )
        );
      } else {
        setDistricts((prev) => prev.filter((d) => (d.id || d.slug) !== districtId));
      }
    } catch (err) {
      console.error("Failed to delete district:", err);
      toast.error("Failed to delete district.");
    }
  };

  useEffect(() => {
    clearWebsiteData();
    loadDistricts();
  }, [selectedCompany, selectedWebsite]);

  // Fast Firebase upload using Firestore writeBatch.
  // Existing districts are skipped. Only new districts are written.
  const uploadWebsiteInBatches = async (website, items, progressIndex, totalWebsites) => {
    const existingSnap = await getDocs(
      collection(db, "websites", website, "districts")
    );

    const existingKeys = new Set();

    existingSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const key = normalizeSlug(
        docSnap.id || data.slug || data.district || ""
      );

      if (key) {
        existingKeys.add(key);
      }
    });

    const newItems = [];
    let skippedForWebsite = 0;

    for (const item of items) {
      const districtKey = getDistrictKey(item);

      if (!districtKey) {
        skippedForWebsite++;
        continue;
      }

      if (existingKeys.has(districtKey)) {
        skippedForWebsite++;
        continue;
      }

      newItems.push({
        item,
        districtKey,
      });

      // Prevent duplicate districts inside the same JSON file from being
      // added twice during this upload.
      existingKeys.add(districtKey);
    }

    // Commit batches. 450 is intentionally below Firestore's 500-operation
    // batch limit to leave a safe margin.
    const totalBatches = Math.ceil(newItems.length / BATCH_SIZE);

    for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
      const chunk = newItems.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(({ item, districtKey }) => {
        const ref = doc(
          db,
          "websites",
          website,
          "districts",
          districtKey
        );

        batch.set(ref, {
          district: item.district || "",
          slug: districtKey,
          state: item.state || "",
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();

      const completedBatches = Math.min(
        Math.floor(i / BATCH_SIZE) + 1,
        totalBatches
      );

      setUploadProgress((prev) => ({
        ...prev,
        website,
        completed: progressIndex,
        total: totalWebsites,
        added: prev.added + chunk.length,
        skipped: prev.skipped,
      }));

      console.log(
        `[District Upload] ${website}: batch ${completedBatches}/${totalBatches} committed`
      );
    }

    setUploadProgress((prev) => ({
      ...prev,
      website,
      completed: progressIndex + 1,
      total: totalWebsites,
      added: prev.added,
      skipped: prev.skipped + skippedForWebsite,
    }));

    // Mark only this website as completed. If another website fails later,
    // retrying the same file can continue with the unfinished website.
    markFileUploaded(selectedFileKey, [website]);

    return {
      website,
      added: newItems.length,
      skipped: skippedForWebsite,
    };
  };

  // Firebase Upload
  const uploadToFirebase = async () => {
    const targetWebsites = getTargetWebsites();

    if (!selectedCompany || !selectedWebsite) {
      toast.error("Please select a company and website first.");
      return;
    }

    if (!selectedFileKey || !jsonData.length) {
      toast.error("Please choose a JSON file first.");
      return;
    }

    if (!targetWebsites.length) {
      toast.error("No target website selected.");
      return;
    }

    if (isFileAlreadyUploaded(selectedFileKey, targetWebsites)) {
      toast.error(
        selectedWebsite === "all"
          ? "This exact JSON file has already been uploaded to all selected websites."
          : "This exact JSON file has already been uploaded to this website."
      );
      return;
    }

    try {
      setLoading(true);

      setUploadProgress({
        completed: 0,
        total: targetWebsites.length,
        website: "",
        added: 0,
        skipped: 0,
      });

      /*
       * Websites are processed sequentially.
       * This prevents browser connection throttling and Firestore write limits,
       * and provides a smooth progress indicator.
       */
      const results = [];
      for (let index = 0; index < targetWebsites.length; index++) {
        const website = targetWebsites[index];
        const res = await uploadWebsiteInBatches(
          website,
          jsonData,
          index,
          targetWebsites.length
        );
        results.push(res);
      }

      const totalAdded = results.reduce(
        (sum, result) => sum + result.added,
        0
      );

      const totalSkipped = results.reduce(
        (sum, result) => sum + result.skipped,
        0
      );

      // Refresh directly from Firestore so UI reflects actual database state.
      await loadDistricts();

      const uploadedFileName = fileName;

      clearSelectedFile();

      setUploadProgress({
        completed: targetWebsites.length,
        total: targetWebsites.length,
        website: "",
        added: totalAdded,
        skipped: totalSkipped,
      });

      if (totalAdded === 0 && totalSkipped > 0) {
        toast.success(
          `No new districts found in ${uploadedFileName}. Existing districts were skipped.`
        );
      } else {
        toast.success(
          `${totalAdded} new district(s) added. ${totalSkipped} existing/invalid district(s) skipped.`
        );
      }
    } catch (err) {
      console.error("Upload failed:", err);

      // Do not clear the selected JSON on failure.
      // This allows the user to retry unfinished websites.
      toast.error(
        "Upload stopped because one or more websites failed. Completed websites were saved; existing districts will be skipped on retry."
      );
    } finally {
      setLoading(false);
    }
  };

  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);

  const canUpload =
    !loading &&
    jsonData.length > 0 &&
    Boolean(selectedFileKey) &&
    Boolean(selectedCompany) &&
    Boolean(selectedWebsite);

  const progressPercent =
    uploadProgress.total > 0
      ? Math.round(
        (uploadProgress.completed / uploadProgress.total) * 100
      )
      : 0;

  return (
    <div className="districtPage">
      <div className="top-header">
        <div className="page-path">
          {pathParts.map((part, index) => (
            <span key={index}>
              {part.charAt(0).toUpperCase() + part.slice(1)}
              {index !== pathParts.length - 1 && " > "}
            </span>
          ))}
        </div>

        <h1 className="heading">District Page Admin</h1>
      </div>

      <div className="card">
        <h2>Select Website</h2>

        <div
          style={{
            display: "flex",
            gap: "15px",
            marginTop: "15px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedCompany}
            disabled={loading}
            onChange={(e) => {
              setSelectedCompany(e.target.value);
              setSelectedWebsite("");
              clearWebsiteData();
              clearSelectedFile();
            }}
          >
            <option value="">Please Select Company</option>
            <option value="human">Human Biomedical</option>
            <option value="global">Global Biomedical</option>
            <option value="rajbiosis">RajBiosis</option>
          </select>

          {selectedCompany && (
            <select
              value={selectedWebsite}
              disabled={loading}
              onChange={(e) => {
                setSelectedWebsite(e.target.value);
                clearWebsiteData();
                clearSelectedFile();
              }}
            >
              <option value="">Select Website</option>

              <option value="all">All Websites</option>

              {websites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="districtContainer">
        <div className="headerBox">
          <div>
            <h1>District JSON Upload</h1>
            <p>Upload JSON file and push district data to Firebase</p>
          </div>

          <div className="topButtons">
            <label
              className="chooseBtn"
              style={{
                opacity: loading ? 0.6 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
              Choose JSON File

              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                disabled={loading}
                hidden
              />
            </label>

            <button
              type="button"
              onClick={uploadToFirebase}
              disabled={!canUpload}
              className="uploadBtn"
              title={
                !selectedFileKey
                  ? "Choose a JSON file first"
                  : !selectedCompany || !selectedWebsite
                    ? "Select company and website first"
                    : "Upload selected JSON"
              }
            >
              {loading
                ? `Uploading ${progressPercent}%...`
                : selectedWebsite === "all"
                  ? "Upload To All Websites"
                  : "Upload Firebase"}
            </button>
          </div>
        </div>

        {loading && uploadProgress.total > 0 && (
          <div
            className="card"
            style={{
              marginTop: "15px",
              padding: "15px",
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              <strong>
                Uploading:{" "}
                {uploadProgress.website || "Preparing..."}
              </strong>

              <span>
                {uploadProgress.completed}/{uploadProgress.total} websites
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: "8px",
                background: "#e5e7eb",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: "#4338ca",
                  transition: "width 250ms ease",
                }}
              />
            </div>

            <p
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              {uploadProgress.added} new districts added •{" "}
              {uploadProgress.skipped} existing/invalid skipped
            </p>
          </div>
        )}

        {fileName && (
          <div className="fileBox">
            📁 {fileName} ({jsonData.length} districts)
          </div>
        )}

        <div className="statsGrid">
          <div className="card">
            <span>Target Website</span>
            <p>{selectedWebsite || "Please Select Website"}</p>
          </div>

          <div className="card">
            <span>Collection</span>
            <p>districts</p>
          </div>

          <div className="card">
            <span>Status</span>
            <p className="green">
              {refreshing
                ? "Refreshing..."
                : loading
                  ? "Uploading..."
                  : jsonData.length > 0
                    ? "JSON Ready"
                    : "Ready"}
            </p>
          </div>
        </div>

        <div className="tableWrapper">
          {selectedWebsite === "all" ? (
            <div>
              {allWebsiteDistricts.map((site) => (
                <div
                  key={site.website}
                  className="card"
                  style={{ marginBottom: "20px" }}
                >
                  <div
                    onClick={() => handleToggleWebsite(site.website)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "15px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          color: "#4338ca",
                        }}
                      >
                        {site.website}
                      </h3>
                    </div>

                    <span
                      style={{
                        background: "#eef2ff",
                        color: "#4338ca",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      {site.loaded ? site.districts.length : site.count ?? 0} Districts
                    </span>
                  </div>

                  {openWebsite === site.website && (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>District</th>
                          <th>Slug</th>
                          <th>State</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {site.districts.length > 0 ? (
                          site.districts.map((item, index) => (
                            <tr key={item.id || item.slug || index}>
                              <td>{index + 1}</td>
                              <td>{item.district}</td>
                              <td>
                                <span className="slug">
                                  {item.slug}
                                </span>
                              </td>
                              <td>{item.state}</td>
                              <td>
                                <button
                                  className="delete-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDistrict(site.website, item.id || item.slug);
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
                              {site.loaded ? "No Districts Found" : "Loading districts..."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                  padding: "10px 5px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: "#4338ca",
                    fontSize: "22px",
                    fontWeight: "700",
                  }}
                >
                  {selectedWebsite || "District Preview"}
                </h3>

                <span
                  style={{
                    background: "#eef2ff",
                    color: "#4338ca",
                    padding: "8px 14px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {(jsonData.length > 0 ? jsonData : districts).length}{" "}
                  Districts
                </span>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>District</th>
                    <th>Slug</th>
                    <th>State</th>
                    {jsonData.length === 0 && <th>Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {(jsonData.length > 0 ? jsonData : districts).length > 0 ? (
                    (jsonData.length > 0 ? jsonData : districts).map(
                      (item, index) => (
                        <tr key={item.id || item.slug || index}>
                          <td>{index + 1}</td>

                          <td>
                            <strong>{item.district || "-"}</strong>
                          </td>

                          <td>
                            <span className="slug">
                              {item.slug || "-"}
                            </span>
                          </td>

                          <td>{item.state || "-"}</td>

                          {jsonData.length === 0 && (
                            <td>
                              <button
                                className="delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDistrict(selectedWebsite, item.id || item.slug);
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td colSpan={jsonData.length === 0 ? 5 : 4}>
                        <div className="emptyBox">
                          <div className="icon">📂</div>

                          <p>
                            {selectedWebsite
                              ? "No District Data Found"
                              : "Please Select Website"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
