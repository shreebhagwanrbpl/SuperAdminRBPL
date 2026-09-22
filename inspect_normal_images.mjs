import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "@/lib/sqliteFirestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGIJXX3MR1CxmIJbJHyVzbfRa0M0Sw6FQ",
  authDomain: "rajbiosis-central.firebaseapp.com",
  projectId: "rajbiosis-central",
  storageBucket: "rajbiosis-central.firebasestorage.app",
  messagingSenderId: "190335913620",
  appId: "1:190335913620:web:99a14edcbb528f06c1ee81"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("=== CHECKING NORMAL PRODUCTS (companies/rajbiosis/products) ===");
  const snap = await getDocs(collection(db, "companies", "rajbiosis", "products"));
  console.log(`Total normal products: ${snap.size}`);
  for (const docSnap of snap.docs.slice(0, 10)) {
    const data = docSnap.data();
    console.log({
      id: docSnap.id,
      title: data.title || data.name,
      image: data.image,
      images: (data.images || []).slice(0, 2)
    });
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
