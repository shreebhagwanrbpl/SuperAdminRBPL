import { getDb } from "../lib/mongodb.js";

const db = await getDb();
const doc = await db.collection("rbpl_products").findOne({ _id: "test-strips" });
console.log("Category:", doc ? doc.name : "Not found");
if (doc && doc.subcategories) {
  for (const sub of doc.subcategories) {
    console.log(`Sub: ${sub.name} (${sub.id}) - Prods: ${sub.products?.length || 0}`);
    if (sub.products && sub.products.length > 0) {
      console.log("Sample prod ids:", sub.products.slice(0, 3).map(p => ({ id: p.id, productId: p.productId, title: p.title || p.name })));
    }
  }
}
process.exit(0);
