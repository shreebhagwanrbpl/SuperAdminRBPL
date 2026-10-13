import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/**
 * Universal Excel Parser & Importer Engine
 * - Supports .xlsx, .xls, .csv, .xlsm, .xlsb
 * - Dual Engine: ExcelJS with embedded image extraction + SheetJS (XLSX) fallback
 * - Auto 10-row header detection with fuzzy column matching
 * - Formula cell resolution, richText unwrapping, safe image extraction
 * - Zero file crashes, full data retention
 */

// 1. Slugify helper
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 2. Parse Category & Subcategory from relative path or filename
export function parseCategoryAndSubcategoryFromPath(
  relPath,
  fileName,
  fallbackCat = "",
  fallbackSub = ""
) {
  const cleanPath = String(relPath || "")
    .replace(/^[/\\]+/, "")
    .replace(/[/\\]+$/, "");

  const parts = cleanPath.split(/[\\/]+/).filter(Boolean);

  let cat = "";
  let sub = "";

  const stripExt = (name) =>
    String(name || "").replace(/\.(xlsx|xls|csv|xlsm|xlsb)$/i, "").trim();

  if (parts.length === 1) {
    cat = fallbackCat || "";
    sub = stripExt(parts[0]);
  } else if (parts.length === 2) {
    // e.g. "Hematology/Reagents.xlsx" -> cat: "Hematology", sub: "Reagents"
    cat = parts[0].trim();
    sub = stripExt(parts[1]);
  } else if (parts.length === 3) {
    // e.g. "Catalog/Hematology/Reagents.xlsx"
    cat = parts[parts.length - 2].trim();
    sub = stripExt(parts[parts.length - 1]);
  } else if (parts.length >= 4) {
    // e.g. "Root/Section/Hematology/Reagents/Kit.xlsx"
    const lastPart = stripExt(parts[parts.length - 1]);
    const secondLast = parts[parts.length - 2].trim();
    const thirdLast = parts[parts.length - 3].trim();

    if (/^(files|products|excel|data|master|items|all|catalog|upload|uploads)$/i.test(thirdLast)) {
      cat = secondLast;
      sub = lastPart;
    } else {
      cat = thirdLast;
      sub = secondLast;
    }
  }

  if (!cat) cat = fallbackCat || "";
  if (!sub) sub = fallbackSub || stripExt(fileName || "");

  return { category: cat, subCategory: sub };
}

