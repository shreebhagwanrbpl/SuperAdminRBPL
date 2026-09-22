import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from "@/lib/sqliteFirestore";
import {
  COMPANY_WEBSITES,
  COMPANIES,
  getCompanyForWebsite,
  slugify,
  saveCompanyCategory,
  saveCompanySubcategory,
  saveCompanyProduct
} from "./companyCatalog";

/**
 * Normalizes an image list ensuring it's an array of clean string URLs
 */
function cleanImageList(images, fallbackImage = null) {
  const result = [];
  if (Array.isArray(images)) {
    images.forEach((img) => {
      if (typeof img === "string" && img.trim()) {
        result.push(img.trim());
      }
    });
  } else if (typeof images === "string" && images.trim()) {
    result.push(images.trim());
  }

  if (result.length === 0 && fallbackImage && typeof fallbackImage === "string" && fallbackImage.trim()) {
    result.push(fallbackImage.trim());
  }

  return result;
}

/**
 * Generates a deterministic identity key for a product to merge duplicates cleanly
 */
function getProductIdentityKey(prod) {
  if (prod.categoryProductId && String(prod.categoryProductId).trim()) {
    return `cpid_${String(prod.categoryProductId).trim().toUpperCase()}`;
  }
  if (prod.sku && String(prod.sku).trim()) {
    return `sku_${String(prod.sku).trim().toLowerCase()}`;
  }
  if (prod.id && String(prod.id).trim() && !String(prod.id).includes("temp-")) {
    return `id_${String(prod.id).trim()}`;
  }
  if (prod.productId && String(prod.productId).trim()) {
    return `pid_${String(prod.productId).trim()}`;
  }
  const cleanTitle = (prod.title || prod.name || "").trim().toLowerCase();
  if (cleanTitle) {
    return `title_${slugify(cleanTitle)}`;
  }
  return `rnd_${crypto.randomUUID()}`;
}

/**
 * Performs a safe, non-destructive, idempotent migration
 */
