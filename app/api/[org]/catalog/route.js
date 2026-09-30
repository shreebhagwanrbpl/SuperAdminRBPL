import { NextResponse } from "next/server";
import { getDb, getProductsCol, getCategoriesCol } from "@/lib/mongodb";
import { normalizeWebsiteId } from "@/lib/websiteCompanyMap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  try {
    const { org } = await params;
    const organizationId = String(org || "").toUpperCase();
    const { searchParams } = new URL(request.url);
    const websiteId = normalizeWebsiteId(searchParams.get("websiteId") || "");

    if (!websiteId) {
      return NextResponse.json(
        { success: false, error: "websiteId query parameter is required", categories: [], products: [] },
        { status: 400 }
      );
    }

    const db = await getDb();
    const categoriesCol = await getCategoriesCol();
    const productsCol = await getProductsCol();

    // 1. Fetch Categories for Organization
    const categories = await categoriesCol
      .find({ organizationId })
      .project({ _id: 1, categoryId: 1, name: 1, slug: 1, subcategories: 1 })
      .toArray();

    // 2. Fetch Products for this Organization and Website
    const products = await productsCol
      .find({
        organizationId,
        status: { $nin: ["inactive", "draft", "deleted", "hidden"] },
        $or: [
          { websiteIds: "all" },
          { websiteIds: websiteId },
          { websiteIds: { $in: ["all", websiteId] } },
          { websiteIds: { $exists: false } },
        ],
      })
      .toArray();

    return NextResponse.json(
      {
        success: true,
        organizationId,
        websiteId,
        categories,
        products,
        totalCount: products.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error(`[API /api/${params?.org}/catalog] Error:`, error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load catalog", categories: [], products: [] },
      { status: 500 }
    );
  }
}
