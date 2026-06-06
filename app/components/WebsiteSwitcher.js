// "use client";

// import { usePathname, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import { onAuthStateChanged } from "firebase/auth";
// import { auth } from "@/lib/firebase";
// import Sidebar from "./Sidebar";

// export default function LayoutWrapper({ children }) {
//   const pathname = usePathname();
//   const router = useRouter();

//   const [loading, setLoading] = useState(true);

//   const isAuthPage =
//     pathname === "/login" ||
//     pathname === "/signup";

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(
//       auth,
//       (user) => {
//         if (!isAuthPage && !user) {
//           router.replace("/login");
//           return;
//         }

//         setLoading(false);
//       }
//     );

//     return () => unsubscribe();
//   }, [isAuthPage, router]);

//   if (loading && !isAuthPage) {
//     return null;
//   }

//   if (isAuthPage) {
//     return children;
//   }

//   return (
//     <div className="admin-layout">
//       <Sidebar />

//       <div className="main-content">
//         {children}
//       </div>
//     </div>
//   );
// }
"use client";
import { websites } from "../data/dummyData";
import { useWebsite } from "../src/context/WebsiteContext";

export default function WebsiteSwitcher() {
  const { activeWebsite, setActiveWebsite } = useWebsite();

  return (
    <select
      className="border px-3 py-2 rounded"
      onChange={(e) =>
        setActiveWebsite(
          websites.find((w) => w.id === e.target.value)
        )
      }
    >
      <option>Select Website</option>
      {websites.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}