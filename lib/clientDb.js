"use client";

import { canUserDeleteProducts } from "./auth";

const API = "/api/db";

function isProductOrCategoryPath(docPath) {
  const p = String(docPath || "").toLowerCase();
  return (
    p.includes("/products/") ||
    p.endsWith("/products") ||
    p.includes("/categories/") ||
    p.includes("/subcategories/")
  );
}

function cleanPath(value) {
  return String(value || "").split("/").filter(Boolean).join("/");
}

export const db = { __mongodb: true };

export function doc(_dbOrCollection, ...parts) {
  let basePath = "";
  let subParts = parts;
  if (_dbOrCollection && typeof _dbOrCollection === "object" && _dbOrCollection.path) {
    basePath = _dbOrCollection.path;
  } else if (typeof _dbOrCollection === "string") {
    subParts = [_dbOrCollection, ...parts];
  }
  const fullPath = [basePath, ...subParts].filter(Boolean).join("/");
  return { __type: "doc", path: cleanPath(fullPath) };
}

export function collection(_dbOrParent, ...parts) {
  let basePath = "";
  let subParts = parts;
  if (_dbOrParent && typeof _dbOrParent === "object" && _dbOrParent.path) {
    basePath = _dbOrParent.path;
  } else if (typeof _dbOrParent === "string") {
    subParts = [_dbOrParent, ...parts];
  }
  const fullPath = [basePath, ...subParts].filter(Boolean).join("/");
  return { __type: "collection", path: cleanPath(fullPath) };
}

export function where(field, op, value) {
  return { __type: "where", field, op, value };
}

export function orderBy(field, direction = "asc") {
  return { __type: "orderBy", field, direction };
}

export function limit(value) {
  return { __type: "limit", value };
}

export function query(source, ...constraints) {
  return { __type: "query", path: source.path, constraints };
}

export function createTimestampObject(val) {
  if (!val) return val;
  if (typeof val === "object" && typeof val.toDate === "function") return val;
  if (typeof val === "object" && typeof val.seconds === "number") {
    const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
    return {
      toDate: () => d,
      toMillis: () => d.getTime(),
      toISOString: () => d.toISOString(),
      toString: () => d.toLocaleString("en-IN"),
      toLocaleString: (...args) => d.toLocaleString(...(args.length ? args : ["en-IN"])),
      toLocaleDateString: (...args) => d.toLocaleDateString(...(args.length ? args : ["en-IN"])),
      toLocaleTimeString: (...args) => d.toLocaleTimeString(...(args.length ? args : ["en-IN"])),
      seconds: val.seconds,
      nanoseconds: val.nanoseconds || 0,
      toJSON: () => d.toISOString(),
    };
  }
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return val;
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    toISOString: () => d.toISOString(),
    toString: () => d.toLocaleString("en-IN"),
    toLocaleString: (...args) => d.toLocaleString(...(args.length ? args : ["en-IN"])),
    toLocaleDateString: (...args) => d.toLocaleDateString(...(args.length ? args : ["en-IN"])),
    toLocaleTimeString: (...args) => d.toLocaleTimeString(...(args.length ? args : ["en-IN"])),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: (d.getTime() % 1000) * 1000000,
    toJSON: () => d.toISOString(),
  };
}

function revive(value) {
  if (!value) return value;
  if (value.__timestamp) {
    return createTimestampObject(value.value || value);
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(revive);

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if ((k === "createdAt" || k === "updatedAt" || k === "timestamp" || k === "date") && v) {
      out[k] = createTimestampObject(v);
    } else {
      out[k] = revive(v);
    }
  }
  return out;
}

export function serverTimestamp() {
  return { __serverTimestamp: true };
}

async function request(url, options = {}) {
  const maxAttempts = 4;
  let lastError;

  let authHeaders = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("superadmin_auth_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.email) authHeaders["x-user-email"] = u.email;
        if (u?.role) authHeaders["x-user-role"] = u.role;
      }
    } catch {}
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {}),
        },
      });
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // Gateways commonly return HTML during temporary 502/503/504 incidents.
        if ([502, 503, 504, 429].includes(res.status) && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
          continue;
        }
        throw new Error(`Database API returned non-JSON response (${res.status} ${res.statusText}).`);
      }

      if (!res.ok) {
        const error = new Error(json?.error || `Database request failed (${res.status})`);
        if ([502, 503, 504, 429].includes(res.status) && attempt < maxAttempts - 1) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
          continue;
        }
        throw error;
      }
      return json;
    } catch (error) {
      lastError = error;
      const transient = /Failed to fetch|NetworkError|fetch failed|timed out|502|503|504|429/i.test(String(error?.message || error));
      if (!transient || attempt >= maxAttempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
  }
  throw lastError || new Error("Database request failed after retries");
}

