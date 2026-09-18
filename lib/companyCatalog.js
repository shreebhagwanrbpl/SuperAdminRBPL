import { db, storage } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  writeBatch,
  query,
  where,
  orderBy
} from "firebase/firestore";

export const COMPANIES = {
  rajbiosis: {
    id: "rajbiosis",
    name: "Rajbiosis",
    displayName: "Rajbiosis",
    watermarkText: "Rajbiosis",
  },
  human: {
    id: "human",
    name: "Human Biomedical",
    displayName: "Human Biomedical",
    watermarkText: "Human Biomedical",
  },
  global: {
    id: "global",
    name: "Global Biomedical",
    displayName: "Global Biomedical",
    watermarkText: "Global Biomedical",
  },
};

export const COMPANY_WEBSITES = {
  human: [
    "humanbiomedicalcom",
    "humanbiomedicalin",
    "humanbiomedicalorg",
    "humanbiomedicalsnet",
    "humanbiomedicalsin",
    "humanbiomedicalsorg",
    "humanbiomedicalscoin",
  ],
  global: [
    "globalbiomedicalorg",
    "globalbiomedicalin",
    "globalbiomedicalcoin",
    "globalbiomedicalsin",
    "globalbiomedicalsnet",
    "globalhealthkartcom",
  ],
  rajbiosis: [
    "indiandiagnostic",
    "centralbiomedicals",
    "humarilabin",
    "humarilabcom",
    "rajbiosisinfo",
    "rajbiosiscoin",
    "rajbiosisltd",
    "ozonexco",
    "aozellocom",
    "aozallocom",
    "ozallecom",
    "ozallocom",
    "ozellein",
    "qlytein",
    "qlyserin",
    "anylabtestin",
    "radioimmunoassayin",
    "bloodmixerin",
    "glucostripscom",
    "glucometersin",
    "safekitin",
    "haemoglobinstripcom",
    "haemoglobinstripscom",
    "haemoglobinmetercom",
    "hemoglobinstripcom",
    "hemoglobinstripin",
    "hemoglobinstripscom",
    "hemoglobinmetercom",
    "hemoglobinmeterin",
    "cliakitscom",
    "clinicalchemistryin",
    "medicalsjobportalcom",
    "tublerin",
    "clinidixcom",
    "oleturcom",
    "indiandiagnosticscom",
    "cliakitsin",
    "radioimmunoassaycoin",
    "centralbiomedicalsin",
    "diagnostatcom",
    "diagnosticbloomcom",
    "diagnotexcom",
    "biohaloscom",
    "diagnosticsbloomcom",
    "globalhealthdirectorycom",
    "humanbiomedicalscom",
    "dxgelcom",
    "globalhealthcartcom",
    "medflixbiomedicalcom",
    "medflixbiomedicalscom",
    "qlysercom",
    "ichromain",
    "spinreactin",
    "rajvedcom",
    "coolpacksin",
    "hamarilabcom",
    "qlyte",
  ],
};

export function getCompanyForWebsite(website) {
  if (!website) return "rajbiosis";
  const clean = String(website).trim().toLowerCase();
  for (const [companyId, websites] of Object.entries(COMPANY_WEBSITES)) {
    if (websites.includes(clean)) {
      return companyId;
    }
  }
  if (clean.includes("human")) return "human";
  if (clean.includes("global")) return "global";
  return "rajbiosis";
}

export function getCompanyDisplayName(companyIdOrWebsite) {
  const companyId = COMPANIES[companyIdOrWebsite]
    ? companyIdOrWebsite
    : getCompanyForWebsite(companyIdOrWebsite);
  return COMPANIES[companyId]?.displayName || "Rajbiosis";
}

export function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes websiteIds array strictly adhering to company master rules:
 * - Empty array [] = HIDDEN from all websites.
 * - Array containing "all" = All websites for that company.
 * - Array of specific IDs = Filtered to only valid websites for that company.
 */
export function normalizeWebsiteIds(companyId, rawWebsites) {
  const companySites = COMPANY_WEBSITES[companyId] || [];
  if (!rawWebsites) return [];
  if (Array.isArray(rawWebsites)) {
    if (rawWebsites.length === 0) return []; // STRICT: [] means hidden from all websites
    if (rawWebsites.includes("all")) {
      return [...companySites];
    }
    return rawWebsites.filter((site) => companySites.includes(site));
  }
  if (rawWebsites === "all") return [...companySites];
  if (typeof rawWebsites === "string") {
    return companySites.includes(rawWebsites) ? [rawWebsites] : [];
  }
  return [];
}

// ============================================================================
// STORAGE PATH HELPERS (COMPANY-LEVEL MASTER MEDIA)
// ============================================================================

