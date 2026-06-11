"use client";
import Modal from "react-modal";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { serverTimestamp } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,

} from "firebase/firestore";
import toast from "react-hot-toast";
import "./userApproval.css";

export default function UserApprovalPage() {
    const [users, setUsers] = useState([]);
    const [deleteId, setDeleteId] = useState(null);
    useEffect(() => {
        Modal.setAppElement("body");
    }, []);
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "adminUsers"),
            (snapshot) => {

                const data = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }))
                    .sort((a, b) => {

                        const aTime =
                            a.createdAt?.seconds || 0;

                        const bTime =
                            b.createdAt?.seconds || 0;

                        return bTime - aTime; // latest first
                    });

                setUsers(data);
            }
        );

        return () => unsub();
    }, []);

    const approveUser = async (id) => {
        try {
            await updateDoc(doc(db, "adminUsers", id), {
                status: "approved",
            });
            console.log("Approved User ID:", id);
            toast.success("User approved successfully");
        } catch (error) {
            console.error(error);
            toast.error("Approval failed");
        }
    };

    const rejectUser = async (id) => {
        try {
            await updateDoc(doc(db, "adminUsers", id), {
                status: "rejected",
            });

            toast.success("User Disabled");
        } catch (error) {
            console.error(error);
            toast.error("Reject failed");
        }
    };


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
                                <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
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
                                        {user.createdAt?.toDate ? (
                                            <div className="date-time">
                                                <div className="date">
                                                    {user.createdAt
                                                        .toDate()
                                                        .toLocaleDateString("en-IN")}
                                                </div>

                                                <div className="time">
                                                    {user.createdAt
                                                        .toDate()
                                                        .toLocaleTimeString(
                                                            "en-IN",
                                                            {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                                hour12: true,
                                                            }
                                                        )}
                                                </div>
                                            </div>
                                        ) : (
                                            "-"
                                        )}
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