import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { setDocument } from "@/lib/mongoDbServer";
import { getCompanyForWebsitePath, normalizeWebsiteId } from "@/lib/websiteCompanyMap.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache" };

export async function POST(request) {
  try {
    const body = await request.json();
    const type = String(body?.type || "").toLowerCase();
    const websiteId = normalizeWebsiteId(body?.websiteId || "");
    const companyId = getCompanyForWebsitePath(websiteId);

    if (!["contact", "product"].includes(type)) {
      return NextResponse.json({ success: false, error: "type must be contact or product" }, { status: 400, headers: NO_CACHE });
    }
    if (!websiteId || !companyId) {
      return NextResponse.json({ success: false, error: "Unknown websiteId" }, { status: 400, headers: NO_CACHE });
    }

    const data = body?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ success: false, error: "data must be an object" }, { status: 400, headers: NO_CACHE });
    }
    const name = String(data.name || data.fullName || "").trim();
    const phone = String(data.phone || data.mobile || data.mobileNumber || "").trim();
    if (!name || !phone) {
      return NextResponse.json({ success: false, error: "name and phone are required" }, { status: 400, headers: NO_CACHE });
    }
    if (JSON.stringify(data).length > 30000) {
      return NextResponse.json({ success: false, error: "Query payload is too large" }, { status: 413, headers: NO_CACHE });
    }

    const id = String(body.id || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || randomUUID();
    const collection = type === "contact" ? "contactQueries" : "productQueries";
    const record = {
      ...data,
      name,
      phone,
      type,
      websiteId,
      companyId,
      queryId: id,
      createdAt: data.createdAt || new Date().toISOString(),
      source: "website",
    };

    await setDocument(`websitesQueries/${websiteId}/${collection}/${id}`, record, false);
    return NextResponse.json({ success: true, ok: true, id, websiteId, companyId }, { status: 201, headers: NO_CACHE });
  } catch (error) {
    console.error("[api/public-query] MongoDB write failed:", error);
    return NextResponse.json({ success: false, error: "Unable to save query" }, { status: 500, headers: NO_CACHE });
  }
}