export function getProductImageStoragePath(companyId, productId, filename) {
  const cleanFilename = String(filename || "image.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `companies/${companyId}/products/${productId}/images/${Date.now()}_${cleanFilename}`;
}

export function getProductVideoStoragePath(companyId, productId, filename) {
  const cleanFilename = String(filename || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `companies/${companyId}/products/${productId}/videos/${Date.now()}_${cleanFilename}`;
}

export function getProductPdfStoragePath(companyId, productId, filename) {
  const cleanFilename = String(filename || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `companies/${companyId}/products/${productId}/pdfs/${Date.now()}_${cleanFilename}`;
}

export function getCategoryMediaStoragePath(companyId, categoryId, filename) {
  const cleanFilename = String(filename || "cat_image.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `companies/${companyId}/categories/${categoryId}/${Date.now()}_${cleanFilename}`;
}

export function getSubcategoryMediaStoragePath(companyId, categoryId, subCategoryId, filename) {
  const cleanFilename = String(filename || "sub_image.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `companies/${companyId}/categories/${categoryId}/subcategories/${subCategoryId}/${Date.now()}_${cleanFilename}`;
}

// Memory cache for categories & subcategories
const _categoryCache = new Map();

export function invalidateCompanyCategoriesCache(companyId) {
  if (companyId) {
    _categoryCache.delete(companyId);
  } else {
    _categoryCache.clear();
  }
}

export function getCachedCompanyCategories(companyId) {
  return _categoryCache.get(companyId) || null;
}

// ============================================================================
// MASTER CATEGORIES CRUD (ONE MASTER CATEGORY PER COMPANY)
// ============================================================================

export async function fetchCompanyCategories(companyId, includeSubcategories = true, forceRefresh = false) {
  if (!companyId) return [];

  if (!forceRefresh && _categoryCache.has(companyId)) {
    const cached = _categoryCache.get(companyId);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  try {
    const catCollRef = collection(db, "companies", companyId, "categories");
    const snap = await getDocs(catCollRef);

    if (!snap.empty) {
      const categories = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        subcategories: [],
      }));

      if (includeSubcategories) {
        await Promise.allSettled(
          categories.map(async (cat) => {
            try {
              const subCollRef = collection(
                db,
                "companies",
                companyId,
                "categories",
                cat.id,
                "subcategories"
              );
              const subSnap = await getDocs(subCollRef);
              cat.subcategories = subSnap.docs.map((subDoc) => ({
                id: subDoc.id,
                ...subDoc.data(),
              }));
            } catch (e) {
              cat.subcategories = [];
            }
          })
        );
      }
      _categoryCache.set(companyId, categories);
      return categories;
    }
  } catch (err) {
    // Gracefully fallback without console noise
  }

  // Fallback to reading legacy categories from website documents in parallel if master is empty
  const fallbackCats = await fetchLegacyCategoriesFallback(companyId, includeSubcategories);
  if (fallbackCats && fallbackCats.length > 0) {
    _categoryCache.set(companyId, fallbackCats);
  }
  return fallbackCats;
}

async function fetchLegacyCategoriesFallback(companyId, includeSubcategories = true) {
  const websites = COMPANY_WEBSITES[companyId] || [];
  const mergedCats = new Map();
  const sitesToScan = websites.slice(0, 5);

  const sitePromises = sitesToScan.map(async (site) => {
    try {
      const catCollRef = collection(
        db,
        "websites",
        site,
        "pages",
        "categoryproducts",
        "categories"
      );
      const catSnap = await getDocs(catCollRef);
      const catDocs = catSnap.docs;

      const subPromises = catDocs.map(async (cDoc) => {
        const cData = cDoc.data();
        const slug = slugify(cData.id || cData.category || cData.name || cDoc.id);

        let subList = [];
        if (includeSubcategories) {
          try {
            const subSnap = await getDocs(
              collection(
                db,
                "websites",
                site,
                "pages",
                "categoryproducts",
                "categories",
                cDoc.id,
                "subcategories"
              )
            );
            subList = subSnap.docs.map((sDoc) => ({
              id: sDoc.id,
              name: sDoc.data().subCategory || sDoc.data().name || sDoc.id,
              subCategory: sDoc.data().subCategory || sDoc.data().name || sDoc.id,
              slug: slugify(sDoc.id),
              categoryId: slug,
              ...sDoc.data(),
            }));
          } catch (e) {}
        }

        return {
          site,
          slug,
          id: slug,
          name: cData.category || cData.name || cDoc.id,
          category: cData.category || cData.name || cDoc.id,
          subList,
        };
      });

      return await Promise.allSettled(subPromises);
    } catch (e) {
      return [];
    }
  });

  const allSiteResults = await Promise.allSettled(sitePromises);

  allSiteResults.forEach((siteRes) => {
    if (siteRes.status === "fulfilled" && Array.isArray(siteRes.value)) {
      siteRes.value.forEach((itemRes) => {
        if (itemRes.status === "fulfilled" && itemRes.value) {
          const item = itemRes.value;
          if (!mergedCats.has(item.slug)) {
            mergedCats.set(item.slug, {
              id: item.slug,
              name: item.name,
              category: item.category,
              slug: item.slug,
              websiteIds: [item.site],
              subcategories: item.subList || [],
            });
          } else {
            const existing = mergedCats.get(item.slug);
            if (!existing.websiteIds.includes(item.site)) {
              existing.websiteIds.push(item.site);
            }
            if (item.subList && item.subList.length > 0) {
              const existingSubIds = new Set(existing.subcategories.map((s) => s.id));
              item.subList.forEach((sub) => {
                if (!existingSubIds.has(sub.id)) {
                  existing.subcategories.push(sub);
                  existingSubIds.add(sub.id);
                }
              });
            }
          }
        }
      });
    }
  });

  return Array.from(mergedCats.values());
}

export async function saveCompanyCategory(companyId, categoryData, websiteIds = null) {
  if (!companyId) throw new Error("companyId is required");
  const catId = categoryData.id || slugify(categoryData.category || categoryData.name);
  if (!catId) throw new Error("Valid category name or id is required");

  const now = new Date().toISOString();
  const assignedWebsites = normalizeWebsiteIds(
    companyId,
    websiteIds !== null ? websiteIds : categoryData.websiteIds
  );

  const payload = {
    id: catId,
    name: categoryData.name || categoryData.category || "",
    category: categoryData.category || categoryData.name || "",
    slug: categoryData.slug || catId,
    description: categoryData.description || categoryData.desc || "",
    image: categoryData.image || "",
    companyId,
    order: Number(categoryData.order) || 0,
    status: categoryData.status || "active",
    websiteIds: assignedWebsites,
    updatedAt: now,
  };

  if (!categoryData.createdAt) {
    payload.createdAt = now;
  }

  // Save purely to company master collection (Single Source of Truth)
  const catDocRef = doc(db, "companies", companyId, "categories", catId);
  await setDoc(catDocRef, payload, { merge: true });

  // Invalidate in-memory cache
  invalidateCompanyCategoriesCache(companyId);

  return payload;
}

export async function deleteCompanyCategory(companyId, categoryId) {
  if (!companyId || !categoryId) return;
  invalidateCompanyCategoriesCache(companyId);

  try {
    const batch = writeBatch(db);
    const subCollRef = collection(
      db,
      "companies",
      companyId,
      "categories",
      categoryId,
      "subcategories"
    );
    const subSnap = await getDocs(subCollRef);
    subSnap.forEach((subDoc) => batch.delete(subDoc.ref));
    batch.delete(doc(db, "companies", companyId, "categories", categoryId));
    await batch.commit();
  } catch (err) {
    console.error("Error deleting company category:", err);
  }
}

// ============================================================================
// MASTER SUBCATEGORIES CRUD (ONE MASTER SUBCATEGORY PER COMPANY)
// ============================================================================

export async function fetchCompanySubcategories(companyId, categoryId) {
  if (!companyId || !categoryId) return [];
  try {
    const subCollRef = collection(
      db,
      "companies",
      companyId,
      "categories",
      categoryId,
      "subcategories"
    );
    const snap = await getDocs(subCollRef);
    if (!snap.empty) {
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
    }
  } catch (err) {}

  // Fallback to website level in parallel
  const websites = COMPANY_WEBSITES[companyId] || [];
  for (const site of websites) {
    try {
      const snap = await getDocs(
        collection(
          db,
          "websites",
          site,
          "pages",
          "categoryproducts",
          "categories",
          categoryId,
          "subcategories"
        )
      );
      if (!snap.empty) {
        return snap.docs.map((d) => ({
          id: d.id,
          name: d.data().subCategory || d.data().name || d.id,
          subCategory: d.data().subCategory || d.data().name || d.id,
          ...d.data(),
        }));
      }
    } catch (e) {}
  }
  return [];
}

export async function saveCompanySubcategory(
  companyId,
  categoryId,
  subcategoryData,
  websiteIds = null
) {
  if (!companyId || !categoryId) throw new Error("companyId and categoryId are required");
  const subId =
    subcategoryData.id || slugify(subcategoryData.subCategory || subcategoryData.name);
  if (!subId) throw new Error("Valid subcategory name or id is required");

  const now = new Date().toISOString();
  const assignedWebsites = normalizeWebsiteIds(
    companyId,
    websiteIds !== null ? websiteIds : subcategoryData.websiteIds
  );

  const payload = {
    id: subId,
    name: subcategoryData.name || subcategoryData.subCategory || "",
    subCategory: subcategoryData.subCategory || subcategoryData.name || "",
    slug: subcategoryData.slug || subId,
    categoryId,
    companyId,
    description: subcategoryData.description || subcategoryData.desc || "",
    image: subcategoryData.image || "",
    order: Number(subcategoryData.order) || 0,
    status: subcategoryData.status || "active",
    websiteIds: assignedWebsites,
    updatedAt: now,
  };

  if (Array.isArray(subcategoryData.products)) {
    payload.products = subcategoryData.products;
  }

  if (!subcategoryData.createdAt) {
    payload.createdAt = now;
  }

  // Save purely to company master subcategory collection (Single Source of Truth)
  const subDocRef = doc(
    db,
    "companies",
    companyId,
    "categories",
    categoryId,
    "subcategories",
    subId
  );
  await setDoc(subDocRef, payload, { merge: true });

  // Invalidate in-memory cache
  invalidateCompanyCategoriesCache(companyId);

  return payload;
}

export async function deleteCompanySubcategory(companyId, categoryId, subCategoryId) {
  if (!companyId || !categoryId || !subCategoryId) return;
  invalidateCompanyCategoriesCache(companyId);

  try {
    await deleteDoc(
      doc(
        db,
        "companies",
        companyId,
        "categories",
        categoryId,
        "subcategories",
        subCategoryId
      )
    );
  } catch (e) {
    console.error("Error deleting company subcategory:", e);
  }
}

// ============================================================================
// MASTER PRODUCTS CRUD
// Category Products -> Stored directly inside subcategories (`products` array)
// Standalone Normal Products -> Stored in `companies/{companyId}/products`
// ============================================================================

export async function fetchCompanyProducts(
  companyId,
  { categoryId = null, subcategoryId = null, type = null, websiteFilter = null } = {}
) {
  if (!companyId) return [];

  // 1. If fetching for a specific subcategory under a category:
  if (categoryId && subcategoryId) {
    try {
      const subDocRef = doc(
        db,
        "companies",
        companyId,
        "categories",
        categoryId,
        "subcategories",
        subcategoryId
      );
      const subSnap = await getDoc(subDocRef);
      if (subSnap.exists()) {
        let prods = subSnap.data().products || [];
        if (websiteFilter && websiteFilter !== "all") {
          prods = prods.filter((p) => {
            const wIds = Array.isArray(p.websiteIds) ? p.websiteIds : [];
            return wIds.includes(websiteFilter);
          });
        }
        prods.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
          return dateB - dateA;
        });
        return prods;
      }
    } catch (err) {
      console.warn("Error fetching subcategory products:", err);
    }
  }

  // 2. If fetching for a specific category (all subcategories within it):
  if (categoryId && !subcategoryId) {
    try {
      const subCollRef = collection(
        db,
        "companies",
        companyId,
        "categories",
        categoryId,
        "subcategories"
      );
      const subSnap = await getDocs(subCollRef);
      let prods = [];
      subSnap.docs.forEach((d) => {
        const subProds = d.data().products || [];
        prods.push(...subProds);
      });
      if (websiteFilter && websiteFilter !== "all") {
        prods = prods.filter((p) => {
          const wIds = Array.isArray(p.websiteIds) ? p.websiteIds : [];
          return wIds.includes(websiteFilter);
        });
      }
      prods.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return dateB - dateA;
      });
      return prods;
    } catch (err) {
      console.warn("Error fetching category products:", err);
    }
  }

  // 3. If fetching all category products across all categories of company:
  if (type === "category") {
    try {
      const catCollRef = collection(db, "companies", companyId, "categories");
      const catSnap = await getDocs(catCollRef);
      let allCatProds = [];
      for (const cDoc of catSnap.docs) {
        const subCollRef = collection(
          db,
          "companies",
          companyId,
          "categories",
          cDoc.id,
          "subcategories"
        );
        const subSnap = await getDocs(subCollRef);
        subSnap.docs.forEach((sDoc) => {
          const subProds = sDoc.data().products || [];
          allCatProds.push(...subProds);
        });
      }
      if (websiteFilter && websiteFilter !== "all") {
        allCatProds = allCatProds.filter((p) => {
          const wIds = Array.isArray(p.websiteIds) ? p.websiteIds : [];
          return wIds.includes(websiteFilter);
        });
      }
      allCatProds.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return dateB - dateA;
      });
      return allCatProds;
    } catch (err) {
      console.warn("Error fetching all category products:", err);
    }
  }

  // 4. Standalone / Normal Products (Directly in companies/{companyId}/products collection)
  try {
    const prodsCollRef = collection(db, "companies", companyId, "products");
    const snap = await getDocs(prodsCollRef);
    if (!snap.empty) {
      let normalProducts = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((p) => !p.categoryId && !p.subcategoryId && p.type !== "category"); // ONLY normal products!

      if (websiteFilter && websiteFilter !== "all") {
        normalProducts = normalProducts.filter((p) => {
          const wIds = Array.isArray(p.websiteIds) ? p.websiteIds : [];
          return wIds.includes(websiteFilter);
        });
      }

      normalProducts.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return dateB - dateA;
      });

      if (type === "normal" || (!categoryId && !subcategoryId && !type)) {
        return normalProducts;
      }
    }
  } catch (err) {
    // Gracefully fallback
  }

  // Fallback to legacy website products if master is empty
  return fetchLegacyProductsFallback(companyId, { categoryId, subcategoryId, type, websiteFilter });
}

