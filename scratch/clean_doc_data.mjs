import { createMongoClient, CLOUD_ATLAS_DIRECT_URI } from "../lib/mongodb.js";

async function cleanup() {
  const client = createMongoClient(CLOUD_ATLAS_DIRECT_URI);
  await client.connect();
  const db = client.db('company_master_cms');
  const doc = await db.collection('rbpl_products').findOne({ _id: 'test-strips' });
  if (doc) {
    const cleanData = {
      id: doc.categoryId || doc.slug || 'test-strips',
      name: doc.name || 'Test Strips',
      category: doc.category || 'Test Strips',
      slug: doc.slug || 'test-strips',
      companyId: 'rajbiosis',
      websiteIds: doc.websiteIds || [],
      updatedAt: doc.updatedAt || new Date().toISOString()
    };
    await db.collection('rbpl_products').updateOne(
      { _id: 'test-strips' },
      { $set: { data: cleanData } }
    );
    console.log('Cleaned up recursive doc.data successfully!');
  }

  // Check new size
  const fresh = await db.collection('rbpl_products').findOne({ _id: 'test-strips' });
  console.log('New document size:', JSON.stringify(fresh).length, 'bytes');
  process.exit(0);
}

cleanup();
