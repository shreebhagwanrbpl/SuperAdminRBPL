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
    // Human
    humanbiomedicalorg: "humanbiomedical.org",
    humanbiomedicalin: "humanbiomedical.in",
    humanbiomedicalcom: "humanbiomedical.com",
    humanbiomedicalsin: "humanbiomedicals.in",
    humanbiomedicalsorg: "humanbiomedicals.org",
    humanbiomedicalscoin: "humanbiomedicals.co.in",
    humanbiomedicalsnet: "humanbiomedicals.net",

    // Global
    globalbiomedicalorg: "globalbiomedical.org",
    globalbiomedicalin: "globalbiomedical.in",
    globalbiomedicalcoin: "globalbiomedical.co.in",
    globalbiomedicalsin: "globalbiomedicals.in",
    globalbiomedicalsnet: "globalbiomedicals.net",
    globalhealthkartcom: "globalhealthkart.com",

    // Rajbiosis
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

    // Qlyte
    qlyte: "qlyte.com",
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