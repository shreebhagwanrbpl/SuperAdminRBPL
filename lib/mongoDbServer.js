import { getDb } from "./mongodb.js";
import crypto from "node:crypto";

export function normalizePath(path) {
  if (!path || typeof path !== "string") return "";
  return path.replace(/^\/+|\/+$/g, "").trim();
}

export function splitPath(path) {
  const parts = normalizePath(path).split("/");
  const docId = parts[parts.length - 1] || "";
  const collectionPath = parts.slice(0, -1).join("/");
  return { collectionPath, docId, parts };
}

// Synchronize structured collections (products, categories, pages, queries, users)
async function syncStructuredCollection(db, path, data, op = "set") {
  try {
    const { collectionPath, docId, parts } = splitPath(path);

    if (op === "delete") {
      // Products
      if (path.startsWith("companies/") && path.includes("/products/")) {
        const orgId = parts[1]?.toUpperCase();
        await db.collection("products").deleteOne({ _id: `${orgId}_${docId}` });
      }
      // Categories
      if (path.startsWith("companies/") && path.includes("/categories/") && !path.includes("/subcategories")) {
        const orgId = parts[1]?.toUpperCase();
        await db.collection("categories").deleteOne({ _id: `${orgId}_${docId}` });
      }
      // Pages
      if (path.startsWith("websites/") && path.includes("/pages/")) {
        const websiteId = parts[2];
        await db.collection("pages").deleteOne({ _id: `${websiteId}_${docId}` });
      }
      // Queries
      if (path.startsWith("websitesQueries/")) {
        const websiteId = parts[1];
        await db.collection("queries").deleteOne({ _id: `${websiteId}_${docId}` });
      }
      return;
    }

    // 1. Categories (companies/{org}/categories/{catId})
    if (path.startsWith("companies/") && path.includes("/categories/") && !path.includes("/subcategories")) {
      const orgId = parts[1]?.toUpperCase();
      const catId = parts[3];
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
    if (path.startsWith("companies/") && path.includes("/subcategories/")) {
      const orgId = parts[1]?.toUpperCase();
      const catId = parts[3];
      const subId = parts[5];

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
    if (path.startsWith("companies/") && path.includes("/products/") && !path.includes("/categories/")) {
      const orgId = parts[1]?.toUpperCase();
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
        updatedAt: new Date(),
      };
      await db.collection("products").updateOne({ _id: prodDoc._id }, { $set: prodDoc }, { upsert: true });
    }

    // 4. Dynamic Pages (websites/{org}/{website}/pages/{pageId})
    if (path.startsWith("websites/") && path.includes("/pages/")) {
      const orgId = parts[1]?.toUpperCase();
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
        updatedAt: new Date(),
      };
      await db.collection("pages").updateOne({ _id: pageDoc._id }, { $set: pageDoc }, { upsert: true });
    }

    // 5. Customer Leads / Queries (websitesQueries/{websiteId}/...)
    if (path.startsWith("websitesQueries/")) {
      const websiteId = parts[1];
      const type = parts[2] === "contactQueries" ? "contact" : "product";
      const qId = parts[3] || docId;
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
      const uid = parts[1];
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
  const clean = normalizePath(path);
  if (!clean) return null;
  const db = await getDb();
  const doc = await db.collection("documents").findOne({ _id: clean });
  return doc ? doc.data : null;
}

export async function setDocument(path, data, merge = false) {
  const clean = normalizePath(path);
  if (!clean) return null;
  const { collectionPath, docId } = splitPath(clean);
  const db = await getDb();
  const now = Date.now();

  let finalData = data;
  if (merge) {
    const existing = await db.collection("documents").findOne({ _id: clean });
    if (existing && existing.data && typeof existing.data === "object") {
      finalData = { ...existing.data, ...data };
    }
  }

  const docRecord = {
    _id: clean,
    path: clean,
    collection_path: collectionPath,
    doc_id: docId,
    data: finalData,
    updated_at: now,
  };

  await db.collection("documents").updateOne(
    { _id: clean },
    { $set: docRecord },
    { upsert: true }
  );

  await syncStructuredCollection(db, clean, finalData, "set");
  return finalData;
}

export async function deleteDocument(path) {
  const clean = normalizePath(path);
  if (!clean) return false;
  const db = await getDb();
  await db.collection("documents").deleteOne({ _id: clean });
  await syncStructuredCollection(db, clean, null, "delete");
  return true;
}

export async function listCollection(collectionPath) {
  const clean = normalizePath(collectionPath);
  if (!clean) return [];
  const db = await getDb();
  const docs = await db.collection("documents")
    .find({ collection_path: clean })
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
