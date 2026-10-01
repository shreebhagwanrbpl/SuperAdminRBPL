import { NextResponse } from "next/server";
import {
  getDocument,
  setDocument,
  deleteDocument,
  listCollection,
  listAllDocuments,
  normalizePath,
} from "@/lib/mongoDbServer";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(error, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[api/db]", error);
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getField(obj, field) {
  return String(field || "").split(".").reduce((v, k) => (v == null ? undefined : v[k]), obj);
}

function compare(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "string" && typeof b === "string") {
    const dA = Date.parse(a);
    const dB = Date.parse(b);
    if (!Number.isNaN(dA) && !Number.isNaN(dB)) return dA - dB;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function applyFilters(rows, filters = []) {
  if (!Array.isArray(filters) || filters.length === 0) return rows;
  return rows.filter(({ data }) => {
    return filters.every(({ field, op, value }) => {
      const actual = getField(data, field);
      switch (op) {
        case "==": return actual === value;
        case "!=": return actual !== value;
        case "<": return compare(actual, value) < 0;
        case "<=": return compare(actual, value) <= 0;
        case ">": return compare(actual, value) > 0;
        case ">=": return compare(actual, value) >= 0;
        case "array-contains": return Array.isArray(actual) && actual.includes(value);
        case "in": return Array.isArray(value) && value.includes(actual);
        case "not-in": return Array.isArray(value) && !value.includes(actual);
        case "array-contains-any": return Array.isArray(actual) && Array.isArray(value) && value.some((item) => actual.includes(item));
        default: return true;
      }
    });
  });
}

function applyOrdering(rows, order = []) {
  if (!Array.isArray(order) || order.length === 0) return rows;
  for (let i = order.length - 1; i >= 0; i--) {
    const item = order[i] || {};
    const field = item.field;
    const direction = String(item.direction || "asc").toLowerCase();
    rows.sort((a, b) => {
      const result = compare(getField(a.data, field), getField(b.data, field));
      return direction === "desc" ? -result : result;
    });
  }
  return rows;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const op = searchParams.get("op") || "get";
    const path = normalizePath(searchParams.get("path") || "");

    const operationsWithoutPath = new Set(["all", "queryNotifications"]);
    if (!path && !operationsWithoutPath.has(op)) {
      return NextResponse.json({ ok: false, error: "path is required" }, { status: 400 });
    }

    // 1. GET DOCUMENT
    if (op === "get") {
      const data = await getDocument(path);
      return NextResponse.json({
        ok: true,
        exists: data !== null,
        data,
      });
    }

    // 2. COLLECTION
    if (op === "collection") {
      let filters = [];
      let order = [];
      const rawFilters = searchParams.get("filters");
      const rawOrder = searchParams.get("order");

      if (rawFilters) {
        try { filters = JSON.parse(rawFilters); } catch { return NextResponse.json({ ok: false, error: "Invalid filters JSON" }, { status: 400 }); }
      }
      if (rawOrder) {
        try { order = JSON.parse(rawOrder); } catch { return NextResponse.json({ ok: false, error: "Invalid order JSON" }, { status: 400 }); }
      }

      const requestedLimit = Number(searchParams.get("limit") || 0);
      let rows = await listCollection(path);
      rows = applyFilters(rows, filters);
      rows = applyOrdering(rows, order);
      const total = rows.length;

      if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
        rows = rows.slice(0, requestedLimit);
      }

      return NextResponse.json({
        ok: true,
        docs: rows.map((r) => ({ id: r.id, data: r.data })),
        count: total,
      });
    }

    // 3. QUERY NOTIFICATIONS
    if (op === "queryNotifications") {
      let since = Number(searchParams.get("since") || 0);
      if (!Number.isFinite(since)) since = 0;

      const db = await getDb();
      const docs = await db.collection("documents")
        .find({
          updated_at: { $gt: since },
          $or: [
            { collection_path: { $regex: /^websitesQueries\/.*\/contactQueries$/ } },
            { collection_path: { $regex: /^websitesQueries\/.*\/productQueries$/ } },
          ],
        })
        .sort({ updated_at: 1 })
        .toArray();

      return NextResponse.json({
        ok: true,
        docs: docs.map((d) => ({
          path: d.path,
          collectionPath: d.collection_path,
          id: d.doc_id,
          data: d.data,
          updatedAt: Number(d.updated_at) || 0,
        })),
        count: docs.length,
        serverTime: Date.now(),
      });
    }

    // 4. ALL DOCUMENTS
    if (op === "all") {
      const docs = await listAllDocuments();
      return NextResponse.json({ ok: true, docs });
    }

    // 5. COUNT
    if (op === "count") {
      const rows = await listCollection(path);
      return NextResponse.json({ ok: true, count: rows.length });
    }

    return NextResponse.json({ ok: false, error: `Unsupported GET operation: ${op}` }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { op = "set", path, data, merge = false, paths = [] } = body || {};

    // 1. SET
    if (op === "set") {
      const cleanPath = normalizePath(path || "");
      if (!cleanPath) return NextResponse.json({ ok: false, error: "path is required" }, { status: 400 });

      const saved = await setDocument(cleanPath, data || {}, !!merge);
      return NextResponse.json({ ok: true, data: saved });
    }

    // 2. UPDATE
    if (op === "update") {
      const cleanPath = normalizePath(path || "");
      if (!cleanPath) return NextResponse.json({ ok: false, error: "path is required" }, { status: 400 });

      const existing = await getDocument(cleanPath);
      if (existing === null) return NextResponse.json({ ok: false, error: "Document does not exist" }, { status: 404 });

      const updated = { ...(existing || {}), ...(data || {}) };
      const saved = await setDocument(cleanPath, updated, false);
      return NextResponse.json({ ok: true, data: saved });
    }

    // 3. DELETE
    if (op === "delete") {
      const cleanPath = normalizePath(path || "");
      if (!cleanPath) return NextResponse.json({ ok: false, error: "path is required" }, { status: 400 });

      await deleteDocument(cleanPath);
      return NextResponse.json({ ok: true });
    }

    // 4. BATCH
    if (op === "batch") {
      if (!Array.isArray(paths)) return NextResponse.json({ ok: false, error: "paths must be an array" }, { status: 400 });

      for (const item of paths) {
        if (!item?.path) continue;
        const itemPath = normalizePath(item.path);
        if (!itemPath) continue;

        if (item.op === "delete") {
          await deleteDocument(itemPath);
        } else {
          await setDocument(itemPath, item.data || {}, !!item.merge);
        }
      }

      return NextResponse.json({ ok: true, count: paths.length });
    }

    // 5. COUNT
    if (op === "count") {
      const cleanPath = normalizePath(path || "");
      if (!cleanPath) return NextResponse.json({ ok: false, error: "path is required" }, { status: 400 });

      const rows = await listCollection(cleanPath);
      return NextResponse.json({ ok: true, count: rows.length });
    }

    return NextResponse.json({ ok: false, error: `Unsupported POST operation: ${op}` }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
