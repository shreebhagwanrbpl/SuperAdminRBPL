import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const collections = ["rbpl_products", "human_products", "global_products"];

for (const col of collections) {
  console.log(`Creating indexes on ${col}...`);
  await db.collection(col).createIndex({ "subcategories.products.id": 1 });
  await db.collection(col).createIndex({ "subcategories.products.productId": 1 });
  await db.collection(col).createIndex({ "subcategories.products.categoryProductId": 1 });
  await db.collection(col).createIndex({ "subcategories.id": 1 });
  await db.collection(col).createIndex({ categoryId: 1 });
  await db.collection(col).createIndex({ slug: 1 });
}

console.log("Indexes created successfully!");
process.exit(0);
