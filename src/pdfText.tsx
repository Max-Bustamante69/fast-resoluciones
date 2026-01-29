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

/**
 * Extrae texto de un PDF con ordenamiento por posición
 * y filtrado de marcas de agua
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
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    // Extraer items con posición
    const items: Array<{ str: string; x: number; y: number }> = [];

    for (const item of content.items) {
      const textItem = item as TextItem;
      if (!textItem.str || textItem.str.trim() === "") continue;

      // transform[4] = x, transform[5] = y
      const x = textItem.transform[4];
      const y = pageHeight - textItem.transform[5]; // Invertir Y (PDF usa coordenadas desde abajo)

      // Filtrar marcas de agua comunes
      const text = textItem.str.trim();
      if (isWatermark(text)) continue;

      items.push({ str: text, x, y });
    }

    // Ordenar por posición: primero por Y (arriba→abajo), luego por X (izquierda→derecha)
    items.sort((a, b) => {
      const yDiff = a.y - b.y;
      // Si están en la misma línea (diferencia < 5px), ordenar por X
      if (Math.abs(yDiff) < 5) {
        return a.x - b.x;
      }
      return yDiff;
    });

    // Construir texto línea por línea
    let currentY = -1;
    let lineText = "";

    for (const item of items) {
      // Nueva línea si la diferencia en Y es > 10px
      if (currentY !== -1 && Math.abs(item.y - currentY) > 10) {
        fullText += lineText.trim() + "\n";
        lineText = "";
      }
      currentY = item.y;
      lineText += item.str + " ";
    }

    // Agregar última línea
    if (lineText.trim()) {
      fullText += lineText.trim() + "\n";
    }
  }

  return cleanExtractedText(fullText.trim());
}

/**
 * Detecta si un texto es parte de una marca de agua
 */
function isWatermark(text: string): boolean {
  const upper = text.toUpperCase();

  for (const pattern of WATERMARK_PATTERNS) {
    if (pattern.test(upper)) return true;
  }

  // Si es solo "CARDER" repetido o fragmentos
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
