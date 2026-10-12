import { getDb } from "../lib/mongodb.js";
import fs from "node:fs/promises";
import path from "node:path";

const isDryRun = !process.argv.includes("--run");

async function main() {
  console.log(`\n======================================================`);
  console.log(`  MONGODB SYSTEMATIC DEDUPLICATION SCRIPT`);
  console.log(`  Mode: ${isDryRun ? "DRY-RUN (Simulating only)" : "LIVE EXECUTION (Modifying DB)"}`);
  console.log(`======================================================\n`);

  const db = await getDb();

  // 1. Fetch subcategory documents from documents collection
  const subDocs = await db.collection("documents")
    .find({ collection_path: { $regex: /subcategories$/i } })
    .toArray();

  console.log(`Found ${subDocs.length} subcategory documents in documents collection.`);

  const backupData = [];
  const prodIdsToDeleteFromProductsCol = [];
  const subcatUpdates = [];

  let totalDupsFound = 0;

  for (const doc of subDocs) {
    const rawProducts = Array.isArray(doc.data?.products) ? doc.data.products : [];
    if (rawProducts.length === 0) continue;

    // Group by normalized title / slug
    const titleGroups = new Map();
    for (const p of rawProducts) {
      const key = String(p.title || p.name || p.slug || p.id || "").trim().toLowerCase();
      if (!titleGroups.has(key)) titleGroups.set(key, []);
      titleGroups.get(key).push(p);
    }

    const cleanProducts = [];
    const removedFromThisSub = [];

    for (const [key, list] of titleGroups.entries()) {
      if (list.length === 1) {
        cleanProducts.push(list[0]);
      } else {
        // Sort by updatedAt descending (newest first)
        list.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        // Best / canonical version to keep
        const canonical = list[0];
        cleanProducts.push(canonical);

        // Duplicates to remove
        const dups = list.slice(1);
        for (const d of dups) {
          removedFromThisSub.push({
            title: d.title || d.name,
            id: d.id,
            canonicalId: canonical.id,
          });
          totalDupsFound++;

          // Build candidate IDs for products collection
          // orgId is determined from doc.path (e.g. companies/human/... -> HUMAN)
          const parts = (doc.path || doc._id || "").split("/");
          let orgId = "RBPL";
          if (parts[1]) {
            const rawOrg = parts[1].toUpperCase();
            if (rawOrg.includes("HUMAN")) orgId = "HUMAN";
            else if (rawOrg.includes("GLOBAL")) orgId = "GLOBAL";
            else orgId = "RBPL";
          }
          if (d.id) prodIdsToDeleteFromProductsCol.push(`${orgId}_${d.id}`);
          if (d.productId) prodIdsToDeleteFromProductsCol.push(`${orgId}_${d.productId}`);
          if (d.uid) prodIdsToDeleteFromProductsCol.push(`${orgId}_${d.uid}`);
        }
      }
    }

    if (removedFromThisSub.length > 0) {
      console.log(`\n- Subcategory: ${doc._id}`);
      console.log(`  Original: ${rawProducts.length} items -> Cleaned: ${cleanProducts.length} items (Removed ${removedFromThisSub.length} duplicates)`);
      backupData.push({
        _id: doc._id,
        path: doc.path,
        data: doc.data,
      });

      subcatUpdates.push({
        docId: doc._id,
        cleanProducts,
      });
    }
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`Total duplicate products identified: ${totalDupsFound}`);
  console.log(`Total candidate IDs to remove from 'products' collection: ${prodIdsToDeleteFromProductsCol.length}`);
  console.log(`------------------------------------------------------\n`);

  if (isDryRun) {
    console.log(`[DRY-RUN COMPLETE] No database changes were made.`);
    console.log(`To execute this cleanup, run with: node --env-file=.env.local scripts/clean-mongodb-duplicates.mjs --run\n`);
    process.exit(0);
  }

  // === LIVE EXECUTION ===
  console.log(`[STEP 1/3] Creating local backup of affected subcategories...`);
  const backupFile = path.resolve(process.cwd(), "data", `backup_before_dedup_${Date.now()}.json`);
  await fs.mkdir(path.dirname(backupFile), { recursive: true });
  await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`Backup saved to: ${backupFile}`);

  console.log(`\n[STEP 2/3] Updating subcategories in 'documents' collection...`);
  for (const update of subcatUpdates) {
    await db.collection("documents").updateOne(
      { _id: update.docId },
      {
        $set: {
          "data.products": update.cleanProducts,
          updated_at: Date.now(),
        },
      }
    );
    console.log(`Updated subcategory: ${update.docId} (${update.cleanProducts.length} products)`);
  }

  console.log(`\n[STEP 3/3] Deleting duplicate records from 'products' collection...`);
  const uniqueIdsToDelete = [...new Set(prodIdsToDeleteFromProductsCol)];
  const deleteResult = await db.collection("products").deleteMany({
    _id: { $in: uniqueIdsToDelete },
  });
  console.log(`Deleted ${deleteResult.deletedCount} duplicate documents from 'products' collection.`);

  // Final verification
  const remainingProds = await db.collection("products").countDocuments();
  console.log(`\n======================================================`);
  console.log(`  CLEANUP COMPLETE!`);
  console.log(`  Remaining products in 'products' collection: ${remainingProds}`);
  console.log(`======================================================\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Deduplication error:", err);
  process.exit(1);
});
