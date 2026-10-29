import { getDb, getCompanyProductsCollectionName } from "./mongodb.js";
import { groupWebsitePath, normalizeWebsiteId, getCompanyForWebsitePath } from "./websiteCompanyMap.js";
import crypto from "node:crypto";

export { getCompanyProductsCollectionName };

export function normalizeOrgId(orgOrCompany) {
  const raw = String(orgOrCompany || "").trim().toUpperCase();
  if (raw === "RAJBIOSIS" || raw === "RBPL") return "RBPL";
  if (raw === "HUMAN" || raw === "HUMANBIOMEDICAL" || raw === "HUMANBIOMEDICALS") return "HUMAN";
  if (raw === "GLOBAL" || raw === "GLOBALBIOMEDICAL" || raw === "GLOBALBIOMEDICALS") return "GLOBAL";
  return raw || "RBPL";
}

export function getOrgAliases(orgOrCompany) {
  const raw = String(orgOrCompany || "").trim().toUpperCase();
  if (raw === "RAJBIOSIS" || raw === "RBPL" || raw === "RAJ") {
    return ["RBPL", "RAJBIOSIS", "rajbiosis", "rbpl", "RAJ", "raj"];
  }
  if (raw === "HUMAN" || raw === "HUMANBIOMEDICAL" || raw === "HUMANBIOMEDICALS") {
    return ["HUMAN", "human", "humanbiomedical", "humanbiomedicals", "HUMANBIOMEDICAL"];
  }
  if (raw === "GLOBAL" || raw === "GLOBALBIOMEDICAL" || raw === "GLOBALBIOMEDICALS") {
    return ["GLOBAL", "global", "globalbiomedical", "globalbiomedicals", "GLOBALBIOMEDICAL"];
  }
  return [raw, raw.toLowerCase(), raw.toUpperCase()];
}

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

// In-memory server cache
const docCache = global._serverDocCache || new Map();
const colCache = global._serverColCache || new Map();
global._serverDocCache = docCache;
global._serverColCache = colCache;

const DOC_CACHE_TTL = 30 * 1000; // 30 seconds
const COL_CACHE_TTL = 30 * 1000; // 30 seconds

export function invalidateServerCache(path = "") {
  if (!path) {
    docCache.clear();
    colCache.clear();
  } else {
    const clean = String(path).replace(/^\/+|\/+$/g, "").trim().toLowerCase();
    for (const key of docCache.keys()) {
      if (key.includes(clean) || clean.includes(key)) {
        docCache.delete(key);
      }
    }
    for (const key of colCache.keys()) {
      if (key.includes(clean) || clean.includes(key)) {
        colCache.delete(key);
      }
    }
  }
  if (global._catalogApiCache) {
    global._catalogApiCache.clear();
  }
}

// Helper to extract websiteId and pageId from page path
function parsePagePath(rawClean) {
  const parts = rawClean.split("/");
  const pageId = parts[parts.length - 1];
  let websiteId = "";
  let orgId = "RBPL";

  if (parts.length >= 5 && parts[0] === "websites") {
    orgId = normalizeOrgId(parts[1]);
    websiteId = normalizeWebsiteId(parts[2]);
  } else if (parts.length === 4 && parts[0] === "websites" && parts[2] === "pages") {
    websiteId = normalizeWebsiteId(parts[1]);
    const comp = getCompanyForWebsitePath(websiteId);
    orgId = normalizeOrgId(comp);
  } else {
    websiteId = normalizeWebsiteId(parts[1] || "default");
  }
  return { websiteId, pageId, orgId };
}

// Helper to extract district info from district path
function parseDistrictPath(rawClean) {
  const parts = rawClean.split("/");
  const distIdx = parts.indexOf("districts");
  if (distIdx === -1) return null;
  const rawSite = parts[distIdx - 1];
  const websiteId = normalizeWebsiteId(rawSite);
  const slug = parts[parts.length - 1];
  return { websiteId, slug, id: `${websiteId}_${slug}` };
}

// Helper to extract category & subcategory info from path
export function parseCategoryPath(rawClean) {
  const parts = rawClean.split("/");
  if (!parts.includes("categories")) return null;

  const catIdx = parts.indexOf("categories");
  let orgId = "RBPL";

  if (parts[0] === "websites" && parts.length >= 2) {
    const site = normalizeWebsiteId(parts[1]);
    const comp = getCompanyForWebsitePath(site);
    orgId = normalizeOrgId(comp || "RBPL");
  } else if (parts[0] === "companies" && parts.length >= 2) {
    orgId = normalizeOrgId(parts[1]);
  } else if (catIdx > 0) {
    orgId = normalizeOrgId(parts[catIdx - 1]);
  }

  const catId = parts[catIdx + 1];
  const subIdx = parts.indexOf("subcategories");
  const isSubcategory = subIdx !== -1 && Boolean(parts[subIdx + 1]);
  const subId = isSubcategory ? parts[subIdx + 1] : null;

  return {
    isSubcategory,
    orgId,
    colName: getCompanyProductsCollectionName(orgId),
    catId,
    subId,
    catKey: `${orgId}_${catId}`,
  };
}

