import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const count = await db.collection("queries").countDocuments();
console.log("Total queries in MongoDB 'queries' collection:", count);

const sample = await db.collection("queries").find({}).sort({ createdAt: -1 }).limit(10).toArray();
for (const q of sample) {
  console.log("-----------------------------------------");
  console.log("ID:", q._id);
  console.log("Type:", q.type, "Website:", q.websiteId);
  console.log("Name:", q.name, "Email:", q.email, "Phone:", q.phone);
  console.log("createdAt:", q.createdAt, typeof q.createdAt);
  console.log("data keys:", q.data ? Object.keys(q.data) : "no data");
  if (q.data) {
    console.log("data.createdAt:", q.data.createdAt, typeof q.data.createdAt);
    console.log("data.date:", q.data.date, "data.time:", q.data.time, "data.timestamp:", q.data.timestamp);
  }
}

process.exit(0);
