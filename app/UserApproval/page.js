"use client";
import Modal from "react-modal";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import "./userApproval.css";

export default function UserApprovalPage() {
    const [users, setUsers] = useState([]);
    const [deleteId, setDeleteId] = useState(null);
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);
    const loadUsers = async () => {
        try {
            const response = await fetch("/api/local-auth?op=list", { cache: "no-store" });
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
            toast.error("Users load nahi hue. Please refresh karein.");
        }
    };

    useEffect(() => {
        Modal.setAppElement("body");
        loadUsers();
        const timer = setInterval(loadUsers, 5000);
        return () => clearInterval(timer);
    }, []);

    const updateUserStatus = async (id, status) => {
        try {
            const response = await fetch("/api/local-auth", {
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

    const approveUser = (id) => updateUserStatus(id, "approved");
    const rejectUser = (id) => updateUserStatus(id, "rejected");


    return (
        <div className="user-approval">
            <h1>User Approval Management</h1>

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
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="9" style={{ textAlign: "center", padding: "20px" }}>
                                    No Users Found
                                </td>
                            </tr>
                        ) : (
                            users.map((user, index) => (
                                <tr key={user.id}>
                                    <td>{index + 1}</td>

                                    <td>{user.fullName}</td>

                                    <td>{user.role}</td>

                                    <td>{user.designation}</td>

                                    <td>{user.email}</td>

                                    <td>{user.phone}</td>

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
                                        <div className="action-btns">
                                            <button
                                                className={
                                                    user.status === "approved"
                                                        ? "reject-btn"
                                                        : "approve-btn"
                                                }
                                                onClick={() =>
                                                    user.status === "approved"
                                                        ? rejectUser(user.id)
                                                        : approveUser(user.id)
                                                }
                                            >
                                                {user.status === "approved"
                                                    ? "Disable"
                                                    : "Approve"}
                                            </button>
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