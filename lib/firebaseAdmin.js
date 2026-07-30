import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),

  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
};

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseAdminConfig);

export const adminDb = getFirestore(adminApp);

export const adminStorage = getStorage(adminApp).bucket();

export default adminApp;