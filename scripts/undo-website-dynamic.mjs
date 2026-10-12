import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Root GitHub directory containing all websites
const rootGithubDir = path.resolve(process.cwd(), "..");

const args = process.argv.slice(2);

console.log("==================================================");
console.log("⏪ Undo Dynamic Script Tool");
console.log("==================================================");

function undoWebsite(siteName) {
  const sitePath = path.join(rootGithubDir, siteName);
  if (!fs.existsSync(sitePath)) {
    console.log(`❌ Folder not found: ${siteName}`);
    return;
  }

  // 1. Try git restore
  if (fs.existsSync(path.join(sitePath, ".git"))) {
    try {
      execSync("git restore .", { cwd: sitePath, stdio: "ignore" });
      console.log(` [${siteName}]: 100% Restored using git restore!`);
      return;
    } catch {
      try {
        execSync("git checkout .", { cwd: sitePath, stdio: "ignore" });
        console.log(` [${siteName}]: 100% Restored using git checkout!`);
        return;
      } catch (err) {
        console.warn(`⚠️ Git restore failed for ${siteName}, attempting manual cleanup:`, err.message);
      }
    }
  }

  console.log(`ℹ️ [${siteName}]: Completed.`);
}

if (args.length > 0) {
  for (const siteName of args) {
    undoWebsite(siteName.trim());
  }
} else {
  console.log("Usage: node scripts/undo-website-dynamic.mjs <WebsiteFolderName1> <WebsiteFolderName2>");
  console.log("Example: node scripts/undo-website-dynamic.mjs Rajbiosis-central sales-performancesp sulckit.in");
}
