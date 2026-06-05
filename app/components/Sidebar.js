"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWebsite } from "../src/context/WebsiteContext";
import Logo from "@/public/logo.png";

import {
  LayoutDashboard,
  Package,
  Globe,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";

export default function Sidebar() {

  const router = useRouter();

  // const [openWebsites, setOpenWebsites] = useState(false);
  // const [activeSite, setActiveSite] = useState(null);

  const pathname = usePathname();

const [openWebsites, setOpenWebsites] = useState(true);

// current selected website from URL
const currentSite = pathname.split("/")[2] || null;
const currentPage = pathname.split("/")[3] || null;

const [activeSite, setActiveSite] = useState(currentSite);

  const { setActiveWebsite } = useWebsite();

  const sites = [
    "indiandiagnostic",
    "globalbiomedicalsin",
    "globalbiomedicalorg",
    "humanbiomedicalin",
    "humanbiomedicalorg",
    "humanbiomedicalsin",
    "humanbiomedicalsorg",
    "humanbiomedicalscoin",
    "centralbiomedicals",
    "qlyte"
  ];
  const pages = ["home", "contact", "services", "products", "query", "district"];


  useEffect(() => {
  if (currentSite) {
    setActiveSite(currentSite);
    setOpenWebsites(true);
  }
}, [currentSite]);

  return (
    <div className="sidebar">

      {/* Logo */}
      <div className="logo-section">

        <img
          src="/logo.png"
          alt="RBPL Logo"
          className="logo"
          width={81}
          height={70}
        />

        <div>
          <h2>RBPL PANEL</h2>
          <p>Website Management</p>
        </div>

      </div>

      {/* Menu */}
      <ul className="menu">

        <li onClick={() => router.push("/")}>
          <div className="menu-left">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>
        </li>

        <li onClick={() => router.push("/products")}>
          <div className="menu-left">
            <Package size={20} />
            <span>Products</span>
          </div>
        </li>

        {/* Websites */}
        <li
          className="menu-dropdown"
          onClick={() => setOpenWebsites(!openWebsites)}
        >
          <div className="menu-left">
            <Globe size={20} />
            <span>Websites</span>
          </div>

          {openWebsites ? (
            <ChevronDown size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </li>

        {/* Websites List */}
        {openWebsites && (

          <ul className="submenu">

            {sites.map((site) => (

              <div key={site}>

                <li
                  // className="site-item"
                    className={`site-item ${
                      currentSite === site ? "active-site" : ""
                    }`}
                  // onClick={() => {
                  //   setActiveSite(activeSite === site ? null : site);
                  //   setActiveWebsite({ id: site, name: site });
                  // }}
                 onClick={() => {
  setActiveSite(site); // ek hi website open rahegi
  setActiveWebsite({ id: site, name: site });
}}
                >

                  <div className="menu-left">
                    <Globe size={16} />
                    <span>{site}</span>
                  </div>

                  {activeSite === site ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}

                </li>

                {activeSite === site && (

                  <ul className="subsubmenu">

                    {pages.map((page) => (

                      // <li
                      //   key={page}
                      //   className="page-item"
                      //   onClick={() =>
                      //     router.push(`/websites/${site}/${page}`)
                      //   }
                      // >
                      <li
                        key={page}
                        className={`page-item ${
                          currentSite === site && currentPage === page
                            ? "active-page"
                            : ""
                        }`}
                        onClick={() =>
                          router.push(`/websites/${site}/${page}`)
                        }
                      >
                        <FileText size={15} />
                        <span>{page}</span>
                      </li>

                    ))}

                  </ul>

                )}

              </div>

            ))}

          </ul>

        )}

      </ul>
    </div>
  );
}