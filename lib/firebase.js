// All Firebase services (Firestore, Storage, Auth) have been replaced by the local SQLite layer.
// This file serves as a drop-in compatibility bridge.

import { auth as sqliteAuth } from "./sqliteAuth";
import { db as sqliteDb } from "./sqliteFirestore";
import { storage as sqliteStorage } from "./sqliteStorage";

export const auth = sqliteAuth;
export const db = sqliteDb;
export const storage = sqliteStorage;

const app = {
  auth: sqliteAuth,
  db: sqliteDb,
  storage: sqliteStorage,
};

export default app;