function resolveRefPath(refOrPath) {
  if (!refOrPath) return "";
  if (typeof refOrPath === "string") return cleanPath(refOrPath);
  if (typeof refOrPath === "object") {
    if (refOrPath.path) return cleanPath(refOrPath.path);
    if (refOrPath.ref && refOrPath.ref.path) return cleanPath(refOrPath.ref.path);
    if (refOrPath._id) return cleanPath(refOrPath._id);
  }
  return "";
}

const clientDocCache = new Map();
const clientColCache = new Map();
const CLIENT_CACHE_TTL = 5 * 60 * 1000; // Keep frequently-read catalog data warm for 5 minutes

export function clearClientDbCache(path) {
  if (!path) {
    clientDocCache.clear();
    clientColCache.clear();
    return;
  }
  const clean = cleanPath(path).toLowerCase();
  for (const k of clientDocCache.keys()) {
    let decoded = k;
    try { decoded = decodeURIComponent(k); } catch { }
    if (decoded.includes(clean) || clean.includes(decoded)) {
      clientDocCache.delete(k);
    }
  }
  for (const k of clientColCache.keys()) {
    let decoded = k;
    try { decoded = decodeURIComponent(k); } catch { }
    if (decoded.includes(clean) || clean.includes(decoded)) {
      clientColCache.delete(k);
    }
  }
}

export async function getDoc(ref) {
  const docPath = resolveRefPath(ref);
  if (!docPath) throw new Error("Invalid document reference provided to getDoc");
  const cacheKey = docPath.toLowerCase();

  const cached = clientDocCache.get(cacheKey);
  const docRef = typeof ref === "object" && ref.path ? ref : doc(docPath);
  if (cached) {
    if (Date.now() - cached.time >= CLIENT_CACHE_TTL && !cached.refreshing) {
      cached.refreshing = true;
      request(`${API}?op=get&path=${encodeURIComponent(docPath)}`)
        .then((fresh) => clientDocCache.set(cacheKey, { json: fresh, time: Date.now() }))
        .catch((error) => console.warn("Background document refresh failed:", docPath, error))
        .finally(() => { const current = clientDocCache.get(cacheKey); if (current) current.refreshing = false; });
    }
    return {
      id: docPath.split("/").pop(),
      path: docPath,
      ref: docRef,
      exists: () => !!cached.json.exists,
      data: () => (cached.json.data ? revive(cached.json.data) : undefined),
    };
  }

  const json = await request(`${API}?op=get&path=${encodeURIComponent(docPath)}`);
  clientDocCache.set(cacheKey, { json, time: Date.now() });


  return {
    id: docPath.split("/").pop(),
    path: docPath,
    ref: docRef,
    exists: () => !!json.exists,
    data: () => (json.data ? revive(json.data) : undefined),
  };
}

export async function getDocs(queryOrCollection) {
  let targetPath = queryOrCollection.path || resolveRefPath(queryOrCollection);
  let filters = [];
  let order = [];
  let limitVal = null;

  if (queryOrCollection.__type === "query") {
    for (const c of queryOrCollection.constraints || []) {
      if (!c) continue;
      if (c.__type === "where") filters.push({ field: c.field, op: c.op, value: c.value });
      if (c.__type === "orderBy") order.push({ field: c.field, direction: c.direction });
      if (c.__type === "limit") limitVal = c.value;
    }
  }

  const params = new URLSearchParams();
  params.set("op", "collection");
  params.set("path", targetPath);
  if (filters.length) params.set("filters", JSON.stringify(filters));
  if (order.length) params.set("order", JSON.stringify(order));
  if (limitVal) params.set("limit", String(limitVal));

  const colKey = params.toString().toLowerCase();
  const cachedCol = clientColCache.get(colKey);
  let json;

  if (cachedCol) {
    json = cachedCol.json;
    if (Date.now() - cachedCol.time >= CLIENT_CACHE_TTL && !cachedCol.refreshing) {
      cachedCol.refreshing = true;
      request(`${API}?${params.toString()}`)
        .then((fresh) => clientColCache.set(colKey, { json: fresh, time: Date.now() }))
        .catch((error) => console.warn("Background collection refresh failed:", targetPath, error))
        .finally(() => { const current = clientColCache.get(colKey); if (current) current.refreshing = false; });
    }
  } else {
    json = await request(`${API}?${params.toString()}`);
    clientColCache.set(colKey, { json, time: Date.now() });
  }

  const docs = (json.docs || []).map((docItem) => {
    const docPath = `${targetPath}/${docItem.id}`;
    const docRef = doc(targetPath, docItem.id);
    return {
      id: docItem.id,
      path: docPath,
      ref: docRef,
      exists: () => true,
      data: () => revive(docItem.data),
    };
  });

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach(cb),
  };
}

