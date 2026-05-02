"use client";

import Sidebar from "./components/Sidebar";
import WebsiteSwitcher from "./components/WebsiteSwitcher";
import { useWebsite } from "./src/context/WebsiteContext";

export default function Home() {
  const { activeWebsite } = useWebsite();

  return (
    <div className="flex">

      <Sidebar />

      <div className="main">

        {/* TOP BAR */}
        <div className="topbar">
          <h1 className="text-3xl font-bold text-gray-800">
            Dashboard
          </h1>

          <WebsiteSwitcher />
        </div>

        {!activeWebsite ? (
          <div className="empty-box">
            <p className="text-gray-500">
              👆 Please select a website to continue
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-6 text-gray-700">
              {activeWebsite.name} Overview
            </h2>

            {/* CARDS */}
            <div className="card-grid">

              <div className="card">
                <p className="card-title">Products</p>
                <h3 className="card-value">120</h3>
              </div>

              <div className="card">
                <p className="text-gray-500">Orders</p>
                <h3 className="text-3xl font-bold">56</h3>
              </div>

              <div className="card">
                <p className="text-gray-500">Revenue</p>
                <h3 className="text-3xl font-bold">₹2.5L</h3>
              </div>

            </div>
          </>
        )}

      </div>
      {/* <style jsx>{`
  .main {
    margin-left: 260px;
    padding: 30px;
    min-height: 100vh;
    background: #f5f7fb;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .card {
    background: #fff;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.05);
    transition: 0.3s;
  }

  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(0,0,0,0.08);
  }

  .card-title {
    color: #6b7280;
    font-size: 14px;
  }

  .card-value {
    font-size: 28px;
    font-weight: 700;
    margin-top: 5px;
  }

  .empty-box {
    background: #fff;
    padding: 25px;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 8px 25px rgba(0,0,0,0.05);
    color: #6b7280;
  }
`}</style> */}
    </div>
  );
}