import { NextResponse } from "next/server";
import { getDb, getCategoriesCol, getProductsCol, getCompanyProductsCol } from "@/lib/mongodb";
import { getDocument, getOrgAliases, normalizeOrgId } from "@/lib/mongoDbServer";
import { getCompanyForWebsitePath, normalizeWebsiteId } from "@/lib/websiteCompanyMap.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const catalogApiCache = global._catalogApiCache || new Map();
global._catalogApiCache = catalogApiCache;
const CATALOG_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export function invalidateCatalogCache(websiteId = "") {
  if (!websiteId) {
    catalogApiCache.clear();
  } else {
    catalogApiCache.delete(normalizeWebsiteId(websiteId));
  }
}

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

function isPublished(item) {
  if (!item || item.isPublished === false) return false;
  const status = String(item.status || "active").trim().toLowerCase();
  return !["inactive", "draft", "deleted", "hidden"].includes(status);
}

function isAssigned(item, websiteId, inherited = true) {
  if (!item || !isPublished(item)) return false;
  if (!Object.prototype.hasOwnProperty.call(item, "websiteIds")) return inherited;
  if (!Array.isArray(item.websiteIds)) {
    const v = normalizeWebsiteId(item.websiteIds);
    return v === "all" || v === websiteId;
  }
  return item.websiteIds.some((id) => {
    const v = normalizeWebsiteId(id);
    return v === "all" || v === websiteId;
  });
}

