import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const colName = "rbpl_products";
const standaloneIds = [
  "f42b6625-b523-479c-bf9a-df947be0b40f",
  "b1b68835-3ab7-482d-b36d-05e7aaab1dc6"
];

console.log("Total docs in rbpl_products:", await db.collection(colName).countDocuments());

let t0 = Date.now();
const withFullDoc = await db.collection(colName).find(
  { "subcategories.products.id": { $in: standaloneIds } }
).toArray();
console.log(`Querying without $or (single field): ${Date.now() - t0}ms, doc size approx: ${JSON.stringify(withFullDoc).length} bytes`);

t0 = Date.now();
const withProjection = await db.collection(colName).find(
  { "subcategories.products.id": { $in: standaloneIds } },
  { projection: { _id: 1 } }
).toArray();
console.log(`Querying with projection: ${Date.now() - t0}ms, found:`, withProjection);

process.exit(0);
