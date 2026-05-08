"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function Page() {
  const [jsonData, setJsonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  // JSON Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setFileName(file.name);

    const text = await file.text();

    try {
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        alert("JSON Array Required");
        return;
      }

      setJsonData(parsed);
    } catch (err) {
      console.log(err);
      alert("Invalid JSON");
    }
  };

  // Firebase Upload
  const uploadToFirebase = async () => {
    try {
      setLoading(true);

      for (const item of jsonData) {

        // document id = district slug
        await setDoc(
          doc(db, "districts", item.slug),
          {
            district: item.district || "",
            slug: item.slug || "",
            state: item.state || "",
            createdAt: serverTimestamp(),
          }
        );
      }

      alert("Data Uploaded Successfully");
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

      {/* CSS */}
      <style>{`

        .districtPage{
          width:100%;
          padding:30px;
          background:#f1f5f9;
          min-height:100vh;
          margin-left: 5px;
        }

        .districtContainer{
          width:100%;
          background:white;
          border-radius:20px;
          padding:30px;
          box-shadow:0 10px 40px rgba(0,0,0,0.08);
        }

        .headerBox{
          display:flex;
          justify-content:space-between;
          align-items:center;
          flex-wrap:wrap;
          gap:20px;
          margin-bottom:25px;
        }

        .headerBox h1{
          font-size:38px;
          color:#111827;
          margin:0;
          font-weight:700;
        }

        .headerBox p{
          margin-top:8px;
          color:#64748b;
          font-size:16px;
        }

        .topButtons{
          display:flex;
          gap:15px;
          flex-wrap:wrap;
        }

        .chooseBtn{
          background:linear-gradient(135deg,#4f46e5,#7c3aed);
          color:white;
          padding:14px 24px;
          border-radius:12px;
          cursor:pointer;
          font-weight:600;
          transition:0.3s;
        }

        .chooseBtn:hover{
          transform:translateY(-2px);
        }

        .uploadBtn{
          background:#16a34a;
          color:white;
          border:none;
          padding:14px 24px;
          border-radius:12px;
          cursor:pointer;
          font-weight:600;
        }

        .uploadBtn:disabled{
          opacity:0.5;
          cursor:not-allowed;
        }

        .fileBox{
          background:#eef2ff;
          color:#4338ca;
          padding:14px 18px;
          border-radius:12px;
          margin-bottom:25px;
          font-weight:600;
        }

        .statsGrid{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:20px;
          margin-bottom:30px;
        }

        .card{
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:18px;
          padding:25px;
        }

        .card span{
          color:#64748b;
          font-size:14px;
        }

        .card h2{
          margin-top:10px;
          font-size:32px;
          color:#111827;
        }

        .green{
          color:#16a34a !important;
        }

        .tableWrapper{
          overflow:auto;
          border-radius:18px;
          border:1px solid #e2e8f0;
        }

        table{
          width:100%;
          border-collapse:collapse;
          min-width:900px;
        }

        thead{
          background:linear-gradient(135deg,#4f46e5,#6366f1);
        }

        th{
          color:white;
          padding:18px;
          text-align:left;
          font-size:15px;
        }

        td{
          padding:18px;
          border-bottom:1px solid #e2e8f0;
          color:#334155;
        }

        tbody tr:hover{
          background:#f8fafc;
        }

        .slug{
          background:#eef2ff;
          color:#4338ca;
          padding:8px 14px;
          border-radius:50px;
          font-size:13px;
          font-weight:600;
        }

        .emptyBox{
          padding:80px 20px;
          text-align:center;
        }

        .icon{
          font-size:70px;
          margin-bottom:15px;
        }

        .emptyBox p{
          font-size:22px;
          color:#64748b;
          font-weight:600;
        }

        @media(max-width:768px){

          .districtPage{
            padding:15px;
          }

          .districtContainer{
            padding:20px;
          }

          .headerBox{
            flex-direction:column;
            align-items:flex-start;
          }

          .headerBox h1{
            font-size:28px;
          }

          .statsGrid{
            grid-template-columns:1fr;
          }

          .topButtons{
            width:100%;
          }

          .chooseBtn,
          .uploadBtn{
            width:100%;
            text-align:center;
          }

        }

      `}</style>

    </div>
  );
}