import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const VPS_URL = "https://admin.rajbiosis.app";
const dbPath = path.resolve(process.cwd(), "data", "catalog.db");

console.log(`Opening local database: ${dbPath}`);
const db = new DatabaseSync(dbPath);

const rows = db.prepare("SELECT path, data FROM documents").all();
console.log(`Found ${rows.length} local documents to sync to ${VPS_URL}...`);

async function syncDocuments() {
  const BATCH_SIZE = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const paths = chunk.map((r) => {
      let data = {};
      try {
        data = JSON.parse(r.data);
      } catch (e) {
        data = {};
      }
      return {
        op: "set",
        path: r.path,
        data,
        merge: true,
      };
    });

    try {
      const res = await fetch(`${VPS_URL}/api/local-firestore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "batch",
          paths,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${res.status} ${text}`);
        failCount += chunk.length;
      } else {
        const json = await res.json();
        if (json.ok) {
          successCount += chunk.length;
          process.stdout.write(`\rProgress: ${successCount}/${rows.length} documents synced...`);
        } else {
          console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} error:`, json.error);
          failCount += chunk.length;
        }
      }
    } catch (err) {
      console.error(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} network error:`, err.message);
      failCount += chunk.length;
    }
  }

  console.log(`\n\nSync Finished!`);
  console.log(`Successfully synced: ${successCount} / ${rows.length}`);
  console.log(`Failed: ${failCount}`);
}

syncDocuments().catch((err) => {
  console.error("Fatal error during sync:", err);
});
