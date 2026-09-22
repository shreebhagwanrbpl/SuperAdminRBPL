// Central website -> company mapping used by the SQLite website path layer.
// Keep this list aligned with COMPANY_WEBSITES in lib/companyCatalog.js.

export const WEBSITE_COMPANY_MAP = {
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
    "globalhealthkartcom",
    "qlyte",
  ],
};

const websiteToCompany = new Map();
for (const [companyId, websites] of Object.entries(WEBSITE_COMPANY_MAP)) {
  for (const website of websites) {
    websiteToCompany.set(website, companyId);
  }
}

export function getCompanyForWebsitePath(website) {
  return websiteToCompany.get(String(website || "").trim().toLowerCase()) || null;
}

export function groupWebsitePath(rawPath) {
  const parts = String(rawPath || "")
    .split("/")
    .filter(Boolean);

  if (parts[0] !== "websites" || parts.length < 2) {
    return parts.join("/");
  }

  // Already grouped: websites/{company}/{website}/...
  if (parts.length >= 3 && WEBSITE_COMPANY_MAP[parts[1]]) {
    return parts.join("/");
  }

  const companyId = getCompanyForWebsitePath(parts[1]);
  if (!companyId) {
    return parts.join("/");
  }

  return ["websites", companyId, parts[1], ...parts.slice(2)].join("/");
}
