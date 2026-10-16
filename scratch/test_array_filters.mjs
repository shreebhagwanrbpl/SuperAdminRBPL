import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const colName = "rbpl_products";
const testProdId = "f42b6625-b523-479c-bf9a-df947be0b40f";
const now = new Date().toISOString();

const t0 = Date.now();
const result = await db.collection(colName).updateOne(
  { "subcategories.products.id": testProdId },
  {
    $set: {
      "subcategories.$[].products.$[prod].websiteIds": ["rajbiosis.com", "rbplbiomedical.com", "oletur.com"],
      "subcategories.$[].products.$[prod].updatedAt": now,
      updatedAt: now,
    }
  },
  {
    arrayFilters: [
      { "prod.id": testProdId }
    ]
  }
);

console.log(`Update with arrayFilters took: ${Date.now() - t0}ms! Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

// Verify that it actually updated the product
const check = await db.collection(colName).findOne(
  { "subcategories.products.id": testProdId },
  { projection: { "subcategories.products.$": 1 } }
);
console.log("Updated product websiteIds:", check?.subcategories?.[0]?.products?.[0]?.websiteIds);

process.exit(0);
