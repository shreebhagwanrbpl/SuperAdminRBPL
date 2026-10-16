import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const all = await db.collection("queries").find({}).toArray();
console.log(`Total queries: ${all.length}`);

let missing = 0;
for (const q of all) {
  const c1 = q.createdAt;
  const c2 = q.data?.createdAt;
  const c3 = q.data?.date;
  const c4 = q.data?.timestamp;
  if (!c1 && !c2 && !c3 && !c4) {
    console.log("Missing date entirely:", q._id, q.name, q.type);
    missing++;
  } else {
    // console.log("OK:", q._id, "c1:", c1, "c2:", c2);
  }
}
console.log(`Queries missing date entirely: ${missing}`);

process.exit(0);