async function fetchLegacyProductsFallback(
  companyId,
  { categoryId = null, subcategoryId = null, type = null, websiteFilter = null } = {}
) {
  const websites = COMPANY_WEBSITES[companyId] || [];
  const targetWebsites = websiteFilter && websiteFilter !== "all"
    ? [websiteFilter]
    : websites;

  const merged = new Map();

  for (const site of targetWebsites) {
    // Normal products
    if (!type || type === "normal") {
      try {
        const snap = await getDoc(doc(db, "websites", site, "pages", "products"));
        if (snap.exists()) {
          const pList = snap.data().products || [];
          pList.forEach((p) => {
            const key = p.id || p.productId || p.title;
            const pWebsites = Array.isArray(p.websiteIds) && p.websiteIds.length > 0 ? p.websiteIds : [site];
            if (!merged.has(key)) {
              merged.set(key, {
                ...p,
                id: p.id || String(p.productId || crypto.randomUUID()),
                companyId,
                type: "normal",
                websiteIds: pWebsites,
              });
            } else {
              const cur = merged.get(key);
              if (Array.isArray(p.websiteIds) && p.websiteIds.length > 0) {
                cur.websiteIds = p.websiteIds;
              } else {
                pWebsites.forEach((s) => {
                  if (!cur.websiteIds.includes(s)) cur.websiteIds.push(s);
                });
              }
            }
          });
        }
      } catch (e) {}
    }

    // Category products
    if (categoryId && subcategoryId) {
      try {
        const subSnap = await getDoc(
          doc(
            db,
            "websites",
            site,
            "pages",
            "categoryproducts",
            "categories",
            categoryId,
            "subcategories",
            subcategoryId
          )
        );
        if (subSnap.exists()) {
          const pList = subSnap.data().products || [];
          pList.forEach((p) => {
            const key = p.id || p.categoryProductId || p.title;
            const pWebsites = Array.isArray(p.websiteIds) && p.websiteIds.length > 0 ? p.websiteIds : [site];
            if (!merged.has(key)) {
              merged.set(key, {
                ...p,
                id: p.id || String(p.categoryProductId || crypto.randomUUID()),
                categoryId,
                subcategoryId,
                companyId,
                type: "category",
                websiteIds: pWebsites,
              });
            } else {
              const cur = merged.get(key);
              if (Array.isArray(p.websiteIds) && p.websiteIds.length > 0) {
                cur.websiteIds = p.websiteIds;
              } else {
                pWebsites.forEach((s) => {
                  if (!cur.websiteIds.includes(s)) cur.websiteIds.push(s);
                });
              }
            }
          });
        }
      } catch (e) {}
    }
  }

  let result = Array.from(merged.values());
  if (websiteFilter && websiteFilter !== "all") {
    result = result.filter((p) => {
      const wIds = Array.isArray(p.websiteIds) ? p.websiteIds : [];
      return wIds.includes(websiteFilter);
    });
  }

  return result;
}

