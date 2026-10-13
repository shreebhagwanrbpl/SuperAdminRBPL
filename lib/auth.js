"use client";

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
