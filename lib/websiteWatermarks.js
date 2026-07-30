const WEBSITE_WATERMARKS = {
  // Human Biomedical
  humanbiomedicalorg: "humanbiomedicalorg.svg",
  humanbiomedicalin: "humanbiomedicalin.svg",
  humanbiomedicalsin: "humanbiomedicalsin.svg",
  humanbiomedicalsorg: "humanbiomedicalsorg.svg",
  humanbiomedicalscoin: "humanbiomedicalscoin.svg",
  humanbiomedicalcom: "humanbiomedicalcom.svg",

  // Global Biomedical
  globalbiomedicalorg: "globalbiomedicalorg.svg",
  globalbiomedicalsin: "globalbiomedicalsin.svg",

  // RajBiosis
  indiandiagnostic: "indiandiagnostic.svg",
  centralbiomedicals: "centralbiomedicals.svg",
  ozonexco: "ozonexco.svg",
  aozellocom: "aozellocom.svg",

  // Qlyte
  qlyte: "qlyte.svg",
};

export function getWatermarkDisplayText(website) {
  const clean = (website || "").trim().toLowerCase();
  const textMap = {
    humanbiomedicalorg: "humanbiomedical.org",
    humanbiomedicalin: "humanbiomedical.in",
    humanbiomedicalsin: "humanbiomedical.s.in",
    humanbiomedicalsorg: "humanbiomedicals.org",
    humanbiomedicalscoin: "humanbiomedicals.co.in",
    humanbiomedicalcom: "humanbiomedical.com",
    globalbiomedicalorg: "globalbiomedical.org",
    globalbiomedicalsin: "globalbiomedical.s.in",
    indiandiagnostic: "indiandiagnostic.com",
    centralbiomedicals: "centralbiomedicals.com",
    ozonexco: "ozonex.co",
    aozellocom: "aozello.com",
    qlyte: "qlyte.com"
  };

  if (textMap[clean]) return textMap[clean];
  if (clean.includes("human")) return "humanbiomedical.org";
  if (clean.includes("global")) return "globalbiomedical.org";
  if (clean.includes("qlyte")) return "qlyte.com";
  if (clean.includes("rajbiosis")) return "rajbiosis.com";
  return clean || "watermark";
}

export function generateTiledWatermarkSvg(website, width = 800, height = 800) {
  const text = getWatermarkDisplayText(website);
  // Calculate tile width dynamically based on text length
  const patternWidth = Math.max(240, text.length * 15 + 70);
  const patternHeight = 120;
  const fontSize = 18;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <pattern id="tiled-wm" width="${patternWidth}" height="${patternHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
        <text x="15" y="40" fill="#000000" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" opacity="0.16" letter-spacing="1">
          ${text}
        </text>
        <text x="${patternWidth / 2 + 15}" y="95" fill="#000000" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" opacity="0.16" letter-spacing="1">
          ${text}
        </text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#tiled-wm)"/>
  </svg>`;

  return typeof Buffer !== "undefined"
    ? Buffer.from(svg)
    : svg;
}

export default WEBSITE_WATERMARKS;