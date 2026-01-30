// pdfText.ts - Extracción mejorada de texto de PDFs

interface TextItem {
  str: string;
  transform: number[];
}

// Caché para el módulo pdfjs
let pdfjsModule: typeof import("pdfjs-dist") | null = null;

async function getPdfjsLib() {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist");
    pdfjsModule.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjsModule;
}

// Pre-compiled regex for watermark detection
const WATERMARK_PATTERNS = [
  /^CARDER$/i,
  /^CA\s*R\s*D\s*E\s*R$/i,
  /^C\s*A\s*R\s*D\s*E\s*R$/i,
];
const MULTI_SPACE = /\s{3,}/g;
const MULTI_NEWLINE = /\n{3,}/g;
const CARDER_LINE = /^.*C\s*A\s*R\s*D\s*E\s*R.*$/gim;

// Pattern para encontrar sección RESUELVE (flexible - con o sin dos puntos)
// También acepta variantes OCR: RESUFLVE, RESUELV, etc.
const RESUELVE_PATTERN = /\bRES[UÚ][EF]LV[EF]?\s*:?/i;
const A_FAVOR_DE_PATTERN = /a\s+favor\s+de/i;

export type PageText = {
  pageNum: number;
  text: string;
};

export type ResuelveInfo = {
  found: boolean;
  pageNum: number | null;
  text: string;
  method: "embed" | "ocr" | null;
};

/**
 * Extrae texto de una página específica del PDF
 */
async function extractPageText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  pageNum: number,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const pageHeight = viewport.height;

  // Extraer items con posición
  const items: Array<{ str: string; x: number; y: number }> = [];

  for (const item of content.items) {
    const textItem = item as TextItem;
    if (!textItem.str || textItem.str.trim() === "") continue;

    const x = textItem.transform[4];
    const y = pageHeight - textItem.transform[5];

    const text = textItem.str.trim();
    if (isWatermark(text)) continue;

    items.push({ str: text, x, y });
  }

  // Ordenar por posición
  items.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < 5) {
      return a.x - b.x;
    }
    return yDiff;
  });

  // Construir texto
  let currentY = -1;
  let lineText = "";
  let fullText = "";

  for (const item of items) {
    if (currentY !== -1 && Math.abs(item.y - currentY) > 10) {
      fullText += lineText.trim() + "\n";
      lineText = "";
    }
    currentY = item.y;
    lineText += item.str + " ";
  }

  if (lineText.trim()) {
    fullText += lineText.trim() + "\n";
  }

  return cleanExtractedText(fullText.trim());
}

/**
 * Extrae texto de un PDF (mantiene compatibilidad)
 */
export async function extractTextFromPdf(
  file: File,
  maxPages: number = 1,
): Promise<string> {
  const pdfjsLib = await getPdfjsLib();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let fullText = "";
  const pagesToProcess = Math.min(maxPages, pdf.numPages);

  for (let i = 1; i <= pagesToProcess; i++) {
    const pageText = await extractPageText(pdf, i);
    fullText += pageText + "\n";
  }

  return fullText.trim();
}

/**
 * Extrae texto de TODAS las páginas del PDF
 * Retorna array con texto de cada página
 */
export async function extractAllPagesText(file: File): Promise<PageText[]> {
  const pdfjsLib = await getPdfjsLib();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const pages: PageText[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const text = await extractPageText(pdf, i);
    pages.push({ pageNum: i, text });
  }

  return pages;
}

/**
 * Extrae texto de una página específica
 */
export async function extractSinglePageText(
  file: File,
  pageNum: number,
): Promise<string> {
  const pdfjsLib = await getPdfjsLib();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  if (pageNum < 1 || pageNum > pdf.numPages) {
    return "";
  }

  return extractPageText(pdf, pageNum);
}

/**
 * Obtiene el número total de páginas del PDF
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjsLib = await getPdfjsLib();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  return pdf.numPages;
}

/**
 * Busca la sección RESUELVE en el texto embebido de todas las páginas
 * Retorna la página donde se encontró y el texto de esa página
 * PRIORIDAD:
 * 1. RESUELVE + "a favor de" (mejor caso)
 * 2. Solo RESUELVE
 * 3. Solo "a favor de" (fallback útil)
 */
export async function findResuelveInEmbed(file: File): Promise<ResuelveInfo> {
  const pages = await extractAllPagesText(file);

  // PRIORIDAD 1: Buscar RESUELVE + "a favor de" (mejor caso)
  for (const page of pages) {
    if (RESUELVE_PATTERN.test(page.text) && A_FAVOR_DE_PATTERN.test(page.text)) {
      return {
        found: true,
        pageNum: page.pageNum,
        text: page.text,
        method: "embed",
      };
    }
  }

  // PRIORIDAD 2: Solo RESUELVE
  for (const page of pages) {
    if (RESUELVE_PATTERN.test(page.text)) {
      return {
        found: true,
        pageNum: page.pageNum,
        text: page.text,
        method: "embed",
      };
    }
  }

  // PRIORIDAD 3: Solo "a favor de" (fallback - puede tener los datos)
  for (const page of pages) {
    if (A_FAVOR_DE_PATTERN.test(page.text)) {
      return {
        found: true, // Marcar como encontrado para hacer OCR en esta página
        pageNum: page.pageNum,
        text: page.text,
        method: "embed",
      };
    }
  }

  return {
    found: false,
    pageNum: null,
    text: "",
    method: null,
  };
}

/**
 * Detecta si un texto es parte de una marca de agua
 */
function isWatermark(text: string): boolean {
  const upper = text.toUpperCase();

  for (const pattern of WATERMARK_PATTERNS) {
    if (pattern.test(upper)) return true;
  }

  if (upper.replace(/\s/g, "") === "CARDER") return true;

  return false;
}

/**
 * Limpia el texto extraído
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(MULTI_SPACE, "  ")
    .replace(MULTI_NEWLINE, "\n\n")
    .replace(CARDER_LINE, "")
    .trim();
}
