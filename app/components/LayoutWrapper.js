"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Sidebar from "./Sidebar";

export default function LayoutWrapper({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    const [loading, setLoading] = useState(true);

    const isAuthPage =
        pathname === "/login" ||
        pathname === "/signup";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {

            if (!user && !isAuthPage) {
                router.replace("/login");
                return;
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [router, isAuthPage]);

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

        </div>
    );
}