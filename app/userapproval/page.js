"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FolderOpen, X, Search, ShieldCheck } from "lucide-react";
import { fetchCompanyCategories } from "@/lib/companyCatalog";
import { useUserRole } from "@/lib/auth";
import "./userApproval.css";

function formatCategoryTitle(cat) {
    if (cat.name && typeof cat.name === "string" && cat.name.trim()) return cat.name.trim();
    if (cat.category && typeof cat.category === "string" && cat.category.trim()) return cat.category.trim();
    const id = cat.id || "";
    return id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function UserApprovalPage() {
    const router = useRouter();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Route Protection: Non-admin sales employees cannot access User Approval
    useEffect(() => {
        if (!roleLoading && !isAdmin) {
            router.replace("/products");
        }
    }, [isAdmin, roleLoading, router]);

    // Category assignment state
    const [allCategories, setAllCategories] = useState([]);
    const [categoryModalUser, setCategoryModalUser] = useState(null);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [categorySearchQuery, setCategorySearchQuery] = useState("");
    const [savingCategories, setSavingCategories] = useState(false);

    const loadUsers = async () => {
        try {
            const response = await fetch("/api/local-auth/?op=list", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "Could not load users");
            const data = (result.users || []).map((user) => ({
                ...user,
                id: user.uid,
                status: user.status || "pending",
                assignedCategories: Array.isArray(user.assignedCategories) ? user.assignedCategories : [],
            })).sort((a, b) => {
                const aTime = Date.parse(a.createdAt || "") || 0;
                const bTime = Date.parse(b.createdAt || "") || 0;
                return bTime - aTime;
            });
            setUsers(data);
        } catch (error) {
            console.error("Unable to load approval requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
        const timer = setInterval(loadUsers, 4000);
        return () => clearInterval(timer);
    }, []);

    // Load RajBiosis master categories for assignment
    useEffect(() => {
        const loadCategoriesList = async () => {
            try {
                const cats = await fetchCompanyCategories("rajbiosis", false);
                if (Array.isArray(cats) && cats.length > 0) {
                    setAllCategories(cats.map((c) => ({
                        id: c.id,
                        name: formatCategoryTitle(c),
                        slug: c.slug || c.id,
                    })));
                } else {
                    const res = await fetch("/api/db?op=collection&path=companies/rajbiosis/categories");
                    if (res.ok) {
                        const json = await res.json();
                        const rows = json.data || json.rows || [];
                        setAllCategories(rows.map((r) => ({
                            id: r.id || r.doc_id,
                            name: formatCategoryTitle(r.data || r),
                            slug: r.data?.slug || r.id,
                        })));
                    }
                }
            } catch (err) {
                console.error("Failed to load categories for assignment:", err);
            }
        };
        loadCategoriesList();
    }, []);

    const updateUserStatus = async (id, status) => {
        try {
            const response = await fetch("/api/local-auth/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ op: "updateStatus", uid: id, status }),
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "Status update failed");
            setUsers((current) => current.map((user) =>
                user.id === id ? { ...user, status } : user
            ));
            toast.success(status === "approved" ? "User approved successfully" : status === "rejected" ? "User rejected" : "Approval status updated");
            await loadUsers();
        } catch (error) {
            console.error("Approval status update failed:", error);
            toast.error(error.message || "Approval update failed");
        }
    };

    const deleteUser = async (id, email) => {
        if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
        try {
            const response = await fetch("/api/local-auth/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ op: "deleteUser", uid: id }),
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "Delete failed");
            toast.success("User deleted successfully");
            await loadUsers();
        } catch (error) {
            console.error("Delete user failed:", error);
            toast.error(error.message || "Delete failed");
        }
    };

    const cleanupDatabase = async () => {
        if (!confirm("Are you sure you want to keep only rajbiosis12@gmail.com and delete all other users?")) return;
        try {
            const response = await fetch("/api/local-auth/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ op: "cleanupToAdminOnly" }),
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "Cleanup failed");
            toast.success("Cleanup complete! Only SuperAdmin kept.");
            await loadUsers();
        } catch (error) {
            console.error("Cleanup failed:", error);
            toast.error(error.message || "Cleanup failed");
        }
    };

    const approveUser = (id) => updateUserStatus(id, "approved");
    const rejectUser = (id) => updateUserStatus(id, "rejected");

    // Open Category Assignment Modal
    const handleOpenCategoryModal = (user) => {
        setCategoryModalUser(user);
        setSelectedCategoryIds(Array.isArray(user.assignedCategories) ? [...user.assignedCategories] : []);
        setCategorySearchQuery("");
    };

    // Map of categories already assigned to other sales employees
    const categoriesAssignedToOthersMap = useMemo(() => {
        const map = new Map();
        if (!categoryModalUser) return map;

        users.forEach((u) => {
            // Ignore the user currently being edited, and ignore Admins
            if (u.id === categoryModalUser.id) return;
            if (u.role === "Admin" || u.email?.toLowerCase() === "rajbiosis12@gmail.com") return;

            const assigned = Array.isArray(u.assignedCategories) ? u.assignedCategories : [];
            assigned.forEach((catId) => {
                const cleanId = String(catId).trim().toLowerCase();
                if (cleanId) {
                    map.set(cleanId, {
                        userId: u.id,
                        name: u.fullName || u.email.split("@")[0],
                        email: u.email,
                    });
                }
            });
        });

        return map;
    }, [users, categoryModalUser]);

    // Toggle Category in Modal
    const toggleCategorySelection = (catId, catName) => {
        const cleanId = String(catId).trim().toLowerCase();
        const otherAssignment = categoriesAssignedToOthersMap.get(cleanId);
        if (otherAssignment) {
            toast.error(`"${catName || catId}" is already assigned to ${otherAssignment.name}`);
            return;
        }

        setSelectedCategoryIds((prev) =>
            prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
        );
    };

    // Filter categories list based on search query
    const filteredCategoriesList = useMemo(() => {
        if (!categorySearchQuery.trim()) return allCategories;
        const q = categorySearchQuery.trim().toLowerCase();
        return allCategories.filter((c) =>
            c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
        );
    }, [allCategories, categorySearchQuery]);

    // Available categories that can be assigned (not taken by another employee)
    const availableCategoriesInFilter = useMemo(() => {
        return filteredCategoriesList.filter(
            (c) => !categoriesAssignedToOthersMap.has(String(c.id).trim().toLowerCase())
        );
    }, [filteredCategoriesList, categoriesAssignedToOthersMap]);

    const handleSelectAllCategories = () => {
        const ids = availableCategoriesInFilter.map((c) => c.id);
        setSelectedCategoryIds((prev) => Array.from(new Set([...prev, ...ids])));
    };

    const handleClearAllCategories = () => {
        if (categorySearchQuery.trim()) {
            const idsToRemove = new Set(filteredCategoriesList.map((c) => c.id));
            setSelectedCategoryIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
        } else {
            setSelectedCategoryIds([]);
        }
    };

    // Save assigned categories
    const handleSaveAssignedCategories = async () => {
        if (!categoryModalUser) return;
        setSavingCategories(true);
        try {
            const res = await fetch("/api/local-auth/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    op: "updateAssignedCategories",
                    uid: categoryModalUser.id,
                    assignedCategories: selectedCategoryIds,
                }),
            });
            const result = await res.json();
            if (!res.ok || !result.ok) throw new Error(result.error || "Failed to update assigned categories");

            toast.success(`Assigned categories updated for ${categoryModalUser.fullName || categoryModalUser.email}`);

            // Optimistically update local users state
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === categoryModalUser.id ? { ...u, assignedCategories: selectedCategoryIds } : u
                )
            );

            setCategoryModalUser(null);
            await loadUsers();
        } catch (err) {
            console.error("Failed to update assigned categories:", err);
            toast.error(err.message || "Failed to save assigned categories");
        } finally {
            setSavingCategories(false);
        }
    };

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="user-approval">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h1 style={{ margin: 0 }}>User Approval Management</h1>
                <button
                    onClick={cleanupDatabase}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "13px"
                    }}
                >
                    Cleanup Extra Users (Keep Admin Only)
                </button>
            </div>

            <div className="user-table-wrapper">
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>S.R.</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Designation</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Assigned Categories</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading && users.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ textAlign: "center", padding: "30px", color: "#6b7280" }}>
                                    Loading users...
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ textAlign: "center", padding: "30px", color: "#6b7280" }}>
                                    No Users Found
                                </td>
                            </tr>
                        ) : (
                            users.map((user, index) => (
                                <tr key={user.id}>
                                    <td>{index + 1}</td>

                                    <td style={{ fontWeight: 600 }}>{user.fullName || "-"}</td>

                                    <td>{user.role || "-"}</td>

                                    <td>{user.designation || "-"}</td>

                                    <td>{user.email}</td>

                                    <td>{user.phone || "-"}</td>

                                    <td>
                                        {user.createdAt ? (
                                            <div className="date-time">
                                                <div className="date">
                                                    {(user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt)).toLocaleDateString("en-IN")}
                                                </div>
                                                <div className="time">
                                                    {(user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                                </div>
                                            </div>
                                        ) : "-"}
                                    </td>
                                    <td>
                                        <span className={`status ${user.status}`}>
                                            {user.status}
                                        </span>
                                    </td>

                                    {/* Assigned Categories for Sales Users */}
                                    <td>
                                        {user.role === "Admin" || user.email.toLowerCase() === "rajbiosis12@gmail.com" ? (
                                            <span className="cat-all-badge" title="Super Admin has full access to all categories">
                                                <ShieldCheck size={14} /> Full Access (All)
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className={`cat-assign-btn ${user.assignedCategories?.length > 0 ? "has-cats" : ""}`}
                                                onClick={() => handleOpenCategoryModal(user)}
                                                title="Click to assign or modify category access for this user"
                                            >
                                                <FolderOpen size={14} />
                                                <span>
                                                    {user.assignedCategories?.length > 0
                                                        ? `${user.assignedCategories.length} Categories`
                                                        : "Assign Categories"}
                                                </span>
                                            </button>
                                        )}
                                    </td>

                                    <td>
                                        <div className="action-btns" style={{ gap: "8px" }}>
                                            {user.status === "approved" ? (
                                                <button
                                                    className="reject-btn"
                                                    onClick={() => rejectUser(user.id)}
                                                    title="Revoke / Disable User"
                                                >
                                                    Disable
                                                </button>
                                            ) : (
                                                <button
                                                    className="approve-btn"
                                                    onClick={() => approveUser(user.id)}
                                                    title="Approve User"
                                                >
                                                    Approve
                                                </button>
                                            )}

                                            {user.email.toLowerCase() !== "rajbiosis12@gmail.com" && (
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => deleteUser(user.id, user.email)}
                                                    title="Delete User"
                                                    style={{ padding: "8px 12px", fontSize: "13px" }}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Category Assignment Modal */}
            {categoryModalUser && (
                <div className="cat-modal-overlay" onClick={() => !savingCategories && setCategoryModalUser(null)}>
                    <div className="cat-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="cat-modal-header">
                            <div>
                                <h2 className="cat-modal-title">
                                    <FolderOpen size={20} color="#2563eb" />
                                    Assign Categories
                                </h2>
                                <div className="cat-modal-subtitle">
                                    {categoryModalUser.fullName || categoryModalUser.email} &bull; <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{categoryModalUser.role || "Sales Employee"}</span> ({categoryModalUser.email})
                                </div>
                            </div>
                            <button
                                type="button"
                                className="cat-modal-close"
                                onClick={() => !savingCategories && setCategoryModalUser(null)}
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="cat-modal-search-bar">
                            <input
                                type="text"
                                className="cat-modal-search-input"
                                placeholder="🔍 Search categories by name or id..."
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="cat-modal-quick-actions">
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    type="button"
                                    className="cat-quick-btn"
                                    onClick={handleSelectAllCategories}
                                    title="Select all categories not assigned to any other employee"
                                >
                                    Select All Available ({availableCategoriesInFilter.length})
                                </button>
                                <button
                                    type="button"
                                    className="cat-quick-btn"
                                    onClick={handleClearAllCategories}
                                >
                                    Clear
                                </button>
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
                                {selectedCategoryIds.length} Selected
                            </span>
                        </div>

                        <div className="cat-modal-list">
                            {filteredCategoriesList.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "30px", color: "#64748b", fontSize: "13px" }}>
                                    No categories found matching &quot;{categorySearchQuery}&quot;
                                </div>
                            ) : (
                                filteredCategoriesList.map((cat) => {
                                    const cleanId = String(cat.id).trim().toLowerCase();
                                    const otherAssigned = categoriesAssignedToOthersMap.get(cleanId);
                                    const isChecked = selectedCategoryIds.includes(cat.id);

                                    return (
                                        <div
                                            key={cat.id}
                                            className={`cat-modal-item ${isChecked ? "selected" : ""} ${otherAssigned ? "assigned-to-other" : ""}`}
                                            onClick={() => toggleCategorySelection(cat.id, cat.name)}
                                            title={otherAssigned ? `Already assigned to ${otherAssigned.name} (${otherAssigned.email})` : `Click to toggle ${cat.name}`}
                                        >
                                            <div className="cat-modal-item-left">
                                                <input
                                                    type="checkbox"
                                                    className="cat-modal-item-checkbox"
                                                    checked={isChecked}
                                                    disabled={Boolean(otherAssigned)}
                                                    onChange={() => toggleCategorySelection(cat.id, cat.name)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="cat-modal-item-name" style={{ color: otherAssigned ? "#64748b" : "#1e293b" }}>
                                                    {cat.name}
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                {otherAssigned && (
                                                    <span className="cat-assigned-other-badge" title={`Assigned to ${otherAssigned.name} (${otherAssigned.email})`}>
                                                        👤 Assigned: {otherAssigned.name}
                                                    </span>
                                                )}
                                                <span className="cat-modal-item-slug">{cat.id}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="cat-modal-footer">
                            <span className="cat-modal-footer-info">
                                Only assigned categories will be visible to this user.
                            </span>
                            <div className="cat-modal-footer-btns">
                                <button
                                    type="button"
                                    className="cat-modal-cancel-btn"
                                    onClick={() => setCategoryModalUser(null)}
                                    disabled={savingCategories}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="cat-modal-save-btn"
                                    onClick={handleSaveAssignedCategories}
                                    disabled={savingCategories}
                                >
                                    {savingCategories ? "Saving..." : "Save Assigned Categories"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