export async function getDocument(path) {
  if (!path || typeof path !== "string") return null;
  const rawClean = path.replace(/^\/+|\/+$/g, "").trim();
  const groupedClean = normalizePath(path);
  const cacheKey = rawClean.toLowerCase();

  const cached = docCache.get(cacheKey);
  if (cached && Date.now() - cached.time < DOC_CACHE_TTL) {
    return cached.data;
  }

  const db = await getDb();

  // 1. DEDICATED PAGE COLLECTIONS: home, services, contact
  if (rawClean.includes("/pages/")) {
    const { websiteId, pageId } = parsePagePath(rawClean);

    if (pageId === "home") {
      const doc = await db.collection("home").findOne({ _id: websiteId });
      if (doc) {
        const { _id, ...rest } = doc;
        docCache.set(cacheKey, { data: rest, time: Date.now() });
        return rest;
      }
    } else if (pageId === "services") {
      const doc = await db.collection("services").findOne({ _id: websiteId });
      if (doc) {
        const { _id, ...rest } = doc;
        docCache.set(cacheKey, { data: rest, time: Date.now() });
        return rest;
      }
    } else if (pageId === "contact") {
      const doc = await db.collection("contact").findOne({ _id: websiteId });
      if (doc) {
        const { _id, ...rest } = doc;
        docCache.set(cacheKey, { data: rest, time: Date.now() });
        return rest;
      }
    } else {
      // Other generic pages (e.g. about)
      const pageDoc = await db.collection("pages").findOne({
        $or: [
          { _id: `${websiteId}_${pageId}` },
          { websiteId, page: pageId },
        ],
      });
      if (pageDoc && pageDoc.data) {
        docCache.set(cacheKey, { data: pageDoc.data, time: Date.now() });
        return pageDoc.data;
      }
    }
  }

  // 2. DEDICATED DISTRICTS COLLECTION
  if (rawClean.includes("/districts/") && !rawClean.endsWith("/districts")) {
    const distInfo = parseDistrictPath(rawClean);
    if (distInfo) {
      const doc = await db.collection("districts").findOne({ _id: distInfo.id });
      if (doc) {
        const { _id, ...rest } = doc;
        docCache.set(cacheKey, { data: rest, time: Date.now() });
        return rest;
      }
    }
  }

  // 3. DEDICATED COMPANY PRODUCT COLLECTIONS (WITH NESTED SUBCATEGORIES & PRODUCTS)
  const catInfo = parseCategoryPath(rawClean);
  if (catInfo && catInfo.catId) {
    const colName = catInfo.colName;
    const cat = await db.collection(colName).findOne({
      $or: [
        { _id: catInfo.catId },
        { _id: catInfo.catKey },
        { categoryId: catInfo.catId },
        { slug: catInfo.catId },
      ],
    });

    if (cat) {
      if (catInfo.isSubcategory) {
        const sub = (cat.subcategories || []).find((s) => s.id === catInfo.subId || s.slug === catInfo.subId);
        if (sub) {
          docCache.set(cacheKey, { data: sub, time: Date.now() });
          return sub;
        }
      } else {
        const catData = { ...(cat.data || {}), ...cat, subcategories: cat.subcategories || [] };
        docCache.set(cacheKey, { data: catData, time: Date.now() });
        return catData;
      }
    }
  }

  // 4. USERS (adminUsers/{uid})
  if (rawClean.startsWith("adminUsers/")) {
    const uid = rawClean.split("/")[1];
    const u = await db.collection("users").findOne({ $or: [{ _id: uid }, { uid }] });
    if (u) {
      const { _id, ...rest } = u;
      docCache.set(cacheKey, { data: rest, time: Date.now() });
      return rest;
    }
  }

  // 5. QUERIES (websitesQueries/{websiteId}/.../{qId})
  if (rawClean.startsWith("websitesQueries/")) {
    const parts = rawClean.split("/");
    const websiteId = normalizeWebsiteId(parts[1]);
    const qId = parts[parts.length - 1];
    const q = await db.collection("queries").findOne({
      $or: [{ _id: `${websiteId}_${qId}` }, { queryId: qId }],
    });
    if (q) {
      const createdAtVal = q.createdAt || q.data?.createdAt || new Date().toISOString();
      const rawData = q.data || q;
      const data = {
        ...rawData,
        id: qId,
        queryId: qId,
        websiteId: q.websiteId || rawData.websiteId,
        createdAt: rawData.createdAt || createdAtVal,
      };
      docCache.set(cacheKey, { data, time: Date.now() });
      return data;
    }
  }

  // 6. WEBSITES (websites/{site})
  if (rawClean.startsWith("websites/") && rawClean.split("/").length === 2) {
    const site = normalizeWebsiteId(rawClean.split("/")[1]);
    const siteDoc = await db.collection("websites").findOne({
      $or: [{ _id: site }, { websiteId: site }, { slug: site }],
    });
    if (siteDoc) {
      const { _id, ...rest } = siteDoc;
      docCache.set(cacheKey, { data: rest, time: Date.now() });
      return rest;
    }
  }

  // 7. ORGANIZATIONS (companies/{org})
  if (rawClean.startsWith("companies/") && rawClean.split("/").length === 2) {
    const org = normalizeOrgId(rawClean.split("/")[1]);
    const orgDoc = await db.collection("organizations").findOne({
      $or: [{ _id: org }, { companyId: org }, { name: org }],
    });
    if (orgDoc) {
      const { _id, ...rest } = orgDoc;
      docCache.set(cacheKey, { data: rest, time: Date.now() });
      return rest;
    }
  }

  // 8. FALLBACK READ TO DOCUMENTS (for non-standard paths or backwards compatibility)
  let doc = await db.collection("documents").findOne({ _id: groupedClean });
  if (doc && doc.data) {
    docCache.set(cacheKey, { data: doc.data, time: Date.now() });
    return doc.data;
  }
  if (rawClean !== groupedClean) {
    doc = await db.collection("documents").findOne({ _id: rawClean });
    if (doc && doc.data) {
      docCache.set(cacheKey, { data: doc.data, time: Date.now() });
      return doc.data;
    }
  }

  docCache.set(cacheKey, { data: null, time: Date.now() });
  return null;
}

