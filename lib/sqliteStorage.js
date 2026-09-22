"use client";

const API = "/api/local-storage";

export const storage = { __sqliteStorage: true };

export function ref(_storage, path = "") {
  return { path: String(path).replace(/^\/+/, "") };
}

export async function uploadBytes(storageRef, file) {
  const form = new FormData();
  form.append("file", file);
  form.append("path", storageRef.path);
  const res = await fetch(API, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Upload failed");
  return { ref: storageRef, metadata: json.metadata };
}

export function uploadBytesResumable(storageRef, file) {
  let progressCb = null;
  let errorCb = null;
  let completeCb = null;

  const task = {
    on(_event, next, error, complete) {
      progressCb = next;
      errorCb = error;
      completeCb = complete;
      uploadBytes(storageRef, file)
        .then((snapshot) => {
          progressCb?.({ bytesTransferred: file.size || 1, totalBytes: file.size || 1 });
          completeCb?.();
          return snapshot;
        })
        .catch((e) => errorCb?.(e));
      return () => {};
    },
    cancel() {},
  };
  return task;
}

export async function getDownloadURL(storageRef) {
  return `/uploads/${storageRef.path}`;
}

export async function deleteObject(storageRef) {
  await fetch(`${API}?path=${encodeURIComponent(storageRef.path)}`, { method: "DELETE" });
}

export async function listAll(storageRef) {
  const res = await fetch(`${API}?op=list&path=${encodeURIComponent(storageRef.path)}`);
  const json = await res.json();
  return {
    items: (json.items || []).map((p) => ({ fullPath: p, name: p.split("/").pop(), path: p })),
    prefixes: [],
  };
}
