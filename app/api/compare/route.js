import { NextResponse } from "next/server";
import { getWatermarkDisplayText } from "@/lib/websiteWatermarks";
import { renderWebsitePage } from "@/lib/compareRenderer";

const PAGE_PATHS = {
  home: "",
  about: "/about",
  services: "/services",
  items: "/items",
  contact: "/contact",
};

const DOMAIN_OVERRIDES = {
  qlyte: "qlyte.in",
  qlytein: "qlyte.in",
  safekitin: "safekit.in",
};

const resolveDomain = (site) =>
  DOMAIN_OVERRIDES[site] || getWatermarkDisplayText(site);

const cleanText = (value) =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalize = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "your", "our", "are",
  "you", "have", "has", "will", "can", "into", "about", "more", "than", "their",
  "they", "was", "were", "been", "in", "on", "of", "to", "a", "an", "is", "as",
  "at", "by", "or", "be", "it", "we", "us",
]);

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter(
      (word) => word.length >= 3 && !STOP_WORDS.has(word)
    );
}

function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);

  if (!left || !right) return 0;
  if (left === right) return 100;

  const A = new Set(tokens(left));
  const B = new Set(tokens(right));

  if (!A.size || !B.size) return 0;

  const intersection = [...A].filter((word) => B.has(word)).length;
  const union = new Set([...A, ...B]).size || 1;
  const jaccard = intersection / union;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  const containment = shorter.length > 30 && longer.includes(shorter) ? 1 : 0;

  return Math.round(
    Math.min(
      1,
      jaccard * 0.85 + containment * 0.15
    ) * 100
  );
}

function extractBlocks(html) {
  const raw = String(html || "");

  // 1. Extract content inside body if present to avoid head contents comparison
  const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : raw;

  // 2. Remove script, style, and header/nav/footer noise
  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // 3. Inject block boundary linebreaks for block and inline tags
  const boundaryTags = [
    "div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "br", "hr", 
    "section", "article", "aside", "main", "header", "footer", "td", "tr", "th", 
    "table", "button", "span", "a", "option"
  ];
  const tagRegex = new RegExp(`</?(${boundaryTags.join("|")})\\b[^>]*>`, "gi");
  let text = content.replace(tagRegex, "\n");

  // 4. Strip any remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // 5. Decode basic HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&");

  // 6. Split text into lines, trim, and filter blocks
  const lines = text.split("\n");
  const blocks = [];
  const seen = new Set();

  lines.forEach((line) => {
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (cleaned.length < 15) return; // Ignore headers/empty noise

    // Ignore generic menu item/action words to prevent false duplicates
    const norm = normalize(cleaned);
    if (["read more", "learn more", "contact us", "get in touch", "submit", "home", "about", "services", "products", "contact"].includes(norm)) return;

    if (seen.has(norm)) return;
    seen.add(norm);

    blocks.push({
      type: "block",
      text: cleaned,
    });
  });

  return blocks;
}

function dynamicCorpus(dynamicData) {
  if (!dynamicData) return "";

  return Object.values(dynamicData)
    .flatMap((value) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [String(value)];
      }
      if (Array.isArray(value)) {
        return [JSON.stringify(value)];
      }
      if (value && typeof value === "object") {
        return [JSON.stringify(value)];
      }
      return [];
    })
    .join(" ");
}

function annotateBlocks(blocks, dynamicData) {
  const corpus = dynamicCorpus(dynamicData);

  return blocks.map((block) => {
    const sourceScore = similarity(block.text, corpus);

    return {
      ...block,
      source: sourceScore >= 42 ? "dynamic" : "static",
      sourceScore,
    };
  });
}

