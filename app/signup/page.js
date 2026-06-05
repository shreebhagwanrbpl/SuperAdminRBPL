"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { FaEye, FaEyeSlash } from "react-icons/fa";
export default function SignupPage() {
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState("");
    const [designation, setDesignation] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const handleSignup = async (e) => {
        e.preventDefault();

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!fullName.trim()) {
            toast.error("Full Name is required");
            return;
        }

        if (!role) {
            toast.error("Please select role");
            return;
        }

        if (!designation) {
            toast.error("Please select designation");
            return;
        }

        if (!emailRegex.test(email)) {
            toast.error("Please enter valid email");
            return;
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            toast.error("Phone number must be exactly 10 digits");
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
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;

            await setDoc(doc(db, "adminUsers", user.uid), {
                uid: user.uid,
                fullName,
                role,
                designation,
                email,
                phone,
                status: "pending",
                createdAt: new Date(),
            });

            toast.success("Account created successfully");

            setFullName("");
            setRole("");
            setDesignation("");
            setEmail("");
            setPhone("");
            setPassword("");

            setTimeout(() => {
                router.push("/login");
            }, 1500);

        } catch (error) {

            if (
                error.code ===
                "auth/email-already-in-use"
            ) {
                toast.error(
                    "Email already registered"
                );
            }
            else if (
                error.code ===
                "auth/weak-password"
            ) {
                toast.error(
                    "Password must be at least 6 characters"
                );
            }
            else if (
                error.code ===
                "auth/invalid-email"
            ) {
                toast.error(
                    "Invalid email address"
                );
            }
            else {
                toast.error(
                    "Registration failed"
                );
            }

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-card" onSubmit={handleSignup}>
                <div className="logo-wrapper">
                    <img
                        src="/logo.png"
                        alt="RBPL Logo"
                        className="logo"
                        width={100}
                        height={90}
                    />
                </div>
                <h1>Create Account</h1>

                <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                />

                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                >
                    <option value="">Select Role</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Sales">Sales</option>
                    <option value="Support">Support</option>
                    <option value="Employee">Employee</option>
                </select>

                <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    required
                >
                    <option value="">Select Designation</option>

                    <option value="IT">IT</option>
                    <option value="Manager">Manager</option>
                    <option value="HR">HR</option>
                    <option value="Sales Executive">Sales Executive</option>
                    <option value="Support Executive">Support Executive</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Marketing Executive">Marketing Executive</option>
                    <option value="Team Leader">Team Leader</option>
                </select>

                <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    type="tel"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) =>
                        setPhone(
                            e.target.value.replace(/\D/g, "")
                        )
                    }
                    maxLength={10}
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
                    {loading ? "Creating..." : "Sign Up"}
                </button>

                <p>
                    Already have an account?{" "}
                    <Link href="/login">
                        Login
                    </Link>
                </p>
            </form>
        </div>
    );
}