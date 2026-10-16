import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const colName = "rbpl_products";
const catId = "test-strips";
const now = new Date().toISOString();

const t0 = Date.now();
const res = await db.collection(colName).updateOne(
  { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
  {
    $set: {
      websiteIds: ["rajbiosis.com", "oletur.com"],
      "subcategories.$[].websiteIds": ["rajbiosis.com", "oletur.com"],
      "subcategories.$[].products.$[].websiteIds": ["rajbiosis.com", "oletur.com"],
      updatedAt: now,
    }
  }
);

console.log(`Cascade category update with arrayFilters took: ${Date.now() - t0}ms! Modified: ${res.modifiedCount}`);

// Verify
const check = await db.collection(colName).findOne(
  { _id: catId },
  { projection: { websiteIds: 1, "subcategories.name": 1, "subcategories.websiteIds": 1, "subcategories.products.websiteIds": 1 } }
);
console.log("Cat websiteIds:", check.websiteIds);
console.log("First sub websiteIds:", check.subcategories[0]?.websiteIds);
console.log("First prod websiteIds:", check.subcategories[0]?.products[0]?.websiteIds);

process.exit(0);
