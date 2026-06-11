"use client";

import Link from "next/link";
import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import {
    doc,
    getDoc,
    updateDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaEye, FaEyeSlash } from "react-icons/fa";
export default function LoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const handleLogin = async (e) => {
        e.preventDefault();

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email.trim()) {
            toast.error("Email is required");
            return;
        }

        if (!emailRegex.test(email)) {
            toast.error("Please enter a valid email");
            return;
        }

        if (!password.trim()) {
            toast.error("Password is required");
            return;
        }

        if (password.length < 6) {
            toast.error(
                "Password must be at least 6 characters"
            );
            return;
        }

        try {
            setLoading(true);

            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;

            const userRef = doc(
                db,
                "adminUsers",
                user.uid
            );

            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                toast.error("Account access denied");
                await signOut(auth);
                return;
            }

            const userData = userSnap.data();

            console.log("STATUS =", userData.status);


            if (userData.status === "pending") {
                toast("Waiting for admin approval", {
                    icon: "⌛",
                });

                await signOut(auth);
                return;
            }

            if (userData.status === "rejected") {

                await updateDoc(
                    doc(db, "adminUsers", user.uid),
                    {
                        status: "pending"
                    }
                );

                toast.success(
                    "Approval request sent to admin"
                );

                await signOut(auth);
                return;
            }

            toast.success("Login successful");

            router.push("/");

        } catch (error) {

            if (
                error.code ===
                "auth/invalid-credential"
            ) {
                toast.error(
                    "Invalid email or password"
                );
            } else if (
                error.code ===
                "auth/user-not-found"
            ) {
                toast.error(
                    "User not found"
                );
            } else if (
                error.code ===
                "auth/wrong-password"
            ) {
                toast.error(
                    "Wrong password"
                );
            } else {
                toast.error(
                    "Login failed"
                );
            }

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">



            <form
                className="auth-card"
                onSubmit={handleLogin}
            >
                <div className="logo-wrapper">
                    <img
                        src="/logo.png"
                        alt="RBPL Logo"
                        className="logo"
                        width={110}
                        height={100}
                    />
                </div>

                <h1>Login</h1>

                <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                    required
                />

                <div className="password-field">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        minLength={6}
                        required
                    />

                    <span
                        className="password-toggle"
                        onClick={() =>
                            setShowPassword(!showPassword)
                        }
                    >
                        {showPassword ? (
                            <FaEyeSlash />
                        ) : (
                            <FaEye />
                        )}
                    </span>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Logging In..."
                        : "Login"}
                </button>

                <p>
                    Don't have an account?{" "}
                    <Link href="/signup">
                        Sign Up
                    </Link>
                </p>
            </form>
        </div>
    );
}