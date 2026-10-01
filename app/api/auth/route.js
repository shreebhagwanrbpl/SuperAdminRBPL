import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb, getUsersCol } from "@/lib/mongodb";
import { getDocument, setDocument, deleteDocument } from "@/lib/mongoDbServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(verifyHash, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { op, email, password, userData, uid, status } = body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const usersCol = await getUsersCol();

    // 1. SIGNUP / REGISTER
    if (op === "signup") {
      if (!cleanEmail || !password) {
        return NextResponse.json(
          { ok: false, code: "auth/invalid-email", error: "Email and password are required" },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { ok: false, code: "auth/weak-password", error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      const existing = await usersCol.findOne({ email: cleanEmail });
      if (existing) {
        return NextResponse.json(
          { ok: false, code: "auth/email-already-in-use", error: "Email already registered" },
          { status: 409 }
        );
      }

      const newUid = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const isSuperAdmin = cleanEmail === "rajbiosis12@gmail.com";
      const totalUsers = await usersCol.countDocuments();
      const isFirstUser = totalUsers === 0;

      const profile = {
        _id: newUid,
        uid: newUid,
        email: cleanEmail,
        passwordHash,
        fullName: userData?.fullName || cleanEmail.split("@")[0],
        role: isSuperAdmin ? "Admin" : (userData?.role || "Employee"),
        designation: isSuperAdmin ? "IT" : (userData?.designation || "Executive"),
        phone: userData?.phone || "",
        status: (isSuperAdmin || isFirstUser) ? "approved" : "pending",
        createdAt: new Date(),
      };

      await usersCol.insertOne(profile);
      await setDocument(`adminUsers/${newUid}`, profile, true);

      return NextResponse.json({
        ok: true,
        user: { ...profile, passwordHash: undefined },
      });
    }

    // 2. SIGN IN / LOGIN
    if (op === "login") {
      if (!cleanEmail || !password) {
        return NextResponse.json(
          { ok: false, code: "auth/invalid-credential", error: "Email and password are required" },
          { status: 400 }
        );
      }

      const userDoc = await usersCol.findOne({ email: cleanEmail });
      if (!userDoc) {
        return NextResponse.json(
          { ok: false, code: "auth/user-not-found", error: "User not found" },
          { status: 404 }
        );
      }

      const isValid = verifyPassword(password, userDoc.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { ok: false, code: "auth/wrong-password", error: "Wrong password" },
          { status: 401 }
        );
      }

      // SuperAdmin override: rajbiosis12@gmail.com is always approved
      if (cleanEmail === "rajbiosis12@gmail.com" && userDoc.status !== "approved") {
        userDoc.status = "approved";
        userDoc.role = "Admin";
        await usersCol.updateOne({ _id: userDoc._id }, { $set: { status: "approved", role: "Admin" } });
        await setDocument(`adminUsers/${userDoc.uid}`, userDoc, true);
      }

      const user = {
        ...userDoc,
        uid: userDoc.uid || userDoc._id,
        status: userDoc.status || "pending",
        passwordHash: undefined,
      };

      if (user.status === "pending") {
        return NextResponse.json(
          { ok: false, code: "auth/pending-approval", error: "Waiting for admin approval", user },
          { status: 403 }
        );
      }

      if (user.status === "rejected") {
        return NextResponse.json(
          { ok: false, code: "auth/rejected", error: "Your account request was rejected by admin", user },
          { status: 403 }
        );
      }

      return NextResponse.json({ ok: true, user });
    }

    // 3. UPDATE USER STATUS / APPROVAL
    if (op === "updateStatus") {
      const targetUid = uid || body?.uid;
      const targetStatus = status || body?.status;

      if (!targetUid || !["pending", "approved", "rejected"].includes(targetStatus)) {
        return NextResponse.json(
          { ok: false, error: "Valid UID and status ('pending', 'approved', 'rejected') are required" },
          { status: 400 }
        );
      }

      const user = await usersCol.findOne({ $or: [{ _id: targetUid }, { uid: targetUid }] });
      if (!user) {
        return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }

      await usersCol.updateOne({ _id: user._id }, { $set: { status: targetStatus, updatedAt: new Date() } });
      await setDocument(`adminUsers/${user.uid}`, { ...user, status: targetStatus }, true);

      return NextResponse.json({ ok: true, user: { ...user, status: targetStatus, passwordHash: undefined } });
    }

    // 4. DELETE USER
    if (op === "deleteUser") {
      const targetUid = uid || body?.uid;
      if (!targetUid) {
        return NextResponse.json({ ok: false, error: "UID is required" }, { status: 400 });
      }

      const user = await usersCol.findOne({ $or: [{ _id: targetUid }, { uid: targetUid }] });
      if (user && user.email.toLowerCase() === "rajbiosis12@gmail.com") {
        return NextResponse.json({ ok: false, error: "Cannot delete the main admin account" }, { status: 400 });
      }

      if (user) {
        await usersCol.deleteOne({ _id: user._id });
        await deleteDocument(`adminUsers/${user.uid}`);
      }

      return NextResponse.json({ ok: true, message: "User deleted successfully" });
    }

    // 5. CHANGE PASSWORD
    if (op === "changePassword") {
      const { newPassword } = body;
      const targetUid = uid || body?.uid;
      if (!targetUid || !newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { ok: false, error: "Valid UID and new password (min 6 chars) required" },
          { status: 400 }
        );
      }

      const newHash = hashPassword(newPassword);
      await usersCol.updateOne(
        { $or: [{ _id: targetUid }, { uid: targetUid }] },
        { $set: { passwordHash: newHash, updatedAt: new Date() } }
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown auth operation" }, { status: 400 });
  } catch (err) {
    console.error("[api/auth] API Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Auth server error" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const op = searchParams.get("op") || "list";
    const uid = searchParams.get("uid");
    const usersCol = await getUsersCol();

    if (op === "get" && uid) {
      const user = await usersCol.findOne({ $or: [{ _id: uid }, { uid }] });
      if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      return NextResponse.json({
        ok: true,
        user: { ...user, passwordHash: undefined },
      });
    }

    if (op === "list") {
      const users = await usersCol
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return NextResponse.json({
        ok: true,
        users: users.map((u) => ({
          ...u,
          uid: u.uid || u._id,
          passwordHash: undefined,
        })),
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
