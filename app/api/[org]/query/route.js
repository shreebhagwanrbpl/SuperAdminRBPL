import { NextResponse } from "next/server";
import { getQueriesCol } from "@/lib/mongodb";
import { setDocument } from "@/lib/mongoDbServer";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, { params }) {
  try {
    const { org } = await params;
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get("websiteId") || "default";
    const body = await request.json();

    const qId = crypto.randomUUID();
    const type = body.type || (body.productTitle || body.productId ? "product" : "contact");

    const queryDoc = {
      _id: `${websiteId}_${qId}`,
      queryId: qId,
      organizationId: String(org || "RBPL").toUpperCase(),
      websiteId,
      type,
      name: body.name || body.fullName || "",
      phone: body.phone || body.mobile || "",
      email: body.email || "",
      message: body.message || body.query || "",
      productTitle: body.productTitle || "",
      productId: body.productId || "",
      data: body,
      status: "unread",
      createdAt: new Date(),
    };

    const col = await getQueriesCol();
    await col.insertOne(queryDoc);

    // Also mirror to legacy document store path for real-time notification compatibility
    const legacyPath = `websitesQueries/${websiteId}/${type === "contact" ? "contactQueries" : "productQueries"}/${qId}`;
    await setDocument(legacyPath, { ...body, createdAt: Date.now() }, true);

    return NextResponse.json(
      { ok: true, message: "Query received successfully", queryId: qId },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("[api/[org]/query] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to submit query" },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
