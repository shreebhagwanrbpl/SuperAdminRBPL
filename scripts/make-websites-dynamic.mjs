import fs from "node:fs";
import path from "node:path";

// Root GitHub directory containing all 80 websites
const rootGithubDir = path.resolve(process.cwd(), "..");

console.log("==================================================");
console.log("🚀 Scanning all websites in:", rootGithubDir);
console.log("==================================================");

const DYNAMIC_LAYOUT_HEADER = `export const dynamic = "force-dynamic";\nexport const revalidate = 0;\nexport const fetchCache = "force-no-store";\n\n`;
const DYNAMIC_PAGE_HEADER = `export const dynamic = "force-dynamic";\nexport const revalidate = 0;\n\n`;

function getFilesRecursively(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
        getFilesRecursively(fullPath, fileList);
      }
    } else if (entry.isFile()) {
      if (
        entry.name === "layout.js" ||
        entry.name === "layout.jsx" ||
        entry.name === "page.js" ||
        entry.name === "page.jsx"
      ) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

let totalWebsitesUpdated = 0;
let totalFilesUpdated = 0;

try {
  const entries = fs.readdirSync(rootGithubDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const siteName = entry.name;
    if (siteName === "SuperAdminRBPL" || siteName === ".git" || siteName.startsWith(".")) continue;

    const sitePath = path.join(rootGithubDir, siteName);

    // Check if it's a Next.js project (has package.json or app/src/app)
    const hasApp = fs.existsSync(path.join(sitePath, "src", "app")) || fs.existsSync(path.join(sitePath, "app"));
    if (!hasApp) continue;

    const appDir = fs.existsSync(path.join(sitePath, "src", "app"))
      ? path.join(sitePath, "src", "app")
      : path.join(sitePath, "app");

    const files = getFilesRecursively(appDir);
    let siteUpdatedFiles = 0;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const fileName = path.basename(filePath);

        if (!content.includes("export const dynamic")) {
          let updatedContent = "";

          if (fileName.startsWith("layout")) {
            // If it starts with "use client", add after it or at top
            if (content.trim().startsWith('"use client"') || content.trim().startsWith("'use client'")) {
              // Client components don't take dynamic exports, skip or handle
              continue;
            }
            updatedContent = DYNAMIC_LAYOUT_HEADER + content;
          } else if (fileName.startsWith("page")) {
            if (content.trim().startsWith('"use client"') || content.trim().startsWith("'use client'")) {
              continue;
            }
            updatedContent = DYNAMIC_PAGE_HEADER + content;
          }

          if (updatedContent) {
            fs.writeFileSync(filePath, updatedContent, "utf8");
            siteUpdatedFiles++;
            totalFilesUpdated++;
          }
        }
      } catch (err) {
        console.warn(`  ⚠️ Could not update file: ${filePath} (${err.message})`);
      }
    }

    if (siteUpdatedFiles > 0) {
      console.log(` [${siteName}]: Updated ${siteUpdatedFiles} files with 100% Dynamic Live Caching`);
      totalWebsitesUpdated++;
    } else {
      console.log(`ℹ️ [${siteName}]: Already configured or client-based`);
    }
  }

  console.log("\n==================================================");
  console.log(`🎉 COMPLETED SUCCESSFULLY!`);
  console.log(`👉 Total Websites Processed: ${totalWebsitesUpdated}`);
  console.log(`👉 Total Route Files Configured: ${totalFilesUpdated}`);
  console.log("==================================================");
} catch (error) {
  console.error("Fatal Error:", error);
}