export async function saveCompanyProduct(companyId, productData, websiteIds = null) {
  if (!companyId) throw new Error("companyId is required");
  const prodId = productData.id || productData._id || productData.productId || productData.categoryProductId || crypto.randomUUID();
  const now = new Date().toISOString();

  const assignedWebsites = normalizeWebsiteIds(
    companyId,
    websiteIds !== null ? websiteIds : productData.websiteIds
  );

  const isCat = Boolean(productData.categoryId || productData.category || productData.type === "category");
  const catId = productData.categoryId || (productData.category ? slugify(productData.category) : null);
  const subId = productData.subcategoryId || (productData.subCategory ? slugify(productData.subCategory) : (catId ? slugify(productData.category || "general") : null));
  const catName = productData.category || productData.categoryName || catId;
  const subName = productData.subCategory || productData.subCategoryName || catName;

  const images = Array.isArray(productData.images)
    ? productData.images
    : productData.image
    ? [productData.image]
    : [];

  const payload = {
    ...productData,
    id: prodId,
    uid: prodId,
    productId: productData.productId || prodId,
    categoryProductId: productData.categoryProductId || (isCat ? prodId : null),
    title: productData.title || productData.name || "",
    name: productData.name || productData.title || "",
    slug: productData.slug || slugify(productData.title || productData.name || prodId),
    price: productData.price || "",
    desc: productData.desc || productData.description || "",
    description: productData.description || productData.desc || "",
    capacity: productData.capacity || "",
    throughput: productData.throughput || "",
    instrument: productData.instrument || "",
    model: productData.model || "",
    usage: productData.usage || "",
    brand: productData.brand || "",
    parameters: productData.parameters || "",
    automation: productData.automation || "",
    availability: productData.availability || "",
    size: productData.size || "",
    companyId,
    category: isCat ? catName : "",
    subCategory: isCat ? subName : "",
    categoryId: isCat ? catId : null,
    subcategoryId: isCat ? subId : null,
    type: isCat ? "category" : "normal",
    image: images[0] || "",
    images: images,
    originalImages: Array.isArray(productData.originalImages)
      ? productData.originalImages
      : images,
    video: productData.video || "",
    pdf: productData.pdf || "",
    isPublished: typeof productData.isPublished === "boolean" ? productData.isPublished : true,
    status: productData.status || "active",
    websiteIds: assignedWebsites,
    updatedAt: now,
  };

  if (productData.createdAt) {
    payload.createdAt = productData.createdAt;
  } else {
    payload.createdAt = now;
  }

  // A. IF THIS IS A CATEGORY PRODUCT -> SAVE STRICTLY INSIDE THE SUBCATEGORY DOC
  if (isCat && catId && subId) {
    const subDocRef = doc(
      db,
      "companies",
      companyId,
      "categories",
      catId,
      "subcategories",
      subId
    );
    const subSnap = await getDoc(subDocRef);
    let productsList = [];
    if (subSnap.exists()) {
      productsList = subSnap.data().products || [];
    }
    const existingIndex = productsList.findIndex(
      (p) =>
        (p.id && p.id === prodId) ||
        (p.categoryProductId && p.categoryProductId === payload.categoryProductId) ||
        (p.slug && p.slug === payload.slug)
    );

    if (existingIndex >= 0) {
      productsList[existingIndex] = { ...productsList[existingIndex], ...payload };
    } else {
      productsList.push(payload);
    }

    await setDoc(subDocRef, { products: productsList, updatedAt: now }, { merge: true });

    // Cleanup: Remove from standalone companies/{companyId}/products if accidentally present
    try {
      await deleteDoc(doc(db, "companies", companyId, "products", prodId));
    } catch (e) {}

    invalidateCompanyCategoriesCache(companyId);
    return payload;
  }

  // B. IF THIS IS A NORMAL / STANDALONE PRODUCT -> SAVE TO companies/{companyId}/products
  const prodDocRef = doc(db, "companies", companyId, "products", prodId);
  await setDoc(prodDocRef, payload, { merge: true });

  return payload;
}

