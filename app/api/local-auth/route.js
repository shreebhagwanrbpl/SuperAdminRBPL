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
    const { op, email, password, userData, uid, status } = body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();

    // ==========================================================
    // 1. SIGN UP / REGISTER
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

      const newUid = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const now = Date.now();

      // Check count of existing users; if 0 or is rajbiosis12@gmail.com, auto-approve
      const countRow = database
        .prepare("SELECT COUNT(*) as count FROM local_users")
        .get();
      const isSuperAdmin = cleanEmail === "rajbiosis12@gmail.com";
      const isFirstUser = !countRow || countRow.count === 0;

      const profile = {
        uid: newUid,
        email: cleanEmail,
        fullName: userData?.fullName || cleanEmail.split("@")[0],
        role: isSuperAdmin ? "Admin" : (userData?.role || "Employee"),
        designation: isSuperAdmin ? "IT" : (userData?.designation || "Executive"),
        phone: userData?.phone || "",
        status: (isSuperAdmin || isFirstUser) ? "approved" : "pending",
        createdAt: new Date().toISOString(),
      };

      // Save to local_users table
      database
        .prepare(`
          INSERT INTO local_users (uid, email, password_hash, user_json, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(newUid, cleanEmail, passwordHash, JSON.stringify(profile), now);

      // Also save to documents collection adminUsers/{uid}
      setDocument(`adminUsers/${newUid}`, profile, true);

      return NextResponse.json({
        ok: true,
        user: profile,
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

      let profile = {};
      try {
        profile = JSON.parse(userRow.user_json || "{}");
      } catch {}

      // SuperAdmin override: rajbiosis12@gmail.com is always approved
      if (cleanEmail === "rajbiosis12@gmail.com" && profile.status !== "approved") {
        profile.status = "approved";
        profile.role = "Admin";
        database
          .prepare("UPDATE local_users SET user_json = ? WHERE uid = ?")
          .run(JSON.stringify(profile), userRow.uid);
        setDocument(`adminUsers/${userRow.uid}`, profile, true);
      }

      const adminDoc = getDocument(`adminUsers/${userRow.uid}`) || {};
      const user = {
        ...adminDoc,
        ...profile,
        uid: userRow.uid,
        email: userRow.email,
        status: profile.status || adminDoc.status || "pending",
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

    // ==========================================================
    // 3. UPDATE USER APPROVAL STATUS
    // ==========================================================
    if (op === "updateStatus") {
      const targetUid = uid || body?.uid;
      const targetStatus = status || body?.status;

      if (!targetUid || !["pending", "approved", "rejected"].includes(targetStatus)) {
        return NextResponse.json(
          { ok: false, error: "Valid UID and status ('pending', 'approved', 'rejected') are required" },
          { status: 400 }
        );
      }

      const row = database
        .prepare("SELECT user_json, email FROM local_users WHERE uid = ?")
        .get(targetUid);

      if (!row) {
        return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      }

      let profile = {};
      try { profile = JSON.parse(row.user_json || "{}"); } catch {}
      const updatedProfile = { ...profile, uid: targetUid, status: targetStatus };

      database
        .prepare("UPDATE local_users SET user_json = ? WHERE uid = ?")
        .run(JSON.stringify(updatedProfile), targetUid);
      setDocument(`adminUsers/${targetUid}`, updatedProfile, true);

      return NextResponse.json({ ok: true, user: updatedProfile });
    }

    // ==========================================================
    // 4. DELETE USER
    // ==========================================================
    if (op === "deleteUser") {
      const targetUid = uid || body?.uid;
      if (!targetUid) {
        return NextResponse.json({ ok: false, error: "UID is required" }, { status: 400 });
      }

      const row = database
        .prepare("SELECT email FROM local_users WHERE uid = ?")
        .get(targetUid);

      if (row && row.email.toLowerCase() === "rajbiosis12@gmail.com") {
        return NextResponse.json({ ok: false, error: "Cannot delete the main admin account" }, { status: 400 });
      }

      database.prepare("DELETE FROM local_users WHERE uid = ?").run(targetUid);
      deleteDocument(`adminUsers/${targetUid}`);

      return NextResponse.json({ ok: true, message: "User deleted successfully" });
    }

    // ==========================================================
    // 5. CLEANUP USERS (Keep only rajbiosis12@gmail.com)
    // ==========================================================
    if (op === "cleanupToAdminOnly") {
      const allUsers = database.prepare("SELECT uid, email FROM local_users").all();
      let keptCount = 0;
      let deletedCount = 0;

      for (const u of allUsers) {
        if (u.email.toLowerCase() === "rajbiosis12@gmail.com") {
          const profile = {
            uid: u.uid,
            email: "rajbiosis12@gmail.com",
            fullName: "Shree Bhagwan",
            role: "Admin",
            designation: "IT",
            phone: "9783861542",
            status: "approved",
            createdAt: new Date().toISOString(),
          };
          database.prepare("UPDATE local_users SET user_json = ? WHERE uid = ?").run(JSON.stringify(profile), u.uid);
          setDocument(`adminUsers/${u.uid}`, profile, true);
          keptCount++;
        } else {
          database.prepare("DELETE FROM local_users WHERE uid = ?").run(u.uid);
          deleteDocument(`adminUsers/${u.uid}`);
          deletedCount++;
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Cleanup completed. Kept: ${keptCount}, Deleted: ${deletedCount}`,
      });
    }

    // ==========================================================
    // 6. CHANGE PASSWORD
    // ==========================================================
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
      database
        .prepare("UPDATE local_users SET password_hash = ? WHERE uid = ?")
        .run(newHash, targetUid);

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

      const adminDoc = getDocument(`adminUsers/${uid}`) || {};
      const mergedProfile = {
        ...adminDoc,
        ...(profile || {}),
        uid: user.uid,
        email: user.email,
        createdAt: profile?.createdAt || new Date(user.created_at).toISOString(),
        status: profile?.status || adminDoc.status || "pending",
      };

      return NextResponse.json({ ok: true, user: mergedProfile });
    }

    if (op === "list") {
      const rows = database
        .prepare("SELECT uid, email, user_json, created_at FROM local_users")
        .all();

      const users = rows.map((r) => {
        let profile = {};
        try {
          profile = JSON.parse(r.user_json || "{}");
        } catch {}

        const adminDoc = getDocument(`adminUsers/${r.uid}`) || {};
        return {
          ...adminDoc,
          ...profile,
          uid: r.uid,
          email: r.email,
          createdAt: profile.createdAt || adminDoc.createdAt || new Date(r.created_at).toISOString(),
          status: profile.status || adminDoc.status || "pending",
        };
      }).sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));

      return NextResponse.json({ ok: true, users });
    }

    return NextResponse.json({ ok: false, error: "Invalid op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