// 3. Column header cleaning & dictionary
export function cleanHeaderString(raw) {
  if (raw == null) return "";
  return String(raw)
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COLUMN_ALIASES = {
  title: [
    "title",
    "product title",
    "product name",
    "item name",
    "name",
    "product",
    "item",
    "particulars",
    "model name",
    "product_name",
    "item_name",
    "item title",
    "description of goods",
    "material description",
    "description of item",
    "heading",
    "equipment name",
    "machine name",
    "instrument name",
  ],
  desc: [
    "desc",
    "description",
    "product description",
    "details",
    "item details",
    "specification",
    "specifications",
    "features",
    "specs",
    "about",
    "note",
    "remarks",
    "detailed description",
    "summary",
    "product details",
  ],
  price: [
    "price",
    "mrp",
    "rate",
    "cost",
    "amount",
    "unit price",
    "selling price",
    "price inr",
    "price rs",
    "rate rs",
    "mrp inr",
    "list price",
    "net price",
    "standard price",
    "sales price",
    "rate per unit",
  ],
  category: [
    "category",
    "cat",
    "category name",
    "main category",
    "dept",
    "department",
    "group",
    "group name",
    "category_name",
    "cat name",
    "product category",
    "classification",
  ],
  subCategory: [
    "sub category",
    "subcategory",
    "sub category name",
    "sub-category",
    "subcat",
    "sub cat",
    "sub group",
    "subgroup",
    "sub_category",
    "subcat name",
    "sub department",
  ],
  brand: [
    "brand",
    "make",
    "manufacturer",
    "company",
    "brand name",
    "mfg",
    "vendor",
  ],
  model: [
    "model",
    "model no",
    "model number",
    "code",
    "item code",
    "product code",
    "sku",
    "cat no",
    "catalog no",
    "ref no",
    "article no",
    "part no",
    "part number",
  ],
  images: [
    "images",
    "image",
    "photo",
    "photos",
    "picture",
    "pictures",
    "image url",
    "img",
    "pic",
    "photo url",
    "product image",
    "picture url",
    "image link",
  ],
  video: ["video", "video url", "video link", "youtube", "clip"],
  pdf: [
    "pdf",
    "brochure",
    "catalog",
    "catalogue",
    "manual",
    "doc",
    "pdf url",
    "pdf link",
    "datasheet",
    "specification sheet",
    "flyer",
  ],
  capacity: ["capacity", "cap", "volume"],
  throughput: ["throughput", "speed", "test speed", "tests per hour", "output"],
  instrument: ["instrument", "instrument type", "machine", "device", "apparatus"],
  usage: ["usage", "application", "intended use", "method", "purpose"],
  parameters: [
    "parameters",
    "param",
    "tests",
    "test parameters",
    "assays",
    "analytes",
    "parameters measured",
  ],
  automation: ["automation", "automation grade", "operation", "mode"],
  availability: ["availability", "stock", "in stock", "status", "lead time", "stock status"],
  size: ["size", "dimensions", "dimension", "pack size", "packing", "pack", "unit", "package"],
};

/**
 * Determine best column mapping from a list of header string tokens
 */
export function mapHeadersToFields(headerCells) {
  const mapping = {}; // fieldKey -> colIndex
  const usedCols = new Set();

  headerCells.forEach((cellText, colIdx) => {
    const cleaned = cleanHeaderString(cellText);
    if (!cleaned) return;

    for (const [fieldKey, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (mapping[fieldKey] !== undefined) continue;

      const exactMatch = aliases.some((a) => a === cleaned);
      const partialMatch = aliases.some(
        (a) => cleaned.includes(a) || a.includes(cleaned)
      );

      if (exactMatch || partialMatch) {
        mapping[fieldKey] = colIdx;
        usedCols.add(colIdx);
        break;
      }
    }
  });

  return mapping;
}

/**
 * Safely extract raw value from ExcelJS cell
 */
export function extractExcelJsCellValue(cell) {
  if (!cell || cell.value == null) return "";
  const v = cell.value;

  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (v instanceof Date) {
    try {
      return v.toISOString().split("T")[0];
    } catch {
      return String(v).trim();
    }
  }

  if (typeof v === "object") {
    // Formula result
    if (v.result != null) return String(v.result).trim();
    // Rich text
    if (Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text || "").join("").trim();
    }
    // Simple text / hyperlink
    if (v.text != null) return String(v.text).trim();
    if (v.hyperlink) return String(v.text || v.hyperlink).trim();
    if (v.error) return "";
  }

  return String(v).trim();
}

/**
 * High-performance async pool for parallel tasks with bounded concurrency
 */
export async function runAsyncPool(limit, items, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

/**
 * Safely find row number for an embedded ExcelJS image
 */
function getImageRowNumber(img) {
  if (!img || !img.range) return null;
  const r = img.range;
  if (r.tl && r.tl.nativeRow != null) return r.tl.nativeRow + 1;
  if (r.from && r.from.row != null) return r.from.row + 1;
  if (r.row != null) return r.row + 1;
  if (r.tl && r.tl.row != null) return r.tl.row + 1;
  return null;
}

/**
 * Primary Parse Engine using ExcelJS (with embedded image extraction)
 */
async function parseWithExcelJS(file, arrayBuffer, options) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0] || workbook.getWorksheet(1);
  if (!worksheet || worksheet.rowCount === 0) {
    throw new Error("Empty worksheet");
  }

  // 1. Scan first 10 rows to detect real header row
  let bestHeaderRow = 1;
  let bestScore = -1;
  let bestMapping = {};

  const scanLimit = Math.min(10, worksheet.rowCount);
  for (let r = 1; r <= scanLimit; r++) {
    const row = worksheet.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = extractExcelJsCellValue(cell);
    });

    const mapping = mapHeadersToFields(cells);
    const score = Object.keys(mapping).length;
    if (score > bestScore) {
      bestScore = score;
      bestHeaderRow = r;
      bestMapping = mapping;
    }
  }

  // Fallback: If no recognized headers, map positionally
  if (bestScore === 0) {
    bestHeaderRow = 1;
    bestMapping = {
      title: 0,
      desc: 1,
      price: 2,
      category: 3,
      subCategory: 4,
      brand: 5,
      model: 6,
    };
  }

  // 2. Safely collect embedded images
  const imageMap = {};
  try {
    const rawImages = typeof worksheet.getImages === "function" ? worksheet.getImages() : [];
    if (Array.isArray(rawImages)) {
      rawImages.forEach((img) => {
        const media = workbook.model?.media?.find((m) => m.index === img.imageId);
        if (media) imageMap[img.imageId] = media;
      });
    }
  } catch (imgErr) {
    console.warn(`[ExcelParser] Image catalog scan warning:`, imgErr);
  }

  const rowsWithImages = [];
  try {
    const rawImages = typeof worksheet.getImages === "function" ? worksheet.getImages() : [];
    for (let rowNumber = bestHeaderRow + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      const currentImage = rawImages.find((img) => getImageRowNumber(img) === rowNumber);
      if (currentImage) {
        const media = imageMap[currentImage.imageId];
        if (media && media.buffer) {
          rowsWithImages.push({
            rowNumber,
            buffer: media.buffer,
            extension: media.extension || "png",
          });
        }
      }
    }
  } catch (imgScanErr) {
    console.warn(`[ExcelParser] Row image matching warning:`, imgScanErr);
  }

  // 3. Upload embedded images if handler provided (bounded concurrency of 6)
  const uploadedImageMap = {};
  if (rowsWithImages.length > 0 && typeof options.onImageUpload === "function") {
    if (options.onLog) {
      options.onLog(
        `Uploading ${rowsWithImages.length} embedded image(s) for "${file.name}"...`,
        "image"
      );
    }
    await runAsyncPool(
      options.imageConcurrency || 6,
      rowsWithImages,
      async ({ rowNumber, buffer, extension }) => {
        try {
          const url = await options.onImageUpload({
            rowNumber,
            buffer,
            extension,
            fileName: file.name,
          });
          if (url) uploadedImageMap[rowNumber] = url;
        } catch (uploadErr) {
          console.warn(`Image upload skipped for row ${rowNumber}:`, uploadErr);
        }
      }
    );
  }

  // 4. Parse Products
  const products = [];
  for (let rowNumber = bestHeaderRow + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const getVal = (field) => {
      const colIdx = bestMapping[field];
      if (colIdx === undefined) return "";
      const cell = row.getCell(colIdx + 1);
      return extractExcelJsCellValue(cell);
    };

    const titleVal = getVal("title");
    const descVal = getVal("desc");
    const priceVal = getVal("price");
    const brandVal = getVal("brand");
    const modelVal = getVal("model");
    const categoryVal = getVal("category") || options.defaultCategory || "";
    const subCategoryVal = getVal("subCategory") || options.defaultSubCategory || "";
    const capacityVal = getVal("capacity");
    const throughputVal = getVal("throughput");
    const instrumentVal = getVal("instrument");
    const usageVal = getVal("usage");
    const parametersVal = getVal("parameters");
    const automationVal = getVal("automation");
    const availabilityVal = getVal("availability");
    const sizeVal = getVal("size");
    const videoVal = getVal("video");
    const pdfVal = getVal("pdf");

    // Check if row has any non-empty cell
    const allRowStrings = [];
    row.eachCell((c) => {
      const v = extractExcelJsCellValue(c);
      if (v) allRowStrings.push(v);
    });

    if (allRowStrings.length === 0) continue; // Completely empty row

    // Images from cell
    const rawImages = getVal("images");
    const cellImageUrls = rawImages
      ? rawImages
          .split(/[\r\n,]+/)
          .map((u) => u.trim())
          .filter((u) => /^https?:\/\//i.test(u) || u.startsWith("/uploads/"))
      : [];

    const embeddedImgUrl = uploadedImageMap[rowNumber];
    const finalImages = embeddedImgUrl
      ? [embeddedImgUrl, ...cellImageUrls]
      : cellImageUrls;

    // Guaranteed title
    const finalTitle =
      titleVal ||
      (modelVal ? `Model ${modelVal}` : "") ||
      (brandVal ? `${brandVal} Item` : "") ||
      allRowStrings[0] ||
      `Product Item ${rowNumber}`;

    products.push({
      id: crypto.randomUUID(),
      title: finalTitle,
      name: finalTitle,
      slug: slugify(finalTitle),
      price: priceVal,
      desc: descVal,
      description: descVal,
      capacity: capacityVal,
      throughput: throughputVal,
      instrument: instrumentVal,
      model: modelVal,
      usage: usageVal,
      brand: brandVal,
      parameters: parametersVal,
      automation: automationVal,
      availability: availabilityVal,
      size: sizeVal,
      category: categoryVal,
      subCategory: subCategoryVal,
      images: finalImages,
      originalImages: finalImages,
      video: videoVal,
      pdf: pdfVal,
      createdAt: new Date().toISOString(),
      isPublished: true,
      rowNumber,
    });
  }

  return { products, format: "exceljs", sheetName: worksheet.name };
}