function groupSimilarBlocks(websites, allPagesData) {
  const groups = [];
  const assigned = new Map(); // key `${site}-${blockIndex}` -> groupId

  websites.forEach((siteI, i) => {
    const blocksI = allPagesData[siteI]?.blocks || [];
    blocksI.forEach((block, idxI) => {
      const keyI = `${siteI}-${idxI}`;
      if (assigned.has(keyI)) return;

      const groupBlocks = [{ site: siteI, index: idxI, text: block.text, source: block.source, type: block.type }];

      websites.forEach((siteJ, j) => {
        if (i === j) return;
        const blocksJ = allPagesData[siteJ]?.blocks || [];

        let bestCandidateIdx = -1;
        let bestCandidateScore = 0;

        blocksJ.forEach((candidate, idxJ) => {
          const keyJ = `${siteJ}-${idxJ}`;
          if (assigned.has(keyJ)) return;

          const score = similarity(block.text, candidate.text);
          if (score > bestCandidateScore) {
            bestCandidateScore = score;
            bestCandidateIdx = idxJ;
          }
        });

        if (bestCandidateScore >= 35 && bestCandidateIdx !== -1) {
          const candidate = blocksJ[bestCandidateIdx];
          groupBlocks.push({
            site: siteJ,
            index: bestCandidateIdx,
            text: candidate.text,
            source: candidate.source,
            type: candidate.type,
            matchScore: bestCandidateScore,
          });
        }
      });

      if (groupBlocks.length > 1) {
        const groupId = `g-${Math.random().toString(36).substring(2, 11)}`;
        groupBlocks.forEach((item) => {
          assigned.set(`${item.site}-${item.index}`, groupId);
        });

        // Compute average similarity (source block to matching blocks)
        let totalScore = 0;
        let count = 0;
        groupBlocks.forEach((item, idx) => {
          if (idx === 0) return;
          totalScore += item.matchScore;
          count++;
        });
        const averageSimilarity = count > 0 ? Math.round(totalScore / count) : 100;

        groups.push({
          id: groupId,
          text: block.text,
          blocks: groupBlocks,
          averageSimilarity,
        });
      }
    });
  });

  // Assign groupIds and match scores back to original blocks
  websites.forEach((site) => {
    const blocks = allPagesData[site]?.blocks || [];
    blocks.forEach((block, idx) => {
      const key = `${site}-${idx}`;
      if (assigned.has(key)) {
        const groupId = assigned.get(key);
        const group = groups.find((g) => g.id === groupId);
        block.groupId = groupId;
        const selfInGroup = group.blocks.find((b) => b.site === site && b.index === idx);
        block.matchScore = selfInGroup.matchScore || group.averageSimilarity;
      } else {
        block.groupId = null;
        block.matchScore = 0;
      }
    });
  });

  return groups;
}

function pageSimilarity(blocksA, blocksB) {
  if (!blocksA.length || !blocksB.length) {
    return null;
  }

  const scores = blocksA.map((block) => {
    return Math.max(
      ...blocksB.map((candidate) => similarity(block.text, candidate.text))
    );
  });

  return Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length
  );
}

async function fetchPage(site, page, timeoutMs = 15000, customPath = null) {
  const domain = resolveDomain(site);
  const path = customPath ?? (PAGE_PATHS[page] || "");
  const url = `https://${domain}${path}`;

  try {
    const rendered = await renderWebsitePage(url, {
      timeoutMs,
      waitMs: 1200,
    });

    const blocks = extractBlocks(rendered.rawHtml);

    return {
      ok: rendered.ok && blocks.length > 0,
      status: rendered.status,
      url: rendered.url || url,
      rawHtml: rendered.rawHtml,
      previewHtml: rendered.previewHtml,
      blocks,
      failedRequests: rendered.failedRequests || [],
      error: rendered.ok
        ? blocks.length
          ? null
          : "Page rendered, but no meaningful content blocks were detected."
        : rendered.error || "Unable to render page.",
    };
  } catch (error) {
    console.error("COMPARE RENDER ERROR", {
      site,
      page,
      url,
      error,
    });

    const message = String(error?.message || "Unable to render page.");
    const browserMissing =
      /executable doesn't exist|browserType\.launch|playwright install/i.test(
        message
      );

    return {
      ok: false,
      status: 0,
      url,
      rawHtml: "",
      previewHtml: "",
      blocks: [],
      failedRequests: [],
      error: browserMissing
        ? "Playwright Chromium is not installed. Run: npx playwright install chromium"
        : message,
    };
  }
}

function getProductTextField(field) {
  if (field == null) return "";
  if (typeof field === "string" || typeof field === "number") return String(field);
  if (typeof field === "object") {
    if (field.text != null) return String(field.text);
    if (Array.isArray(field.richText)) {
      return field.richText.map((x) => x?.text || "").join(" ");
    }
  }
  return String(field);
}

function normalizeProductSlug(value) {
  return normalize(
    getProductTextField(value)
      .replace(/-(?:0*\d{1,3})$/i, "")
  );
}

