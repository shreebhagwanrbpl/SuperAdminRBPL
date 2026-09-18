import { getCompanyForWebsite, getCompanyDisplayName } from "./companyCatalog";

export function getWatermarkDisplayText(websiteOrCompany) {
  if (!websiteOrCompany) return "Rajbiosis";
  return getCompanyDisplayName(websiteOrCompany);
}

export function generateTiledWatermarkSvg(websiteOrCompany, width = 800, height = 800) {
  const text = getWatermarkDisplayText(websiteOrCompany);
  // Calculate tile width dynamically based on text length
  const patternWidth = Math.max(260, text.length * 16 + 80);
  const patternHeight = 130;
  const fontSize = 18;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <pattern id="tiled-wm" width="${patternWidth}" height="${patternHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
        <text x="15" y="45" fill="#000000" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" opacity="0.16" letter-spacing="1">
          ${text}
        </text>
        <text x="${patternWidth / 2 + 15}" y="105" fill="#000000" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" opacity="0.16" letter-spacing="1">
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

export const applyWatermarkClientSide = (imageUrl, companyOrWebsite) => {
  return new Promise((resolve) => {
    if (!imageUrl || typeof imageUrl !== "string") {
      return resolve(imageUrl);
    }

    const companyText = getWatermarkDisplayText(companyOrWebsite);

    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      resolve(imageUrl);
    }, 4000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 800;

        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
        ctx.font = "600 18px 'Segoe UI', Roboto, sans-serif";

        ctx.translate(width / 2, height / 2);
        ctx.rotate((-25 * Math.PI) / 180);

        const text = companyText;
        const textWidth = ctx.measureText(text).width + 80;
        const stepY = 100;

        const diagonal = Math.sqrt(width * width + height * height) * 1.5;
        const startX = -diagonal;
        const endX = diagonal;
        const startY = -diagonal;
        const endY = diagonal;

        let row = 0;
        for (let y = startY; y < endY; y += stepY) {
          const offsetX = (row % 2) * (textWidth / 2);
          for (let x = startX; x < endX; x += textWidth) {
            ctx.fillText(text, x + offsetX, y);
          }
          row++;
        }

        ctx.restore();

        const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
        resolve(dataUrl);
      } catch (err) {
        console.error("Canvas watermark error:", err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
};

export default {
  getWatermarkDisplayText,
  generateTiledWatermarkSvg,
  applyWatermarkClientSide,
};