export async function setDocument(path, data, merge = false) {
  if (!path || typeof path !== "string") return null;
  const rawClean = path.replace(/^\/+|\/+$/g, "").trim();
  const db = await getDb();
  const now = new Date();

  let finalData = data || {};
  if (merge) {
    const existing = await getDocument(path);
    if (existing && typeof existing === "object") {
      finalData = { ...existing, ...data };
    }
  }

  // 1. DEDICATED PAGE COLLECTIONS: home, services, contact
  if (rawClean.includes("/pages/")) {
    const { websiteId, pageId, orgId } = parsePagePath(rawClean);

    if (pageId === "home") {
      const homeDoc = {
        _id: websiteId,
        websiteId,
        organizationId: orgId,
        ...finalData,
        updatedAt: now,
      };
      await db.collection("home").updateOne(
        { _id: websiteId },
        { $set: homeDoc },
        { upsert: true }
      );
      invalidateServerCache(path);
      return finalData;
    }

    if (pageId === "services") {
      const servicesDoc = {
        _id: websiteId,
        websiteId,
        organizationId: orgId,
        ...finalData,
        updatedAt: now,
      };
      await db.collection("services").updateOne(
        { _id: websiteId },
        { $set: servicesDoc },
        { upsert: true }
      );
      invalidateServerCache(path);
      return finalData;
    }

    if (pageId === "contact") {
      const contactDoc = {
        _id: websiteId,
        websiteId,
        organizationId: orgId,
        ...finalData,
        updatedAt: now,
      };
      await db.collection("contact").updateOne(
        { _id: websiteId },
        { $set: contactDoc },
        { upsert: true }
      );
      invalidateServerCache(path);
      return finalData;
    }

    // Generic other pages (e.g. about)
    const pageDoc = {
      _id: `${websiteId}_${pageId}`,
      websiteId,
      organizationId: orgId,
      page: pageId,
      data: finalData,
      updatedAt: now,
    };
    await db.collection("pages").updateOne(
      { _id: pageDoc._id },
      { $set: pageDoc },
      { upsert: true }
    );
    invalidateServerCache(path);
    return finalData;
  }

  // 2. DEDICATED DISTRICTS COLLECTION
  if (rawClean.includes("/districts/") && !rawClean.endsWith("/districts")) {
    const distInfo = parseDistrictPath(rawClean);
    if (distInfo) {
      const districtDoc = {
        _id: distInfo.id,
        websiteId: distInfo.websiteId,
        slug: distInfo.slug,
        name: finalData.name || finalData.district || distInfo.slug,
        ...finalData,
        updatedAt: now,
      };
      await db.collection("districts").updateOne(
        { _id: distInfo.id },
        { $set: districtDoc },
        { upsert: true }
      );
      invalidateServerCache(path);
      return finalData;
    }
  }

  // 3. DEDICATED COMPANY PRODUCT COLLECTIONS (NESTED SUBCATEGORIES & PRODUCTS)
  const catInfo = parseCategoryPath(rawClean);
  if (catInfo && catInfo.catId) {
    const colName = catInfo.colName;
    const existing = await db.collection(colName).findOne({
      $or: [
        { _id: catInfo.catId },
        { _id: catInfo.catKey },
        { categoryId: catInfo.catId },
        { slug: catInfo.catId },
      ],
    });

    if (catInfo.isSubcategory) {
      const existingSub = (existing?.subcategories || []).find((s) => s.id === catInfo.subId || s.slug === catInfo.subId);
      const rawProds = Array.isArray(finalData.products)
        ? finalData.products
        : (Array.isArray(existingSub?.products) ? existingSub.products : []);

      const subRecord = {
        id: catInfo.subId,
        name: finalData.name || finalData.subCategory || catInfo.subId,
        subCategory: finalData.subCategory || finalData.name || catInfo.subId,
        slug: catInfo.subId,
        websiteIds: Array.isArray(finalData.websiteIds)
          ? finalData.websiteIds
          : (finalData.websiteIds ? [finalData.websiteIds] : ["all"]),
        products: rawProds,
        ...finalData,
        updatedAt: now,
      };

      // 1. Ensure parent category document exists
      try {
        await db.collection(colName).updateOne(
          { $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }] },
          {
            $setOnInsert: {
              _id: catInfo.catId,
              categoryId: catInfo.catId,
              organizationId: catInfo.orgId,
              name: catInfo.catId,
              category: catInfo.catId,
              slug: catInfo.catId,
              websiteIds: ["all"],
              subcategories: [],
            },
            $set: { updatedAt: now },
          },
          { upsert: true }
        );
      } catch (err) {
        if (err.code !== 11000 && !String(err.message || "").includes("E11000") && !String(err.message || "").includes("duplicate key")) {
          throw err;
        }
      }

      // 2. Try to update the subcategory if it already exists in the array
      const updateResult = await db.collection(colName).updateOne(
        {
          $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }],
          "subcategories.id": catInfo.subId,
        },
        {
          $set: {
            "subcategories.$": subRecord,
            updatedAt: now,
          },
        }
      );

      // 3. If it wasn't already in the array, push it atomically
      if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
        await db.collection(colName).updateOne(
          {
            $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }],
            "subcategories.id": { $ne: catInfo.subId },
          },
          {
            $push: { subcategories: subRecord },
            $set: { updatedAt: now },
          }
        );
      }

      invalidateServerCache(path);
      return finalData;
    } else {
      // Writing the category itself
      const { data: _ignoredData, subcategories: incomingSubs, ...cleanData } = finalData;
      const subcategoriesToKeep = Array.isArray(incomingSubs) && incomingSubs.length > 0
        ? incomingSubs
        : (existing?.subcategories || []);
      const { _id: _ignoredId, ...restCleanData } = cleanData;
      const catDocFields = {
        categoryId: catInfo.catId,
        organizationId: catInfo.orgId,
        name: finalData.name || finalData.category || catInfo.catId,
        category: finalData.category || finalData.name || catInfo.catId,
        slug: finalData.slug || catInfo.catId,
        websiteIds: Array.isArray(finalData.websiteIds)
          ? finalData.websiteIds
          : (finalData.websiteIds ? [finalData.websiteIds] : ["all"]),
        subcategories: subcategoriesToKeep,
        data: restCleanData,
        updatedAt: now,
      };

      try {
        await db.collection(colName).updateOne(
          { $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }] },
          {
            $set: catDocFields,
            $setOnInsert: { _id: catInfo.catId },
          },
          { upsert: true }
        );
      } catch (err) {
        if (err.code === 11000 || String(err.message || "").includes("E11000") || String(err.message || "").includes("duplicate key")) {
          // Concurrent upsert won the race, update existing document without upsert!
          await db.collection(colName).updateOne(
            { $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }] },
            { $set: catDocFields }
          );
        } else {
          throw err;
        }
      }

      invalidateServerCache(path);
      return finalData;
    }
  }

  // 4. USERS (adminUsers/{uid})
  if (rawClean.startsWith("adminUsers/")) {
    const uid = rawClean.split("/")[1];
    const userDoc = {
      _id: uid,
      uid,
      email: String(finalData.email || "").toLowerCase(),
      fullName: finalData.fullName || "",
      role: finalData.role || "Admin",
      designation: finalData.designation || "Executive",
      phone: finalData.phone || "",
      status: finalData.status || "pending",
      updatedAt: now,
    };
    await db.collection("users").updateOne(
      { _id: uid },
      { $set: userDoc },
      { upsert: true }
    );
    invalidateServerCache(path);
    return finalData;
  }

  // 5. QUERIES (websitesQueries/{websiteId}/...)
  if (rawClean.startsWith("websitesQueries/")) {
    const parts = rawClean.split("/");
    const websiteId = normalizeWebsiteId(parts[1] || "default");
    const type = parts[2] === "contactQueries" ? "contact" : "product";
    const qId = parts[3] || parts[parts.length - 1] || crypto.randomUUID();
    const createdAt = finalData.createdAt || now;
    const queryDoc = {
      _id: `${websiteId}_${qId}`,
      queryId: qId,
      websiteId,
      type,
      name: finalData.name || finalData.fullName || "",
      phone: finalData.phone || finalData.mobile || "",
      email: finalData.email || "",
      message: finalData.message || finalData.query || "",
      data: {
        ...finalData,
        createdAt,
        id: qId,
        queryId: qId,
        websiteId,
      },
      status: finalData.status || "unread",
      createdAt,
    };
    await db.collection("queries").updateOne(
      { _id: queryDoc._id },
      { $set: queryDoc },
      { upsert: true }
    );
    invalidateServerCache(path);
    return queryDoc.data;
  }

  // 6. WEBSITES (websites/{site})
  if (rawClean.startsWith("websites/") && rawClean.split("/").length === 2) {
    const site = normalizeWebsiteId(rawClean.split("/")[1]);
    const siteDoc = {
      _id: site,
      websiteId: site,
      ...finalData,
      updatedAt: now,
    };
    await db.collection("websites").updateOne(
      { _id: site },
      { $set: siteDoc },
      { upsert: true }
    );
    invalidateServerCache(path);
    return finalData;
  }

  // 7. ORGANIZATIONS (companies/{org})
  if (rawClean.startsWith("companies/") && rawClean.split("/").length === 2) {
    const org = normalizeOrgId(rawClean.split("/")[1]);
    const orgDoc = {
      _id: org,
      companyId: org,
      name: org,
      ...finalData,
      updatedAt: now,
    };
    await db.collection("organizations").updateOne(
      { _id: org },
      { $set: orgDoc },
      { upsert: true }
    );
    invalidateServerCache(path);
    return finalData;
  }

  invalidateServerCache(path);
  return finalData;
}