function productIdentity(product) {
  if (!product || typeof product !== "object") return "";

  const title = getProductTextField(
    product.title || product.name || product.productName
  );
  const brand = getProductTextField(product.brand);
  const model = getProductTextField(product.model);

  // masterSlug is intentionally preferred because the project already
  // stores the website-specific SEO slug separately from the master slug.
  const masterSlug = normalizeProductSlug(
    product.masterSlug ||
      product.productSlug ||
      product.slug ||
      product.seoSlug ||
      title
  );

  return normalize(
    [title, brand, model, masterSlug]
      .filter(Boolean)
      .join(" ")
  );
}

function productDescription(product) {
  if (!product || typeof product !== "object") return "";

  const fields = [
    "description",
    "shortDescription",
    "details",
    "specifications",
    "features",
    "usage",
    "instrument",
    "parameters",
    "automation",
    "availability",
    "size",
  ];

  return normalize(
    fields
      .map((key) => getProductTextField(product[key]))
      .filter(Boolean)
      .join(" ")
  );
}

function productSimilarity(productA, productB) {
  const identityA = productIdentity(productA);
  const identityB = productIdentity(productB);

  if (!identityA || !identityB) return 0;

  const identityScore = similarity(identityA, identityB);

  const descA = productDescription(productA);
  const descB = productDescription(productB);

  const descScore =
    descA && descB
      ? similarity(descA, descB)
      : null;

  // Identity is intentionally dominant. This prevents small SEO/slug
  // variations from making the same product look different.
  if (descScore == null) return identityScore;

  return Math.round(identityScore * 0.75 + descScore * 0.25);
}

function compactProductCatalog(products) {
  if (!Array.isArray(products)) return [];
  return products.filter(Boolean);
}

function productCatalogSimilarity(productsA, productsB) {
  const A = compactProductCatalog(productsA);
  const B = compactProductCatalog(productsB);

  if (!A.length || !B.length) {
    return {
      available: false,
      similarity: null,
      common: 0,
      onlyA: A.length,
      onlyB: B.length,
      countA: A.length,
      countB: B.length,
      reason: "One or both product catalogs are empty.",
    };
  }

  let matches = 0;
  const matchedB = new Set();
  const matchScores = [];

  A.forEach((productA) => {
    let bestScore = 0;
    let bestIdx = -1;

    B.forEach((productB, idxB) => {
      if (matchedB.has(idxB)) return;

      const score = productSimilarity(productA, productB);

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idxB;
      }
    });

    // 70 is deliberately higher than generic text similarity so a random
    // shared word cannot make two different products duplicates.
    if (bestScore >= 70 && bestIdx !== -1) {
      matches++;
      matchedB.add(bestIdx);
      matchScores.push(bestScore);
    }
  });

  const union = A.length + B.length - matches || 1;

  return {
    available: true,
    similarity: Math.round((matches / union) * 100),
    common: matches,
    onlyA: A.length - matches,
    onlyB: B.length - matches,
    countA: A.length,
    countB: B.length,
    averageMatchedProductScore: matchScores.length
      ? Math.round(
          matchScores.reduce((a, b) => a + b, 0) /
            matchScores.length
        )
      : 0,
  };
}

function findMatchingProduct(products, targetProduct) {
  if (!Array.isArray(products) || !targetProduct) return null;

  let best = null;
  let bestScore = 0;

  products.forEach((candidate) => {
    const score = productSimilarity(
      targetProduct,
      candidate
    );

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  });

  return bestScore >= 70
    ? {
        product: best,
        score: bestScore,
      }
    : null;
}

function productDetailPath(product) {
  if (!product) return "";

  const slug =
    getProductTextField(
      product.seoSlug ||
        product.slug ||
        product.productSlug ||
        product.masterSlug
    )
      .trim()
      .replace(/^\/+/, "");

  return slug
    ? `/items/${encodeURIComponent(slug)}`
    : "";
}

