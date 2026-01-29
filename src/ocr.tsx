// ocr.ts - OCR optimizado con filtrado de marcas de agua
import Tesseract from "tesseract.js";

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

  // Resolver todos los que estaban esperando
  while (workerQueue.length > 0) {
    const resolve = workerQueue.shift()!;
    resolve(worker);
  }

  return worker;
}

// Pre-compiled regex for text cleaning (optimization)
const CARDER_LINE = /^.*C\s*A\s*R\s*D\s*E\s*R.*$/gim;
const CARDER_WORD = /\bCARDER\b/gi;
const CARDER_SPACED = /\bCA\s*RD\s*ER\b/gi;
const OCR_NOISE = /[|¡¿]/g;
const MULTI_SPACE = /\s{3,}/g;
const MULTI_NEWLINE = /\n{3,}/g;

/**
 * Preprocesamiento de imagen optimizado para eliminar marcas de agua
 * Usa TypedArray para mejor rendimiento
 */
function preprocessImage(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  // Procesar en un solo loop optimizado
  for (let i = 0; i < len; i += 4) {
    // Grayscale usando enteros (más rápido que floats)
    const gray = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;

    // Binarización con umbrales optimizados
    const val = gray > 170 ? 255 : gray < 90 ? 0 : gray > 130 ? 255 : 0;

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    // Alpha (data[i + 3]) se mantiene
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Limpia el texto OCR de fragmentos de marca de agua
 */
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

/**
 * OCR de PDF optimizado
 * - Worker reutilizable
 * - Scale 2.5 (balance velocidad/calidad)
 * - JPEG para menor tamaño de datos
 * - Preprocessing inline
 */
export async function ocrPdfWithTesseract(
  file: File,
  maxPages: number = 1,
): Promise<string> {
  // Cargar pdfjs una sola vez
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist");
    pdfjsModule.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  const pdf = await pdfjsModule.getDocument({ data: await file.arrayBuffer() })
    .promise;

  const worker = await getWorker();
  const pagesToProcess = Math.min(maxPages, pdf.numPages);

  let text = "";

  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);

    // Scale 2.5 - buen balance velocidad/calidad
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Fondo blanco
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Renderizar PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport } as any).promise;

    // Preprocesar para eliminar marca de agua (inline para evitar crear nuevo canvas)
    preprocessImage(canvas);

    // OCR - usar JPEG para menor tamaño (más rápido transfer al worker)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const { data } = await worker.recognize(dataUrl);
    text += data.text + "\n";

    // Limpiar memoria inmediatamente
    canvas.width = 0;
    canvas.height = 0;
  }

  return cleanOcrText(text);
}

// Limpiar worker al cerrar la página
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    workerInstance?.terminate();
    workerInstance = null;
  });
}
