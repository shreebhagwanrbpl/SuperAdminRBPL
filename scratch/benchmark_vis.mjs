import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const colName = "rbpl_products";
const standaloneIds = [
  "f42b6625-b523-479c-bf9a-df947be0b40f",
  "b1b68835-3ab7-482d-b36d-05e7aaab1dc6"
];

let t0 = Date.now();
const catsWithProds = await db.collection(colName).find({
  $or: [
    { "subcategories.products.id": { $in: standaloneIds } },
    { "subcategories.products.categoryProductId": { $in: standaloneIds } },
    { "subcategories.products.productId": { $in: standaloneIds } },
  ],
}).toArray();
console.log(`Find in ${colName}: ${Date.now() - t0}ms (found ${catsWithProds.length} cats)`);

t0 = Date.now();
const res = await db.collection("products").updateMany(
  {
    $or: [
      { _id: { $in: standaloneIds } },
      { id: { $in: standaloneIds } },
      { productId: { $in: standaloneIds } },
    ],
  },
  { $set: { websiteIds: ["rajbiosis.com"], updatedAt: new Date().toISOString() } }
);
console.log(`Update in products: ${Date.now() - t0}ms (matched: ${res.matchedCount})`);

process.exit(0);
