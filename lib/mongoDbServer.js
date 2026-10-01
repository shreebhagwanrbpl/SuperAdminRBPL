import { getDb } from "./mongodb.js";
import { groupWebsitePath, normalizeWebsiteId, getCompanyForWebsitePath } from "./websiteCompanyMap.js";
import crypto from "node:crypto";

export function normalizePath(path) {
  if (!path || typeof path !== "string") return "";
  const clean = path.replace(/^\/+|\/+$/g, "").trim();
  return groupWebsitePath(clean);
}

export function splitPath(path) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  const docId = parts[parts.length - 1] || "";
  const collectionPath = parts.slice(0, -1).join("/");
  return { collectionPath, docId, parts };
}

// Synchronize structured collections (products, categories, pages, queries, users)
async function syncStructuredCollection(db, path, data, op = "set") {
  try {
    const rawParts = String(path || "").replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    const { collectionPath, docId, parts } = splitPath(path);

    if (op === "delete") {
      // Products
      if (path.includes("/products/")) {
        const prodId = rawParts[rawParts.length - 1];
        await db.collection("products").deleteMany({ $or: [{ productId: prodId }, { _id: new RegExp(`_${prodId}$`) }] });
      }
      // Categories
      if (path.includes("/categories/") && !path.includes("/subcategories")) {
        const catId = rawParts[rawParts.length - 1];
        await db.collection("categories").deleteMany({ $or: [{ categoryId: catId }, { _id: new RegExp(`_${catId}$`) }] });
      }
      // Pages
      if (path.includes("/pages/")) {
        const pageId = rawParts[rawParts.length - 1];
        const websiteId = rawParts.length >= 5 ? rawParts[2] : (rawParts.length >= 4 ? (rawParts[0] === "websites" && rawParts[2] === "pages" ? rawParts[1] : rawParts[2]) : rawParts[1]);
        await db.collection("pages").deleteMany({ $or: [{ _id: `${websiteId}_${pageId}` }, { websiteId, page: pageId }] });
      }
      // Queries
      if (path.startsWith("websitesQueries/")) {
        const websiteId = rawParts[1];
        const qId = rawParts[rawParts.length - 1];
        await db.collection("queries").deleteMany({ $or: [{ _id: `${websiteId}_${qId}` }, { queryId: qId }] });
      }
      return;
    }

    // 1. Categories (companies/{org}/categories/{catId})
    if (path.includes("/categories/") && !path.includes("/subcategories")) {
      const orgId = (rawParts[0] === "companies" ? rawParts[1] : "RBPL").toUpperCase();
      const catId = rawParts[rawParts.length - 1];
      const catDoc = {
        _id: `${orgId}_${catId}`,
        categoryId: catId,
        organizationId: orgId,
        name: data.name || data.category || catId,
        slug: catId,
        data,
        updatedAt: new Date(),
      };
      await db.collection("categories").updateOne({ _id: catDoc._id }, { $set: catDoc }, { upsert: true });
    }

    // 2. Subcategories & Products (companies/{org}/categories/{catId}/subcategories/{subId})
    if (path.includes("/subcategories/")) {
      const orgId = (rawParts[0] === "companies" ? rawParts[1] : "RBPL").toUpperCase();
      const catId = rawParts[3] || rawParts[1];
      const subId = rawParts[rawParts.length - 1];

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
        },
        { upsert: true }
      );

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
      }
    }

    // 3. Standalone Products (companies/{org}/products/{prodId})
    if (path.includes("/products/") && !path.includes("/categories/")) {
      const orgId = (rawParts[0] === "companies" ? rawParts[1] : "RBPL").toUpperCase();
      const prodId = rawParts[rawParts.length - 1];
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
        updatedAt: new Date(),
      };
      await db.collection("products").updateOne({ _id: prodDoc._id }, { $set: prodDoc }, { upsert: true });
    }

    // 4. Dynamic Pages & Services (websites/.../pages/{pageId})
    if (path.includes("/pages/")) {
      const pageId = rawParts[rawParts.length - 1];
      let websiteId = "";
      let orgId = "RBPL";

      if (rawParts.length >= 5 && rawParts[0] === "websites") {
        orgId = rawParts[1].toUpperCase();
        websiteId = normalizeWebsiteId(rawParts[2]);
      } else if (rawParts.length === 4 && rawParts[0] === "websites" && rawParts[2] === "pages") {
        websiteId = normalizeWebsiteId(rawParts[1]);
        const comp = getCompanyForWebsitePath(websiteId);
        orgId = comp ? comp.toUpperCase() : "RBPL";
      } else {
        websiteId = normalizeWebsiteId(rawParts[1] || "default");
      }

      const pageDoc = {
        _id: `${websiteId}_${pageId}`,
        websiteId,
        organizationId: orgId,
        page: pageId,
        title: data.title || "",
        description: data.description || "",
        data,
        updatedAt: new Date(),
      };
      await db.collection("pages").updateOne({ _id: pageDoc._id }, { $set: pageDoc }, { upsert: true });
    }

    // 5. Customer Leads / Queries (websitesQueries/{websiteId}/...)
    if (path.startsWith("websitesQueries/")) {
      const websiteId = normalizeWebsiteId(rawParts[1] || "default");
      const type = rawParts[2] === "contactQueries" ? "contact" : "product";
      const qId = rawParts[3] || docId;
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
        createdAt: new Date(data.createdAt || Date.now()),
      };
      await db.collection("queries").updateOne({ _id: queryDoc._id }, { $set: queryDoc }, { upsert: true });
    }

    // 6. Users (adminUsers/{uid})
    if (path.startsWith("adminUsers/")) {
      const uid = rawParts[1] || docId;
      const userDoc = {
        _id: uid,
        uid,
        email: String(data.email || "").toLowerCase(),
        fullName: data.fullName || "",
        role: data.role || "Admin",
        designation: data.designation || "Executive",
        phone: data.phone || "",
        status: data.status || "pending",
        updatedAt: new Date(),
      };
      await db.collection("users").updateOne({ _id: uid }, { $set: userDoc }, { upsert: true });
    }
  } catch (err) {
    console.error("[mongoDbServer] sync error:", err);
  }
}

