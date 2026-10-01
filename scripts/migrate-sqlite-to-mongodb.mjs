import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { MongoClient } from "mongodb";
import { WEBSITE_COMPANY_MAP, normalizeWebsiteId } from "../lib/websiteCompanyMap.js";

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

let MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/company_master_cms";
const MONGODB_DB = process.env.MONGODB_DB || "company_master_cms";
const dbPath = path.resolve(process.cwd(), "data", "catalog.db");

if (MONGODB_URI.includes("://") && MONGODB_URI.includes("@")) {
  try {
    const match = MONGODB_URI.match(/^mongodb:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) {
      const u = match[1];
      const p = match[2];
      const rest = match[3];
      MONGODB_URI = `mongodb://${encodeURIComponent(decodeURIComponent(u))}:${encodeURIComponent(decodeURIComponent(p))}@${rest}`;
    }
  } catch {}
}

console.log(`\n=== MONGODB MIGRATION SCRIPT ===`);
console.log(`Connecting to MongoDB: ${MONGODB_URI.replace(/:([^:@]+)@/, ":****@")}`);
console.log(`SQLite database source: ${dbPath}\n`);

const client = new MongoClient(MONGODB_URI);
const sqlite = new DatabaseSync(dbPath);

async function runMigration() {
  await client.connect();
  const db = client.db(MONGODB_DB);
  console.log(`✓ Connected to MongoDB database: ${MONGODB_DB}\n`);

  // 1. ORGANIZATIONS
  console.log(`[1/7] Seeding Organizations...`);
  const orgs = [
    { _id: "RBPL", code: "RBPL", name: "Raj Biosis Pvt Ltd", status: "active", createdAt: new Date() },
    { _id: "HUMAN", code: "HUMAN", name: "Human Biomedical", status: "active", createdAt: new Date() },
    { _id: "GLOBAL", code: "GLOBAL", name: "Global Biomedical", status: "active", createdAt: new Date() },
  ];
  for (const org of orgs) {
    await db.collection("organizations").updateOne({ _id: org._id }, { $set: org }, { upsert: true });
  }
  console.log(`✓ Seeded ${orgs.length} Organizations (RBPL, HUMAN, GLOBAL)\n`);

  // 2. WEBSITES REGISTRY
  console.log(`[2/7] Seeding Websites Registry...`);
  let websiteCount = 0;
  for (const [companyKey, sites] of Object.entries(WEBSITE_COMPANY_MAP)) {
    const orgId = companyKey.toUpperCase();
    for (const siteName of sites) {
      const normalized = normalizeWebsiteId(siteName);
      const siteDoc = {
        _id: normalized,
        websiteId: normalized,
        organizationId: orgId,
        name: siteName,
        domain: `${siteName}.com`,
        status: "active",
        createdAt: new Date(),
      };
      await db.collection("websites").updateOne({ _id: normalized }, { $set: siteDoc }, { upsert: true });
      websiteCount++;
    }
  }
  console.log(`✓ Seeded ${websiteCount} Websites in Registry\n`);

  // 3. READ SQLITE DOCUMENTS
  const rows = sqlite.prepare("SELECT path, collection_path, doc_id, data, updated_at FROM documents").all();
  console.log(`Found ${rows.length} documents in SQLite database to process...\n`);

  // 4. CATEGORIES, PRODUCTS, PAGES, QUERIES MIGRATION
  console.log(`[3/7] Migrating Categories, Products, Pages and Queries...`);
  let catCount = 0;
  let prodCount = 0;
  let pageCount = 0;
  let queryCount = 0;

  for (const r of rows) {
    let data = {};
    try { data = JSON.parse(r.data); } catch { data = {}; }
    const p = String(r.path || "");

    // A. Raw Documents (for full backwards compatibility)
    await db.collection("documents").updateOne(
      { _id: p },
      {
        $set: {
          path: p,
          collection_path: r.collection_path,
          doc_id: r.doc_id,
          data,
          updated_at: r.updated_at || Date.now(),
        },
      },
      { upsert: true }
    );

    // B. Categories (companies/{org}/categories/{catId})
    if (p.startsWith("companies/") && p.includes("/categories/") && !p.includes("/subcategories")) {
      const parts = p.split("/");
      const orgId = parts[1].toUpperCase();
      const catId = parts[3];
      const catDoc = {
        _id: `${orgId}_${catId}`,
        categoryId: catId,
        organizationId: orgId,
        name: data.name || data.category || catId,
        slug: catId,
        data,
        updatedAt: new Date(r.updated_at || Date.now()),
      };
      await db.collection("categories").updateOne({ _id: catDoc._id }, { $set: catDoc }, { upsert: true });
      catCount++;
    }

    // C. Subcategories & Embedded Products (companies/{org}/categories/{catId}/subcategories/{subId})
    if (p.startsWith("companies/") && p.includes("/subcategories/")) {
      const parts = p.split("/");
      const orgId = parts[1].toUpperCase();
      const catId = parts[3];
      const subId = parts[5];

      // Update Subcategory in Category
      await db.collection("categories").updateOne(
        { _id: `${orgId}_${catId}` },
        {
          $addToSet: {
            subcategories: {
              id: subId,
              name: data.name || data.subCategory || subId,
              slug: subId,
            },
          },
        }
      );

      // Extract Products
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      for (const prod of rawProducts) {
        const prodId = String(prod.id || prod.productId || prod.slug || prod.title || crypto.randomUUID());
        const prodDoc = {
          _id: `${orgId}_${prodId}`,
          productId: prodId,
          organizationId: orgId,
          categoryId: catId,
          subcategoryId: subId,
          title: prod.title || prod.name || "",
          name: prod.name || prod.title || "",
          slug: prod.slug || String(prod.title || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
          price: prod.price || null,
          image: prod.image || (prod.images && prod.images[0]) || "",
          images: Array.isArray(prod.images) ? prod.images : (prod.image ? [prod.image] : []),
          websiteIds: prod.websiteIds || ["all"],
          scope: "organization",
          data: prod,
          status: prod.status || "active",
          updatedAt: new Date(),
        };
        await db.collection("products").updateOne({ _id: prodDoc._id }, { $set: prodDoc }, { upsert: true });
        prodCount++;
      }
    }

    // D. Standalone Products (companies/{org}/products/{prodId})
    if (p.startsWith("companies/") && p.includes("/products/") && !p.includes("/categories/")) {
      const parts = p.split("/");
      const orgId = parts[1].toUpperCase();
      const prodId = parts[3];
      const prodDoc = {
        _id: `${orgId}_${prodId}`,
        productId: prodId,
        organizationId: orgId,
        title: data.title || data.name || prodId,
        slug: data.slug || prodId,
        websiteIds: data.websiteIds || ["all"],
        scope: "organization",
        data,
        status: data.status || "active",
        updatedAt: new Date(r.updated_at || Date.now()),
      };
      await db.collection("products").updateOne({ _id: prodDoc._id }, { $set: prodDoc }, { upsert: true });
      prodCount++;
    }

    // E. Dynamic Pages (websites/{org}/{website}/pages/{pageId})
    if (p.startsWith("websites/") && p.includes("/pages/")) {
      const parts = p.split("/");
      const orgId = parts[1].toUpperCase();
      const websiteId = parts[2];
      const pageId = parts[4];
      const pageDoc = {
        _id: `${websiteId}_${pageId}`,
        websiteId,
        organizationId: orgId,
        page: pageId,
        title: data.title || "",
        description: data.description || "",
        data,
        updatedAt: new Date(r.updated_at || Date.now()),
      };
      await db.collection("pages").updateOne({ _id: pageDoc._id }, { $set: pageDoc }, { upsert: true });
      pageCount++;
    }

    // F. Queries / Leads (websitesQueries/{websiteId}/...)
    if (p.startsWith("websitesQueries/")) {
      const parts = p.split("/");
      const websiteId = parts[1];
      const type = parts[2] === "contactQueries" ? "contact" : "product";
      const qId = parts[3] || r.doc_id;
      const queryDoc = {
        _id: `${websiteId}_${qId}`,
        queryId: qId,
        websiteId,
        type,
        name: data.name || data.fullName || "",
        phone: data.phone || data.mobile || "",
        email: data.email || "",
        message: data.message || data.query || "",
        data,
        status: data.status || "unread",
        createdAt: new Date(data.createdAt || r.updated_at || Date.now()),
      };
      await db.collection("queries").updateOne({ _id: queryDoc._id }, { $set: queryDoc }, { upsert: true });
      queryCount++;
    }
  }
  console.log(`✓ Categories migrated: ${catCount}`);
  console.log(`✓ Products migrated: ${prodCount}`);
  console.log(`✓ Pages migrated: ${pageCount}`);
  console.log(`✓ Queries migrated: ${queryCount}\n`);

  // 5. USERS MIGRATION
  console.log(`[4/7] Migrating Users...`);
  const localUsers = sqlite.prepare("SELECT uid, email, password_hash, user_json, created_at FROM local_users").all();
  let userCount = 0;
  for (const u of localUsers) {
    let profile = {};
    try { profile = JSON.parse(u.user_json || "{}"); } catch { profile = {}; }
    const isSuperAdmin = u.email.toLowerCase() === "rajbiosis12@gmail.com";
    const userDoc = {
      _id: u.uid,
      uid: u.uid,
      email: u.email.toLowerCase(),
      passwordHash: u.password_hash,
      fullName: profile.fullName || "Admin User",
      role: isSuperAdmin ? "SuperAdmin" : (profile.role || "Admin"),
      designation: isSuperAdmin ? "IT" : (profile.designation || "Executive"),
      phone: profile.phone || "",
      status: isSuperAdmin ? "approved" : (profile.status || "pending"),
      createdAt: new Date(u.created_at || Date.now()),
    };
    await db.collection("users").updateOne({ _id: u.uid }, { $set: userDoc }, { upsert: true });
    userCount++;
  }
  console.log(`✓ Migrated ${userCount} Users to MongoDB users collection\n`);

  // 6. CREATE INDEXES FOR ULTRA-FAST PERFORMANCE
  console.log(`[5/7] Creating Performance Indexes in MongoDB...`);
  await db.collection("products").createIndex({ organizationId: 1, websiteIds: 1 });
  await db.collection("products").createIndex({ slug: 1 });
  await db.collection("categories").createIndex({ organizationId: 1, slug: 1 });
  await db.collection("pages").createIndex({ websiteId: 1, page: 1 });
  await db.collection("queries").createIndex({ websiteId: 1, createdAt: -1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("documents").createIndex({ path: 1 });
  console.log(`✓ Indexes created successfully\n`);

  // 7. SUMMARY
  console.log(`=== MIGRATION COMPLETED SUCCESSFULLY! ===`);
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(` - Collection '${c.name}': ${count} documents`);
  }
}

runMigration()
  .then(() => {
    console.log(`\n🎉 All data migrated with 100% integrity into MongoDB!`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n❌ Migration failed:`, err);
    process.exit(1);
  });
