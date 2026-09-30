// Single source of truth for website -> company assignment.
// Keep IDs normalized (domain name with punctuation removed).
export function normalizeWebsiteId(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[.\-\s]/g, "");
}

export const WEBSITE_COMPANY_MAP = {
  human: [
    "humanbiomedicalcom",
    "humanbiomedicalin",
    "humanbiomedicalorg",
    "humanbiomedicalsnet",
    "humanbiomedicalsin",
    "humanbiomedicalsorg",
    "humanbiomedicalscoin",
    "humanbiomedicalscom",
  ],
  global: [
    "globalbiomedicalorg",
    "globalbiomedicalin",
    "globalbiomedicalcoin",
    "globalbiomedicalsin",
    "globalbiomedicalsnet",
  ],
  rajbiosis: [
    "indiandiagnostic", "centralbiomedicals", "humarilabin", "humarilabcom",
    "rajbiosisinfo", "rajbiosiscoin", "rajbiosisltd", "ozonexco", "aozellocom",
    "aozallocom", "ozallecom", "ozallocom", "ozellein", "qlytein", "qlyserin",
    "anylabtestin", "radioimmunoassayin", "bloodmixerin", "glucostripscom",
    "glucometersin", "safekitin", "haemoglobinstripcom", "haemoglobinstripscom",
    "haemoglobinmetercom", "hemoglobinstripcom", "hemoglobinstripin",
    "hemoglobinstripscom", "hemoglobinmetercom", "hemoglobinmeterin", "cliakitscom",
    "clinicalchemistryin", "medicalsjobportalcom", "globalhealthkartcom", "tublerin",
    "clinidixcom", "oleturcom", "indiandiagnosticscom", "cliakitsin",
    "radioimmunoassaycoin", "centralbiomedicalsin", "diagnostatcom", "diagnosticbloomcom",
    "diagnotexcom", "biohaloscom", "diagnosticsbloomcom", "globalhealthdirectorycom",
    "dxgelcom", "globalhealthcartcom", "medflixbiomedicalcom",
    "medflixbiomedicalscom", "qlysercom", "ichromain", "spinreactin", "rajvedcom",
    "coolpacksin", "hamarilabcom",
  ],
};

// Backwards-compatible export used by existing code.
export const COMPANY_WEBSITES = WEBSITE_COMPANY_MAP;

const websiteToCompany = new Map();
for (const [companyId, websites] of Object.entries(WEBSITE_COMPANY_MAP)) {
  for (const website of websites) {
    const normalized = normalizeWebsiteId(website);
    const previous = websiteToCompany.get(normalized);
    if (previous && previous !== companyId) {
      throw new Error(`Website ${normalized} is assigned to both ${previous} and ${companyId}`);
    }
    websiteToCompany.set(normalized, companyId);
  }
}

export function getCompanyForWebsitePath(website) {
  const normalized = normalizeWebsiteId(website);
  return websiteToCompany.get(normalized) || null;
}

export function groupWebsitePath(rawPath) {
  const parts = String(rawPath || "").split("/").filter(Boolean);
  if (parts[0] !== "websites" || parts.length < 2) return parts.join("/");

  // Already grouped: websites/{company}/{website}/...
  if (parts.length >= 3 && WEBSITE_COMPANY_MAP[parts[1]]) return parts.join("/");

  const companyId = getCompanyForWebsitePath(parts[1]);
  if (!companyId) return parts.join("/");
  const normalizedSiteId = normalizeWebsiteId(parts[1]);
  return ["websites", companyId, normalizedSiteId, ...parts.slice(2)].join("/");
}