export async function runCompanyCatalogMigration(onProgress = null) {
  const stats = {
    startedAt: new Date().toISOString(),
    companiesProcessed: 0,
    websitesScanned: 0,
    legacyNormalProductsFound: 0,
    legacyCategoryProductsFound: 0,
    masterCategoriesCreated: 0,
    masterSubcategoriesCreated: 0,
    masterProductsCreated: 0,
    detailsByCompany: {},
  };

  for (const companyId of Object.keys(COMPANY_WEBSITES)) {
    const websites = COMPANY_WEBSITES[companyId] || [];
    stats.detailsByCompany[companyId] = {
      websitesCount: websites.length,
      categoriesCount: 0,
      subcategoriesCount: 0,
      productsCount: 0,
    };

    if (onProgress) {
      onProgress({
        step: `Processing company: ${COMPANIES[companyId]?.displayName || companyId}`,
        companyId,
      });
    }

    const companyCategoriesMap = new Map(); // slug -> categoryData
    const companySubcategoriesMap = new Map(); // catSlug:subSlug -> subcategoryData
    const companyProductsMap = new Map(); // identityKey -> masterProductData

    // -------------------------------------------------------------
    // STEP 1: SCAN EACH WEBSITE IN THIS COMPANY
    // -------------------------------------------------------------
    for (let wIdx = 0; wIdx < websites.length; wIdx++) {
      const site = websites[wIdx];
      stats.websitesScanned++;

      if (onProgress) {
        onProgress({
          step: `Scanning website ${site} (${wIdx + 1}/${websites.length}) for ${companyId}`,
          companyId,
          site,
        });
      }

      // A. Scan Normal Products
      try {
        const normalDocRef = doc(db, "websites", site, "pages", "products");
        const normalSnap = await getDoc(normalDocRef);
        if (normalSnap.exists()) {
          const prods = normalSnap.data().products || [];
          stats.legacyNormalProductsFound += prods.length;

          for (const prod of prods) {
            const identKey = getProductIdentityKey(prod);
            const images = cleanImageList(prod.originalImages || prod.images, prod.image);

            if (!companyProductsMap.has(identKey)) {
              companyProductsMap.set(identKey, {
                id: prod.id || crypto.randomUUID(),
                productId: prod.productId || null,
                categoryProductId: prod.categoryProductId || null,
                title: typeof prod.title === "object" ? prod.title?.text || "" : prod.title || "",
                name: typeof prod.title === "object" ? prod.title?.text || "" : prod.title || "",
                slug: prod.slug || slugify(prod.title || "product"),
                price: prod.price || "",
                desc: typeof prod.desc === "object" ? prod.desc?.text || "" : prod.desc || "",
                description: typeof prod.desc === "object" ? prod.desc?.text || "" : prod.desc || "",
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
                categoryId: null,
                subcategoryId: null,
                type: "normal",
                images,
                originalImages: images,
                video: prod.video || "",
                pdf: prod.pdf || "",
                isPublished: typeof prod.isPublished === "boolean" ? prod.isPublished : true,
                status: "active",
                websiteIds: new Set([site]),
                createdAt: prod.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            } else {
              // Product already exists in master map -> Add this website to its visibility
              const existing = companyProductsMap.get(identKey);
              existing.websiteIds.add(site);
              // Fill any missing attributes from this copy
              if (!existing.video && prod.video) existing.video = prod.video;
              if (!existing.pdf && prod.pdf) existing.pdf = prod.pdf;
              if (existing.images.length === 0 && images.length > 0) {
                existing.images = images;
                existing.originalImages = images;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[Migration] Error reading normal products for ${site}:`, err);
      }

      // B. Scan Categories & Subcategories
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

        for (const catDoc of catSnap.docs) {
          const catData = catDoc.data();
          const catName = catData.category || catData.name || catDoc.id;
          const catSlug = slugify(catData.id || catName);

          if (!companyCategoriesMap.has(catSlug)) {
            companyCategoriesMap.set(catSlug, {
              id: catSlug,
              name: catName,
              category: catName,
              slug: catSlug,
              description: catData.description || catData.desc || "",
              image: catData.image || "",
              companyId,
              order: Number(catData.order) || 0,
              status: "active",
              websiteIds: new Set([site]),
              createdAt: catData.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            companyCategoriesMap.get(catSlug).websiteIds.add(site);
          }

          // Scan subcategories of this category
          const subCollRef = collection(
            db,
            "websites",
            site,
            "pages",
            "categoryproducts",
            "categories",
            catDoc.id,
            "subcategories"
          );
          const subSnap = await getDocs(subCollRef);

          for (const subDoc of subSnap.docs) {
            const subData = subDoc.data();
            const subName = subData.subCategory || subData.name || subDoc.id;
            const subSlug = slugify(subData.id || subName);
            const subKey = `${catSlug}:${subSlug}`;

            if (!companySubcategoriesMap.has(subKey)) {
              companySubcategoriesMap.set(subKey, {
                id: subSlug,
                name: subName,
                subCategory: subName,
                slug: subSlug,
                categoryId: catSlug,
                companyId,
                description: subData.description || subData.desc || "",
                image: subData.image || "",
                order: Number(subData.order) || 0,
                status: "active",
                websiteIds: new Set([site]),
                createdAt: subData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            } else {
              companySubcategoriesMap.get(subKey).websiteIds.add(site);
            }

            // Products inside this subcategory
            const catProds = subData.products || [];
            stats.legacyCategoryProductsFound += catProds.length;

            for (const prod of catProds) {
              const identKey = getProductIdentityKey(prod);
              const images = cleanImageList(prod.originalImages || prod.images, prod.image);

              if (!companyProductsMap.has(identKey)) {
                companyProductsMap.set(identKey, {
                  id: prod.id || crypto.randomUUID(),
                  productId: prod.productId || null,
                  categoryProductId: prod.categoryProductId || null,
                  title: typeof prod.title === "object" ? prod.title?.text || "" : prod.title || "",
                  name: typeof prod.title === "object" ? prod.title?.text || "" : prod.title || "",
                  slug: prod.slug || slugify(prod.title || "product"),
                  price: prod.price || "",
                  desc: typeof prod.desc === "object" ? prod.desc?.text || "" : prod.desc || "",
                  description: typeof prod.desc === "object" ? prod.desc?.text || "" : prod.desc || "",
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
                  categoryId: catSlug,
                  subcategoryId: subSlug,
                  type: "category",
                  images,
                  originalImages: images,
                  video: prod.video || "",
                  pdf: prod.pdf || "",
                  isPublished: typeof prod.isPublished === "boolean" ? prod.isPublished : true,
                  status: "active",
                  websiteIds: new Set([site]),
                  createdAt: prod.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              } else {
                const existing = companyProductsMap.get(identKey);
                existing.websiteIds.add(site);
                if (!existing.categoryId) existing.categoryId = catSlug;
                if (!existing.subcategoryId) existing.subcategoryId = subSlug;
                if (existing.type !== "category") existing.type = "category";
                if (!existing.video && prod.video) existing.video = prod.video;
                if (!existing.pdf && prod.pdf) existing.pdf = prod.pdf;
                if (existing.images.length === 0 && images.length > 0) {
                  existing.images = images;
                  existing.originalImages = images;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[Migration] Error reading category products for ${site}:`, err);
      }
    }

    // -------------------------------------------------------------
    // STEP 2: WRITE MASTER RECORDS & VISIBILITY MAPPINGS FOR THIS COMPANY
    // -------------------------------------------------------------

    // A. Write Master Categories
    for (const [catSlug, catData] of companyCategoriesMap.entries()) {
      const websiteIds = Array.from(catData.websiteIds);
      await saveCompanyCategory(companyId, { ...catData, id: catSlug }, websiteIds);
      stats.masterCategoriesCreated++;
      stats.detailsByCompany[companyId].categoriesCount++;
    }

    // B. Write Master Subcategories
    for (const [subKey, subData] of companySubcategoriesMap.entries()) {
      const websiteIds = Array.from(subData.websiteIds);
      await saveCompanySubcategory(
        companyId,
        subData.categoryId,
        subData,
        websiteIds
      );
      stats.masterSubcategoriesCreated++;
      stats.detailsByCompany[companyId].subcategoriesCount++;
    }

    // C. Write Master Products
    for (const [, prodData] of companyProductsMap.entries()) {
      const websiteIds = Array.from(prodData.websiteIds);
      await saveCompanyProduct(companyId, prodData, websiteIds);
      stats.masterProductsCreated++;
      stats.detailsByCompany[companyId].productsCount++;
    }

    stats.companiesProcessed++;
  }

  stats.completedAt = new Date().toISOString();
  return stats;
}