export async function saveCompanyProductsBatch(companyId, productsList, websiteIds = null) {
  if (!companyId || !Array.isArray(productsList) || productsList.length === 0) return [];

  const defaultWebsites = normalizeWebsiteIds(companyId, websiteIds);
  const now = new Date().toISOString();

  const categoryBuckets = new Map(); // key: `${catId}:::${subId}` -> [payloads]
  const normalPayloads = [];

  productsList.forEach((prod) => {
    const prodId = prod.id || prod._id || prod.productId || prod.categoryProductId || crypto.randomUUID();
    const assignedWebsites =
      prod.websiteIds !== undefined
        ? normalizeWebsiteIds(companyId, prod.websiteIds)
        : defaultWebsites;

    const isCat = Boolean(prod.categoryId || prod.category || prod.type === "category");
    const catId = prod.categoryId || (prod.category ? slugify(prod.category) : null);
    const subId = prod.subcategoryId || (prod.subCategory ? slugify(prod.subCategory) : (catId ? slugify(prod.category || "general") : null));
    const catName = prod.category || prod.categoryName || catId;
    const subName = prod.subCategory || prod.subCategoryName || catName;

    const images = Array.isArray(prod.images)
      ? prod.images
      : prod.image
      ? [prod.image]
      : [];

    const payload = {
      ...prod,
      id: prodId,
      uid: prodId,
      productId: prod.productId || prodId,
      categoryProductId: prod.categoryProductId || (isCat ? prodId : null),
      title: prod.title || prod.name || "",
      name: prod.name || prod.title || "",
      slug: prod.slug || slugify(prod.title || prod.name || prodId),
      price: prod.price || "",
      desc: prod.desc || prod.description || "",
      description: prod.description || prod.desc || "",
      capacity: prod.capacity || "",
      throughput: prod.throughput || "",
      instrument: prod.instrument || "",
      model: prod.model || "",
      usage: prod.usage || "",
      brand: prod.brand || "",
      parameters: prod.parameters || "",
      automation: prod.automation || "",
      availability: prod.availability || "",
      size: prod.size || "",
      companyId,
      category: isCat ? catName : "",
      subCategory: isCat ? subName : "",
      categoryId: isCat ? catId : null,
      subcategoryId: isCat ? subId : null,
      type: isCat ? "category" : "normal",
      image: images[0] || "",
      images: images,
      originalImages: Array.isArray(prod.originalImages)
        ? prod.originalImages
        : images,
      video: prod.video || "",
      pdf: prod.pdf || "",
      isPublished: typeof prod.isPublished === "boolean" ? prod.isPublished : true,
      status: prod.status || "active",
      websiteIds: assignedWebsites,
      createdAt: prod.createdAt || now,
      updatedAt: now,
    };

    if (isCat && catId && subId) {
      const key = `${catId}:::${subId}`;
      if (!categoryBuckets.has(key)) {
        categoryBuckets.set(key, []);
      }
      categoryBuckets.get(key).push(payload);
    } else {
      normalPayloads.push(payload);
    }
  });

  // A. Save Category Products directly into their respective subcategory docs
  for (const [key, newProds] of categoryBuckets.entries()) {
    const [catId, subId] = key.split(":::");
    try {
      const subDocRef = doc(
        db,
        "companies",
        companyId,
        "categories",
        catId,
        "subcategories",
        subId
      );
      const subSnap = await getDoc(subDocRef);
      let existing = subSnap.exists() ? (subSnap.data().products || []) : [];
      const prodMap = new Map();
      existing.forEach((p) => {
        const idKey = p.id || p.categoryProductId || p.slug;
        if (idKey) prodMap.set(idKey, p);
      });
      newProds.forEach((p) => {
        const idKey = p.id || p.categoryProductId || p.slug;
        if (idKey) prodMap.set(idKey, { ...(prodMap.get(idKey) || {}), ...p });
      });
      const mergedList = Array.from(prodMap.values());
      await setDoc(subDocRef, { products: mergedList, updatedAt: now }, { merge: true });
    } catch (err) {
      console.error(`Error saving batch for subcategory ${catId}/${subId}:`, err);
    }
  }

  // B. Save Normal Products sequentially to companies/{companyId}/products
  if (normalPayloads.length > 0) {
    try {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < normalPayloads.length; i += CHUNK_SIZE) {
        const chunk = normalPayloads.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const docRef = doc(db, "companies", companyId, "products", p.id);
          batch.set(docRef, p, { merge: true });
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Normal products batch save error:", e);
    }
  }

  invalidateCompanyCategoriesCache(companyId);
  return [...Array.from(categoryBuckets.values()).flat(), ...normalPayloads];
}

