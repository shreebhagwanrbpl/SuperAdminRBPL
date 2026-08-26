"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useWebsite } from "../src/context/WebsiteContext";
import Logo from "@/public/logo.png";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import Modal from "react-modal";
import {
  LayoutDashboard,
  Home,
  Bot,
  Phone,
  MapPinned,
  Package,
  BriefcaseBusiness,
  MessageSquareText,
  UserCheck,
  GitCompareArrows,
} from "lucide-react";
import { FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
// import {
//   LayoutDashboard,
//   Package,
//   Globe,
//   ChevronDown,
//   ChevronRight,
//   FileText,
// } from "lucide-react";

export default function Sidebar() {

  const router = useRouter();
  const pathname = usePathname();
  const currentRootPage = pathname.split("/")[1]?.toLowerCase();
  const [openWebsites, setOpenWebsites] = useState(true);
  // current selected website from URL
  const currentSite = pathname.split("/")[2] || null;
  const currentPage = pathname.split("/")[3] || null;
  const [activeSite, setActiveSite] = useState(currentSite);
  const { setActiveWebsite } = useWebsite();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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
  // const pages = ["home", "contact", "services", "products", "query", "district"];

  const handleLogout = async () => {
    try {
      await signOut(auth);

      toast.success("Logged out successfully");

      router.push("/login");
    } catch (error) {
      toast.error("Logout failed");
    }
  };
  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  useEffect(() => {
    if (currentSite) {
      setActiveSite(currentSite);
      setOpenWebsites(true);
    }
  }, [currentSite]);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const userSnap = await getDoc(
          doc(db, "adminUsers", user.uid)
        );

        if (userSnap.exists()) {
          setUserData(userSnap.data());
        }
      } catch (error) {
        console.log(error);
      }
    });

    return () => unsubscribe();
  }, []);
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

        <li
          className={
            pathname === "/"
              ? "active-menu"
              : ""
          }
          onClick={() => router.push("/")}
        >
          <div className="menu-left">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>
        </li>

        <li
          className={currentRootPage === "home" ? "active-menu" : ""}
          onClick={() => router.push("/home")}
        >
          <div className="menu-left">
            <Home size={20} />
            <span>Home</span>
          </div>
        </li>

        <li
          className={currentRootPage === "contact" ? "active-menu" : ""}
          onClick={() => router.push("/contact")}
        >
          <div className="menu-left">
            <Phone size={20} />
            <span>Contact</span>
          </div>
        </li>
        <li
          className={currentRootPage === "district" ? "active-menu" : ""}
          onClick={() => router.push("/district")}
        >
          <div className="menu-left">
            <MapPinned size={20} />
            <span>District</span>
          </div>
        </li>

        <li
          className={currentRootPage === "products" ? "active-menu" : ""}
          onClick={() => router.push("/products")}
        >
          <div className="menu-left">
            <Package size={20} />
            <span>Products</span>
          </div>
        </li>

        <li
          className={currentRootPage === "services" ? "active-menu" : ""}
          onClick={() => router.push("/services")}
        >
          <div className="menu-left">
            <BriefcaseBusiness size={20} />
            <span>Services</span>
          </div>
        </li>

        <li
          className={currentRootPage === "queries" ? "active-menu" : ""}
          onClick={() => router.push("/queries")}
        >
          <div className="menu-left">
            <MessageSquareText size={20} />
            <span>Queries</span>
          </div>
        </li>
        <li
          className={currentRootPage === "compare" ? "active-menu" : ""}
          onClick={() => router.push("/compare")}
        >
          <div className="menu-left">
            <GitCompareArrows size={20} />
            <span>Compare</span>
          </div>
        </li>

        <li
          className={currentRootPage === "ai" ? "active-menu" : ""}
          onClick={() => router.push("/ai")}
        >
          <div className="menu-left">
            <Bot size={20} />
            <span>AI Assistant</span>
          </div>
        </li>
        <li
          className={currentRootPage === "userapproval" ? "active-menu" : ""}
          onClick={() => router.push("/userapproval")}
        >
          <div className="menu-left">
            <UserCheck size={20} />
            <span>User Approval</span>
          </div>
        </li>

        {/* Websites */}
        {/* <li
          className={`menu-dropdown ${currentRootPage === "websites" ? "active-menu" : ""}`}
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
        </li> */}

        {/* {openWebsites && (

          <ul className="submenu">

            {sites.map((site) => (

              <div key={site}>

                <li
                  className={`site-item ${currentSite === site ? "active-site" : ""
                    }`}
                  onClick={() => {
                    setActiveSite(site);
                    setActiveWebsite({
                      id: site,
                      name: site
                    });
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

                      <li
                        key={page}
                        className={`page-item ${currentSite === site &&
                          currentPage === page
                          ? "active-page"
                          : ""
                          }`}
                        onClick={() =>
                          router.push(
                            `/websites/${site}/${page}`
                          )
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

        )} */}

      </ul>
      <div className="sidebar-footer">

        <div
          className="user-info"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <div className="user-avatar">
            {userData?.fullName
              ? userData.fullName
                .trim()
                .split(" ")
                .filter(Boolean)
                .map(word => word[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
              : ""}
          </div>

          <div>
            <h4>{userData?.fullName}</h4>
            <p>{userData?.email}</p>
            <p>{userData?.role}</p>
          </div>
        </div>

        <button
          className="logout-btn"
          onClick={() => setShowLogoutModal(true)}
        >
          <FaSignOutAlt />
          Logout
        </button>

      </div>

      <Modal
        isOpen={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
        className="modal-box"
        overlayClassName="modal-overlay"
      >
        <h2>Logout?</h2>

        <p>
          Are you sure you want to logout?
        </p>

        <div className="modal-actions">
          <button
            className="cancel-btn"
            onClick={() => setShowLogoutModal(false)}
          >
            Cancel
          </button>

          <button
            className="confirm-btn"
            onClick={async () => {
              setShowLogoutModal(false);
              await handleLogout();
            }}
          >
            Yes, Logout
          </button>
        </div>
      </Modal>
    </div>
  );
}