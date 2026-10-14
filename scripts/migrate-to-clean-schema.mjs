import path from "node:path";
import { pathToFileURL } from "node:url";

const mongodbModulePath = pathToFileURL(path.resolve(process.cwd(), "lib", "mongodb.js")).href;
const mongoServerPath = pathToFileURL(path.resolve(process.cwd(), "lib", "mongoDbServer.js")).href;
const websiteMapPath = pathToFileURL(path.resolve(process.cwd(), "lib", "websiteCompanyMap.js")).href;

const { connectToDatabase } = await import(mongodbModulePath);
const { normalizeOrgId } = await import(mongoServerPath);
const { normalizeWebsiteId } = await import(websiteMapPath);

async function main() {
  console.log("=== STARTING CLEAN SCHEMA MIGRATION ===");
  const { db } = await connectToDatabase();
  console.log("✓ Connected to MongoDB database:", db.databaseName);

  // ----------------------------------------------------
  // STEP 1: CATEGORIES & NESTED SUBCATEGORIES & PRODUCTS
  // ----------------------------------------------------
  console.log("\n[1/5] Fetching categories & subcategories from documents...");
  const companyDocs = await db.collection("documents")
    .find({ path: { $regex: "^companies/" } })
    .toArray();

  const catDocs = companyDocs.filter(d => !d.path.includes("/subcategories/") && d.path.includes("/categories/"));
  const subcatDocs = companyDocs.filter(d => d.path.includes("/subcategories/"));
  console.log(`Found ${catDocs.length} categories, ${subcatDocs.length} subcategories.`);

  const subsByCat = new Map();
  let totalProductCount = 0;

  for (const sub of subcatDocs) {
    const parts = (sub.path || "").split("/");
    const orgId = normalizeOrgId(parts[1]);
    const catId = parts[3];
    const subId = sub.doc_id || parts[parts.length - 1];
    const key = `${orgId}_${catId}`;

    if (!subsByCat.has(key)) subsByCat.set(key, []);

    const subData = sub.data || {};
    const rawProds = Array.isArray(subData.products) ? subData.products : [];
    totalProductCount += rawProds.length;

    subsByCat.get(key).push({
      id: subId,
      name: subData.name || subData.subCategory || subId,
      subCategory: subData.subCategory || subData.name || subId,
      slug: subId,
      websiteIds: Array.isArray(subData.websiteIds) ? subData.websiteIds : ["all"],
      products: rawProds.map(p => ({
        id: String(p.id || p.productId || p.slug || p.title || ""),
        productId: String(p.productId || p.id || p.slug || p.title || ""),
        title: p.title || p.name || "",
        name: p.name || p.title || "",
        slug: p.slug || String(p.title || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
        price: p.price || "",
        image: p.image || (p.images && p.images[0]) || "",
        images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
        websiteIds: Array.isArray(p.websiteIds) ? p.websiteIds : (p.websiteIds ? [p.websiteIds] : ["all"]),
        status: p.status || "active",
        isPublished: p.isPublished !== false,
        ...p,
      })),
      updatedAt: sub.updated_at ? new Date(sub.updated_at) : new Date(),
    });
  }

  console.log(`Grouped subcategories into ${subsByCat.size} categories with ${totalProductCount} total products.`);
  console.log("Writing nested categories to 'categories' collection...");

  let savedCats = 0;
  for (const c of catDocs) {
    const parts = (c.path || "").split("/");
    const orgId = normalizeOrgId(parts[1]);
    const catId = c.doc_id || parts[parts.length - 1];
    const key = `${orgId}_${catId}`;
    const data = c.data || {};
    const subcategories = subsByCat.get(key) || [];

    const categoryDoc = {
      _id: key,
      categoryId: catId,
      organizationId: orgId,
      name: data.name || data.category || catId,
      category: data.category || data.name || catId,
      slug: data.slug || catId,
      websiteIds: Array.isArray(data.websiteIds) ? data.websiteIds : ["all"],
      subcategories,
      data,
      updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
    };

    await db.collection("categories").replaceOne(
      { _id: key },
      categoryDoc,
      { upsert: true }
    );
    savedCats++;
    const prodCount = subcategories.reduce((acc, s) => acc + s.products.length, 0);
    console.log(`  ✓ [${savedCats}/${catDocs.length}] Saved ${key}: ${subcategories.length} subs, ${prodCount} prods`);
  }
  console.log(`✓ STEP 1 COMPLETE: ${savedCats} categories migrated.`);

  // ----------------------------------------------------
  // STEP 2: HOME PAGES
  // ----------------------------------------------------
  console.log("\n[2/5] Migrating Home pages to dedicated 'home' collection...");
  const homePages = await db.collection("documents")
    .find({ path: { $regex: "/pages/home$" } })
    .toArray();

  const homeOps = [];
  for (const doc of homePages) {
    const parts = (doc.path || "").split("/");
    const rawSite = parts.length >= 5 ? parts[2] : (parts.length === 4 ? parts[1] : parts[1]);
    const site = normalizeWebsiteId(rawSite);
    const orgId = normalizeOrgId(parts[1]);

    const homeDoc = {
      _id: site,
      websiteId: site,
      organizationId: orgId,
      ...(doc.data || {}),
      updatedAt: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    };

    homeOps.push({
      replaceOne: {
        filter: { _id: site },
        replacement: homeDoc,
        upsert: true,
      },
    });
  }

  if (homeOps.length > 0) {
    await db.collection("home").bulkWrite(homeOps, { ordered: false });
  }
  console.log(`✓ STEP 2 COMPLETE: Saved ${homeOps.length} Home pages into 'home' collection!`);

  // ----------------------------------------------------
  // STEP 3: SERVICES PAGES
  // ----------------------------------------------------
  console.log("\n[3/5] Migrating Services to dedicated 'services' collection...");
  const servicesPages = await db.collection("documents")
    .find({ path: { $regex: "/pages/services$" } })
    .toArray();

  const servOps = [];
  for (const doc of servicesPages) {
    const parts = (doc.path || "").split("/");
    const rawSite = parts.length >= 5 ? parts[2] : (parts.length === 4 ? parts[1] : parts[1]);
    const site = normalizeWebsiteId(rawSite);
    const orgId = normalizeOrgId(parts[1]);

    const servicesDoc = {
      _id: site,
      websiteId: site,
      organizationId: orgId,
      ...(doc.data || {}),
      updatedAt: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    };

    servOps.push({
      replaceOne: {
        filter: { _id: site },
        replacement: servicesDoc,
        upsert: true,
      },
    });
  }

  if (servOps.length > 0) {
    await db.collection("services").bulkWrite(servOps, { ordered: false });
  }
  console.log(`✓ STEP 3 COMPLETE: Saved ${servOps.length} Services pages into 'services' collection!`);

  // ----------------------------------------------------
  // STEP 4: CONTACT PAGES
  // ----------------------------------------------------
  console.log("\n[4/5] Migrating Contact pages to dedicated 'contact' collection...");
  const contactPages = await db.collection("documents")
    .find({ path: { $regex: "/pages/contact$" } })
    .toArray();

  const contOps = [];
  for (const doc of contactPages) {
    const parts = (doc.path || "").split("/");
    const rawSite = parts.length >= 5 ? parts[2] : (parts.length === 4 ? parts[1] : parts[1]);
    const site = normalizeWebsiteId(rawSite);
    const orgId = normalizeOrgId(parts[1]);

    const contactDoc = {
      _id: site,
      websiteId: site,
      organizationId: orgId,
      ...(doc.data || {}),
      updatedAt: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    };

    contOps.push({
      replaceOne: {
        filter: { _id: site },
        replacement: contactDoc,
        upsert: true,
      },
    });
  }

  if (contOps.length > 0) {
    await db.collection("contact").bulkWrite(contOps, { ordered: false });
  }
  console.log(`✓ STEP 4 COMPLETE: Saved ${contOps.length} Contact pages into 'contact' collection!`);

  // ----------------------------------------------------
  // STEP 5: DISTRICTS (BATCHED)
  // ----------------------------------------------------
  console.log("\n[5/5] Migrating Districts to dedicated 'districts' collection...");
  const districtDocs = await db.collection("documents")
    .find({ path: { $regex: "districts" } })
    .toArray();

  console.log(`Found ${districtDocs.length} district documents.`);

  let districtBatch = [];
  let districtCount = 0;
  for (const doc of districtDocs) {
    const parts = (doc.path || "").split("/");
    const distIdx = parts.indexOf("districts");
    if (distIdx === -1) continue;
    const rawSite = parts[distIdx - 1];
    const site = normalizeWebsiteId(rawSite);
    const slug = doc.doc_id || parts[parts.length - 1];
    const id = `${site}_${slug}`;

    districtBatch.push({
      replaceOne: {
        filter: { _id: id },
        replacement: {
          _id: id,
          websiteId: site,
          slug,
          name: doc.data?.name || doc.data?.district || slug,
          ...(doc.data || {}),
          updatedAt: doc.updated_at ? new Date(doc.updated_at) : new Date(),
        },
        upsert: true,
      },
    });

    if (districtBatch.length >= 200) {
      await db.collection("districts").bulkWrite(districtBatch, { ordered: false });
      districtCount += districtBatch.length;
      districtBatch = [];
      console.log(`  Processed ${districtCount}/${districtDocs.length} districts...`);
    }
  }

  if (districtBatch.length > 0) {
    await db.collection("districts").bulkWrite(districtBatch, { ordered: false });
    districtCount += districtBatch.length;
  }
  console.log(`✓ STEP 5 COMPLETE: Saved ${districtCount} District records into 'districts' collection!`);

  // ----------------------------------------------------
  // FINAL COUNTS VERIFICATION
  // ----------------------------------------------------
  console.log("\n=== MIGRATION SUMMARY & VERIFICATION ===");
  console.log("- 'categories'     :", await db.collection("categories").countDocuments(), "docs");
  console.log("- 'home'           :", await db.collection("home").countDocuments(), "docs");
  console.log("- 'services'       :", await db.collection("services").countDocuments(), "docs");
  console.log("- 'contact'        :", await db.collection("contact").countDocuments(), "docs");
  console.log("- 'districts'      :", await db.collection("districts").countDocuments(), "docs");
  console.log("- 'websites'       :", await db.collection("websites").countDocuments(), "docs");
  console.log("- 'users'          :", await db.collection("users").countDocuments(), "docs");
  console.log("- 'queries'        :", await db.collection("queries").countDocuments(), "docs");
  console.log("- 'organizations'  :", await db.collection("organizations").countDocuments(), "docs");
  console.log("- 'documents' (orig):", await db.collection("documents").countDocuments(), "docs (100% UNTOUCHED)");
  console.log("- 'backup_archive' :", await db.collection("documents_backup_archive").countDocuments(), "docs (100% SAFE)");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
