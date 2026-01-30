// ocr.ts - OCR optimizado con filtrado de marcas de agua
import Tesseract from "tesseract.js";
import type { ResuelveInfo } from "./pdfText";

// Worker reutilizable (singleton)
let workerInstance: Tesseract.Worker | null = null;
let workerInitializing = false;
const workerQueue: Array<(worker: Tesseract.Worker) => void> = [];

async function getWorker(): Promise<Tesseract.Worker> {
  if (workerInstance) {
    return workerInstance;
  }

  if (workerInitializing) {
    return new Promise((resolve) => {
      workerQueue.push(resolve);
    });
  }

  workerInitializing = true;

  const worker = await Tesseract.createWorker("spa", 1, {
    logger: () => {},
  });

  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    preserve_interword_spaces: "1",
  });

  workerInstance = worker;
  workerInitializing = false;

  while (workerQueue.length > 0) {
    const resolve = workerQueue.shift()!;
    resolve(worker);
  }

  return worker;
}

// Pre-compiled regex
const CARDER_LINE = /^.*C\s*A\s*R\s*D\s*E\s*R.*$/gim;
const CARDER_WORD = /\bCARDER\b/gi;
const CARDER_SPACED = /\bCA\s*RD\s*ER\b/gi;
const OCR_NOISE = /[|¡¿]/g;
const MULTI_SPACE = /\s{3,}/g;
const MULTI_NEWLINE = /\n{3,}/g;

// Pattern para encontrar sección RESUELVE
const RESUELVE_PATTERN = /\bRESUELVE\s*:/i;
const A_FAVOR_DE_PATTERN = /a\s+favor\s+de/i;

function preprocessImage(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const gray = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    const val = gray > 170 ? 255 : gray < 90 ? 0 : gray > 130 ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
}

function cleanOcrText(text: string): string {
  return text
    .replace(CARDER_LINE, "")
    .replace(CARDER_WORD, "")
    .replace(CARDER_SPACED, "")
    .replace(OCR_NOISE, "")
    .replace(MULTI_SPACE, " ")
    .replace(MULTI_NEWLINE, "\n\n")
    .trim();
}

// Caché para el módulo pdfjs
let pdfjsModule: typeof import("pdfjs-dist") | null = null;

async function getPdfjsModule() {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist");
    pdfjsModule.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjsModule;
}

/**
 * OCR de una página específica del PDF
 */
export async function ocrSinglePage(
  file: File,
  pageNum: number,
): Promise<string> {
  const pdfjs = await getPdfjsModule();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;

  if (pageNum < 1 || pageNum > pdf.numPages) {
    return "";
  }

  const worker = await getWorker();
  const page = await pdf.getPage(pageNum);

  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport } as any).promise;

  preprocessImage(canvas);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const { data } = await worker.recognize(dataUrl);

  canvas.width = 0;
  canvas.height = 0;

  return cleanOcrText(data.text);
}

/**
 * OCR de PDF (mantiene compatibilidad)
 */
export async function ocrPdfWithTesseract(
  file: File,
  maxPages: number = 1,
): Promise<string> {
  const pdfjs = await getPdfjsModule();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;

  const worker = await getWorker();
  const pagesToProcess = Math.min(maxPages, pdf.numPages);

  let text = "";

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);

    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport } as any).promise;

    preprocessImage(canvas);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const { data } = await worker.recognize(dataUrl);
    text += data.text + "\n";

    canvas.width = 0;
    canvas.height = 0;
  }

  return cleanOcrText(text);
}

/**
 * Busca la sección RESUELVE usando OCR, página por página
 * Retorna información sobre dónde se encontró
 */
export async function findResuelveWithOcr(file: File): Promise<ResuelveInfo> {
  const pdfjs = await getPdfjsModule();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;

  const worker = await getWorker();

  // Buscar desde la página 1 hasta encontrar RESUELVE
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport } as any).promise;

    preprocessImage(canvas);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const { data } = await worker.recognize(dataUrl);
    const text = cleanOcrText(data.text);

    canvas.width = 0;
    canvas.height = 0;

    // Verificar si esta página tiene RESUELVE y "a favor de"
    if (RESUELVE_PATTERN.test(text) && A_FAVOR_DE_PATTERN.test(text)) {
      return {
        found: true,
        pageNum: i,
        text: text,
        method: "ocr",
      };
    }

    // Si solo tiene RESUELVE, guardar pero seguir buscando
    if (RESUELVE_PATTERN.test(text)) {
      // Podría ser que "a favor de" esté en la siguiente página
      // Hacer OCR de la siguiente página también
      if (i < pdf.numPages) {
        const nextPage = await pdf.getPage(i + 1);
        const nextViewport = nextPage.getViewport({ scale: 2.5 });
        const nextCanvas = document.createElement("canvas");
        const nextCtx = nextCanvas.getContext("2d", {
          willReadFrequently: true,
        })!;
        nextCanvas.width = nextViewport.width;
        nextCanvas.height = nextViewport.height;

        nextCtx.fillStyle = "white";
        nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await nextPage.render({ canvasContext: nextCtx, viewport: nextViewport } as any).promise;

        preprocessImage(nextCanvas);

        const nextDataUrl = nextCanvas.toDataURL("image/jpeg", 0.92);
        const nextResult = await worker.recognize(nextDataUrl);
        const nextText = cleanOcrText(nextResult.data.text);

        nextCanvas.width = 0;
        nextCanvas.height = 0;

        // Combinar texto de ambas páginas
        const combinedText = text + "\n" + nextText;

        if (A_FAVOR_DE_PATTERN.test(combinedText)) {
          return {
            found: true,
            pageNum: i, // Página donde empieza RESUELVE
            text: combinedText,
            method: "ocr",
          };
        }
      }

      // Si no encontramos "a favor de", retornar solo con RESUELVE
      return {
        found: true,
        pageNum: i,
        text: text,
        method: "ocr",
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
 * Obtiene el número total de páginas del PDF
 */
export async function getOcrPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfjsModule();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;
  return pdf.numPages;
}

// Limpiar worker al cerrar la página
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    workerInstance?.terminate();
    workerInstance = null;
  });
}
