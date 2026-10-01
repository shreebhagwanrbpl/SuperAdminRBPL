import { NextResponse } from "next/server";
import { getPagesCol } from "@/lib/mongodb";
import { normalizeWebsiteId } from "@/lib/websiteCompanyMap";
import { normalizeOrgId } from "@/lib/mongoDbServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  try {
    const { org } = await params;
    const organizationId = normalizeOrgId(org);
    const { searchParams } = new URL(request.url);
    const websiteId = normalizeWebsiteId(searchParams.get("websiteId") || "");
    const requestedPage = String(searchParams.get("page") || "").trim().toLowerCase();

    if (!websiteId) {
      return NextResponse.json(
        { success: false, error: "websiteId query parameter is required" },
        { status: 400 }
      );
    }

    const pagesCol = await getPagesCol();

    if (requestedPage) {
      const pageDoc = await pagesCol.findOne({
        websiteId,
        page: requestedPage,
      });

      return NextResponse.json(
        {
          success: true,
          organizationId,
          websiteId,
          page: requestedPage,
          data: pageDoc?.data || pageDoc || null,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Fetch all pages for this website
    const allPages = await pagesCol.find({ websiteId }).toArray();
    const pagesMap = {};
    for (const p of allPages) {
      pagesMap[p.page] = p.data || p;
    }

    return NextResponse.json(
      {
        success: true,
        organizationId,
        websiteId,
        pages: pagesMap,
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
    console.error(`[API /api/${params?.org}/site-data] Error:`, error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load site data" },
      { status: 500 }
    );
  }
}
