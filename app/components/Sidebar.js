"use client";
// import { LayoutDashboard, Package, Globe } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWebsite } from "../src/context/WebsiteContext";

export default function Sidebar() {
  const router = useRouter();

  const [openWebsites, setOpenWebsites] = useState(false);
  const [activeSite, setActiveSite] = useState(null);
  const { setActiveWebsite } = useWebsite();
  const sites = ["indiandiagnostic","RbplWebThree", "RbplWebEight"];

  const pages = ["home", "contact", "services", "products","query"];

  return (
    <div className="sidebar">
      <h2 className="title">Admin Panel</h2>

      <ul className="menu">

        <li onClick={() => router.push("/")}>
          {/* <LayoutDashboard size={18} /> */}
          <span>Dashboard</span>
        </li>

        <li onClick={() => router.push("/products")}>
          {/* <Package size={18} /> */}
          <span>Products</span>
        </li>

        {/* Websites */}
        <li onClick={() => setOpenWebsites(!openWebsites)}>
          {/* <Globe size={18} /> */}
          <span>Websites</span>
        </li>

        {openWebsites && (
          <ul className="submenu">

            {sites.map((site) => (
              <div key={site}>
                {/* <li onClick={() => setActiveSite(activeSite === site ? null : site)}> */}
                <li
  onClick={() => {
    setActiveSite(activeSite === site ? null : site);
    setActiveWebsite({ id: site, name: site });
  }}
>
                  {site}
                </li>

                {activeSite === site && (
                  <ul className="subsubmenu">
                    {pages.map((page) => (
                      <li
                        key={page}
                        onClick={() =>
                          router.push(`/websites/${site}/${page}`)
                        }
                      >
                        {page}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          </ul>
        )}

      </ul>

      {/* <style jsx>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          background: #fff;
          border-right: 1px solid #e5e7eb;
          padding: 24px;
          position: fixed;
        }

        .menu li {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px;
          cursor: pointer;
          border-radius: 10px;
        }

        .menu li:hover {
          background: #f1f5ff;
        }

        .submenu {
          list-style: none;
          padding-left: 20px;
        }

        .subsubmenu {
          list-style: none;
          padding-left: 20px;
        }

        .subsubmenu li {
          font-size: 13px;
          padding: 6px;
        }

        .subsubmenu li:hover {
          color: #2563eb;
        }
      `}</style> */}
    </div>
  );
}