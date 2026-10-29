"use client";

import { useState, useEffect } from "react";

const AUTH_STORAGE_KEY = "superadmin_auth_user";
const AUTH_EVENT_NAME = "superadmin_auth_state_change";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}

  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT_NAME, { detail: { user } })
  );
}

export const auth = {
  get currentUser() {
    return getStoredUser();
  },
};

export function getAuth() {
  return auth;
}

async function parseAuthResponse(res, defaultError = "Operation failed") {
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = null;
  }

  if (!res.ok || !json?.ok) {
    if (!json) {
      if (res.status === 504) {
        throw new Error("Server request timed out (504). Please try again.");
      }
      if (res.status === 502) {
        throw new Error("Server temporarily restarting or unavailable (502). Please wait a moment and try again.");
      }
      throw new Error(`Server returned error (${res.status}). Please try again.`);
    }
    const err = new Error(json.error || defaultError);
    if (json.code) err.code = json.code;
    throw err;
  }

  return json;
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "login",
      email: String(email).trim().toLowerCase(),
      password,
    }),
  });

  const json = await parseAuthResponse(res, "Login failed");
  const user = {
    uid: json.user.uid,
    email: json.user.email,
    displayName: json.user.fullName || json.user.email,
    ...json.user,
  };

  setStoredUser(user);

  return {
    user,
  };
}

export async function createUserWithEmailAndPassword(_auth, email, password, userData = {}) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "signup",
      email: String(email).trim().toLowerCase(),
      password,
      userData,
    }),
  });

  const json = await parseAuthResponse(res, "Signup failed");
  const user = {
    uid: json.user.uid,
    email: json.user.email,
    displayName: json.user.fullName || json.user.email,
    ...json.user,
  };

  setStoredUser(user);

  return {
    user,
  };
}

export async function signOut(_auth) {
  setStoredUser(null);
  return Promise.resolve();
}

export function onAuthStateChanged(_auth, callback) {
  if (typeof window === "undefined") {
    callback(null);
    return () => {};
  }

  const currentUser = getStoredUser();
  callback(currentUser);

  const handleCustomEvent = (e) => {
    callback(e.detail?.user || null);
  };

  const handleStorageEvent = (e) => {
    if (e.key === AUTH_STORAGE_KEY) {
      callback(getStoredUser());
    }
  };

  window.addEventListener(AUTH_EVENT_NAME, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(AUTH_EVENT_NAME, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

/**
 * Check if the given or stored user has full Admin privileges.
 * SuperAdmin (rajbiosis12@gmail.com) is always Admin.
 * Sales role or designation is explicitly barred from Admin.
 */
export function isUserAdmin(user) {
  const target = user || (typeof window !== "undefined" ? getStoredUser() : null);
  if (!target) return false;

  const email = String(target.email || "").trim().toLowerCase();
  if (email === "rajbiosis12@gmail.com") return true;

  const role = String(target.role || "").trim().toLowerCase();
  const designation = String(target.designation || "").trim().toLowerCase();

  // Sales users and non-admins strictly cannot delete products
  if (role.includes("sales") || designation.includes("sales")) {
    return false;
  }

  return role === "admin";
}

/**
 * Permission check for deleting products, categories, and subcategories.
 * Only users with verified Admin role are authorized. Sales role is explicitly blocked.
 */
export function canUserDeleteProducts(user) {
  return isUserAdmin(user);
}

/**
 * React hook to retrieve current user role & product deletion permissions.
 * Synchronously initializes from stored user and refreshes live from MongoDB adminUsers.
 */
export function useUserRole() {
  const [currentUser, setCurrentUser] = useState(() => (typeof window !== "undefined" ? getStoredUser() : null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!isMounted) return;
      if (!u?.uid) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      setCurrentUser(u);

      // Verify fresh role and status from DB in background
      try {
        const res = await fetch(`/api/db?path=adminUsers/${encodeURIComponent(u.uid)}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json?.data && isMounted) {
            const merged = { ...u, ...json.data };
            setCurrentUser(merged);
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(merged));
            } catch {}
          }
        }
      } catch (err) {
        // Fall back to stored user
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const isAdmin = isUserAdmin(currentUser);
  const canDeleteProduct = isAdmin;

  return {
    user: currentUser,
    role: currentUser?.role || "",
    designation: currentUser?.designation || "",
    isAdmin,
    canDeleteProduct,
    loading,
  };
}