function normalizeProduct(product, categoryName, subcategoryName, websiteId) {
  const title = product?.title || product?.name || "";
  const images = Array.isArray(product?.images)
    ? product.images.slice(0, 3)
    : (product?.image ? [product.image] : []);
  const prodId = String(product?.productId || product?.id || product?.slug || title);
  return {
    id: prodId,
    productId: prodId,
    title,
    name: product?.name || title,
    slug: product?.slug || String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    price: product?.price || "",
    image: product?.image || images[0] || "",
    images,
    categoryId: product?.categoryId || "",
    category: categoryName || product?.category || "",
    subcategoryId: product?.subcategoryId || "",
    subCategory: subcategoryName || product?.subCategory || product?.subcategory || "",
    websiteId,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawWebsiteId = searchParams.get("websiteId") || "";
    const websiteId = normalizeWebsiteId(rawWebsiteId);
    const requestedCompany = String(searchParams.get("companyId") || "").trim().toLowerCase();

    if (!websiteId) {
      return NextResponse.json({ success: false, error: "websiteId is required", categories: [], products: [] }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const mappedCompany = getCompanyForWebsitePath(websiteId);
    if (!mappedCompany) {
      return NextResponse.json({ success: false, error: `Website '${websiteId}' is not assigned to a company`, websiteId, categories: [], products: [] }, { status: 400, headers: NO_CACHE_HEADERS });
    }
    if (requestedCompany && requestedCompany !== mappedCompany) {
      return NextResponse.json({ success: false, error: `Company mismatch: ${websiteId} belongs to ${mappedCompany}`, websiteId, companyId: mappedCompany, categories: [], products: [] }, { status: 400, headers: NO_CACHE_HEADERS });
    }
    const companyId = mappedCompany;

    // Check fast in-memory cache
    const cacheKey = `${companyId}:::${websiteId}`;
    const cached = catalogApiCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CATALOG_CACHE_TTL) {
      return NextResponse.json(cached.payload, { status: 200, headers: CACHE_HEADERS });
    }

    const orgAliases = getOrgAliases(companyId);
    const companyProductsCol = await getCompanyProductsCol(companyId);
    const productsCol = await getProductsCol();

    // 1. Fetch Categories and extract nested products using streaming cursor from dedicated company collection
    const catMap = new Map();
    const subcatNameMap = new Map();
    const nestedProds = [];

    let catCursor = companyProductsCol.find({});
    const hasCompanyDocs = await catCursor.hasNext();
    if (!hasCompanyDocs) {
      const normOrg = normalizeOrgId(companyId);
      catCursor = (await getCategoriesCol()).find({ organizationId: normOrg });
    } else {
      catCursor.rewind();
    }

    while (await catCursor.hasNext()) {
      const cat = await catCursor.next();
      const catId = cat.categoryId || cat.slug || String(cat._id).replace(/^[^_]+_/, "");
      const catName = cat.name || cat.category || catId;
      catMap.set(catId, {
        id: catId,
        name: catName,
        category: catName,
        slug: cat.slug || catId,
        websiteIds: cat.websiteIds,
        subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
      });

      if (Array.isArray(cat.subcategories)) {
        for (const sub of cat.subcategories) {
          const subId = sub.id || sub.slug;
          subcatNameMap.set(`${catId}:::${subId}`, sub.name || sub.subCategory || subId);
          if (Array.isArray(sub.products)) {
            for (const p of sub.products) {
              nestedProds.push({
                ...p,
                categoryId: p.categoryId || catId,
                subcategoryId: p.subcategoryId || subId,
                subCategory: p.subCategory || sub.name || sub.subCategory || subId,
                websiteIds: p.websiteIds || sub.websiteIds || cat.websiteIds || ["all"],
              });
            }
          }
        }
      }
    }

    let allCandidateProds = nestedProds;
    if (allCandidateProds.length === 0) {
      allCandidateProds = await productsCol
        .find({
          organizationId: { $in: orgAliases },
          isPublished: { $ne: false },
        })
        .project({
          _id: 1,
          productId: 1,
          id: 1,
          title: 1,
          name: 1,
          slug: 1,
          price: 1,
          image: 1,
          images: 1,
          categoryId: 1,
          subcategoryId: 1,
          websiteIds: 1,
          status: 1,
          isPublished: 1,
          type: 1,
        })
        .toArray();
    }

    // Filter & assign products
    const allProducts = [];
    const seenProducts = new Set();
    const catProductsMap = new Map(); // catId -> subId -> []

    for (const raw of allCandidateProds) {
      if (!isAssigned(raw, websiteId, true)) continue;
      const catId = raw.categoryId || "";
      const subId = raw.subcategoryId || "";
      const catName = catMap.get(catId)?.name || "";
      const subName = subcatNameMap.get(`${catId}:::${subId}`) || raw.subCategory || "";

      const product = normalizeProduct(raw, catName, subName, websiteId);
      const identity = String(product.id || product.slug || product.title);
      if (!seenProducts.has(identity)) {
        seenProducts.add(identity);
        allProducts.push(product);

        if (catId) {
          if (!catProductsMap.has(catId)) catProductsMap.set(catId, new Map());
          const subMap = catProductsMap.get(catId);
          if (!subMap.has(subId)) subMap.set(subId, []);
          subMap.get(subId).push(product);
        }
      }
    }

    // Fallback: If products collection has no assigned products, check legacy page documents
    if (allProducts.length === 0) {
      const legacy = (await getDocument(`websites/${websiteId}/pages/products`))
        || (await getDocument(`websites/${websiteId}/pages/categoryproducts`));
      const legacyProducts = Array.isArray(legacy) ? legacy : (Array.isArray(legacy?.products) ? legacy.products : []);
      for (const item of legacyProducts) {
        if (!isAssigned(item, websiteId, true)) continue;
        allProducts.push(normalizeProduct(item, null, null, websiteId));
      }
    }

    // Assemble structured categories output
    const categoriesOutput = [];
    for (const [catId, cat] of catMap.entries()) {
      if (!isAssigned(cat, websiteId, true)) continue;
      const subcategories = [];
      const subMap = catProductsMap.get(catId);

      for (const sub of cat.subcategories) {
        if (!isAssigned(sub, websiteId, true)) continue;
        const subId = sub.id || sub.slug;
        const visibleProducts = (subMap && subMap.get(subId)) || [];
        subcategories.push({
          id: subId,
          name: sub.name || sub.subCategory || subId,
          subCategory: sub.subCategory || sub.name || subId,
          slug: subId,
          products: visibleProducts,
        });
      }

      categoriesOutput.push({
        id: catId,
        name: cat.name,
        category: cat.name,
        slug: cat.slug || catId,
        websiteIds: cat.websiteIds,
        subcategories,
      });
    }

    const payload = {
      success: true,
      websiteId,
      companyId,
      categories: categoriesOutput,
      products: allProducts,
      totalCount: allProducts.length,
    };

    // Store in cache
    catalogApiCache.set(cacheKey, { payload, time: Date.now() });

    return NextResponse.json(payload, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[Admin /api/catalog] Error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to load catalog", categories: [], products: [] }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
