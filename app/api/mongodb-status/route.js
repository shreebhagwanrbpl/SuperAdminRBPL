import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    const stats = {};

    for (const col of collections) {
      stats[col.name] = await db.collection(col.name).countDocuments();
    }

    return NextResponse.json(
      {
        database: "MongoDB",
        status: "connected",
        databaseName: db.databaseName,
        collections: stats,
        totalCollections: collections.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        database: "MongoDB",
        status: "disconnected",
        error: error?.message || "Failed to connect to MongoDB",
      },
      { status: 500 }
    );
  }
}
