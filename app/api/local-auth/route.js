import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  database,
  getDocument,
  setDocument,
  deleteDocument,
} from "@/lib/sqliteServer";

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
    const { op, email, password, userData } = body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();

    // ==========================================================
    // 1. SIGN UP
    // ==========================================================
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

      // Check if email already registered in local_users
      const existing = database
        .prepare("SELECT uid FROM local_users WHERE LOWER(email) = ?")
        .get(cleanEmail);

      if (existing) {
        return NextResponse.json(
          { ok: false, code: "auth/email-already-in-use", error: "Email already registered" },
          { status: 409 }
        );
      }

      const uid = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const now = Date.now();

      // Check count of existing users; if 0, auto-approve the first admin
      const countRow = database
        .prepare("SELECT COUNT(*) as count FROM local_users")
        .get();
      const isFirstUser = !countRow || countRow.count === 0;

      const profile = {
        uid,
        email: cleanEmail,
        fullName: userData?.fullName || cleanEmail.split("@")[0],
        role: userData?.role || "Admin",
        designation: userData?.designation || "IT",
        phone: userData?.phone || "",
        status: isFirstUser ? "approved" : (userData?.status || "pending"),
        createdAt: new Date().toISOString(),
      };

      // Save to local_users table
      database
        .prepare(`
          INSERT INTO local_users (uid, email, password_hash, user_json, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(uid, cleanEmail, passwordHash, JSON.stringify(profile), now);

      // Also save to documents collection adminUsers/{uid}
      setDocument(`adminUsers/${uid}`, profile, true);

      return NextResponse.json({
        ok: true,
        user: {
          uid,
          email: cleanEmail,
          ...profile,
        },
      });
    }

    // ==========================================================
    // 2. SIGN IN / LOGIN
    // ==========================================================
    if (op === "login") {
      if (!cleanEmail || !password) {
        return NextResponse.json(
          { ok: false, code: "auth/invalid-credential", error: "Email and password are required" },
          { status: 400 }
        );
      }

      const userRow = database
        .prepare("SELECT uid, email, password_hash, user_json FROM local_users WHERE LOWER(email) = ?")
        .get(cleanEmail);

      if (!userRow) {
        return NextResponse.json(
          { ok: false, code: "auth/user-not-found", error: "User not found" },
          { status: 404 }
        );
      }

      const isValid = verifyPassword(password, userRow.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { ok: false, code: "auth/wrong-password", error: "Wrong password" },
          { status: 401 }
        );
      }

      // Fetch fresh adminUsers doc if available
      let adminDoc = getDocument(`adminUsers/${userRow.uid}`);
      if (!adminDoc && userRow.user_json) {
        try {
          adminDoc = JSON.parse(userRow.user_json);
        } catch {}
      }

      return NextResponse.json({
        ok: true,
        user: {
          uid: userRow.uid,
          email: userRow.email,
          ...(adminDoc || {}),
        },
      });
    }

    // ==========================================================
    // 3. CHANGE PASSWORD
    // ==========================================================
    if (op === "changePassword") {
      const { uid, newPassword } = body;
      if (!uid || !newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { ok: false, error: "Valid UID and new password (min 6 chars) required" },
          { status: 400 }
        );
      }

      const newHash = hashPassword(newPassword);
      database
        .prepare("UPDATE local_users SET password_hash = ? WHERE uid = ?")
        .run(newHash, uid);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown auth operation" }, { status: 400 });
  } catch (err) {
    console.error("[local-auth] API Error:", err);
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

    if (op === "get" && uid) {
      const user = database
        .prepare("SELECT uid, email, user_json, created_at FROM local_users WHERE uid = ?")
        .get(uid);

      if (!user) {
        return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }

      let profile = null;
      try {
        profile = JSON.parse(user.user_json);
      } catch {}

      const adminDoc = getDocument(`adminUsers/${uid}`) || profile;

      return NextResponse.json({
        ok: true,
        user: {
          uid: user.uid,
          email: user.email,
          createdAt: user.created_at,
          ...adminDoc,
        },
      });
    }

    if (op === "list") {
      const rows = database
        .prepare("SELECT uid, email, user_json, created_at FROM local_users")
        .all();

      const users = rows.map((r) => {
        let p = {};
        try {
          p = JSON.parse(r.user_json);
        } catch {}
        const doc = getDocument(`adminUsers/${r.uid}`) || p;
        return {
          uid: r.uid,
          email: r.email,
          ...doc,
        };
      });

      return NextResponse.json({ ok: true, users });
    }

    return NextResponse.json({ ok: false, error: "Invalid op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
