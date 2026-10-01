import { NextResponse } from "next/server";
import { getDocument, listCollection, normalizePath } from "@/lib/mongoDbServer";
import { getCompanyForWebsitePath, normalizeWebsiteId } from "@/lib/websiteCompanyMap.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const rawWebsiteId = searchParams.get("websiteId") || "";
    const websiteId = normalizeWebsiteId(rawWebsiteId);
    const requestedCompany = String(searchParams.get("companyId") || "").trim().toLowerCase();
    const type = searchParams.get("type");
    const rawPath = searchParams.get("path");
    const rawCollection = searchParams.get("collection");
    const isDistrictsFlag = searchParams.get("districts") === "1" || searchParams.get("districts") === "true";

    // 1. If path is provided directly
    if (rawPath) {
      let resolvedPath = rawPath.trim();
      if (resolvedPath.startsWith("__website__")) {
        if (!websiteId) {
          return NextResponse.json({ success: false, error: "websiteId is required for __website__ paths" }, { status: 400, headers: NO_CACHE_HEADERS });
        }
        resolvedPath = resolvedPath.replace(/^__website__/, `websites/${websiteId}`);
      }

      const normalized = normalizePath(resolvedPath);
      const data = await getDocument(normalized);

      return NextResponse.json({
        success: true,
        path: normalized,
        websiteId: websiteId || null,
        data: data || null,
        exists: data !== null,
      }, { status: 200, headers: NO_CACHE_HEADERS });
    }

    // 2. If collection is provided directly
    if (rawCollection) {
      let resolvedColl = rawCollection.trim();
      if (resolvedColl.startsWith("__website__")) {
        if (!websiteId) {
          return NextResponse.json({ success: false, error: "websiteId is required for __website__ collections" }, { status: 400, headers: NO_CACHE_HEADERS });
        }
        resolvedColl = resolvedColl.replace(/^__website__/, `websites/${websiteId}`);
      }

      const normalized = normalizePath(resolvedColl);
      const items = await listCollection(normalized);

      return NextResponse.json({
        success: true,
        collection: normalized,
        websiteId: websiteId || null,
        data: items,
        count: items.length,
      }, { status: 200, headers: NO_CACHE_HEADERS });
    }

    // 3. If websiteId is provided with type or districts
    if (!websiteId) {
      return NextResponse.json({ success: false, error: "websiteId or path is required" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const companyId = getCompanyForWebsitePath(websiteId) || requestedCompany || "rajbiosis";

    // Handle districts listing
    if (isDistrictsFlag || type === "districts") {
      const districtsCollPath = `websites/${websiteId}/districts`;
      const districts = await listCollection(districtsCollPath);

      return NextResponse.json({
        success: true,
        type: "districts",
        websiteId,
        companyId,
        data: districts,
        districts,
        count: districts.length,
      }, { status: 200, headers: NO_CACHE_HEADERS });
    }

    // Handle single district read
    if (type === "district") {
      const districtSlug = searchParams.get("district") || searchParams.get("slug") || "";
      if (!districtSlug) {
        return NextResponse.json({ success: false, error: "district slug is required for type=district" }, { status: 400, headers: NO_CACHE_HEADERS });
      }
      const districtDocPath = `websites/${websiteId}/districts/${districtSlug}`;
      const data = await getDocument(districtDocPath);

      return NextResponse.json({
        success: true,
        type: "district",
        district: districtSlug,
        websiteId,
        companyId,
        data: data || null,
        exists: data !== null,
      }, { status: 200, headers: NO_CACHE_HEADERS });
    }

    // Handle page document types: home, contact, services, about, etc.
    const resolvedType = type || "home";
    const documentPath = `websites/${websiteId}/pages/${resolvedType}`;
    const data = await getDocument(documentPath);

    return NextResponse.json({
      success: true,
      type: resolvedType,
      websiteId,
      companyId,
      data: data || null,
      exists: data !== null,
    }, { status: 200, headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("[Admin /api/site-data] Error:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Failed to load site data",
      data: null,
    }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}