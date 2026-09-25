import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import {
  groupWebsitePath,
  getCompanyForWebsitePath,
} from "./websiteCompanyMap.js";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "catalog.db");
const database = new DatabaseSync(dbPath);

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    collection_path TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_documents_collection
    ON documents(collection_path);

  CREATE INDEX IF NOT EXISTS idx_documents_doc_id
    ON documents(doc_id);

  CREATE TABLE IF NOT EXISTS storage_files (
    path TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    local_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS local_users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    user_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// One-time/idempotent migration of legacy
// websites/{website}/...
// into
// websites/{company}/{website}/...
migrateLegacyWebsitePaths();

export { database, dbPath };

export function normalizePath(p) {
  const clean = String(p || "")
    .split("/")
    .filter(Boolean)
    .join("/");

  return groupWebsitePath(clean);
}

function migrateLegacyWebsitePaths() {
  const rows = database
    .prepare(
      `SELECT path, collection_path, doc_id, data, updated_at
       FROM documents
       WHERE path LIKE 'websites/%'`
    )
    .all();

  for (const row of rows) {
    const parts = String(row.path || "")
      .split("/")
      .filter(Boolean);

    if (parts[0] !== "websites" || parts.length < 2) {
      continue;
    }

    // Only migrate known website IDs.
    // Unknown/custom paths remain unchanged.
    const companyId = getCompanyForWebsitePath(parts[1]);

    if (!companyId) {
      continue;
    }

    const newPath = groupWebsitePath(row.path);

    if (!newPath || newPath === row.path) {
      continue;
    }

    const newParts = newPath.split("/");
    const newCollectionPath = newParts.slice(0, -1).join("/");
    const newDocId = newParts[newParts.length - 1] || "";

    // Never overwrite an already existing grouped document.
    database
      .prepare(`
        INSERT OR IGNORE INTO documents
          (path, collection_path, doc_id, data, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        newPath,
        newCollectionPath,
        newDocId,
        row.data,
        row.updated_at
      );

    // Remove the old legacy path after migration.
    database
      .prepare("DELETE FROM documents WHERE path = ?")
      .run(row.path);
  }
}

export function collectionPathForDoc(docPath) {
  const parts = normalizePath(docPath).split("/");
  return parts.slice(0, -1).join("/");
}

export function docIdForPath(docPath) {
  const parts = normalizePath(docPath).split("/");
  return parts[parts.length - 1] || "";
}

export function encodeValue(value) {
  return JSON.stringify(value, (_, v) => {
    if (v instanceof Date) {
      return {
        __sqliteType: "timestamp",
        value: v.toISOString(),
      };
    }

    return v;
  });
}

export function decodeValue(text) {
  return JSON.parse(text, (_, v) => {
    if (v && v.__sqliteType === "timestamp") {
      return {
        __sqliteType: "timestamp",
        value: v.value,
      };
    }

    return v;
  });
}

export function getDocument(docPath) {
  const row = database
    .prepare("SELECT data FROM documents WHERE path = ?")
    .get(normalizePath(docPath));

  return row ? decodeValue(row.data) : null;
}

export function setDocument(docPath, data, merge = false) {
  const p = normalizePath(docPath);

  const old = merge ? getDocument(p) : null;

  const finalData =
    merge && old
      ? {
        ...old,
        ...data,
      }
      : data;

  database
    .prepare(`
      INSERT INTO documents(
        path,
        collection_path,
        doc_id,
        data,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)

      ON CONFLICT(path) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `)
    .run(
      p,
      collectionPathForDoc(p),
      docIdForPath(p),
      encodeValue(finalData),
      Date.now()
    );

  return finalData;
}

export function deleteDocument(docPath) {
  database
    .prepare("DELETE FROM documents WHERE path = ?")
    .run(normalizePath(docPath));
}

export function listCollection(collectionPath) {
  const p = normalizePath(collectionPath);

  const rows = database
    .prepare(
      "SELECT path, doc_id, data FROM documents WHERE collection_path = ?"
    )
    .all(p);

  return rows.map((row) => ({
    id: row.doc_id,
    path: row.path,
    data: decodeValue(row.data),
  }));
}

export function listAllDocuments() {
  return database
    .prepare(
      "SELECT path, data FROM documents ORDER BY path"
    )
    .all()
    .map((row) => ({
      path: row.path,
      data: decodeValue(row.data),
    }));
}