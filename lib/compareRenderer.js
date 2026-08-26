import { chromium } from "playwright";
import fs from "node:fs";

let browserPromise = null;

function detectChromeExecutable() {
  const configured = process.env.CHROME_EXECUTABLE_PATH?.trim();
  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  const candidates = [
    process.env.PROGRAMFILES
      ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`
      : "",
    process.env["PROGRAMFILES(X86)"]
      ? `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`
      : "",
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : "",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  return candidates.find((file) => fs.existsSync(file)) || "";
}

function getLaunchOptions() {
  const executablePath = detectChromeExecutable();

  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  };
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch(getLaunchOptions()).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
}

function cleanRenderedHtml(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(
      /<meta\b[^>]*(?:http-equiv\s*=\s*["']?content-security-policy|name\s*=\s*["']?content-security-policy)[^>]*>/gi,
      ""
    )
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?x-frame-options[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
}

export async function renderWebsitePage(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 20000);
  const waitMs = Number(options.waitMs ?? 1200);

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/151.0.0.0 Safari/537.36 RBPL-Compare/4.0",
  });

  const page = await context.newPage();

  // Block non-essential heavy resources to dramatically speed up scraping and prevent CDN/loading hangs
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    const url = route.request().url().toLowerCase();

    // Block common tracker and analytics URLs to avoid slow client script rendering hangs
    const isTracker =
      url.includes("analytics") ||
      url.includes("google-analytics") ||
      url.includes("doubleclick") ||
      url.includes("facebook.net") ||
      url.includes("hotjar") ||
      url.includes("pixel") ||
      url.includes("gtm.js");

    if (
      ["image", "media", "font", "stylesheet", "websocket", "eventsource", "manifest", "texttrack"].includes(type) ||
      isTracker
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const failedRequests = [];

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    if (failure) {
      failedRequests.push({
        url: request.url(),
        error: failure.errorText,
      });
    }
  });

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // Give Next.js/Firebase/client components a chance to finish rendering.
    // We do not require network-idle because analytics/polling can keep a page
    // busy forever. Instead, wait for a meaningful amount of visible text.
    try {
      await page.waitForFunction(
        () => {
          const text = document.body?.innerText?.trim() || "";
          return text.length >= 80;
        },
        null,
        { timeout: Math.min(6000, timeoutMs) }
      );
    } catch (_) {
      // Some pages intentionally render very little text. Continue with DOM.
    }

    try {
      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      });
    } catch (_) { }

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const status = response?.status() || 0;
    const ok = Boolean(response?.ok()) && status >= 200 && status < 400;

    const finalUrl = page.url();
    const renderedHtml = await page.content();

    if (!renderedHtml.trim()) {
      throw new Error("The browser rendered an empty document.");
    }

    return {
      ok,
      status,
      url: finalUrl || url,
      rawHtml: renderedHtml,
      previewHtml: cleanRenderedHtml(renderedHtml),
      failedRequests: failedRequests.slice(0, 20),
      error: ok ? null : `HTTP ${status || "unknown"}`,
    };
  } finally {
    await context.close().catch(() => { });
  }
}

export async function closeCompareBrowser() {
  if (!browserPromise) return;

  const browser = await browserPromise.catch(() => null);
  browserPromise = null;

  if (browser) {
    await browser.close().catch(() => { });
  }
}
