"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Sidebar from "./Sidebar";
import FloatingTaskManager from "./FloatingTaskManager";

export default function LayoutWrapper({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    const [loading, setLoading] = useState(true);

    const cleanPath = (pathname || "").replace(/\/$/, "");
    const isAuthPage =
        cleanPath === "/login" ||
        cleanPath === "/signup";

    const bypassAuth =
        cleanPath === "/compare";

    // Restore last visited route on root load
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user && !isAuthPage && !bypassAuth) {
                router.replace("/login");
                return;
            }

            if (user && pathname === "/") {
                const lastVisited = localStorage.getItem("active_admin_page");
                if (lastVisited && lastVisited !== "/") {
                    router.replace(lastVisited);
                    return;
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [router, isAuthPage, pathname]);

    // Save routing history on switch
    useEffect(() => {
        if (!isAuthPage && pathname && pathname !== "/") {
            localStorage.setItem("active_admin_page", pathname);
        }
    }, [pathname, isAuthPage]);

    if (loading && !isAuthPage) {
        return null;
    }

    if (isAuthPage) {
        return children;
    }

    return (
        <div className="admin-layout">

            <Sidebar />

            <div className="main-content">
                {children}
            </div>

            <FloatingTaskManager />

        </div>
    );
}