export async function deleteCompanyProduct(companyId, productId, { categoryId = null, subcategoryId = null } = {}) {
  if (!companyId || !productId) return;
  const now = new Date().toISOString();

  // A. If categoryId and subcategoryId are known:
  if (categoryId && subcategoryId) {
    try {
      const subDocRef = doc(
        db,
        "companies",
        companyId,
        "categories",
        categoryId,
        "subcategories",
        subcategoryId
      );
      const subSnap = await getDoc(subDocRef);
      if (subSnap.exists()) {
        const existing = subSnap.data().products || [];
        const filtered = existing.filter(
          (p) =>
            p.id !== productId &&
            p.categoryProductId !== productId &&
            p.productId !== productId
        );
        await setDoc(subDocRef, { products: filtered, updatedAt: now }, { merge: true });
        invalidateCompanyCategoriesCache(companyId);
        return;
      }
    } catch (e) {
      console.error("Delete subcategory product error:", e);
    }
  }

  // B. Standalone normal product delete:
  try {
    await deleteDoc(doc(db, "companies", companyId, "products", productId));
  } catch (e) {
    console.error("Delete normal product error:", e);
  }

  // C. Also search category subcategories if it might have been in a subcategory
  try {
    const cats = await fetchCompanyCategories(companyId, true);
    for (const cat of cats) {
      for (const sub of (cat.subcategories || [])) {
        const prods = sub.products || [];
        if (prods.some((p) => p.id === productId || p.categoryProductId === productId)) {
          const rem = prods.filter((p) => p.id !== productId && p.categoryProductId !== productId);
          await setDoc(
            doc(db, "companies", companyId, "categories", cat.id, "subcategories", sub.id),
            { products: rem, updatedAt: now },
            { merge: true }
          );
        }
      }
    }
  } catch (e) {}

  invalidateCompanyCategoriesCache(companyId);
}

export async function deleteCompanyProductsBatch(companyId, productIds, { categoryId = null, subcategoryId = null } = {}) {
  if (!companyId || !Array.isArray(productIds) || productIds.length === 0) return;
  const idSet = new Set(productIds);
  const now = new Date().toISOString();

  // A. If deleting from inside a specific subcategory
  if (categoryId && subcategoryId) {
    try {
      const subDocRef = doc(
        db,
        "companies",
        companyId,
        "categories",
        categoryId,
        "subcategories",
        subcategoryId
      );
      const subSnap = await getDoc(subDocRef);
      if (subSnap.exists()) {
        const existing = subSnap.data().products || [];
        const filtered = existing.filter(
          (p) => !idSet.has(p.id) && !idSet.has(p.categoryProductId) && !idSet.has(p.productId)
        );
        await setDoc(subDocRef, { products: filtered, updatedAt: now }, { merge: true });
        invalidateCompanyCategoriesCache(companyId);
        return;
      }
    } catch (e) {
      console.error("Delete subcategory products batch error:", e);
    }
  }

  // B. Delete from standalone normal products collection
  try {
    const CHUNK_SIZE = 450;
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((pid) => {
        batch.delete(doc(db, "companies", companyId, "products", pid));
      });
      await batch.commit();
    }
  } catch (e) {
    console.error("Batch delete normal products error:", e);
  }

  // C. Also cleanup from subcategories if present
  try {
    const cats = await fetchCompanyCategories(companyId, true);
    for (const cat of cats) {
      for (const sub of (cat.subcategories || [])) {
        const prods = sub.products || [];
        const hasAny = prods.some((p) => idSet.has(p.id) || idSet.has(p.categoryProductId));
        if (hasAny) {
          const rem = prods.filter((p) => !idSet.has(p.id) && !idSet.has(p.categoryProductId));
          await setDoc(
            doc(db, "companies", companyId, "categories", cat.id, "subcategories", sub.id),
            { products: rem, updatedAt: now },
            { merge: true }
          );
        }
      }
    }
  } catch (e) {}

  invalidateCompanyCategoriesCache(companyId);
}

export async function updateProductWebsiteVisibility(companyId, productOrId, targetWebsites, onProgress = null) {
  if (!companyId || !productOrId || !Array.isArray(targetWebsites)) return;
  await bulkUpdateProductsWebsiteVisibility(companyId, [productOrId], targetWebsites, onProgress);
}

export async function bulkUpdateProductsWebsiteVisibility(companyId, productsOrIds, targetWebsites, onProgress = null) {
  if (!companyId || !Array.isArray(productsOrIds) || productsOrIds.length === 0 || !Array.isArray(targetWebsites)) return;
  const now = new Date().toISOString();
  const assignedWebsites = normalizeWebsiteIds(companyId, targetWebsites);

  if (onProgress) onProgress(15, `Updating visibility for ${productsOrIds.length} products...`);

  const targetIdSet = new Set();
  const normalIds = [];

  for (const item of productsOrIds) {
    if (!item) continue;
    const isObj = typeof item === "object" && item !== null;
    const pid = isObj ? (item.id || item.categoryProductId || item.productId || item.uid) : item;
    if (!pid) continue;
    targetIdSet.add(pid);
    if (!isObj || (!item.categoryId && !item.category)) {
      normalIds.push(pid);
    }
  }

  // 1. Update subcategories' products arrays
  try {
    const cats = await fetchCompanyCategories(companyId, true);
    for (const cat of cats) {
      for (const sub of (cat.subcategories || [])) {
        const prods = sub.products || [];
        let modified = false;
        const updatedProds = prods.map((p) => {
          const pKey = p.id || p.categoryProductId || p.slug;
          if (targetIdSet.has(pKey) || targetIdSet.has(p.id) || targetIdSet.has(p.categoryProductId)) {
            modified = true;
            return { ...p, websiteIds: assignedWebsites, updatedAt: now };
          }
          return p;
        });

        if (modified) {
          await setDoc(
            doc(db, "companies", companyId, "categories", cat.id, "subcategories", sub.id),
            { products: updatedProds, updatedAt: now },
            { merge: true }
          );
        }
      }
    }
  } catch (err) {
    console.error("Subcategory visibility update error:", err);
  }

  // 2. Update normal standalone products
  if (normalIds.length > 0) {
    try {
      const CHUNK_SIZE = 450;
      let currentBatch = writeBatch(db);
      let count = 0;

      for (let i = 0; i < normalIds.length; i++) {
        const pid = normalIds[i];
        const targetRef = doc(db, "companies", companyId, "products", String(pid));
        currentBatch.set(targetRef, { websiteIds: assignedWebsites, updatedAt: now }, { merge: true });
        count++;
        if (count >= CHUNK_SIZE) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await currentBatch.commit();
      }
    } catch (err) {
      console.error("Normal products visibility update error:", err);
    }
  }

  invalidateCompanyCategoriesCache(companyId);
  if (onProgress) onProgress(100, `Completed visibility update!`);
}

