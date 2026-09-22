// Firebase Firestore/Storage have been replaced by the VPS SQLite layer.
// Firebase Auth is intentionally kept in this compatibility file so existing
// login/session behaviour is not changed during the data-store migration.

import { getAuth } from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import { db as sqliteDb } from "./sqliteFirestore";
import { storage as sqliteStorage } from "./sqliteStorage";

const firebaseConfig = {
  apiKey: "AIzaSyDGIJXX3MR1CxmIJbJHyVzbfRa0M0Sw6FQ",
  authDomain: "rajbiosis-central.firebaseapp.com",
  projectId: "rajbiosis-central",
  storageBucket: "rajbiosis-central.firebasestorage.app",
  messagingSenderId: "190335913620",
  appId: "1:190335913620:web:99a14edcbb528f06c1ee81",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = sqliteDb;
export const storage = sqliteStorage;
export default app;
