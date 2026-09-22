import { NextResponse } from "next/server";
import { dbPath, database } from "@/lib/sqliteServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const count = database.prepare("SELECT COUNT(*) AS count FROM documents").get().count;
  return NextResponse.json({
    database: "SQLite",
    status: "connected",
    file: "data/catalog.db",
    path: dbPath,
    documents: Number(count),
    firestoreRuntime: false,
    firebaseStorageRuntime: false,
    firebaseAuth: true,
  });
}
