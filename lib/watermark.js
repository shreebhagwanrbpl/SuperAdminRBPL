import sharp from "sharp";
import { generateTiledWatermarkSvg } from "./websiteWatermarks";

export async function addWatermark(imageBuffer, website) {
  try {
    let image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const origWidth = metadata.width || 800;
    const origHeight = metadata.height || 800;

    // Resize to max 800px dimension for ultra-fast uploads and tiny file sizes (~50KB)
    const maxDim = 800;
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (origWidth > maxDim || origHeight > maxDim) {
      if (origWidth >= origHeight) {
        targetWidth = maxDim;
        targetHeight = Math.round((origHeight * maxDim) / origWidth);
      } else {
        targetHeight = maxDim;
        targetWidth = Math.round((origWidth * maxDim) / origHeight);
      }
      image = image.resize(targetWidth, targetHeight);
    }

    // Generate diagonal tiled SVG matching the image dimensions & website name
    const watermarkSvg = generateTiledWatermarkSvg(website, targetWidth, targetHeight);

    // Composite overlay over the image
    const output = await image
      .composite([
        {
          input: watermarkSvg,
          gravity: "center",
          blend: "over",
        },
      ])
      .jpeg({
        quality: 80,
      })
      .toBuffer();

    return output;
  } catch (err) {
    console.error("Watermark Error:", err);
    throw err;
  }
}