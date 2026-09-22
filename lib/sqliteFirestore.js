"use client";

const API = "/api/local-firestore";

function cleanPath(value) {
  return String(value || "").split("/").filter(Boolean).join("/");
}

export const db = { __sqlite: true };

export function doc(_dbOrCollection, ...parts) {
  return { __type: "doc", path: cleanPath(parts.join("/")) };
}

export function collection(_db, ...parts) {
  return { __type: "collection", path: cleanPath(parts.join("/")) };
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

function revive(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(revive);
  if (value.__sqliteType === "timestamp") {
    const d = new Date(value.value);
    return {
      __sqliteTimestamp: true,
      toDate: () => d,
      toMillis: () => d.getTime(),
      toString: () => d.toISOString(),
    };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = revive(v);
  return out;
}

export function serverTimestamp() {
  return { __serverTimestamp: true };
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `SQLite API returned non-JSON response (${res.status} ${res.statusText}).`
    );
  }

  if (!res.ok) {
    throw new Error(json?.error || `SQLite request failed (${res.status})`);
  }

  return json;
}

export async function getDoc(ref) {
  const json = await request(`${API}?op=get&path=${encodeURIComponent(ref.path)}`);
  return {
    exists: () => !!json.exists,
    data: () => revive(json.data),
    id: ref.path.split("/").pop(),
  };
}

export async function getDocs(ref) {
  const constraints = ref.constraints || [];
  const filters = constraints.filter((c) => c.__type === "where");
  const order = constraints.filter((c) => c.__type === "orderBy");
  const lim = constraints.find((c) => c.__type === "limit");

  const params = new URLSearchParams({
    op: "collection",
    path: ref.path,
    filters: JSON.stringify(filters),
    order: JSON.stringify(order),
  });
  if (lim) params.set("limit", String(lim.value));

  const json = await request(`${API}?${params.toString()}`);
  return {
    docs: (json.docs || []).map((d) => ({
      id: d.id,
      data: () => revive(d.data),
      exists: () => true,
    })),
    empty: !json.docs?.length,
    size: json.docs?.length || 0,
  };
}

export async function setDoc(ref, data, options = {}) {
  await request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "set",
      path: ref.path,
      data,
      merge: !!options.merge,
    }),
  });
}

export async function updateDoc(ref, data) {
  return setDoc(ref, data, { merge: true });
}

export async function deleteDoc(ref) {
  await request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "delete", path: ref.path }),
  });
}

export async function addDoc(collectionRef, data) {
  const id = crypto.randomUUID();
  const ref = doc(collectionRef, id);
  await setDoc(ref, data);
  return { id, ...ref };
}

export function writeBatch(_db) {
  const items = [];
  return {
    set(ref, data, options = {}) { items.push({ op: "set", path: ref.path, data, merge: !!options.merge }); return this; },
    update(ref, data) { items.push({ op: "set", path: ref.path, data, merge: true }); return this; },
    delete(ref) { items.push({ op: "delete", path: ref.path }); return this; },
    async commit() {
      await request(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "batch", paths: items }),
      });
    },
  };
}

export function onSnapshot(ref, callback, errorCallback) {
  let stopped = false;
  let timer = null;
  let last = "";
  const intervalMs = 15000;

  const run = async () => {
    if (stopped) return;
    try {
      const snap = ref.__type === "doc" ? await getDoc(ref) : await getDocs(ref);
      const signature = JSON.stringify(
        ref.__type === "doc"
          ? snap.data()
          : snap.docs.map((d) => ({ id: d.id, data: d.data() }))
      );

      if (signature !== last) {
        const previous = last;
        last = signature;

        // Preserve Firebase-style docChanges() for collection listeners.
        if (ref.__type === "collection" || ref.__type === "query") {
          const docs = snap.docs || [];
          const current = new Map(docs.map((d) => [d.id, d]));
          let previousMap = new Map();
          if (previous) {
            try {
              const oldDocs = JSON.parse(previous);
              previousMap = new Map(oldDocs.map((d) => [d.id, d]));
            } catch {}
          }

          const changes = [];
          for (const [id, docSnap] of current) {
            const type = previousMap.has(id) ? "modified" : "added";
            changes.push({ type, doc: docSnap });
          }
          for (const [id, oldDoc] of previousMap) {
            if (!current.has(id)) {
              changes.push({
                type: "removed",
                doc: {
                  id,
                  exists: () => false,
                  data: () => revive(oldDoc.data),
                },
              });
            }
          }

          callback({
            ...snap,
            docChanges: () => changes,
          });
        } else {
          callback(snap);
        }
      }
    } catch (e) {
      console.error("SQLite onSnapshot:", e);
      errorCallback?.(e);
    }

    if (!stopped) timer = setTimeout(run, intervalMs);
  };

  run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// Efficient replacement for hundreds of independent Firestore listeners used by
// the Task Manager notification system. It polls one endpoint instead of making
// one request per website/query collection.
export function onQueryNotifications(callback, errorCallback, startTime = Date.now()) {
  let stopped = false;
  let timer = null;
  let since = Number(startTime) || Date.now();
  const seen = new Set();
  const intervalMs = 5000;

  const run = async () => {
    if (stopped) return;

    try {
      // Small overlap prevents a write occurring at the exact boundary from
      // being missed. `seen` removes duplicates caused by that overlap.
      const querySince = Math.max(0, since - 1000);
      const json = await request(
        `${API}?op=queryNotifications&since=${encodeURIComponent(querySince)}`
      );

      const changes = [];
      let maxUpdatedAt = since;

      for (const item of json.docs || []) {
        const updatedAt = Number(item.updatedAt || 0);
        maxUpdatedAt = Math.max(maxUpdatedAt, updatedAt);
        const key = `${item.path}:${updatedAt}`;
        if (seen.has(key)) continue;
        seen.add(key);
        changes.push({
          type: "added",
          doc: {
            id: item.id,
            data: () => revive(item.data),
            exists: () => true,
          },
          path: item.path,
          collectionPath: item.collectionPath,
          updatedAt,
        });
      }

      // Keep memory bounded.
      if (seen.size > 5000) {
        const recent = Array.from(seen).slice(-2500);
        seen.clear();
        recent.forEach((key) => seen.add(key));
      }

      since = Math.max(since, maxUpdatedAt);

      if (changes.length) {
        callback({
          docChanges: () => changes,
          docs: changes.map((change) => change.doc),
        });
      }
    } catch (e) {
      console.error("SQLite query notifications:", e);
      errorCallback?.(e);
    }

    if (!stopped) timer = setTimeout(run, intervalMs);
  };

  run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export async function getCountFromServer(ref) {
  const params = new URLSearchParams({ op: "collection", path: ref.path, filters: "[]", order: "[]" });
  const json = await request(`${API}?${params.toString()}`);
  return { data: () => ({ count: json.count || 0 }) };
}