// Helper to resolve any relative URL against a base URL
function resolveRelativeUrl(url, baseUrl) {
  if (!url) return "";
  const trimUrl = url.trim();
  if (/^(https?:|data:|blob:|mailto:|tel:|\/\/|#)/i.test(trimUrl)) {
    return trimUrl;
  }
  try {
    return new URL(trimUrl, baseUrl).href;
  } catch (e) {
    return trimUrl;
  }
}

function buildPreviewHtml(html, baseUrl, blocks, groups, site) {
  const raw = String(html || "");
  if (!raw) {
    return "";
  }

  const safeBlocks = (blocks || [])
    .map((block) => {
      let otherText = "";
      if (block.groupId) {
        const group = groups.find((g) => g.id === block.groupId);
        const other = group?.blocks.find((b) => b.site !== site);
        otherText = other ? other.text : "";
      }
      return {
        type: block.type,
        text: block.text,
        source: block.source,
        matchScore: block.matchScore || 0,
        otherText,
      };
    })
    .filter((block) => block.text);

  const payload = JSON.stringify(safeBlocks).replace(/</g, "\\u003c");

  const css = `
    .rbpl-source-dynamic {
      outline: 2px solid rgba(22,163,74,.5)!important;
      outline-offset: 2px!important;
      background: rgba(220,252,231,.45)!important;
      position: relative!important;
    }

    .rbpl-source-static {
      outline: 2px solid rgba(249,115,22,.5)!important;
      outline-offset: 2px!important;
      background: rgba(255,237,213,.45)!important;
      position: relative!important;
    }

    mark.rbpl-sim-dynamic {
      background: #86efac!important;
      color: #14532d!important;
      border-radius: 4px!important;
      padding: 0 2px!important;
    }

    mark.rbpl-sim-static {
      background: #fdba74!important;
      color: #7c2d12!important;
      border-radius: 4px!important;
      padding: 0 2px!important;
    }

    .rbpl-badge {
      position: relative!important;
    }

    .rbpl-badge:after {
      content: attr(data-rbpl-source);
      position: absolute!important;
      right: 4px!important;
      top: 4px!important;
      font: 700 9px/1 Arial,sans-serif!important;
      padding: 3px 5px!important;
      border-radius: 999px!important;
      z-index: 2147483647!important;
      pointer-events: none!important;
    }

    .rbpl-badge-dynamic:after {
      background: #dcfce7!important;
      color: #166534!important;
      border: 1px solid #86efac!important;
    }

    .rbpl-badge-static:after {
      background: #ffedd5!important;
      color: #9a3412!important;
      border: 1px solid #fdba74!important;
    }

    body {
      scroll-behavior: smooth!important;
    }
  `;

  const script = `
    (() => {
      const blocks = ${payload};

      const norm = (s) =>
        String(s || "")
          .toLowerCase()
          .replace(/[^a-z0-9\\\\s]/g, " ")
          .replace(/\\\\s+/g, " ")
          .trim();

      const toks = (s) =>
        norm(s)
          .split(" ")
          .filter(
            (x) => x.length >= 4
          );

      const common = (a, b) => {
        const B = new Set(toks(b));
        return new Set(toks(a).filter((x) => B.has(x)));
      };

      const allElements = [...document.querySelectorAll("body *")];

      blocks.forEach((block) => {
        const target = norm(block.text);

        // Find the deepest matching element that contains the exact normalized text
        let el = allElements.find((node) => {
          const nodeText = norm(node.textContent);
          if (nodeText !== target) return false;
          return ![...node.children].some(child => norm(child.textContent) === target);
        });

        if (!el) {
          el = allElements.find((node) => {
            const nodeText = norm(node.textContent);
            if (!nodeText.includes(target)) return false;
            return ![...node.children].some(child => norm(child.textContent).includes(target));
          });
        }

        if (!el) return;

        const source = block.source === "dynamic" ? "dynamic" : "static";

        el.classList.add(
          "rbpl-source-" + source,
          "rbpl-badge",
          "rbpl-badge-" + source
        );

        el.setAttribute("data-rbpl-source", source.toUpperCase());

        const score = Number(block.matchScore || 0);
        if (score < 35 || !block.otherText) return;

        const words = common(block.text, block.otherText);
        if (!words.size) return;

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
          nodes.push(walker.currentNode);
        }

        nodes.forEach((node) => {
          if (!node.nodeValue.trim() || node.parentElement.closest("script,style,mark")) return;

          const parts = node.nodeValue.split(/(\\s+)/);
          const fragment = document.createDocumentFragment();

          parts.forEach((part) => {
            const key = part.toLowerCase().replace(/[^a-z0-9]/g, "");

            if (key && words.has(key)) {
              const mark = document.createElement("mark");
              mark.className = "rbpl-sim-" + source;
              mark.textContent = part;
              fragment.appendChild(mark);
            } else {
              fragment.appendChild(document.createTextNode(part));
            }
          });

          node.parentNode.replaceChild(fragment, node);
        });
      });

      document.documentElement.dataset.rbplReady = "1";
    })();
  `;

  // Escape script and noscript tags correctly inside RegExp
  const scriptTagRegex = new RegExp("<script[\\s\\S]*?<\\/script>", "gi");
  const noscriptTagRegex = new RegExp("<noscript[\\s\\S]*?<\\/noscript>", "gi");
  const baseTagRegex = /<base[^>]*>/gi;

  let cleaned = raw
    .replace(scriptTagRegex, "")
    .replace(noscriptTagRegex, "")
    .replace(baseTagRegex, "");

  // Rewrite all relative URLs (href, src, srcset) to absolute URLs
  cleaned = cleaned.replace(/(href|src|srcset)=["']([^"']*)["']/gi, (match, attr, val) => {
    if (attr.toLowerCase() === "srcset") {
      const parts = val.split(",").map((part) => {
        const subParts = part.trim().split(/\s+/);
        if (subParts[0]) {
          subParts[0] = resolveRelativeUrl(subParts[0], baseUrl);
        }
        return subParts.join(" ");
      });
      return `${attr}="${parts.join(", ")}"`;
    }
    return `${attr}="${resolveRelativeUrl(val, baseUrl)}"`;
  });

  if (!/<html[\s>]/i.test(cleaned)) {
    cleaned = `<html><head></head><body>${cleaned}</body></html>`;
  }

  const safeBaseUrl = String(baseUrl).replace(/"/g, "&quot;");
  const headInject = `
    <base href="${safeBaseUrl}/">
    <style>${css}</style>
  `;

  if (/<head[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<head[^>]*>/i, (match) => match + headInject);
  } else {
    cleaned = `<head>${headInject}</head>${cleaned}`;
  }

  const safeScript = script.replace(/<\//g, "\\u003c/");

  if (/<\/body>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<\/body>/i, `<script>${safeScript}</script></body>`);
  } else {
    cleaned += `<script>${safeScript}</script>`;
  }

  return cleaned;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      websites = [],
      dynamic = {},
      productCatalogs = {},
      page = null,
    } = body;

    // Backward compatibility mapping
    let selectedSites = websites;
    if (body.websiteA && body.websiteB && (!selectedSites || selectedSites.length === 0)) {
      selectedSites = [body.websiteA, body.websiteB];
    }

    let dynamicDocs = dynamic || {};
    if (body.dynamicA && body.websiteA) {
      dynamicDocs[body.websiteA] = body.dynamicA;
    }
    if (body.dynamicB && body.websiteB) {
      dynamicDocs[body.websiteB] = body.dynamicB;
    }

    let catalogs = productCatalogs || {};
    if (body.productCatalogA && body.websiteA) {
      catalogs[body.websiteA] = body.productCatalogA;
    }
    if (body.productCatalogB && body.websiteB) {
      catalogs[body.websiteB] = body.productCatalogB;
    }

    if (!selectedSites || selectedSites.length < 2) {
      return NextResponse.json(
        { error: "Select at least two websites to compare." },
        { status: 400 }
      );
    }

    if (selectedSites.length > 5) {
      return NextResponse.json(
        { error: "A maximum of 5 websites can be compared at once." },
        { status: 400 }
      );
    }

    /*
     * Product Detail comparison.
     *
     * The UI resolves the corresponding product object for every website
     * using the master product identity. We then fetch each website's
     * actual SEO variant URL (e.g. -01 / -02 / -130).
     */
    if (page === "productDetail") {
      const productTargets = body.productTargets || {};
      const pageData = {};

      await Promise.all(
        selectedSites.map(async (site) => {
          const target = productTargets[site];

          if (!target) {
            pageData[site] = {
              ok: false,
              status: 0,
              url: "",
              rawHtml: "",
              blocks: [],
              error: "Matching product was not found on this website.",
            };
            return;
          }

          const path = productDetailPath(target);

          if (!path) {
            pageData[site] = {
              ok: false,
              status: 0,
              url: "",
              rawHtml: "",
              blocks: [],
              error: "Product does not contain a usable slug.",
            };
            return;
          }

          const res = await fetchPage(
            site,
            "productDetail",
            15000,
            path
          );

          const dynamicDoc =
            dynamicDocs[site]?.productDetail ||
            dynamicDocs[site]?.items ||
            null;

          res.blocks = annotateBlocks(
            res.blocks,
            dynamicDoc
          );

          pageData[site] = res;
        })
      );

      const groups = groupSimilarBlocks(
        selectedSites,
        pageData
      );

      const matrix = {};
      selectedSites.forEach((s) => {
        matrix[s] = {};
      });

      for (let i = 0; i < selectedSites.length; i++) {
        for (let j = i + 1; j < selectedSites.length; j++) {
          const siteX = selectedSites[i];
          const siteY = selectedSites[j];

          const dataX = pageData[siteX];
          const dataY = pageData[siteY];

          const score =
            dataX?.ok && dataY?.ok
              ? pageSimilarity(
                  dataX.blocks,
                  dataY.blocks
                )
              : null;

          matrix[siteX][siteY] = score;
          matrix[siteY][siteX] = score;
        }
      }

      const scores = [];

      selectedSites.forEach((siteX, i) => {
        for (let j = i + 1; j < selectedSites.length; j++) {
          const score =
            matrix[siteX][selectedSites[j]];

          if (Number.isFinite(score)) {
            scores.push(score);
          }
        }
      });

      const pageSimilarityScore = scores.length
        ? Math.round(
            scores.reduce((a, b) => a + b, 0) /
              scores.length
          )
        : null;

      return NextResponse.json({
        websites: selectedSites,
        page,
        result: {
          similarity: pageSimilarityScore,
          matrix,
          pageData,
          groups,
          productTargets,
        },
        generatedAt:
          new Date().toISOString(),
      });
    }

    /*
     * Single page comparison.
     * Used by page tabs and retry.
     */
    if (page && PAGE_PATHS[page] !== undefined) {
      const pageKey = page;
      const pageData = {};

      await Promise.all(
        selectedSites.map(async (site) => {
          const res = await fetchPage(site, pageKey, 15000);
          const dynamicDoc = dynamicDocs[site]?.[pageKey] || null;
          res.blocks = annotateBlocks(res.blocks, dynamicDoc);
          pageData[site] = res;
        })
      );

      const groups = groupSimilarBlocks(selectedSites, pageData);

      // Matrix calculation for this page
      const matrix = {};
      selectedSites.forEach((s) => { matrix[s] = {}; });
      for (let i = 0; i < selectedSites.length; i++) {
        for (let j = i + 1; j < selectedSites.length; j++) {
          const siteX = selectedSites[i];
          const siteY = selectedSites[j];
          const dataX = pageData[siteX];
          const dataY = pageData[siteY];

          let score = 0;
          if (dataX.ok && dataY.ok) {
            const simVal = pageSimilarity(dataX.blocks, dataY.blocks);
            if (pageKey === "items") {
              const catalogSim = productCatalogSimilarity(catalogs[siteX] || [], catalogs[siteY] || []);
              if (catalogSim.available) {
                score =
                  simVal == null
                    ? catalogSim.similarity
                    : Math.round(
                        catalogSim.similarity * 0.8 +
                          simVal * 0.2
                      );
              } else {
                // Catalog is unavailable; never silently turn that into 0%.
                score = simVal;
              }
            } else {
              score = simVal || 0;
            }
          } else {
            score = null;
          }
          matrix[siteX][siteY] = score;
          matrix[siteY][siteX] = score;
        }
      }

      // Compute page average similarity score (average of all unique pairs)
      let totalSim = 0;
      let pairCount = 0;
      for (let i = 0; i < selectedSites.length; i++) {
        for (let j = i + 1; j < selectedSites.length; j++) {
          const score = matrix[selectedSites[i]][selectedSites[j]];
          if (score !== null) {
            totalSim += score;
            pairCount++;
          }
        }
      }
      const pageSimilarityScore = pairCount > 0 ? Math.round(totalSim / pairCount) : null;

      const catalogMatrix = {};
      selectedSites.forEach((s) => {
        catalogMatrix[s] = {};
      });

      if (pageKey === "items") {
        for (let i = 0; i < selectedSites.length; i++) {
          for (let j = i + 1; j < selectedSites.length; j++) {
            const a = selectedSites[i];
            const b = selectedSites[j];
            const catalog = productCatalogSimilarity(
              catalogs[a] || [],
              catalogs[b] || []
            );
            catalogMatrix[a][b] = catalog;
            catalogMatrix[b][a] = catalog;
          }
        }
      }

      const result = {
        similarity: pageSimilarityScore,
        matrix,
        catalogMatrix,
        pageData,
        groups,
        previewHtml: Object.fromEntries(
          selectedSites.map((site) => {
            const data = pageData[site];
            return [
              site,
              data.ok ? buildPreviewHtml(data.rawHtml || "", data.url, data.blocks, groups, site) : "",
            ];
          })
        ),
      };

      return NextResponse.json({
        websites: selectedSites,
        page,
        result,
        generatedAt: new Date().toISOString(),
      });
    }

    /*
     * Initial dashboard comparison (all pages).
     */
    const entries = await Promise.all(
      Object.keys(PAGE_PATHS).map(async (pageKey) => {
        const pageData = {};
        await Promise.all(
          selectedSites.map(async (site) => {
            const res = await fetchPage(site, pageKey, 10000);
            const dynamicDoc = dynamicDocs[site]?.[pageKey] || null;
            res.blocks = annotateBlocks(res.blocks, dynamicDoc);
            pageData[site] = res;
          })
        );

        const groups = groupSimilarBlocks(selectedSites, pageData);

        // Matrix calculation for this page
        const matrix = {};
        selectedSites.forEach((s) => { matrix[s] = {}; });
        for (let i = 0; i < selectedSites.length; i++) {
          for (let j = i + 1; j < selectedSites.length; j++) {
            const siteX = selectedSites[i];
            const siteY = selectedSites[j];
            const dataX = pageData[siteX];
            const dataY = pageData[siteY];

            let score = 0;
            if (dataX.ok && dataY.ok) {
              const simVal = pageSimilarity(dataX.blocks, dataY.blocks);
              if (pageKey === "items") {
                const catalogSim = productCatalogSimilarity(catalogs[siteX] || [], catalogs[siteY] || []);
                if (catalogSim.available) {
                  score = simVal == null
                    ? catalogSim.similarity
                    : Math.round(catalogSim.similarity * 0.8 + simVal * 0.2);
                } else {
                  score = simVal;
                }
              } else {
                score = simVal || 0;
              }
            } else {
              score = null;
            }
            matrix[siteX][siteY] = score;
            matrix[siteY][siteX] = score;
          }
        }

        // Compute page similarity score: average of all pairwise similarities
        let totalSim = 0;
        let pairCount = 0;
        for (let i = 0; i < selectedSites.length; i++) {
          for (let j = i + 1; j < selectedSites.length; j++) {
            const score = matrix[selectedSites[i]][selectedSites[j]];
            if (score !== null) {
              totalSim += score;
              pairCount++;
            }
          }
        }
        const pageSimilarityScore = pairCount > 0 ? Math.round(totalSim / pairCount) : null;

        return [
          pageKey,
          {
            similarity: pageSimilarityScore,
            matrix,
            catalogMatrix: pageKey === "items"
              ? Object.fromEntries(
                  selectedSites.map((site) => [
                    site,
                    Object.fromEntries(
                      selectedSites
                        .filter((other) => other !== site)
                        .map((other) => [
                          other,
                          productCatalogSimilarity(
                            catalogs[site] || [],
                            catalogs[other] || []
                          ),
                        ])
                    ),
                  ])
                )
              : {},
            pageData,
            groups,
            previewHtml: Object.fromEntries(
              selectedSites.map((site) => {
                const data = pageData[site];
                return [
                  site,
                  data.ok ? buildPreviewHtml(data.rawHtml || "", data.url, data.blocks, groups, site) : "",
                ];
              })
            ),
          },
        ];
      })
    );

    const results = Object.fromEntries(entries);

    const values = Object.values(results)
      .map((item) => item.similarity)
      .filter((value) => Number.isFinite(value));

    const overall = values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : null;

    return NextResponse.json({
      websites: selectedSites,
      overall,
      results,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("COMPARE ERROR", error);
    return NextResponse.json(
      { error: error?.message || "Compare failed" },
      { status: 500 }
    );
  }
}