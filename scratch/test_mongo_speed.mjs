import { createMongoClient, CLOUD_ATLAS_DIRECT_URI, getCompanyProductsCollectionName } from "../lib/mongodb.js";

async function test() {
  const client = createMongoClient(CLOUD_ATLAS_DIRECT_URI);
  const conn0 = Date.now();
  await client.connect();
  console.log('Direct connect took:', Date.now() - conn0, 'ms');
  const db = client.db('company_master_cms');
  const colName = getCompanyProductsCollectionName('RBPL');
  const t0 = Date.now();
  const cat = await db.collection(colName).findOne({ _id: 'test-strips' });
  const t1 = Date.now();
  console.log('findOne took:', t1 - t0, 'ms');
  
  const sub = cat.subcategories.find(s => s.id === 'urine-test-strip');
  const originalIds = sub.products[0].websiteIds;
  sub.products[0].websiteIds = ['indiandiagnostic', 'centralbiomedicals'];
  const t2 = Date.now();
  await db.collection(colName).updateOne({ _id: cat._id }, { $set: { subcategories: cat.subcategories } });
  const t3 = Date.now();
  console.log('updateOne took:', t3 - t2, 'ms');
  console.log('Total update time:', t3 - t0, 'ms');

  // restore original
  sub.products[0].websiteIds = originalIds;
  await db.collection(colName).updateOne({ _id: cat._id }, { $set: { subcategories: cat.subcategories } });
  process.exit(0);
}

test();
