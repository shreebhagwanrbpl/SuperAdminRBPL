"use client";
import "./district.css"
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

export default function Page() {
  const WEBSITE = "humanbiomedicalsorg";
  const [jsonData, setJsonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

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

      const batch = writeBatch(db);

      jsonData.forEach((item) => {

        const ref = doc(
          db,
          "websites",
          WEBSITE,
          "districts",
          item.slug
        );

        batch.set(ref, {
          district: item.district || "",
          slug: item.slug || "",
          state: item.state || "",
          createdAt: serverTimestamp(),
        });

      });

      await batch.commit();

      alert("Data Uploaded Successfully");

      localStorage.removeItem("districtJson");

    } catch (err) {
      console.log(err);
      alert("Upload Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="districtPage">

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
              disabled={loading || jsonData.length === 0}
              className="uploadBtn"
            >
              {loading ? "Uploading..." : "Upload Firebase"}
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
            <span>Total Records</span>
            <h2>{jsonData.length}</h2>
          </div>

          <div className="card">
            <span>Collection</span>
            <h2>districts</h2>
          </div>

          <div className="card">
            <span>Status</span>
            <h2 className="green">Ready</h2>
          </div>

        </div>

        {/* TABLE */}
        <div className="tableWrapper">

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

              {jsonData.length > 0 ? (
                jsonData.map((item, index) => (
                  <tr key={index}>

                    <td>{index + 1}</td>

                    <td>
                      <strong>{item.district}</strong>
                    </td>

                    <td>
                      <span className="slug">
                        {item.slug}
                      </span>
                    </td>

                    <td>{item.state}</td>

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
                        No JSON File Uploaded
                      </p>

                    </div>

                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>


    </div>
  );
}