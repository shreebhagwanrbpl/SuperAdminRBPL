/**
 * One-time migration utility.
 *
 * Reads every Firestore document from the configured Firebase project and
 * writes it into data/catalog.db using the same document paths.
 *
 * Required environment variables:
 * FIREBASE_PROJECT_ID
 * FIREBASE_CLIENT_EMAIL
 * FIREBASE_PRIVATE_KEY
 * FIREBASE_STORAGE_BUCKET (optional for Firestore-only migration)
 *
 * Run after the Firestore quota is available:
 *   npm run migrate:firebase
 */
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { DatabaseSync } from "node:sqlite";

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
  throw new Error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

const firestore = getFirestore(app);
const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "catalog.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    collection_path TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_path);
  CREATE INDEX IF NOT EXISTS idx_documents_doc_id ON documents(doc_id);
`);

const upsert = db.prepare(`
  INSERT INTO documents(path, collection_path, doc_id, data, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(path) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
`);

function cleanValue(value) {
  if (value instanceof Date) {
    return { __sqliteType: "timestamp", value: value.toISOString() };
  }
  if (value && typeof value.toDate === "function") {
    return { __sqliteType: "timestamp", value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanValue(v);
    return out;
  }
  return value;
}

let count = 0;

async function walkCollection(collectionRef, prefix = "") {
  const snap = await collectionRef.get();

  for (const document of snap.docs) {
    const documentPath = document.ref.path;
    const parts = documentPath.split("/");
    const collectionPath = parts.slice(0, -1).join("/");
    const docId = parts.at(-1);

    upsert.run(
      documentPath,
      collectionPath,
      docId,
      JSON.stringify(cleanValue(document.data())),
      Date.now()
    );

    count++;
    if (count % 100 === 0) {
      console.log(`Migrated ${count} Firestore documents...`);
    }

    const subcollections = await document.ref.listCollections();
    for (const subcollection of subcollections) {
      await walkCollection(subcollection, documentPath);
    }
  }
}

const rootCollections = await firestore.listCollections();
for (const collectionRef of rootCollections) {
  console.log(`Scanning collection: ${collectionRef.id}`);
  await walkCollection(collectionRef);
}

console.log(`\nFirestore → SQLite migration complete.`);
console.log(`Documents migrated: ${count}`);
console.log(`Database: ${path.join(dataDir, "catalog.db")}`);

try {
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    const bucket = getStorage(app).bucket();
    const [files] = await bucket.getFiles();
    const uploadRoot = path.join(process.cwd(), "public", "uploads");
    for (const file of files) {
      const destination = path.join(uploadRoot, file.name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      await file.download({ destination });
    }
    console.log(`Storage files migrated: ${files.length}`);
  }
} catch (error) {
  console.warn("Storage migration skipped:", error.message);
}