export async function toggleProductPublish(companyId, productId, isPublished, { categoryId = null, subcategoryId = null } = {}, onProgress = null) {
  if (!companyId || !productId) return;
  const now = new Date().toISOString();

  if (onProgress) onProgress(30, "Updating publish status in master catalog...");

  // A. If inside a category
  if (categoryId && subcategoryId) {
    try {
      const subDocRef = doc(db, "companies", companyId, "categories", categoryId, "subcategories", subcategoryId);
      const subSnap = await getDoc(subDocRef);
      if (subSnap.exists()) {
        const prods = subSnap.data().products || [];
        const updated = prods.map((p) =>
          p.id === productId || p.categoryProductId === productId
            ? { ...p, isPublished, updatedAt: now }
            : p
        );
        await setDoc(subDocRef, { products: updated, updatedAt: now }, { merge: true });
        invalidateCompanyCategoriesCache(companyId);
      }
    } catch (e) {
      console.error("Toggle publish subcategory error:", e);
    }
  } else {
    // B. Standalone normal product
    try {
      const prodDocRef = doc(db, "companies", companyId, "products", productId);
      await setDoc(prodDocRef, { isPublished, updatedAt: now }, { merge: true });
    } catch (e) {
      console.error("Toggle publish normal error:", e);
    }
  }

  if (onProgress) onProgress(100, isPublished ? "Product published!" : "Product hidden!");
}

export async function bulkEnableProductsOnWebsites(companyId, productIds, destWebsites, onProgress = null) {
  if (!companyId || !Array.isArray(productIds) || productIds.length === 0 || !Array.isArray(destWebsites)) return;
  const validDestWebsites = normalizeWebsiteIds(companyId, destWebsites);
  await bulkUpdateProductsWebsiteVisibility(companyId, productIds, validDestWebsites, onProgress);
}

export async function updateCategoryWebsiteVisibility(
  companyId,
  categoryId,
  targetWebsites,
  { cascadeToSubcategories = true, cascadeToProducts = true } = {},
  onProgress = null
) {
  if (!companyId || !categoryId || !Array.isArray(targetWebsites)) return;
  const now = new Date().toISOString();
  const assignedWebsites = normalizeWebsiteIds(companyId, targetWebsites);

  if (onProgress) onProgress(20, "Updating category website visibility...");

  // 1. Direct write to company category master doc
  try {
    const catDocRef = doc(db, "companies", companyId, "categories", categoryId);
    await setDoc(catDocRef, { websiteIds: assignedWebsites, updatedAt: now }, { merge: true });
  } catch (e) {
    console.error("Update category master doc error:", e);
  }

  // 2. Cascade to subcategories and their internal products
  if (cascadeToSubcategories || cascadeToProducts) {
    if (onProgress) onProgress(45, "Updating subcategories & products visibility...");
    try {
      const subCollRef = collection(db, "companies", companyId, "categories", categoryId, "subcategories");
      const subSnap = await getDocs(subCollRef);
      for (const d of subSnap.docs) {
        const subData = d.data();
        const updatePayload = {
          websiteIds: cascadeToSubcategories ? assignedWebsites : (subData.websiteIds || assignedWebsites),
          updatedAt: now,
        };
        if (cascadeToProducts && Array.isArray(subData.products)) {
          updatePayload.products = subData.products.map((p) => ({
            ...p,
            websiteIds: assignedWebsites,
            updatedAt: now,
          }));
        }
        await setDoc(d.ref, updatePayload, { merge: true });
      }
    } catch (e) {
      console.error("Cascade subcategories error:", e);
    }
  }

  invalidateCompanyCategoriesCache(companyId);
  if (onProgress) onProgress(100, "Category visibility updated!");
}

export async function bulkUpdateCategoriesWebsiteVisibility(
  companyId,
  categoryIds,
  targetWebsites,
  options = {},
  onProgress = null
) {
  if (!companyId || !Array.isArray(categoryIds) || categoryIds.length === 0 || !Array.isArray(targetWebsites)) return;
  const total = categoryIds.length;

  if (onProgress) onProgress(5, `Starting visibility update for ${total} categories...`);

  for (let i = 0; i < total; i++) {
    const catId = categoryIds[i];
    await updateCategoryWebsiteVisibility(companyId, catId, targetWebsites, options);
    if (onProgress) {
      const pct = Math.min(98, Math.round(((i + 1) / total) * 100));
      onProgress(pct, `Processed ${i + 1} of ${total} categories (${pct}%)...`);
    }
  }

  if (onProgress) onProgress(100, `Completed visibility update for all ${total} categories!`);
}

