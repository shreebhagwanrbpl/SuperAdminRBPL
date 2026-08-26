"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COMPANY_WEBSITES } from "@/lib/seoCompareConfig";
import {
  GitCompareArrows,
  CheckCircle2,
  AlertTriangle,
  CircleHelp,
  Save,
  RefreshCw,
  Code2,
  Database,
  Link2,
  Settings2,
  X,
  Sparkles,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import "./compare.css";

const PAGES = [
  ["home", "Home"],
  ["about", "About"],
  ["services", "Services"],
  ["items", "Items"],
  ["contact", "Contact"],
];

function percentClass(value) {
  if (value == null) return "unknown";
  if (value >= 80) return "danger";
  if (value >= 50) return "warn";
  return "good";
}

// Find if a text matches any key in Firestore dynamic document
function findFirebaseField(blockText, dynamicData) {
  if (!dynamicData || typeof dynamicData !== "object") return null;
  const target = normalizeText(blockText);

  for (const [key, value] of Object.entries(dynamicData)) {
    const valStr = typeof value === "object"
      ? value?.text || value?.richText?.map(x => x.text).join("") || JSON.stringify(value)
      : String(value);

    if (normalizeText(valStr) === target || normalizeText(valStr).includes(target) || target.includes(normalizeText(valStr))) {
      return key;
    }
  }
  return null;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/*
|--------------------------------------------------------------------------
| FULL DYNAMIC DOCUMENT EDITOR
|--------------------------------------------------------------------------
*/
function DynamicEditor({ website, page, data, onSaved }) {
  const [draft, setDraft] = useState(data || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(data || {});
  }, [data]);

  const entries = Object.entries(draft || {}).filter(
    ([, value]) =>
      ["string", "number", "boolean"].includes(typeof value) ||
      Array.isArray(value) ||
      (value && typeof value === "object")
  );

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "websites", website, "pages", page), draft, { merge: true });
      toast.success("Dynamic content saved");
      onSaved?.(draft);
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="empty-editor">
        <CircleHelp size={18} />
        No Firebase content found for this page on {website}.
      </div>
    );
  }

  return (
    <div className="dynamic-editor">
      <div className="editor-title">
        <span>Full Firebase document edit ({website})</span>
        <small>
          <Database size={13} />
          Firebase
        </small>
      </div>

      <div className="editor-fields-scroll">
        {entries.map(([key, value]) => (
          <label className="editor-field" key={key}>
            <span>{key}</span>
            {Array.isArray(value) || (value && typeof value === "object") ? (
              <textarea
                value={JSON.stringify(value, null, 2)}
                onChange={(e) => {
                  try {
                    setDraft((d) => ({
                      ...d,
                      [key]: JSON.parse(e.target.value),
                    }));
                  } catch {
                    setDraft((d) => ({
                      ...d,
                      [key]: e.target.value,
                    }));
                  }
                }}
              />
            ) : (
              <textarea
                value={String(value ?? "")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [key]: e.target.value,
                  }))
                }
              />
            )}
          </label>
        ))}
      </div>

      <button className="save-dynamic" onClick={save} disabled={saving}>
        {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
        {saving ? "Saving..." : "Save Document"}
      </button>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Visual preview helper
|--------------------------------------------------------------------------
*/
function PreviewFrame({
  site,
  page,
  productSlug = "",
  data,
  onGroupClick,
}) {
  // Use a ref without adding another React import.
  const refHolder = useMemo(
    () => ({ current: null }),
    []
  );

  useEffect(() => {
    const iframe = refHolder.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.body) return;

        const selector =
          "h1,h2,h3,h4,h5,h6,p,li,button,article,section";

        const elements = [
          ...doc.querySelectorAll(selector),
        ];

        const normalize = (value) =>
          String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9\\s]/g, " ")
            .replace(/\\s+/g, " ")
            .trim();

        const used = new Set();

        (data?.blocks || []).forEach((block) => {
          if (!block?.groupId) return;
          if ((block.matchScore || 0) < 35) return;

          const target = normalize(block.text);

          if (!target || used.has(target)) return;

          let element = elements.find(
            (node) =>
              !used.has(node) &&
              normalize(node.textContent) === target &&
              ![...node.children].some(
                (child) =>
                  normalize(child.textContent) === target
              )
          );

          if (!element) {
            element = elements.find(
              (node) =>
                !used.has(node) &&
                normalize(node.textContent).includes(target)
            );
          }

          if (!element) return;

          used.add(element);

          const source =
            block.source === "dynamic"
              ? "dynamic"
              : "static";

          element.classList.add(
            `rbpl-preview-match-${source}`,
            "rbpl-preview-label",
            `rbpl-preview-label-${source}`
          );

          element.setAttribute(
            "data-rbpl-label",
            `${source === "dynamic" ? "DYNAMIC" : "STATIC"} • ${block.matchScore || 0}%`
          );

          element.setAttribute(
            "data-rbpl-group",
            block.groupId
          );

          element.style.cursor = "pointer";

          element.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              event.stopPropagation();
              onGroupClick?.(block.groupId);
            },
            true
          );
        });
      } catch (error) {
        console.warn(
          "Preview highlight failed:",
          error
        );
      }
    };

    iframe.addEventListener(
      "load",
      handleLoad
    );

    if (iframe.contentDocument?.readyState === "complete") {
      handleLoad();
    }

    return () => {
      iframe.removeEventListener(
        "load",
        handleLoad
      );
    };
  }, [
    refHolder,
    data,
    onGroupClick,
    site,
    page,
    productSlug,
  ]);

  const params = new URLSearchParams({
    site,
    page,
  });

  if (productSlug) {
    params.set(
      "slug",
      productSlug
    );
  }

  return (
    <iframe
      ref={(node) => {
        refHolder.current = node;
      }}
      className="preview-iframe"
      src={`/api/compare/preview?${params.toString()}`}
      title={`${site} ${page} preview`}
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      referrerPolicy="no-referrer"
    />
  );
}

