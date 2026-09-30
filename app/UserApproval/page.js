"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import "./userApproval.css";

export default function UserApprovalPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = async () => {
        try {
            const response = await fetch("/api/local-auth/?op=list", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "Could not load users");
            const data = (result.users || []).map((user) => ({
                ...user,
                id: user.uid,
                status: user.status || "pending",
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
                            <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading && users.length === 0 ? (
                            <tr>
                                <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "#6b7280" }}>
                                    Loading users...
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "#6b7280" }}>
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
        </div>
    );
}