export async function deleteDocument(path) {
  if (!path || typeof path !== "string") return false;
  const rawClean = path.replace(/^\/+|\/+$/g, "").trim();
  const db = await getDb();

  // 1. Pages
  if (rawClean.includes("/pages/")) {
    const { websiteId, pageId } = parsePagePath(rawClean);
    if (pageId === "home") await db.collection("home").deleteOne({ _id: websiteId });
    else if (pageId === "services") await db.collection("services").deleteOne({ _id: websiteId });
    else if (pageId === "contact") await db.collection("contact").deleteOne({ _id: websiteId });
    else await db.collection("pages").deleteOne({ _id: `${websiteId}_${pageId}` });
    invalidateServerCache(path);
    return true;
  }

  // 2. Districts
  if (rawClean.includes("/districts/") && !rawClean.endsWith("/districts")) {
    const distInfo = parseDistrictPath(rawClean);
    if (distInfo) {
      await db.collection("districts").deleteOne({ _id: distInfo.id });
      invalidateServerCache(path);
      return true;
    }
  }

  // 3. Categories / Subcategories in dedicated company collections
  const catInfo = parseCategoryPath(rawClean);
  if (catInfo && catInfo.catId) {
    const colName = catInfo.colName;
    if (catInfo.isSubcategory) {
      await db.collection(colName).updateOne(
        { $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }] },
        {
          $pull: {
            subcategories: {
              $or: [
                { id: catInfo.subId },
                { slug: catInfo.subId },
                { name: catInfo.subId },
                { subCategory: catInfo.subId },
              ],
            },
          },
        }
      );
      await db.collection("documents").deleteOne({ path: rawClean });
    } else {
      await db.collection(colName).deleteOne({
        $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }],
      });
      await db.collection("categories").deleteOne({
        $or: [{ _id: catInfo.catId }, { categoryId: catInfo.catId }, { slug: catInfo.catId }],
      });
      await db.collection("documents").deleteMany({
        path: { $regex: `^companies/${catInfo.orgId}/categories/${catInfo.catId}` },
      });
    }
    invalidateServerCache();
    return true;
  }

  // 4. Users
  if (rawClean.startsWith("adminUsers/")) {
    const uid = rawClean.split("/")[1];
    await db.collection("users").deleteOne({ $or: [{ _id: uid }, { uid }] });
    invalidateServerCache(path);
    return true;
  }

  // 5. Queries
  if (rawClean.startsWith("websitesQueries/")) {
    const parts = rawClean.split("/");
    const websiteId = normalizeWebsiteId(parts[1]);
    const qId = parts[parts.length - 1];
    await db.collection("queries").deleteOne({ $or: [{ _id: `${websiteId}_${qId}` }, { queryId: qId }] });
    invalidateServerCache(path);
    return true;
  }

  invalidateServerCache(path);
  return true;
}

