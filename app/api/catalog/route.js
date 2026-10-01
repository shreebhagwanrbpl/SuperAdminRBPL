import { NextResponse } from "next/server";
import { getDocument, listCollection } from "@/lib/mongoDbServer";
import { getCompanyForWebsitePath, normalizeWebsiteId } from "@/lib/websiteCompanyMap.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPublished(item) {
  if (!item || item.isPublished === false) return false;
  const status = String(item.status || "active").trim().toLowerCase();
  return !["inactive", "draft", "deleted", "hidden"].includes(status);
}

// Missing websiteIds preserves legacy visibility inherited from the parent.
// An explicit empty array means intentionally hidden.
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

function normalizeProduct(product, category, subcategory, websiteId) {
  const title = product?.title || product?.name || "";
  const images = Array.isArray(product?.images)
    ? product.images
    : (product?.image ? [product.image] : []);
  return {
    ...product,
    id: product?.id || product?.productId || product?.slug || title,
    productId: product?.productId || product?.id || product?.slug || title,
    title,
    name: product?.name || title,
    slug: product?.slug || String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    categoryId: product?.categoryId || category?.id || "",
    category: product?.category || category?.name || category?.category || "",
    subcategoryId: product?.subcategoryId || subcategory?.id || "",
    subCategory: product?.subCategory || product?.subcategory || subcategory?.name || subcategory?.subCategory || "",
    image: product?.image || images[0] || "",
    images,
    websiteId,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = normalizeWebsiteId(searchParams.get("websiteId") || "");
    const requestedCompany = String(searchParams.get("companyId") || "").trim().toLowerCase();

    if (!websiteId) {
      return NextResponse.json({ success: false, error: "websiteId is required", categories: [], products: [] }, { status: 400 });
    }

    const mappedCompany = getCompanyForWebsitePath(websiteId);
    if (!mappedCompany) {
      return NextResponse.json({ success: false, error: `Website '${websiteId}' is not assigned to a company`, websiteId, categories: [], products: [] }, { status: 400 });
    }
    if (requestedCompany && requestedCompany !== mappedCompany) {
      return NextResponse.json({ success: false, error: `Company mismatch: ${websiteId} belongs to ${mappedCompany}`, websiteId, companyId: mappedCompany, categories: [], products: [] }, { status: 400 });
    }
    const companyId = mappedCompany;


    const categoryRows = await listCollection(`companies/${companyId}/categories`);
    const categories = [];
    const allProducts = [];
    const seenProducts = new Set();

    for (const row of categoryRows) {
      const category = { id: row.id, ...(row.data || {}) };
      if (!isAssigned(category, websiteId, true)) continue;
      const subRows = await listCollection(`companies/${companyId}/categories/${row.id}/subcategories`);
      const subcategories = [];

      for (const subRow of subRows) {
        const subcategory = { id: subRow.id, ...(subRow.data || {}) };
        if (!isAssigned(subcategory, websiteId, true)) continue;
        const rawProducts = Array.isArray(subcategory.products) ? subcategory.products : [];
        const visibleProducts = [];
        for (const rawProduct of rawProducts) {
          if (!isAssigned(rawProduct, websiteId, true)) continue;
          const product = normalizeProduct(rawProduct, category, subcategory, websiteId);
          visibleProducts.push(product);
          const identity = String(product.id || product.slug || product.title);
          if (!seenProducts.has(identity)) {
            seenProducts.add(identity);
            allProducts.push(product);
          }
        }
        subcategories.push({ ...subcategory, name: subcategory.name || subcategory.subCategory || subRow.id, subCategory: subcategory.subCategory || subcategory.name || subRow.id, products: visibleProducts });
      }

      categories.push({ ...category, name: category.name || category.category || row.id, category: category.category || category.name || row.id, subcategories });
    }

    // Standalone products live in companies/{companyId}/products.
    const standaloneRows = await listCollection(`companies/${companyId}/products`);
    for (const row of standaloneRows) {
      const rawProduct = { id: row.id, ...(row.data || {}) };
      if (!isAssigned(rawProduct, websiteId, true)) continue;
      const product = normalizeProduct(rawProduct, null, null, websiteId);
      const identity = String(product.id || product.slug || product.title);
      if (!seenProducts.has(identity)) {
        seenProducts.add(identity);
        allProducts.push(product);
      }
    }

    // Older websites may still have a legacy page-level product document.
    // Use it only when no company-master products exist, never mix catalogs.
    if (allProducts.length === 0) {
      const legacy = (await getDocument(`websites/${websiteId}/pages/products`))
        || (await getDocument(`websites/${websiteId}/pages/categoryproducts`));
      const legacyProducts = Array.isArray(legacy) ? legacy : (Array.isArray(legacy?.products) ? legacy.products : []);
      for (const item of legacyProducts) {
        if (!isAssigned(item, websiteId, true)) continue;
        allProducts.push(normalizeProduct(item, null, null, websiteId));
      }
    }

    return NextResponse.json({
      success: true,
      websiteId,
      companyId,
      categories,
      products: allProducts,
      totalCount: allProducts.length,
    }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache" } });
  } catch (error) {
    console.error("[Admin /api/catalog] Error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to load catalog", categories: [], products: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
