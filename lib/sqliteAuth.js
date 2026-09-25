"use client";

const AUTH_STORAGE_KEY = "superadmin_local_auth_user";
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

  // Dispatch custom event for instant cross-component updates
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

export async function signInWithEmailAndPassword(_auth, email, password) {
  const res = await fetch("/api/local-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "login",
      email: String(email).trim().toLowerCase(),
      password,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    const error = new Error(json.error || "Login failed");
    error.code = json.code || "auth/invalid-credential";
    throw error;
  }

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
  const res = await fetch("/api/local-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "signup",
      email: String(email).trim().toLowerCase(),
      password,
      userData,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    const error = new Error(json.error || "Signup failed");
    error.code = json.code || "auth/email-already-in-use";
    throw error;
  }

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

  // Initial call with current state immediately
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
