"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, useUserRole } from "@/lib/auth";
import { auth } from "@/lib/auth";
import Sidebar from "./Sidebar";
import FloatingTaskManager from "./FloatingTaskManager";

export default function LayoutWrapper({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isAdmin, loading: roleLoading } = useUserRole();

    const [authLoading, setAuthLoading] = useState(true);

    const cleanPath = (pathname || "").replace(/\/$/, "");
    const isAuthPage =
        cleanPath === "/login" ||
        cleanPath === "/signup";

    const bypassAuth =
        cleanPath === "/compare";

    // Authentication Guard
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (!authUser && !isAuthPage && !bypassAuth) {
                router.replace("/login");
                return;
            }

            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, [router, isAuthPage, bypassAuth]);

    // Sales Employee Strict Route Lock: Non-admins can ONLY access /products
    useEffect(() => {
        if (roleLoading || isAuthPage || !user) return;

        if (!isAdmin) {
            // Non-admin sales users are strictly locked to /products
            if (!cleanPath.startsWith("/products")) {
                router.replace("/products");
            }
        } else {
            // Admin users restore last visited page on root
            if (pathname === "/") {
                const lastVisited = localStorage.getItem("active_admin_page");
                if (lastVisited && lastVisited !== "/") {
                    router.replace(lastVisited);
                }
            }
        }
    }, [user, isAdmin, roleLoading, cleanPath, pathname, isAuthPage, router]);

    // Save routing history on switch
    useEffect(() => {
        if (!isAuthPage && pathname && pathname !== "/") {
            if (isAdmin) {
                localStorage.setItem("active_admin_page", pathname);
            } else {
                localStorage.setItem("active_admin_page", "/products");
            }
        }
    }, [pathname, isAuthPage, isAdmin]);

    if ((authLoading || roleLoading) && !isAuthPage) {
        return null;
    }

    if (isAuthPage) {
        return children;
    }

    // Do not render non-product content for sales users while redirecting
    if (!isAdmin && !cleanPath.startsWith("/products")) {
        return null;
    }

    return (
        <div className="admin-layout">
            <Sidebar />

            <div className="main-content">
                {children}
            </div>

            {isAdmin && <FloatingTaskManager />}
        </div>
    );
}
