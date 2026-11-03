import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".pjpeg": "image/jpeg",
  ".pjp": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
};

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    if (!slug || !Array.isArray(slug) || slug.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    // Sanitize path segments to prevent path traversal
    const safeSegments = slug.map((seg) => String(seg).replace(/[\/\\]/g, "")).filter(Boolean);
    if (safeSegments.some((s) => s === ".." || s === ".")) {
      return new Response("Forbidden", { status: 403 });
    }

    const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
    const localFilePath = path.resolve(uploadsDir, ...safeSegments);

    // Verify file remains within public/uploads directory
    if (!localFilePath.startsWith(uploadsDir + path.sep) && localFilePath !== uploadsDir) {
      return new Response("Forbidden", { status: 403 });
    }

    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    // 1. If file already exists locally on disk, serve it directly
    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
      const fileBuffer = fs.readFileSync(localFilePath);
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "Content-Length": String(fileBuffer.length),
        },
      });
    }

    // 2. If not on local disk, fetch from production VPS with fast timeout
    const vpsUrl = String(process.env.NEXT_PUBLIC_ADMIN_API_URL || "https://admin.rajbiosis.app")
      .trim()
      .replace(/\/+$/, "");

    // Check request host to avoid endless loopback if running directly on the production host
    const reqHost = request.headers.get("host") || "";
    const isSelfHost = vpsUrl.includes(reqHost);

    if (vpsUrl && !isSelfHost) {
      const remoteUrl = `${vpsUrl}/uploads/${safeSegments.join("/")}`;
      try {
        const remoteRes = await fetch(remoteUrl, {
          signal: AbortSignal.timeout(4000),
          headers: {
            "User-Agent": "SuperAdminRBPL-Image-Proxy",
          },
        });

        if (remoteRes.ok) {
          const arrayBuffer = await remoteRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Save to local disk so subsequent requests are served in 0ms
          try {
            fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
            fs.writeFileSync(localFilePath, buffer);
          } catch (writeErr) {
            console.warn("[uploads route] Failed to cache file locally:", writeErr.message);
          }

          const remoteContentType = remoteRes.headers.get("content-type") || contentType;
          return new Response(buffer, {
            status: 200,
            headers: {
              "Content-Type": remoteContentType,
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              "Content-Length": String(buffer.length),
            },
          });
        }
      } catch (proxyErr) {
        // Fallback to 404 without hanging
      }
    }

    return new Response("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return new Response("Error", { status: 500 });
  }
}

