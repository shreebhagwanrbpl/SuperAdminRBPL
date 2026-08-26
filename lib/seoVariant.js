// SEO variant helpers. Additive only: existing product data/logic remains unchanged.

export const WEBSITE_SEO_ORDER = [
  // Human Biomedical
  "humanbiomedicalcom",
  "humanbiomedicalin",
  "humanbiomedicalorg",
  "humanbiomedicalsnet",
  "humanbiomedicalsin",
  "humanbiomedicalsorg",
  "humanbiomedicalscoin",
  // Global Biomedicals
  "globalbiomedicalorg",
  "globalbiomedicalin",
  "globalbiomedicalcoin",
  "globalbiomedicalsin",
  "globalbiomedicalsnet",
  "globalhealthkartcom",
  // Rajbiosis
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
];

export function getWebsiteSeoIndex(website) {
  const index = WEBSITE_SEO_ORDER.indexOf(String(website || "").trim());
  // Unknown/new websites get a deterministic suffix without changing existing IDs.
  return index >= 0 ? index + 1 : null;
}

export function stripSeoVariantSuffix(slug = "") {
  return String(slug)
    .trim()
    .replace(/-(?:0*[1-9]\d{0,2})$/, "");
}

export function makeWebsiteProductSlug(product, website) {
  const base = stripSeoVariantSuffix(
    product?.masterSlug || product?.slug || product?.productSlug || product?.title || "product"
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const index = getWebsiteSeoIndex(website);
  if (!base) return "";
  if (!index) return base;

  return `${base}-${String(index).padStart(2, "0")}`;
}

export function buildProductSeoVariant(product, website) {
  const baseName = product?.title || product?.name || "Product";
  const brand = product?.brand ? `${product.brand} ` : "";
  const index = getWebsiteSeoIndex(website);
  const websiteNumber = index ? String(index).padStart(2, "0") : "";
  const slug = makeWebsiteProductSlug(product, website);

  return {
    seoSlug: slug,
    masterSlug: stripSeoVariantSuffix(product?.masterSlug || product?.slug || product?.productSlug || slug),
    seoVariantIndex: index || null,
    seoTitle: `${brand}${baseName} Supplier | Price & Specifications`,
    seoH1: `${brand}${baseName}`,
    seoDescription: `Explore ${brand}${baseName}, including features, specifications, applications and product details. Request pricing and availability from the supplier.`,
    seoKeywords: [
      baseName,
      `${baseName} supplier`,
      `${baseName} price`,
      `${baseName} specifications`,
      `${brand}${baseName}`.trim(),
    ].filter(Boolean),
    seoVariantVersion: 1,
    seoWebsiteNumber: websiteNumber,
  };
}