export async function listCollection(collectionPath) {
  if (!collectionPath || typeof collectionPath !== "string") return [];
  const rawClean = collectionPath.replace(/^\/+|\/+$/g, "").trim();
  const cacheKey = rawClean.toLowerCase();

  const cached = colCache.get(cacheKey);
  if (cached && Date.now() - cached.time < COL_CACHE_TTL) {
    return cached.data;
  }

  const db = await getDb();
  const itemsMap = new Map();

  // 1. CATEGORIES (companies/{org}/categories OR websites/{site}/pages/categoryproducts/categories)
  if (rawClean.includes("/categories") && !rawClean.includes("/subcategories")) {
    const parts = rawClean.split("/");
    let orgId = "RBPL";
    if (parts[0] === "websites" && parts.length >= 2) {
      const site = normalizeWebsiteId(parts[1]);
      const comp = getCompanyForWebsitePath(site);
      orgId = normalizeOrgId(comp || "RBPL");
    } else if (parts[0] === "companies" && parts.length >= 2) {
      orgId = normalizeOrgId(parts[1]);
    } else {
      const catIdx = parts.indexOf("categories");
      if (catIdx > 0) orgId = normalizeOrgId(parts[catIdx - 1]);
    }

    const colName = getCompanyProductsCollectionName(orgId);
    let cats = await db.collection(colName)
      .find({})
      .project({
        _id: 1,
        categoryId: 1,
        organizationId: 1,
        name: 1,
        category: 1,
        slug: 1,
        websiteIds: 1,
        data: 1,
        updatedAt: 1,
        subcategories: 1,
      })
      .toArray();

    for (const c of cats) {
      const catId = c.categoryId || c.slug || c._id;
      itemsMap.set(catId, {
        id: catId,
        path: `${collectionPath}/${catId}`,
        data: { ...(c.data || {}), ...c, subcategories: c.subcategories || [] },
        updatedAt: c.updatedAt ? new Date(c.updatedAt).getTime() : Date.now(),
      });
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 2. SUBCATEGORIES (companies/{org}/categories/{catId}/subcategories OR websites/{site}/pages/categoryproducts/categories/{catId}/subcategories)
  if (rawClean.includes("/subcategories")) {
    const catInfo = parseCategoryPath(rawClean);
    if (catInfo && catInfo.catId) {
      const colName = catInfo.colName;
      const cat = await db.collection(colName).findOne({
        $or: [
          { _id: catInfo.catId },
          { _id: catInfo.catKey },
          { categoryId: catInfo.catId },
          { slug: catInfo.catId },
        ],
      });

      if (cat && Array.isArray(cat.subcategories)) {
        for (const sub of cat.subcategories) {
          itemsMap.set(sub.id, {
            id: sub.id,
            path: `${collectionPath}/${sub.id}`,
            data: sub,
            updatedAt: sub.updatedAt ? new Date(sub.updatedAt).getTime() : Date.now(),
          });
        }
      }
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 3. DISTRICTS (websites/{site}/districts)
  if (rawClean.includes("/districts")) {
    const parts = rawClean.split("/");
    const distIdx = parts.indexOf("districts");
    const rawSite = parts[distIdx - 1];
    const websiteId = normalizeWebsiteId(rawSite);

    const districts = await db.collection("districts")
      .find({ websiteId })
      .toArray();

    for (const d of districts) {
      const slug = d.slug || d._id;
      const { _id, ...rest } = d;
      itemsMap.set(slug, {
        id: slug,
        path: `${collectionPath}/${slug}`,
        data: rest,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
      });
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 4. USERS (adminUsers)
  if (rawClean === "adminUsers") {
    const users = await db.collection("users").find({}).toArray();
    for (const u of users) {
      const uid = u.uid || u._id;
      const { _id, ...rest } = u;
      itemsMap.set(uid, {
        id: uid,
        path: `adminUsers/${uid}`,
        data: rest,
        updatedAt: u.updatedAt ? new Date(u.updatedAt).getTime() : Date.now(),
      });
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 5. QUERIES (websitesQueries/{websiteId}/...)
  if (rawClean.startsWith("websitesQueries/")) {
    const parts = rawClean.split("/");
    const websiteId = normalizeWebsiteId(parts[1] || "default");
    const type = parts[2] === "contactQueries" ? "contact" : (parts[2] === "productQueries" ? "product" : null);

    const queryFilter = { websiteId };
    if (type) queryFilter.type = type;

    const queries = await db.collection("queries").find(queryFilter).sort({ createdAt: -1 }).toArray();
    for (const q of queries) {
      const qId = q.queryId || q._id;
      const createdAtVal = q.createdAt || q.data?.createdAt || new Date().toISOString();
      const rawData = q.data || q;
      itemsMap.set(qId, {
        id: qId,
        path: `${collectionPath}/${qId}`,
        data: {
          ...rawData,
          id: qId,
          queryId: qId,
          websiteId: q.websiteId || rawData.websiteId,
          createdAt: rawData.createdAt || createdAtVal,
          date: rawData.date || createdAtVal,
        },
        updatedAt: createdAtVal ? new Date(createdAtVal).getTime() : Date.now(),
      });
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 6. WEBSITES (websites)
  if (rawClean === "websites") {
    const sites = await db.collection("websites").find({}).toArray();
    for (const s of sites) {
      const siteId = s.websiteId || s.slug || s._id;
      const { _id, ...rest } = s;
      itemsMap.set(siteId, {
        id: siteId,
        path: `websites/${siteId}`,
        data: rest,
        updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
      });
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 7. ORGANIZATIONS (companies or organizations)
  if (rawClean === "companies" || rawClean === "organizations") {
    const orgs = await db.collection("organizations").find({}).toArray();
    for (const o of orgs) {
      const orgId = o.companyId || o.name || o._id;
      const { _id, ...rest } = o;
      itemsMap.set(orgId, {
        id: orgId,
        path: `companies/${orgId}`,
        data: rest,
        updatedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : Date.now(),
      });
    }

    const result = Array.from(itemsMap.values());
    colCache.set(cacheKey, { data: result, time: Date.now() });
    return result;
  }

  // 8. FALLBACK TO DOCUMENTS
  const groupedClean = normalizePath(collectionPath);
  const rawDocs = await db.collection("documents")
    .find({ collection_path: { $in: [groupedClean, rawClean] } })
    .toArray();

  for (const d of rawDocs) {
    itemsMap.set(d.doc_id || d._id, {
      id: d.doc_id || d._id,
      path: d.path,
      data: d.data,
      updatedAt: d.updated_at,
    });
  }

  const result = Array.from(itemsMap.values());
  colCache.set(cacheKey, { data: result, time: Date.now() });
  return result;
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

export async function updateVisibilityServer({
  companyId,
  targetType = "bulk_products",
  targetWebsites = [],
  productIds = [],
  products = [],
  categoryIds = [],
  subcategories = [],
  cascade = true,
}) {
  const db = await getDb();
  const orgId = normalizeOrgId(companyId);
  const colName = getCompanyProductsCollectionName(orgId);
  const now = new Date().toISOString();
  const assignedWebsites = Array.isArray(targetWebsites) ? targetWebsites : [];

  let modifiedCount = 0;

  // 1. CATEGORIES (category | bulk_categories)
  if (targetType === "category" || targetType === "bulk_categories") {
    const ids = Array.isArray(categoryIds) && categoryIds.length > 0
      ? categoryIds
      : (Array.isArray(productIds) ? productIds : []);

    for (const catId of ids) {
      if (!catId) continue;
      const setFields = {
        websiteIds: assignedWebsites,
        updatedAt: now,
      };
      if (cascade) {
        setFields["subcategories.$[].websiteIds"] = assignedWebsites;
        setFields["subcategories.$[].products.$[].websiteIds"] = assignedWebsites;
      }
      const res = await db.collection(colName).updateOne(
        { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
        { $set: setFields }
      );
      if (res.matchedCount > 0) modifiedCount++;
    }
  }

  // 2. SUBCATEGORIES (subcategory | bulk_subcategories)
  else if (targetType === "subcategory" || targetType === "bulk_subcategories") {
    const grouped = new Map();
    for (const subItem of subcategories) {
      const catId = subItem.categoryId || subItem.catId;
      const subId = subItem.subcategoryId || subItem.subId || subItem.id;
      if (!catId || !subId) continue;
      if (!grouped.has(catId)) grouped.set(catId, new Set());
      grouped.get(catId).add(subId);
    }

    for (const [catId, subIdSet] of grouped.entries()) {
      const subIds = Array.from(subIdSet);
      const setFields = {
        "subcategories.$[sub].websiteIds": assignedWebsites,
        updatedAt: now,
      };
      if (cascade) {
        setFields["subcategories.$[sub].products.$[].websiteIds"] = assignedWebsites;
      }
      const res = await db.collection(colName).updateOne(
        { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
        { $set: setFields },
        {
          arrayFilters: [
            { $or: [{ "sub.id": { $in: subIds } }, { "sub.slug": { $in: subIds } }] }
          ]
        }
      );
      if (res.matchedCount > 0) modifiedCount++;
    }
  }

  // 3. MIXED (categories + subcategories)
  else if (targetType === "bulk_mixed") {
    const catIdSet = new Set(categoryIds || []);
    const subGrouped = new Map();
    for (const subItem of subcategories) {
      const catId = subItem.categoryId || subItem.catId;
      const subId = subItem.subcategoryId || subItem.subId || subItem.id;
      if (!catId || !subId) continue;
      if (!subGrouped.has(catId)) subGrouped.set(catId, new Set());
      subGrouped.get(catId).add(subId);
    }

    const allCatIds = Array.from(new Set([...catIdSet, ...subGrouped.keys()]));
    for (const catId of allCatIds) {
      const isCatSelected = catIdSet.has(catId);
      const subIdSet = subGrouped.get(catId);

      if (isCatSelected) {
        const setFields = {
          websiteIds: assignedWebsites,
          updatedAt: now,
        };
        if (cascade) {
          setFields["subcategories.$[].websiteIds"] = assignedWebsites;
          setFields["subcategories.$[].products.$[].websiteIds"] = assignedWebsites;
        }
        const res = await db.collection(colName).updateOne(
          { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
          { $set: setFields }
        );
        if (res.matchedCount > 0) modifiedCount++;
      } else if (subIdSet && subIdSet.size > 0) {
        const subIds = Array.from(subIdSet);
        const setFields = {
          "subcategories.$[sub].websiteIds": assignedWebsites,
          updatedAt: now,
        };
        if (cascade) {
          setFields["subcategories.$[sub].products.$[].websiteIds"] = assignedWebsites;
        }
        const res = await db.collection(colName).updateOne(
          { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
          { $set: setFields },
          {
            arrayFilters: [
              { $or: [{ "sub.id": { $in: subIds } }, { "sub.slug": { $in: subIds } }] }
            ]
          }
        );
        if (res.matchedCount > 0) modifiedCount++;
      }
    }
  }

  // 4. PRODUCTS (product | bulk_products)
  else {
    const catBuckets = new Map(); // catId -> Set of prodIds
    const standaloneIds = [];

    const registerItem = (item) => {
      if (!item) return;
      const isObj = typeof item === "object";
      const id = isObj ? (item.id || item.productId || item.categoryProductId || item.slug) : item;
      if (!id) return;

      const catId = isObj ? (item.categoryId || item.catId) : null;
      if (catId) {
        if (!catBuckets.has(catId)) catBuckets.set(catId, new Set());
        catBuckets.get(catId).add(String(id));
      } else {
        standaloneIds.push(String(id));
      }
    };

    if (Array.isArray(products) && products.length > 0) {
      products.forEach(registerItem);
    }
    if (Array.isArray(productIds) && productIds.length > 0) {
      productIds.forEach(registerItem);
    }

    // A. Fast direct category product update using arrayFilters
    for (const [catId, prodIdSet] of catBuckets.entries()) {
      const prodIds = Array.from(prodIdSet);
      const res = await db.collection(colName).updateOne(
        { $or: [{ _id: catId }, { categoryId: catId }, { slug: catId }] },
        {
          $set: {
            "subcategories.$[].products.$[prod].websiteIds": assignedWebsites,
            "subcategories.$[].products.$[prod].updatedAt": now,
            updatedAt: now,
          }
        },
        {
          arrayFilters: [
            {
              $or: [
                { "prod.id": { $in: prodIds } },
                { "prod.productId": { $in: prodIds } },
                { "prod.categoryProductId": { $in: prodIds } },
                { "prod.slug": { $in: prodIds } },
              ]
            }
          ]
        }
      );
      if (res.matchedCount > 0) modifiedCount++;
    }

    // B. Standalone normal products or fallback when category is unknown
    if (standaloneIds.length > 0) {
      const matchingCats = await db.collection(colName).find(
        {
          $or: [
            { "subcategories.products.id": { $in: standaloneIds } },
            { "subcategories.products.categoryProductId": { $in: standaloneIds } },
            { "subcategories.products.productId": { $in: standaloneIds } },
          ],
        },
        { projection: { _id: 1 } }
      ).toArray();

      for (const catRef of matchingCats) {
        const res = await db.collection(colName).updateOne(
          { _id: catRef._id },
          {
            $set: {
              "subcategories.$[].products.$[prod].websiteIds": assignedWebsites,
              "subcategories.$[].products.$[prod].updatedAt": now,
              updatedAt: now,
            }
          },
          {
            arrayFilters: [
              {
                $or: [
                  { "prod.id": { $in: standaloneIds } },
                  { "prod.productId": { $in: standaloneIds } },
                  { "prod.categoryProductId": { $in: standaloneIds } },
                  { "prod.slug": { $in: standaloneIds } },
                ]
              }
            ]
          }
        );
        if (res.matchedCount > 0) modifiedCount++;
      }

      // Also update standalone products in MongoDB products collection
      await db.collection("products").updateMany(
        {
          $or: [
            { _id: { $in: standaloneIds } },
            { id: { $in: standaloneIds } },
            { productId: { $in: standaloneIds } },
          ],
        },
        { $set: { websiteIds: assignedWebsites, updatedAt: now } }
      );
    }
  }


  // Invalidate server caches
  invalidateServerCache();
  return { ok: true, modifiedCount };
}