export async function setDoc(ref, data, options = {}) {
  const docPath = resolveRefPath(ref);
  if (!docPath) throw new Error("Invalid document reference provided to setDoc");
  await request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "set",
      path: docPath,
      data,
      merge: !!options.merge,
    }),
  });
  clearClientDbCache(docPath);
}

export async function updateDoc(ref, data) {
  const docPath = resolveRefPath(ref);
  if (!docPath) throw new Error("Invalid document reference provided to updateDoc");
  await request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "update",
      path: docPath,
      data,
    }),
  });
  clearClientDbCache(docPath);
}

export async function deleteDoc(ref) {
  const docPath = resolveRefPath(ref);
  if (!docPath) throw new Error("Invalid document reference provided to deleteDoc");
  if (isProductOrCategoryPath(docPath) && !canUserDeleteProducts()) {
    throw new Error("Permission Denied: Only Admin can delete products or categories. Sales and other roles are not authorized.");
  }
  await request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "delete",
      path: docPath,
    }),
  });
  clearClientDbCache(docPath);
}

export async function addDoc(collectionRef, data) {
  const autoId = (
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "doc_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
  const docRef = doc(collectionRef, autoId);
  await setDoc(docRef, data);
  return docRef;
}

export function writeBatch() {
  const operations = [];
  return {
    set(ref, data, options = {}) {
      operations.push({ op: "set", path: ref.path, data, merge: !!options.merge });
      return this;
    },
    update(ref, data) {
      operations.push({ op: "update", path: ref.path, data });
      return this;
    },
    delete(ref) {
      const itemPath = resolveRefPath(ref);
      if (isProductOrCategoryPath(itemPath) && !canUserDeleteProducts()) {
        throw new Error("Permission Denied: Only Admin can delete products or categories. Sales and other roles are not authorized.");
      }
      operations.push({ op: "delete", path: itemPath });
      return this;
    },
    async commit() {
      if (operations.length === 0) return;
      await request(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "batch",
          paths: operations,
        }),
      });
      clearClientDbCache();
    },
  };
}

export async function getCountFromServer(queryOrCollection) {
  let targetPath = queryOrCollection.path;
  const params = new URLSearchParams();
  params.set("op", "count");
  params.set("path", targetPath);
  const json = await request(`${API}?${params.toString()}`);
  return {
    data: () => ({ count: json.count || 0 }),
  };
}

export function onSnapshot(refOrQuery, onNext, onError) {
  let isMounted = true;
  const fetchData = async () => {
    try {
      if (refOrQuery.__type === "doc") {
        const snap = await getDoc(refOrQuery);
        if (isMounted) onNext?.(snap);
      } else {
        const snap = await getDocs(refOrQuery);
        if (isMounted) onNext?.(snap);
      }
    } catch (err) {
      if (isMounted && onError) onError(err);
    }
  };

  fetchData();
  const timer = setInterval(fetchData, 4000);
  return () => {
    isMounted = false;
    clearInterval(timer);
  };
}

export function onQueryNotifications(arg1, arg2, arg3) {
  let isMounted = true;
  let onNext, onError, since;

  if (typeof arg1 === "function") {
    onNext = arg1;
    onError = typeof arg2 === "function" ? arg2 : null;
    since = typeof arg3 === "number" ? arg3 : (typeof arg2 === "number" ? arg2 : Date.now());
  } else {
    since = typeof arg1 === "number" ? arg1 : 0;
    onNext = typeof arg2 === "function" ? arg2 : null;
    onError = typeof arg3 === "function" ? arg3 : null;
  }

  let lastTime = Number(since || Date.now());

  const poll = async () => {
    try {
      const res = await request(`${API}?op=queryNotifications&since=${lastTime}`);
      if (res && res.docs && res.docs.length > 0) {
        lastTime = res.serverTime || Date.now();
        const docChanges = res.docs.map((docItem) => {
          const docData = revive(docItem.data || {});
          return {
            type: "added",
            collectionPath: docItem.collectionPath || docItem.path || "",
            path: docItem.path || docItem.collectionPath || "",
            doc: {
              id: docItem.id,
              path: docItem.path || docItem.collectionPath || "",
              data: () => docData,
              ref: { path: docItem.path || docItem.collectionPath || "" },
            },
          };
        });

        const snapshot = {
          docs: docChanges.map((c) => c.doc),
          docChanges: () => docChanges,
          size: docChanges.length,
          empty: docChanges.length === 0,
        };

        if (isMounted && onNext) onNext(snapshot);
      }
    } catch (e) {
      if (isMounted && onError) onError(e);
    }
  };

  const timer = setInterval(poll, 15000);
  return () => {
    isMounted = false;
    clearInterval(timer);
  };
}

export async function updateVisibilityApi(payload) {
  const res = await request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "updateVisibility",
      ...payload,
    }),
  });
  clearClientDbCache(payload.companyId ? `companies/${payload.companyId}` : "");
  return res;
}

