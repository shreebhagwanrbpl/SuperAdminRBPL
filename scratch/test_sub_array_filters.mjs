import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const colName = "rbpl_products";
const catId = "test-strips";
const subId = "urine-test-strip";
const now = new Date().toISOString();

const t0 = Date.now();
const res = await db.collection(colName).updateOne(
  { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
  {
    $set: {
      "subcategories.$[sub].websiteIds": ["rajbiosis.com"],
      "subcategories.$[sub].products.$[].websiteIds": ["rajbiosis.com"],
      updatedAt: now,
    }
  },
  {
    arrayFilters: [
      { $or: [{ "sub.id": subId }, { "sub.slug": subId }] }
    ]
  }
);

console.log(`Cascade subcategory update with arrayFilters took: ${Date.now() - t0}ms! Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);

// Verify
const check = await db.collection(colName).findOne(
  { _id: catId },
  { projection: { "subcategories.id": 1, "subcategories.websiteIds": 1, "subcategories.products.websiteIds": 1 } }
);
const sub = check.subcategories.find(s => s.id === subId);
console.log("Sub websiteIds:", sub?.websiteIds);
console.log("Sub first prod websiteIds:", sub?.products?.[0]?.websiteIds);

process.exit(0);