function compactProductForCompare(product) {
  if (!product || typeof product !== "object") {
    return null;
  }

  return {
    id: product.id || null,
    productId: product.productId || null,
    title: product.title || product.name || "",
    name: product.name || "",
    brand: product.brand || "",
    model: product.model || "",
    description: product.description || "",
    shortDescription:
      product.shortDescription || "",
    details: product.details || "",
    specifications:
      product.specifications || "",
    features: product.features || "",
    usage: product.usage || "",
    parameters:
      product.parameters || "",
    automation:
      product.automation || "",
    availability:
      product.availability || "",
    size: product.size || "",
    slug: product.slug || "",
    seoSlug:
      product.seoSlug || "",
    masterSlug:
      product.masterSlug || "",
    productSlug:
      product.productSlug || "",
    seoTitle:
      product.seoTitle || "",
    seoDescription:
      product.seoDescription || "",
  };
}

function productIdentityClient(product) {
  if (!product) return "";

  const value =
    product.masterSlug ||
    product.productSlug ||
    product.slug ||
    product.seoSlug ||
    product.title ||
    product.name ||
    "";

  return String(value)
    .toLowerCase()
    .replace(/-(?:0*\d{1,3})$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function productLabel(product) {
  return (
    product?.title ||
    product?.name ||
    product?.productName ||
    product?.model ||
    "Product"
  );
}

/*
|--------------------------------------------------------------------------
| MAIN COMPARE PAGE
|--------------------------------------------------------------------------
*/
export default function ComparePage() {
  const [company, setCompany] = useState("");
  const [selectedWebsites, setSelectedWebsites] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState("home");
  const [dynamicCache, setDynamicCache] = useState({});
  const [editingSide, setEditingSide] = useState(null);

  // Details Modal/Drawer state
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [inlineDrafts, setInlineDrafts] = useState({}); // { [site]: newText }
  const [inlineSaving, setInlineSaving] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("duplicates");
  const [hoveredGroupId, setHoveredGroupId] = useState(null);

  // Product Detail comparison state.
  const [selectedProductKey, setSelectedProductKey] = useState("");
  const [productDetailResult, setProductDetailResult] = useState(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);

  const websitesOptions = useMemo(
    () => COMPANY_WEBSITES[company] || [],
    [company]
  );

  // Auto-select first two websites when company changes
  useEffect(() => {
    if (websitesOptions.length >= 2) {
      setSelectedWebsites([websitesOptions[0], websitesOptions[1]]);
    } else {
      setSelectedWebsites([]);
    }
    setResult(null);
    setEditingSide(null);
    setSelectedGroupId(null);
    setSelectedProductKey("");
    setProductDetailResult(null);
  }, [company, websitesOptions]);

  const handleWebsiteCheck = (site) => {
    setSelectedWebsites((prev) => {
      if (prev.includes(site)) {
        setResult(null);
        setProductDetailResult(null);
        setSelectedProductKey("");
        return prev.filter((s) => s !== site);
      } else {
        if (prev.length >= 5) {
          toast.error("Maximum 5 websites can be compared simultaneously");
          return prev;
        }
        setResult(null);
        setProductDetailResult(null);
        setSelectedProductKey("");
        return [...prev, site];
      }
    });
  };

  const loadDynamicDocs = async (sites) => {
    const cache = {};
    await Promise.all(
      sites.map(async (site) => {
        cache[site] = {};
        await Promise.all(
          PAGES.map(async ([page]) => {
            const snap = await getDoc(doc(db, "websites", site, "pages", page));
            cache[site][page] = snap.exists() ? snap.data() : null;
          })
        );

        const productsSnap = await getDoc(doc(db, "websites", site, "pages", "products"));
        cache[site].__products = productsSnap.exists()
          ? productsSnap.data()?.products || []
          : [];
      })
    );
    setDynamicCache(cache);
    return cache;
  };

  const runCompare = async () => {
    if (selectedWebsites.length < 2) {
      return toast.error("Select at least two websites");
    }

    setLoading(true);
    setResult(null);
    setSelectedGroupId(null);
    setProductDetailResult(null);

    try {
      const freshCache = await loadDynamicDocs(selectedWebsites);
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          websites: selectedWebsites,
          dynamic: freshCache,
          productCatalogs: Object.fromEntries(
            selectedWebsites.map((site) => [site, freshCache[site].__products])
          ),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Compare failed");
      }

      setResult(data);
      setSelectedPage("home");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Compare failed");
    } finally {
      setLoading(false);
    }
  };

  const compareSinglePage = async (page, overrides = {}) => {
    const payload = {
      websites: selectedWebsites,
      page,
      dynamic: overrides.dynamic || dynamicCache,
      productCatalogs: overrides.productCatalogs || Object.fromEntries(
        selectedWebsites.map((site) => [site, dynamicCache[site]?.__products || []])
      ),
    };

    const response = await fetch("/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Page compare failed");
    }

    setResult((prev) => ({
      ...prev,
      results: {
        ...prev.results,
        [page]: data.result,
      },
    }));

    return data.result;
  };

  const compareProductDetail = async () => {
    if (!selectedProductKey) {
      return toast.error("Select a product first");
    }

    if (selectedWebsites.length < 2) {
      return toast.error("Select at least two websites");
    }

    const sourceSite = selectedWebsites[0];
    const sourceProducts =
      dynamicCache[sourceSite]?.__products || [];

    const sourceProduct =
      sourceProducts.find(
        (product) =>
          productIdentityClient(product) ===
          selectedProductKey
      );

    if (!sourceProduct) {
      return toast.error(
        "Selected product could not be found."
      );
    }

    const productTargets = {};

    selectedWebsites.forEach((site) => {
      const products =
        dynamicCache[site]?.__products || [];

      let best = null;
      let bestScore = 0;

      products.forEach((candidate) => {
        const a =
          productIdentityClient(
            sourceProduct
          );
        const b =
          productIdentityClient(
            candidate
          );

        if (!a || !b) return;

        let score = 0;

        if (a === b) {
          score = 100;
        } else {
          const A = new Set(a.split(" "));
          const B = new Set(b.split(" "));
          const common = [...A].filter((x) =>
            B.has(x)
          ).length;
          const union =
            new Set([...A, ...B]).size || 1;
          score = Math.round(
            (common / union) * 100
          );
        }

        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      });

      if (best && bestScore >= 70) {
        productTargets[site] =
          compactProductForCompare(best);
      }
    });

    if (
      Object.keys(productTargets).length <
      selectedWebsites.length
    ) {
      toast.error(
        "The product could not be matched on every selected website."
      );
      // Continue so the missing website is explicitly shown
      // as unavailable instead of becoming a false 0%.
    }

    setProductDetailLoading(true);

    try {
      const response = await fetch(
        "/api/compare",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            websites:
              selectedWebsites,
            page: "productDetail",
            productTargets,
            dynamic:
              dynamicCache,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Product detail comparison failed"
        );
      }

      setProductDetailResult(
        data.result
      );

      toast.success(
        "Product detail compared"
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error.message ||
          "Product detail comparison failed"
      );
    } finally {
      setProductDetailLoading(false);
    }
  };

  const selectPage = async (page) => {
    setSelectedPage(page);
    setSelectedGroupId(null);

    // If already loaded successfully for all sites, skip reload
    const currentResults = result?.results?.[page]?.pageData;
    const allOk = currentResults && selectedWebsites.every(site => currentResults[site]?.ok);
    if (allOk) {
      return;
    }

    setPageLoading(true);
    try {
      await compareSinglePage(page);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Page compare failed");
    } finally {
      setPageLoading(false);
    }
  };

  const current = result?.results?.[selectedPage];

  const productOptions = useMemo(() => {
    const sourceSite = selectedWebsites[0];
    const products =
      dynamicCache[sourceSite]?.__products || [];

    const seen = new Set();

    return products.filter((product) => {
      const key =
        productIdentityClient(product);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [dynamicCache, selectedWebsites]);

  // Group Details Drawer Logic
  const activeGroup = useMemo(() => {
    if (!selectedGroupId || !current?.groups) return null;
    return current.groups.find((g) => g.id === selectedGroupId);
  }, [selectedGroupId, current]);

  useEffect(() => {
    if (activeGroup) {
      const initialDrafts = {};
      selectedWebsites.forEach((site) => {
        const item = activeGroup.blocks.find((b) => b.site === site);
        initialDrafts[site] = item ? item.text : "";
      });
      setInlineDrafts(initialDrafts);
    }
  }, [activeGroup, selectedWebsites]);

  const saveInlineBlock = async (site) => {
    const fieldKey = findFirebaseField(
      activeGroup.text,
      dynamicCache[site]?.[selectedPage]
    );

    if (!fieldKey) {
      return toast.error("Could not locate Firestore field key for this block.");
    }

    setInlineSaving(true);
    try {
      const pageDocRef = doc(db, "websites", site, "pages", selectedPage);
      const newTextVal = inlineDrafts[site];

      // Prepare updated object merging existing data
      const docSnap = await getDoc(pageDocRef);
      const docData = docSnap.exists() ? docSnap.data() : {};

      let updatedField = newTextVal;
      // Handle nested object structure if original was an object (like {text: "..."})
      if (docData[fieldKey] && typeof docData[fieldKey] === "object") {
        if (docData[fieldKey].text !== undefined) {
          updatedField = { ...docData[fieldKey], text: newTextVal };
        } else if (Array.isArray(docData[fieldKey].richText)) {
          // If rich text, write to first segment as fallback or set simple text
          updatedField = { ...docData[fieldKey], text: newTextVal };
        }
      }

      await setDoc(pageDocRef, { [fieldKey]: updatedField }, { merge: true });

      // Update local dynamic cache
      const freshCache = {
        ...dynamicCache,
        [site]: {
          ...dynamicCache[site],
          [selectedPage]: {
            ...dynamicCache[site]?.[selectedPage],
            [fieldKey]: updatedField,
          },
        },
      };
      setDynamicCache(freshCache);

      // Re-run single page comparison
      await compareSinglePage(selectedPage, { dynamic: freshCache });
      toast.success(`Updated ${site} successfully`);
    } catch (e) {
      console.error(e);
      toast.error(`Save failed for ${site}`);
    } finally {
      setInlineSaving(false);
    }
  };

  // Compile metadata table comparison
  const metadataComparison = useMemo(() => {
    if (!current?.pageData) return [];

    const keys = [
      ["Title tag", "title"],
      ["Meta description", "metaDescription"],
      ["Canonical link", "canonical"],
      ["Main heading (H1)", "h1"],
    ];

    return keys.map(([label, type]) => {
      const row = { label, type, sites: {} };
      selectedWebsites.forEach((site) => {
        const data = current.pageData[site];
        if (!data || !data.ok) {
          row.sites[site] = { val: "Fetch issue", ok: false };
          return;
        }

        // Try extracting from SEO meta object, or parsed blocks for H1
        let val = "";
        const rawHtml = data.rawHtml || "";

        if (type === "title") {
          const match = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          val = match ? match[1].trim() : "Not specified";
        } else if (type === "metaDescription") {
          const match = rawHtml.match(/<meta[^>]+name=["']?description["']?[^>]*content=["']?([\s\S]*?)["']/i);
          val = match ? match[1].trim() : "Not specified";
        } else if (type === "canonical") {
          const match = rawHtml.match(/<link[^>]+rel=["']?canonical["']?[^>]*href=["']?([\s\S]*?)["']/i);
          val = match ? match[1].trim() : "Not specified";
        } else if (type === "h1") {
          const h1s = data.blocks.filter(b => b.type === "h1");
          val = h1s.length ? h1s.map(h => h.text).join(" | ") : "None";
        }

        row.sites[site] = { val, ok: true };
      });
      return row;
    });
  }, [current, selectedWebsites]);

  return (
    <div className="compare-page">
      <div className="compare-header">
        <div>
          <div className="eyebrow">
            <GitCompareArrows size={18} />
            SEO Multi-Website Compare
          </div>
          <h1>Compare Manager Dashboard</h1>
          <p>
            Compare content blocks, SEO metadata, and product catalogs across 2 to 5 websites side-by-side.
            Identify dynamic blocks, locate exact duplicates, and edit live Firestore content.
          </p>
        </div>

        <div className="legend">
          <span className="legend-item">
            <span className="legend-dot dynamic" />
            Dynamic (Firebase)
          </span>
          <span className="legend-item">
            <span className="legend-dot static" />
            Static (Code)
          </span>
        </div>
      </div>

      {/* Control Panel */}
      <div className="compare-controls-card">
        <div className="controls-grid">
          <label className="control-label">
            <span>Select Company</span>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="">Choose Company</option>
              <option value="rajbiosis">Rajbiosis</option>
              <option value="human">Human Biomedical</option>
              <option value="global">Global Biomedicals</option>
              <option value="qlyte">Qlyte</option>
            </select>
          </label>

          {company && (
            <div className="websites-selection-group">
              <span className="group-title">
                Choose Websites <small>({selectedWebsites.length} of 5 selected)</small>
              </span>
              <div className="websites-checkbox-grid">
                {websitesOptions.map((site) => (
                  <label key={site} className={`website-checkbox-label ${selectedWebsites.includes(site) ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedWebsites.includes(site)}
                      onChange={() => handleWebsiteCheck(site)}
                      disabled={!selectedWebsites.includes(site) && selectedWebsites.length >= 5}
                    />
                    <span>{getWatermarkDisplayText(site)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="controls-action-bar">
          <button
            className="check-btn primary"
            onClick={runCompare}
            disabled={loading || selectedWebsites.length < 2}
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={18} />
                Comparing Platforms...
              </>
            ) : (
              <>
                <GitCompareArrows size={18} />
                Calculate Similarity
              </>
            )}
          </button>
        </div>
      </div>

      {/* Comparison Results */}
      {result && (
        <>
          {/* Similarity Card & Pairwise Matrix */}
          <div className="matrix-and-stats">
            <div className="overall-summary-card">
              <span>Overall Avg Similarity</span>
              <strong className={percentClass(result.overall)}>
                {result.overall == null ? "—" : `${result.overall}%`}
              </strong>
              <div className="overall-note">
                Aggregated average of matching content blocks across all successfully retrieved pages.
              </div>
            </div>

            {selectedWebsites.length > 2 && (
              <div className="matrix-card">
                <h3>Pairwise Similarity Matrix</h3>
                <div className="matrix-table-wrap">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        {selectedWebsites.map(s => (
                          <th key={s}>{getWatermarkDisplayText(s)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWebsites.map(siteX => (
                        <tr key={siteX}>
                          <td className="matrix-row-header">{getWatermarkDisplayText(siteX)}</td>
                          {selectedWebsites.map(siteY => {
                            if (siteX === siteY) return <td key={siteY} className="matrix-cell self">-</td>;
                            const score = result.results?.[selectedPage]?.matrix?.[siteX]?.[siteY];
                            return (
                              <td key={siteY} className={`matrix-cell ${percentClass(score)}`}>
                                {score == null ? "—" : `${score}%`}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Page Tabs */}
          <div className="page-results-tabs">
            {PAGES.map(([key, label]) => {
              const item = result.results[key];
              const isActive = selectedPage === key;

              return (
                <button
                  key={key}
                  className={`page-tab ${isActive ? "active" : ""}`}
                  onClick={() => selectPage(key)}
                >
                  <div className="tab-info">
                    <span className="tab-title">{label}</span>
                    <span className="tab-status">
                      {selectedWebsites.every(site => item?.pageData?.[site]?.ok)
                        ? "Synced"
                        : item
                          ? "Retry Needed"
                          : "Unchecked"}
                    </span>
                  </div>
                  <b className={`tab-score ${percentClass(item?.similarity)}`}>
                    {item?.similarity == null ? "—" : `${item.similarity}%`}
                  </b>
                </button>
              );
            })}
          </div>

          {/* Compare workspace */}
          {current && (
            <div className="compare-workspace">
              {/* Workspace Header */}
              <div className="workspace-top">
                <div>
                  <h2>
                    {PAGES.find(([key]) => key === selectedPage)?.[1]} Comparison workspace
                  </h2>
                  <div className="url-row-multi">
                    {selectedWebsites.map((site) => {
                      const data = current.pageData?.[site];
                      if (!data) return null;
                      return (
                        <div key={site} className="url-badge">
                          <strong>{getWatermarkDisplayText(site)}:</strong>
                          {data.ok ? (
                            <a href={data.url} target="_blank" rel="noreferrer">
                              <Link2 size={11} />
                              {data.url}
                            </a>
                          ) : (
                            <span className="url-error">
                              <AlertTriangle size={11} />
                              {data.error || "Fetch Issue"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {pageLoading && (
                      <span className="loading-inline">
                        <RefreshCw size={13} className="spin" />
                        Analyzing Page Data...
                      </span>
                    )}
                  </div>
                </div>

                <div className={`similarity-pill large ${percentClass(current.similarity)}`}>
                  {current.similarity == null ? "Unavailable" : `${current.similarity}% Similar`}
                </div>
              </div>

              {/* Items Catalog Cards (Items tab only) */}
              {selectedPage === "items" && (
                <div className="catalog-comparison-wrap">
                  <div className="catalog-title-row">
                    <div>
                      <h3>Product Catalog Comparison</h3>
                      <p>
                        Product identity uses the master product/variant identity,
                        not the website-specific -01/-02/-130 slug.
                      </p>
                    </div>
                  </div>

                  <div className="catalog-grid">
                    {selectedWebsites.map((siteX) => (
                      <div
                        key={siteX}
                        className="catalog-column-card"
                      >
                        <h4>
                          {getWatermarkDisplayText(siteX)}
                        </h4>

                        <div className="catalog-meta-stats">
                          <span>
                            Products:{" "}
                            <strong>
                              {dynamicCache[siteX]?.__products?.length || 0}
                            </strong>
                          </span>
                        </div>

                        <div className="catalog-compare-list">
                          {selectedWebsites
                            .filter(
                              (siteY) => siteY !== siteX
                            )
                            .map((siteY) => {
                              const catalog =
                                current.catalogMatrix?.[
                                  siteX
                                ]?.[siteY];

                              return (
                                <div
                                  key={siteY}
                                  className="catalog-pairwise-row"
                                >
                                  <span>
                                    vs{" "}
                                    {getWatermarkDisplayText(
                                      siteY
                                    )}
                                  </span>

                                  {!catalog?.available ? (
                                    <strong className="catalog-unavailable">
                                      Catalog unavailable
                                    </strong>
                                  ) : (
                                    <strong>
                                      {catalog.similarity}%{" "}
                                      <small>
                                        ({catalog.common} matched)
                                      </small>
                                    </strong>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPage === "items" && (
                <div className="product-detail-compare-card">
                  <div className="product-detail-compare-head">
                    <div>
                      <h3>Product Detail Comparison</h3>
                      <p>
                        Select one product and compare its actual detail page
                        across the selected websites.
                      </p>
                    </div>

                    <div className="product-detail-actions">
                      <select
                        value={selectedProductKey}
                        onChange={(event) => {
                          setSelectedProductKey(
                            event.target.value
                          );
                          setProductDetailResult(null);
                        }}
                      >
                        <option value="">
                          Select product
                        </option>

                        {productOptions.map(
                          (product) => (
                            <option
                              key={productIdentityClient(product)}
                              value={productIdentityClient(product)}
                            >
                              {productLabel(product)}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        className="check-btn primary"
                        onClick={
                          compareProductDetail
                        }
                        disabled={
                          productDetailLoading ||
                          !selectedProductKey
                        }
                      >
                        {productDetailLoading ? (
                          <>
                            <RefreshCw
                              size={16}
                              className="spin"
                            />
                            Comparing...
                          </>
                        ) : (
                          <>
                            <GitCompareArrows
                              size={16}
                            />
                            Compare Product
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {productDetailResult && (
                    <div className="product-detail-result">
                      <div className="product-detail-result-summary">
                        <strong>
                          Product detail similarity
                        </strong>

                        <b
                          className={percentClass(
                            productDetailResult.similarity
                          )}
                        >
                          {productDetailResult.similarity == null
                            ? "Unavailable"
                            : `${productDetailResult.similarity}%`}
                        </b>
                      </div>

                      <div
                        className="product-detail-preview-grid"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(
                            selectedWebsites.length,
                            3
                          )}, minmax(0, 1fr))`,
                        }}
                      >
                        {selectedWebsites.map(
                          (site) => {
                            const data =
                              productDetailResult.pageData?.[
                                site
                              ];

                            const target =
                              productDetailResult.productTargets?.[
                                site
                              ];

                            const slug =
                              target?.seoSlug ||
                              target?.slug ||
                              target?.productSlug ||
                              "";

                            return (
                              <div
                                key={site}
                                className="product-detail-site"
                              >
                                <div className="product-detail-site-head">
                                  <strong>
                                    {getWatermarkDisplayText(
                                      site
                                    )}
                                  </strong>

                                  {data?.ok ? (
                                    <a
                                      href={data.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Open ↗
                                    </a>
                                  ) : (
                                    <span className="url-error">
                                      {data?.error ||
                                        "Not available"}
                                    </span>
                                  )}
                                </div>

                                {data?.ok ? (
                                  <PreviewFrame
                                    site={site}
                                    page="productDetail"
                                    productSlug={slug}
                                    data={data}
                                    onGroupClick={
                                      setSelectedGroupId
                                    }
                                  />
                                ) : (
                                  <div className="preview-placeholder error">
                                    <AlertTriangle
                                      size={20}
                                    />
                                    <span>
                                      {data?.error ||
                                        "Product detail could not be loaded."}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Responsive Layout with Live Preview Side-by-Side */}
              <div className="live-preview-section">
                <div className="preview-toolbar">
                  <div>
                    <h3>Live Page Visual Previews</h3>
                    <p>Visual view of each website with dynamic highlight mapping. Scroll inside panels independently.</p>
                  </div>
                  <div className="preview-toolbar-legend">
                    <span>
                      <span className="dot dynamic-sim" />
                      Dynamic + Duplicate
                    </span>
                    <span>
                      <span className="dot static-sim" />
                      Static + Duplicate
                    </span>
                  </div>
                </div>

                <div className="website-previews-grid" style={{
                  gridTemplateColumns: `repeat(${selectedWebsites.length}, 1fr)`
                }}>
                  {selectedWebsites.map((site) => {
                    const data = current.pageData?.[site];

                    return (
                      <div key={site} className="preview-panel">
                        <div className="preview-header">
                          <span className="preview-site-name">{getWatermarkDisplayText(site)}</span>
                          {data && !data.ok && (
                            <button
                              className="retry-btn"
                              onClick={() => selectPage(selectedPage)}
                            >
                              Retry Fetch
                            </button>
                          )}
                        </div>
                        {data?.ok ? (
                          <PreviewFrame
                            site={site}
                            page={selectedPage}
                            data={data}
                            onGroupClick={setSelectedGroupId}
                          />
                        ) : (
                          <div className="preview-placeholder error">
                            <AlertTriangle size={24} />
                            <span>
                              {data?.error || "Connection timed out / blocked."}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workspace bottom - Metadata & Duplicate list Tabs */}
              <div className="workspace-tabs-container">
                <div className="workspace-tabs-header">
                  <button
                    className={`ws-tab-btn ${activeWorkspaceTab === "duplicates" ? "active" : ""}`}
                    onClick={() => setActiveWorkspaceTab("duplicates")}
                  >
                    <Sparkles size={14} />
                    Duplicate Blocks ({current.groups?.length || 0})
                  </button>
                  <button
                    className={`ws-tab-btn ${activeWorkspaceTab === "blocks" ? "active" : ""}`}
                    onClick={() => setActiveWorkspaceTab("blocks")}
                  >
                    <Code2 size={14} />
                    Detailed Block List
                  </button>
                  <button
                    className={`ws-tab-btn ${activeWorkspaceTab === "seo" ? "active" : ""}`}
                    onClick={() => setActiveWorkspaceTab("seo")}
                  >
                    <Info size={14} />
                    SEO Metadata Comparisons
                  </button>
                  <button
                    className={`ws-tab-btn ${activeWorkspaceTab === "editor" ? "active" : ""}`}
                    onClick={() => setActiveWorkspaceTab("editor")}
                  >
                    <Settings2 size={14} />
                    Full Document Editors
                  </button>
                </div>

                <div className="workspace-tabs-content">
                  {/* Detailed Block List Tab */}
                  {activeWorkspaceTab === "blocks" && (
                    <div className="detailed-blocks-tab">
                      <div className="list-description">
                        Scroll side-by-side to compare all content blocks from each site. Matches are highlighted in green/orange. Hover over any match to highlight it across all websites. Click to inspect or edit.
                      </div>

                      <div className="detailed-blocks-grid" style={{
                        gridTemplateColumns: `repeat(${selectedWebsites.length}, 1fr)`
                      }}>
                        {selectedWebsites.map((site) => {
                          const data = current.pageData?.[site];
                          const blocks = data?.blocks || [];

                          return (
                            <div key={site} className="site-blocks-col">
                              <div className="col-header">
                                <strong>{getWatermarkDisplayText(site)} Blocks</strong>
                                <small>{blocks.length} elements</small>
                              </div>

                              <div className="col-blocks-scroll">
                                {data?.ok ? (
                                  blocks.map((block, idx) => {
                                    const isMatched = !!block.groupId;
                                    const isHovered = hoveredGroupId && block.groupId === hoveredGroupId;

                                    return (
                                      <div
                                        key={idx}
                                        className={`block-card-item ${block.source} ${isMatched ? "match" : "unique"} ${isHovered ? "hovered" : ""}`}
                                        onMouseEnter={() => block.groupId && setHoveredGroupId(block.groupId)}
                                        onMouseLeave={() => setHoveredGroupId(null)}
                                        onClick={() => block.groupId && setSelectedGroupId(block.groupId)}
                                      >
                                        <div className="block-card-meta">
                                          <span>Tag: {block.type || "text"}</span>
                                          {isMatched ? (
                                            <strong className="match-pct">Match ({block.matchScore}%)</strong>
                                          ) : (
                                            <span className="unique-badge">Unique</span>
                                          )}
                                        </div>
                                        <p className="block-card-text">
                                          {block.text}
                                        </p>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="col-error-msg">
                                    <AlertTriangle size={16} />
                                    <span>Failed to fetch blocks.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Duplicates Tab */}
                  {activeWorkspaceTab === "duplicates" && (
                    <div className="duplicates-list-tab">
                      <div className="list-description">
                        These content segments were found on multiple sites. Click any row to view individual texts, details, and edit dynamic keys.
                      </div>

                      <div className="duplicates-grid">
                        {current.groups?.map((group) => (
                          <div
                            key={group.id}
                            className="duplicate-row-card"
                            onClick={() => setSelectedGroupId(group.id)}
                          >
                            <div className="dup-meta">
                              <span className="dup-badge">
                                Matches on {group.blocks.length} of {selectedWebsites.length} sites
                              </span>
                              <span className="dup-score">
                                Avg Match: {group.averageSimilarity}%
                              </span>
                            </div>
                            <p className="dup-text-snippet">
                              "{group.text.substring(0, 180)}{group.text.length > 180 ? '...' : ''}"
                            </p>
                          </div>
                        ))}

                        {(!current.groups || current.groups.length === 0) && (
                          <div className="empty-results">
                            No duplicate content blocks detected on this page. All blocks are unique.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEO Metadata Comparison Tab */}
                  {activeWorkspaceTab === "seo" && (
                    <div className="seo-comparison-tab">
                      <table className="seo-compare-table">
                        <thead>
                          <tr>
                            <th>Meta Attribute</th>
                            {selectedWebsites.map((site) => (
                              <th key={site}>{getWatermarkDisplayText(site)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {metadataComparison.map((row) => (
                            <tr key={row.type}>
                              <td className="meta-label">{row.label}</td>
                              {selectedWebsites.map((site) => {
                                const data = row.sites[site];
                                return (
                                  <td key={site} className={`meta-value ${data.ok ? "" : "error"}`}>
                                    <div className="meta-cell-text">{data.val}</div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Document Editors Tab */}
                  {activeWorkspaceTab === "editor" && (
                    <div className="document-editors-tab">
                      <div className="editor-controls-bar">
                        <span>Select site to view Firestore document:</span>
                        <div className="editor-select-buttons">
                          {selectedWebsites.map((site) => (
                            <button
                              key={site}
                              className={`edit-side-select-btn ${editingSide === site ? "active" : ""}`}
                              onClick={() => setEditingSide(editingSide === site ? null : site)}
                            >
                              {getWatermarkDisplayText(site)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {editingSide && (
                        <div className="editor-container-wrap">
                          <DynamicEditor
                            website={editingSide}
                            page={selectedPage}
                            data={current.pageData?.[editingSide]?.ok ? dynamicCache[editingSide]?.[selectedPage] : null}
                            onSaved={async (draft) => {
                              // Reload docs
                              const fresh = await loadDynamicDocs(selectedWebsites);
                              // Recompute
                              await compareSinglePage(selectedPage, { dynamic: fresh });
                            }}
                          />
                        </div>
                      )}

                      {!editingSide && (
                        <div className="editor-placeholder">
                          Select a website above to open the dynamic document editor.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Block Details Drawer / Modal overlay */}
      {activeGroup && (
        <div className="details-drawer-overlay">
          <div className="details-drawer">
            <div className="drawer-header">
              <h3>Duplication Details</h3>
              <button className="close-btn" onClick={() => setSelectedGroupId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="block-repr-text">
                <strong>Matching Content Snippet:</strong>
                <p>"{activeGroup.text}"</p>
              </div>

              <div className="sites-details-list">
                {selectedWebsites.map((site) => {
                  const item = activeGroup.blocks.find((b) => b.site === site);
                  const isMatch = !!item;
                  const fieldKey = isMatch ? findFirebaseField(activeGroup.text, dynamicCache[site]?.[selectedPage]) : null;

                  return (
                    <div key={site} className={`site-match-card ${isMatch ? "match" : "unique"}`}>
                      <div className="site-match-card-head">
                        <h4>{getWatermarkDisplayText(site)}</h4>
                        <span className={`status-badge ${isMatch ? "matched" : "unique"}`}>
                          {isMatch ? `Match (${item.matchScore || activeGroup.averageSimilarity}%)` : "Unique"}
                        </span>
                      </div>

                      {isMatch ? (
                        <div className="site-match-card-body">
                          <div className="meta-row">
                            <span>Block tag: <code>&lt;{item.type}&gt;</code></span>
                            <span>
                              Source:
                              <strong className={`source-type ${item.source}`}>
                                {item.source.toUpperCase()}
                              </strong>
                            </span>
                          </div>

                          {item.source === "dynamic" ? (
                            <div className="inline-editor-fields">
                              {fieldKey ? (
                                <div className="field-key-indicator">
                                  Firestore Field Key: <code>{fieldKey}</code>
                                </div>
                              ) : (
                                <div className="field-key-warning">
                                  Firebase nested key or element
                                </div>
                              )}

                              <textarea
                                value={inlineDrafts[site] ?? ""}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setInlineDrafts((prev) => ({ ...prev, [site]: text }));
                                }}
                                disabled={inlineSaving}
                              />

                              <button
                                className="save-inline-btn"
                                onClick={() => saveInlineBlock(site)}
                                disabled={inlineSaving || !fieldKey}
                              >
                                {inlineSaving ? (
                                  <RefreshCw size={14} className="spin" />
                                ) : (
                                  <Save size={14} />
                                )}
                                Save to Firebase
                              </button>
                            </div>
                          ) : (
                            <div className="static-indicator">
                              <Code2 size={13} />
                              Hardcoded in source code files. Edit in code.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="site-match-card-body text-muted">
                          This platform does not contain this content block on the {selectedPage} page.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getWatermarkDisplayText(website) {
  const clean = (website || "").trim().toLowerCase();
  const textMap = {
    humanbiomedicalorg: "humanbiomedical.org",
    humanbiomedicalin: "humanbiomedical.in",
    humanbiomedicalcom: "humanbiomedical.com",
    humanbiomedicalsin: "humanbiomedicals.in",
    humanbiomedicalsorg: "humanbiomedicals.org",
    humanbiomedicalscoin: "humanbiomedicals.co.in",
    humanbiomedicalsnet: "humanbiomedicals.net",
    globalbiomedicalorg: "globalbiomedical.org",
    globalbiomedicalin: "globalbiomedical.in",
    globalbiomedicalcoin: "globalbiomedical.co.in",
    globalbiomedicalsin: "globalbiomedicals.in",
    globalbiomedicalsnet: "globalbiomedicals.net",
    globalhealthkartcom: "globalhealthkart.com",
    humarilabin: "humarilab.in",
    humarilabcom: "humarilab.com",
    rajbiosisinfo: "rajbiosis.info",
    rajbiosiscoin: "rajbiosis.co.in",
    rajbiosisltd: "rajbiosis.ltd",
    ozonexco: "ozonex.co",
    aozellocom: "aozello.com",
    aozallocom: "aozallo.com",
    ozallecom: "ozalle.com",
    ozallocom: "ozallo.com",
    ozellein: "ozelle.in",
    qlytein: "qlyte.in",
    qlyserin: "qlyser.in",
    anylabtestin: "anylabtest.in",
    radioimmunoassayin: "radioimmunoassay.in",
    bloodmixerin: "bloodmixer.in",
    glucostripscom: "glucostrips.com",
    glucometersin: "glucometers.in",
    safekitin: "safekit.in",
    haemoglobinstripcom: "haemoglobinstrip.com",
    haemoglobinstripscom: "haemoglobinstrips.com",
    haemoglobinmetercom: "haemoglobinmeter.com",
    hemoglobinstripcom: "hemoglobinstrip.com",
    hemoglobinstripin: "hemoglobinstrip.in",
    hemoglobinstripscom: "hemoglobinstrips.com",
    hemoglobinmetercom: "hemoglobinmeter.com",
    hemoglobinmeterin: "hemoglobinmeter.in",
    cliakitscom: "cliakits.com",
    clinicalchemistryin: "clinicalchemistry.in",
    medicalsjobportalcom: "medicalsjobportal.com",
    centralbiomedicals: "centralbiomedicals.com",
    tublerin: "tubler.in",
    indiandiagnostic: "indiandiagnostic.com",
    qlyte: "qlyte.com",
  };

  if (textMap[clean]) return textMap[clean];
  if (clean.includes("human")) return "humanbiomedical.org";
  if (clean.includes("global")) return "globalbiomedical.org";
  if (clean.includes("qlyte")) return "qlyte.com";
  if (clean.includes("rajbiosis")) return "rajbiosis.com";
  return clean || "website";
}