export async function getDocument(path) {
  if (!path || typeof path !== "string") return null;
  const rawClean = path.replace(/^\/+|\/+$/g, "").trim();
  const groupedClean = normalizePath(path);
  const db = await getDb();

  // 1. Check by grouped path (e.g. websites/rajbiosis/qlyte/pages/services)
  let doc = await db.collection("documents").findOne({ _id: groupedClean });
  if (doc && doc.data) return doc.data;

  // 2. Check by raw path (e.g. websites/qlyte/pages/services)
  if (rawClean !== groupedClean) {
    doc = await db.collection("documents").findOne({ _id: rawClean });
    if (doc && doc.data) return doc.data;
  }

  // 3. Check pages collection if it's a page path
  if (rawClean.includes("/pages/")) {
    const rawParts = rawClean.split("/");
    const pageId = rawParts[rawParts.length - 1];
    const site = rawParts.length >= 5 ? rawParts[2] : (rawParts.length === 4 ? rawParts[1] : rawParts[1]);
    const normSite = normalizeWebsiteId(site);

    const pageDoc = await db.collection("pages").findOne({
      $or: [
        { _id: `${normSite}_${pageId}` },
        { websiteId: normSite, page: pageId },
        { websiteId: site, page: pageId },
      ],
    });
    if (pageDoc && pageDoc.data) return pageDoc.data;
  }

  return null;
}

export async function setDocument(path, data, merge = false) {
  if (!path || typeof path !== "string") return null;
  const rawClean = path.replace(/^\/+|\/+$/g, "").trim();
  const groupedClean = normalizePath(path);
  const { collectionPath, docId } = splitPath(path);
  const db = await getDb();
  const now = Date.now();

  let finalData = data;
  if (merge) {
    const existing = await getDocument(path);
    if (existing && typeof existing === "object") {
      finalData = { ...existing, ...data };
    }
  }

  const docRecord = {
    _id: groupedClean,
    path: groupedClean,
    collection_path: collectionPath,
    doc_id: docId,
    data: finalData,
    updated_at: now,
  };

  // Upsert on groupedClean
  await db.collection("documents").updateOne(
    { _id: groupedClean },
    { $set: docRecord },
    { upsert: true }
  );

  // If rawClean is different, mirror it to ensure backward compatibility
  if (rawClean !== groupedClean) {
    await db.collection("documents").updateOne(
      { _id: rawClean },
      { $set: { ...docRecord, _id: rawClean, path: rawClean } },
      { upsert: true }
    );
  }

  await syncStructuredCollection(db, groupedClean, finalData, "set");
  return finalData;
}

export async function deleteDocument(path) {
  if (!path || typeof path !== "string") return false;
  const rawClean = path.replace(/^\/+|\/+$/g, "").trim();
  const groupedClean = normalizePath(path);
  const db = await getDb();

  await db.collection("documents").deleteOne({ _id: groupedClean });
  if (rawClean !== groupedClean) {
    await db.collection("documents").deleteOne({ _id: rawClean });
  }

  await syncStructuredCollection(db, groupedClean, null, "delete");
  return true;
}

export async function listCollection(collectionPath) {
  if (!collectionPath || typeof collectionPath !== "string") return [];
  const rawClean = collectionPath.replace(/^\/+|\/+$/g, "").trim();
  const groupedClean = normalizePath(collectionPath);
  const db = await getDb();

  let docs = await db.collection("documents")
    .find({ $or: [{ collection_path: groupedClean }, { collection_path: rawClean }] })
    .toArray();

  return docs.map((d) => ({
    id: d.doc_id,
    path: d.path,
    data: d.data,
    updatedAt: d.updated_at,
  }));
}

export async function listAllDocuments() {
  const db = await getDb();
  const docs = await db.collection("documents").find({}).toArray();
  return docs.map((d) => ({
    path: d.path,
    collection_path: d.collection_path,
    doc_id: d.doc_id,
    data: d.data,
    updated_at: d.updated_at,
  }));
}