/**
 * Secondary Universal Parse Engine using SheetJS (XLSX)
 * Bulletproof fallback for .xls, corrupted zip, or XML issues
 */
function parseWithSheetJS(file, arrayBuffer, options) {
  const wb = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("No worksheet found in file");

  const rawGrid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (!Array.isArray(rawGrid) || rawGrid.length === 0) {
    throw new Error("Empty spreadsheet");
  }

  // 1. Scan first 10 rows for header
  let bestHeaderRow = 0;
  let bestScore = -1;
  let bestMapping = {};

  const scanLimit = Math.min(10, rawGrid.length);
  for (let r = 0; r < scanLimit; r++) {
    const rowCells = (rawGrid[r] || []).map((c) => String(c == null ? "" : c).trim());
    const mapping = mapHeadersToFields(rowCells);
    const score = Object.keys(mapping).length;
    if (score > bestScore) {
      bestScore = score;
      bestHeaderRow = r;
      bestMapping = mapping;
    }
  }

  if (bestScore === 0) {
    bestHeaderRow = 0;
    bestMapping = {
      title: 0,
      desc: 1,
      price: 2,
      category: 3,
      subCategory: 4,
      brand: 5,
      model: 6,
    };
  }

  // 2. Parse Products
  const products = [];
  for (let r = bestHeaderRow + 1; r < rawGrid.length; r++) {
    const row = rawGrid[r] || [];
    const getVal = (field) => {
      const colIdx = bestMapping[field];
      if (colIdx === undefined) return "";
      const val = row[colIdx];
      return String(val == null ? "" : val).trim();
    };

    const titleVal = getVal("title");
    const descVal = getVal("desc");
    const priceVal = getVal("price");
    const brandVal = getVal("brand");
    const modelVal = getVal("model");
    const categoryVal = getVal("category") || options.defaultCategory || "";
    const subCategoryVal = getVal("subCategory") || options.defaultSubCategory || "";
    const capacityVal = getVal("capacity");
    const throughputVal = getVal("throughput");
    const instrumentVal = getVal("instrument");
    const usageVal = getVal("usage");
    const parametersVal = getVal("parameters");
    const automationVal = getVal("automation");
    const availabilityVal = getVal("availability");
    const sizeVal = getVal("size");
    const videoVal = getVal("video");
    const pdfVal = getVal("pdf");

    const nonBlank = row.filter((c) => String(c == null ? "" : c).trim() !== "");
    if (nonBlank.length === 0) continue;

    const rawImages = getVal("images");
    const cellImageUrls = rawImages
      ? rawImages
          .split(/[\r\n,]+/)
          .map((u) => u.trim())
          .filter((u) => /^https?:\/\//i.test(u) || u.startsWith("/uploads/"))
      : [];

    const finalTitle =
      titleVal ||
      (modelVal ? `Model ${modelVal}` : "") ||
      (brandVal ? `${brandVal} Item` : "") ||
      String(nonBlank[0] || "").trim() ||
      `Product Item ${r + 1}`;

    products.push({
      id: crypto.randomUUID(),
      title: finalTitle,
      name: finalTitle,
      slug: slugify(finalTitle),
      price: priceVal,
      desc: descVal,
      description: descVal,
      capacity: capacityVal,
      throughput: throughputVal,
      instrument: instrumentVal,
      model: modelVal,
      usage: usageVal,
      brand: brandVal,
      parameters: parametersVal,
      automation: automationVal,
      availability: availabilityVal,
      size: sizeVal,
      category: categoryVal,
      subCategory: subCategoryVal,
      images: cellImageUrls,
      originalImages: cellImageUrls,
      video: videoVal,
      pdf: pdfVal,
      createdAt: new Date().toISOString(),
      isPublished: true,
      rowNumber: r + 1,
    });
  }

  return { products, format: "sheetjs", sheetName };
}

/**
 * Universal Excel Parser Entry Point
 * Tries ExcelJS first; on any format/drawing issue, seamlessly falls back to SheetJS.
 */
export async function parseExcelFileUniversal(file, options = {}) {
  const arrayBuffer = await file.arrayBuffer();
  const isXls = /\.xls$/i.test(file.name) && !/\.xlsx$/i.test(file.name);

  // If it's a binary .xls file, directly use SheetJS (ExcelJS does not support BIFF8 .xls)
  if (isXls) {
    if (options.onLog) {
      options.onLog(`Parsing legacy .xls file "${file.name}" via SheetJS engine...`, "file");
    }
    return parseWithSheetJS(file, arrayBuffer, options);
  }

  // Otherwise, try ExcelJS first for full rich format & embedded images
  try {
    return await parseWithExcelJS(file, arrayBuffer, options);
  } catch (excelJsErr) {
    if (options.onLog) {
      options.onLog(
        `ExcelJS reader bypassed for "${file.name}" (${excelJsErr.message || "format issue"}). Activating SheetJS universal reader...`,
        "warning"
      );
    }
    return parseWithSheetJS(file, arrayBuffer, options);
  }
}
