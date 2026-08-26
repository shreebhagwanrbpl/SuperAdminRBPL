import { NextResponse } from "next/server";
import { getWatermarkDisplayText } from "@/lib/websiteWatermarks";
import { renderWebsitePage } from "@/lib/compareRenderer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DOMAIN_OVERRIDES = {
  qlyte: "qlyte.in",
  qlytein: "qlyte.in",
  safekitin: "safekit.in",
};

const PAGE_PATHS = {
  home: "",
  about: "/about",
  services: "/services",
  items: "/items",
  contact: "/contact",
};

function resolveDomain(site) {
  const key = String(site || "")
    .trim()
    .toLowerCase();

  return DOMAIN_OVERRIDES[key] || getWatermarkDisplayText(key);
}

function allowedDomain(site) {
  const domain = String(resolveDomain(site) || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  return /^[a-z0-9.-]+$/i.test(domain) ? domain : "";
}

function getPath(page, slug) {
  const key = String(page || "")
    .trim()
    .toLowerCase();

  if (key === "productdetail") {
    const cleanSlug = String(slug || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    return cleanSlug
      ? `/items/${encodeURIComponent(cleanSlug)}`
      : null;
  }

  if (key === "home") return "";
  return Object.prototype.hasOwnProperty.call(PAGE_PATHS, key)
    ? PAGE_PATHS[key]
    : null;
}

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function preparePreviewHtml(renderedHtml, originalUrl) {
  let html = String(renderedHtml || "");

  // Playwright has already executed the site's JavaScript. Keep the resulting
  // DOM, but remove executable scripts so hydration cannot replace the page
  // with a runtime error inside the Compare Manager iframe.
  html = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(
      /<meta\b[^>]*(?:http-equiv\s*=\s*["']?content-security-policy|name\s*=\s*["']?content-security-policy)[^>]*>/gi,
      ""
    )
    .replace(
      /<meta\b[^>]*http-equiv\s*=\s*["']?x-frame-options[^>]*>/gi,
      ""
    );

  const safeBase = escapeHtmlAttribute(originalUrl);

  const previewCss = `
<style id="rbpl-preview-style">
  html, body {
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  body {
    min-height: 100vh !important;
  }

  img, video, iframe, svg, canvas {
    max-width: 100%;
  }

  .rbpl-preview-match-dynamic {
    outline: 3px solid #22c55e !important;
    outline-offset: 3px !important;
    background: rgba(34,197,94,.10) !important;
    box-shadow: 0 0 0 5px rgba(34,197,94,.10) !important;
  }

  .rbpl-preview-match-static {
    outline: 3px solid #f97316 !important;
    outline-offset: 3px !important;
    background: rgba(249,115,22,.10) !important;
    box-shadow: 0 0 0 5px rgba(249,115,22,.10) !important;
  }

  .rbpl-preview-label {
    position: relative !important;
  }

  .rbpl-preview-label::after {
    content: attr(data-rbpl-label) !important;
    position: absolute !important;
    top: 5px !important;
    right: 5px !important;
    z-index: 2147483647 !important;
    padding: 4px 7px !important;
    border-radius: 999px !important;
    font: 700 10px/1 Arial,sans-serif !important;
    pointer-events: none !important;
    background: #fff !important;
    box-shadow: 0 1px 5px rgba(0,0,0,.12) !important;
  }

  .rbpl-preview-label-dynamic::after {
    color: #15803d !important;
    border: 1px solid #86efac !important;
  }

  .rbpl-preview-label-static::after {
    color: #c2410c !important;
    border: 1px solid #fdba74 !important;
  }
</style>`;

  const interactionScript = `
<script>
(() => {
  try {
    document.addEventListener("click", (event) => {
      const link = event.target?.closest?.("a");
      if (!link) return;

      const href = link.getAttribute("href") || "";
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        event.preventDefault();
      }
    }, true);

    document.addEventListener("submit", (event) => {
      event.preventDefault();
    }, true);
  } catch (_) {}
})();
</script>`;

  const inject = `
<base href="${safeBase}" target="_self">
${previewCss}
${interactionScript}`;

  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (match) => `${match}${inject}`);
  } else {
    html = `<!doctype html><html><head>${inject}</head><body>${html}</body></html>`;
  }

  return html;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const site = searchParams.get("site") || "";
  const page = searchParams.get("page") || "home";
  const slug = searchParams.get("slug") || "";

  const domain = allowedDomain(site);
  if (!domain) {
    return new NextResponse("Invalid website.", { status: 400 });
  }

  const path = getPath(page, slug);
  if (path === null) {
    return new NextResponse("Invalid page or missing product slug.", {
      status: 400,
    });
  }

  const originalUrl = `https://${domain}${path}`;

  try {
    const rendered = await renderWebsitePage(originalUrl, {
      timeoutMs: 20000,
      waitMs: 1500,
    });

    if (!rendered.ok) {
      return new NextResponse(
        rendered.error || "Website could not be rendered.",
        { status: 502 }
      );
    }

    const preview = preparePreviewHtml(
      rendered.rawHtml,
      rendered.url || originalUrl
    );

    return new NextResponse(preview, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        pragma: "no-cache",
        expires: "0",
        "x-robots-tag": "noindex, nofollow, noarchive",
        "content-security-policy":
          "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; " +
          "img-src * data: blob:; " +
          "style-src * data: 'unsafe-inline'; " +
          "font-src * data:; " +
          "script-src 'unsafe-inline'; " +
          "connect-src * data: blob:; " +
          "frame-src * data: blob:;",
      },
    });
  } catch (error) {
    console.error("COMPARE PREVIEW ERROR", {
      site,
      page,
      slug,
      originalUrl,
      error,
    });

    const message = /playwright install|executable doesn't exist|browserType\.launch/i.test(
      String(error?.message || "")
    )
      ? "Preview renderer is not ready. Install Chromium with: npx playwright install chromium"
      : error?.name === "TimeoutError"
        ? "Preview timed out while rendering the website."
        : "Preview could not be rendered.";

    return new NextResponse(message, { status: 504 });
  }
}