export async function updateSubcategoryWebsiteVisibility(
  companyId,
  categoryId,
  subCategoryId,
  targetWebsites,
  { cascadeToProducts = true } = {},
  onProgress = null
) {
  if (!companyId || !categoryId || !subCategoryId || !Array.isArray(targetWebsites)) return;
  const now = new Date().toISOString();
  const assignedWebsites = normalizeWebsiteIds(companyId, targetWebsites);

  if (onProgress) onProgress(25, "Updating subcategory visibility...");

  // 1. Direct write to master company subcategory doc
  try {
    const subDocRef = doc(
      db,
      "companies",
      companyId,
      "categories",
      categoryId,
      "subcategories",
      subCategoryId
    );
    const subSnap = await getDoc(subDocRef);
    const subData = subSnap.exists() ? subSnap.data() : {};
    const updatePayload = {
      websiteIds: assignedWebsites,
      updatedAt: now,
    };
    if (cascadeToProducts && Array.isArray(subData.products)) {
      updatePayload.products = subData.products.map((p) => ({
        ...p,
        websiteIds: assignedWebsites,
        updatedAt: now,
      }));
    }
    await setDoc(subDocRef, updatePayload, { merge: true });
  } catch (e) {
    console.error("Update subcategory master doc error:", e);
  }

  invalidateCompanyCategoriesCache(companyId);
  if (onProgress) onProgress(100, "Subcategory visibility updated!");
}

export async function bulkUpdateSubcategoriesWebsiteVisibility(
  companyId,
  subcategoriesList,
  targetWebsites,
  options = {},
  onProgress = null
) {
  if (!companyId || !Array.isArray(subcategoriesList) || subcategoriesList.length === 0 || !Array.isArray(targetWebsites)) return;
  const total = subcategoriesList.length;

  if (onProgress) onProgress(5, `Starting visibility update for ${total} subcategories...`);

  for (let i = 0; i < total; i++) {
    const item = subcategoriesList[i];
    const catId = item.categoryId || item.catId;
    const subId = item.subcategoryId || item.subId || item.id;
    await updateSubcategoryWebsiteVisibility(companyId, catId, subId, targetWebsites, options);
    if (onProgress) {
      const pct = Math.min(98, Math.round(((i + 1) / total) * 100));
      onProgress(pct, `Processed ${i + 1} of ${total} subcategories (${pct}%)...`);
    }
  }

  if (onProgress) onProgress(100, `Completed visibility update for all ${total} subcategories!`);
}

export async function bulkEnableCategoryOnWebsites(companyId, categoryId, destWebsites) {
  if (!companyId || !categoryId || !Array.isArray(destWebsites)) return;
  const validDestWebsites = normalizeWebsiteIds(companyId, destWebsites);
  await updateCategoryWebsiteVisibility(companyId, categoryId, validDestWebsites, { cascadeToSubcategories: true, cascadeToProducts: true });
}

export async function bulkEnableSubcategoryOnWebsites(companyId, categoryId, subCategoryId, destWebsites) {
  if (!companyId || !categoryId || !subCategoryId || !Array.isArray(destWebsites)) return;
  const validDestWebsites = normalizeWebsiteIds(companyId, destWebsites);
  await updateSubcategoryWebsiteVisibility(companyId, categoryId, subCategoryId, validDestWebsites, { cascadeToProducts: true });
}

export async function getWebsiteCatalog(website) {
  const companyId = getCompanyForWebsite(website);
  const companyDisplayName = getCompanyDisplayName(companyId);

  const allCategories = await fetchCompanyCategories(companyId, true);
  const enabledCategories = allCategories
    .filter((cat) => Array.isArray(cat.websiteIds) && cat.websiteIds.includes(website))
    .map((cat) => {
      const enabledSubs = (cat.subcategories || []).filter(
        (sub) => Array.isArray(sub.websiteIds) && sub.websiteIds.includes(website)
      );
      return {
        ...cat,
        subcategories: enabledSubs,
      };
    });

  const enabledProducts = await fetchCompanyProducts(companyId, {
    websiteFilter: website,
  });

  return {
    companyId,
    companyName: companyDisplayName,
    website,
    categories: enabledCategories,
    products: enabledProducts,
  };
}

export async function syncAllCompanyProductsToWebsites(companyId, onProgress = null) {
  if (!companyId) return { success: false, error: "companyId is required" };
  const allSites = COMPANY_WEBSITES[companyId] || [];
  if (allSites.length === 0) return { success: true, count: 0 };

  if (onProgress) onProgress({ step: "Fetching master catalog for synchronization...", current: 0, total: 100 });

  // 1. Fetch all master categories and products for company
  const categories = await fetchCompanyCategories(companyId, true, true);
  const products = await fetchCompanyProducts(companyId);

  if (onProgress) onProgress({ step: `Ensuring visibility configuration for ${categories.length} categories...`, current: 20, total: 100 });

  // 2. Ensure all categories have valid company website visibility
  for (const cat of categories) {
    const validWebsites = normalizeWebsiteIds(companyId, cat.websiteIds || allSites);
    try {
      await setDoc(
        doc(db, "companies", companyId, "categories", cat.id),
        { websiteIds: validWebsites, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {}

    if (Array.isArray(cat.subcategories)) {
      for (const sub of cat.subcategories) {
        const subWebsites = normalizeWebsiteIds(companyId, sub.websiteIds || allSites);
        try {
          await setDoc(
            doc(db, "companies", companyId, "categories", cat.id, "subcategories", sub.id),
            { websiteIds: subWebsites, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        } catch (e) {}
      }
    }
  }

  // 3. Ensure all products in master catalog have valid company website visibility
  const total = products.length;
  const CHUNK_SIZE = 50;
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((prod) => {
      const validWebsites = normalizeWebsiteIds(companyId, prod.websiteIds || allSites);
      const pRef = doc(db, "companies", companyId, "products", prod.id);
      batch.set(pRef, { websiteIds: validWebsites, updatedAt: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();

    if (onProgress) {
      const pct = Math.min(99, Math.round(20 + ((i + CHUNK_SIZE) / total) * 79));
      onProgress({
        step: `Updated visibility for ${Math.min(i + CHUNK_SIZE, total)} of ${total} master products...`,
        current: pct,
        total: 100,
      });
    }
  }

  if (onProgress) onProgress({ step: `Master catalog sync complete! Processed ${total} products.`, current: 100, total: 100 });
  return { success: true, count: total };
}
