"use client";
import "./district.css"
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs
} from "firebase/firestore";
import { usePathname } from "next/navigation";
const COMPANY_WEBSITES = {
  human: [
    "humanbiomedicalorg",
    "humanbiomedicalin",
    "humanbiomedicalsin",
    "humanbiomedicalsorg",
    "humanbiomedicalscoin",
  ],

  global: [
    "globalbiomedicalorg",
    "globalbiomedicalsin",
  ],

  rajbiosis: [
    "indiandiagnostic",
    "centralbiomedicals",
  ],
};
export default function Page() {
  const [jsonData, setJsonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [districts, setDistricts] = useState([]);
  const [allWebsiteDistricts, setAllWebsiteDistricts] = useState([]);
  const [selectedCompany, setSelectedCompany] =
    useState("");
  const [openWebsite, setOpenWebsite] = useState(null);
  const [selectedWebsite, setSelectedWebsite] =
    useState("");

  const websites =
    COMPANY_WEBSITES[selectedCompany] || [];

  const getTargetWebsites = () => {

    if (selectedWebsite === "all") {
      return COMPANY_WEBSITES[selectedCompany];
    }

    return [selectedWebsite];
  };
  useEffect(() => {
    const saved = localStorage.getItem("districtJson");
    if (saved) {
      const parsed = JSON.parse(saved);

      setJsonData(parsed.data || []);
      setFileName(parsed.fileName || "");
    }
  }, []);
  // JSON Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setFileName(file.name);

    const text = await file.text();

    try {
      const parsed = JSON.parse(text);

      // check array
      if (!Array.isArray(parsed)) {
        alert("JSON Array Required");
        return;
      }

      // state save
      setJsonData(parsed);

      // localStorage save
      localStorage.setItem(
        "districtJson",
        JSON.stringify({
          data: parsed,
          fileName: file.name,
        })
      );

    } catch (err) {
      console.log(err);
      alert("Invalid JSON");
    }
  };

  // Firebase Upload
  const uploadToFirebase = async () => {
    try {
      setLoading(true);

      for (const website of getTargetWebsites()) {

        for (const item of jsonData) {

          const ref = doc(
            db,
            "websites",
            website,
            "districts",
            item.slug
          );

          await setDoc(ref, {
            district: item.district || "",
            slug: item.slug || "",
            state: item.state || "",
            createdAt: serverTimestamp(),
          });

        }

      }

      // Firestore se latest data reload karo
      await loadDistricts();

      // Local preview clear karo
      setJsonData([]);
      setFileName("");

      localStorage.removeItem("districtJson");

      toast.success(
        selectedWebsite === "all"
          ? "Districts uploaded to all websites"
          : "Districts uploaded successfully"
      );

    } catch (err) {
      console.log(err);
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };
  const loadDistricts = async () => {

    if (!selectedWebsite) return;

    try {

      // ALL WEBSITES
      if (selectedWebsite === "all") {

        const allData = [];

        for (const website of COMPANY_WEBSITES[selectedCompany]) {

          const snap = await getDocs(
            collection(
              db,
              "websites",
              website,
              "districts"
            )
          );

          allData.push({
            website,
            districts: snap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
          });
        }

        setAllWebsiteDistricts(allData);

        return;
      }

      // SINGLE WEBSITE
      const snap = await getDocs(
        collection(
          db,
          "websites",
          selectedWebsite,
          "districts"
        )
      );

      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setDistricts(data);

    } catch (err) {

      console.log(err);

    }

  };
  useEffect(() => {
    loadDistricts();
  }, [selectedCompany, selectedWebsite]);

  const pathname = usePathname();
  const pathParts = pathname
    .split("/")
    .filter(Boolean);

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

        <h1 className="heading">
          District Page Admin
        </h1>

      </div>
      <div className="card">

        <h2>Select Website</h2>

        <div
          style={{
            display: "flex",
            gap: "15px",
            marginTop: "15px",
            flexWrap: "wrap"
          }}
        >

          <select
            value={selectedCompany}
            onChange={(e) => {
              setSelectedCompany(e.target.value);
              setSelectedWebsite("");
            }}
          >
            <option value="">
              Please Select Company
            </option>

            <option value="human">
              Human Biomedical
            </option>

            <option value="global">
              Global Biomedical
            </option>

            <option value="rajbiosis">
              RajBiosis
            </option>

          </select>

          {selectedCompany && (

            <select
              value={selectedWebsite}
              onChange={(e) =>
                setSelectedWebsite(e.target.value)
              }
            >

              <option value="">
                Select Website
              </option>

              <option value="all">
                All Websites
              </option>

              {websites.map((site) => (
                <option
                  key={site}
                  value={site}
                >
                  {site}
                </option>
              ))}

            </select>

          )}

        </div>

      </div>
      <div className="districtContainer">

        {/* HEADER */}
        <div className="headerBox">

          <div>
            <h1>District JSON Upload</h1>
            <p>
              Upload JSON file and push district data to Firebase
            </p>
          </div>

          <div className="topButtons">

            <label className="chooseBtn">
              Choose JSON File

              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                hidden
              />
            </label>

            <button
              onClick={uploadToFirebase}
              disabled={
                loading ||
                jsonData.length === 0 ||
                !selectedCompany ||
                !selectedWebsite
              }
              className="uploadBtn"
            >
              {loading
                ? "Uploading..."
                : selectedWebsite === "all"
                  ? "Upload To All Websites"
                  : "Upload Firebase"}
            </button>

          </div>

        </div>

        {/* FILE */}
        {fileName && (
          <div className="fileBox">
            📁 {fileName}
          </div>
        )}

        {/* STATS */}
        <div className="statsGrid">

          <div className="card">
            <span>Target Website</span>
            <p>
              {selectedWebsite || "Please Select Website"}
            </p>
          </div>

          <div className="card">
            <span>Collection</span>
            <p>districts</p>
          </div>

          <div className="card">
            <span>Status</span>
            <p className="green">Ready</p>
          </div>

        </div>

        {/* TABLE */}
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
                    onClick={() =>
                      setOpenWebsite(
                        openWebsite === site.website
                          ? null
                          : site.website
                      )
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "15px"
                    }}
                  >

                    <div

                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        padding: "15px"
                      }}
                    >

                      <h3
                        style={{
                          margin: 0,
                          color: "#4338ca"
                        }}
                      >
                        {site.website}
                      </h3>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px"
                        }}
                      >


                      </div>

                    </div>

                    <span
                      style={{
                        background: "#eef2ff",
                        color: "#4338ca",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: "600"
                      }}
                    >
                      {site.districts.length} Districts
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
                        </tr>
                      </thead>

                      <tbody>

                        {site.districts.map((item, index) => (

                          <tr key={item.id}>

                            <td>{index + 1}</td>

                            <td>{item.district}</td>

                            <td>
                              <span className="slug">
                                {item.slug}
                              </span>
                            </td>

                            <td>{item.state}</td>

                          </tr>

                        ))}

                      </tbody>

                    </table>
                  )}
                </div>

              ))}

            </div>

          ) :
            (

              <>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "15px",
                    padding: "10px 5px"
                  }}
                >

                  <h3
                    style={{
                      margin: 0,
                      color: "#4338ca",
                      fontSize: "22px",
                      fontWeight: "700"
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
                      fontWeight: "600"
                    }}
                  >
                    {(jsonData.length > 0
                      ? jsonData
                      : districts
                    ).length} Districts
                  </span>

                </div>

                <table>

                  <thead>
                    <tr>
                      <th>#</th>
                      <th>District</th>
                      <th>Slug</th>
                      <th>State</th>
                    </tr>
                  </thead>

                  <tbody>

                    {(jsonData.length > 0
                      ? jsonData
                      : districts
                    ).length > 0 ? (

                      (jsonData.length > 0
                        ? jsonData
                        : districts
                      ).map((item, index) => (

                        <tr key={item.id || index}>

                          <td>{index + 1}</td>

                          <td>
                            <strong>
                              {item.district || "-"}
                            </strong>
                          </td>

                          <td>
                            <span className="slug">
                              {item.slug || "-"}
                            </span>
                          </td>

                          <td>
                            {item.state || "-"}
                          </td>

                        </tr>

                      ))

                    ) : (

                      <tr>

                        <td colSpan="4">

                          <div className="emptyBox">

                            <div className="icon">
                              📂
                            </div>

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

            )
          }
        </div>

      </div>


    </div>
  );
}