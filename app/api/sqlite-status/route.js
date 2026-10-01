import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    status: "migrated_to_mongodb",
    message: "SQLite has been completely deprecated. SuperAdmin is now running 100% on MongoDB.",
    mongodbStatusEndpoint: "/api/mongodb-status",
  });
}
