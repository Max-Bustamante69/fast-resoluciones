import { useState, useCallback, useRef, type DragEvent } from "react";
import * as XLSX from "xlsx";
import {
  readWorkbook,
  sheetToJson,
  writeRows,
  downloadWorkbook,
} from "./excel";
import { extractTextFromPdf } from "./pdfText";
import { ocrPdfWithTesseract } from "./ocr";
import { extractUserId } from "./extract";

type LogEntry = {
  message: string;
  type: "info" | "success" | "error" | "warning" | "review" | "partial";
  details?: {
    fileName?: string;
    fileUrl?: string; // URL blob para abrir el archivo
    reason?: string;
    extractedText?: string;
    ocrText?: string; // Texto extraído con OCR
    embedText?: string; // Texto extraído con EMBED
    searchedFor?: string;
    availableFiles?: string[];
  };
};

const RES_COL = "Resolución";
const USER_COL = "Usuario";
const ID_COL = "Identificacion";

// ============ Log Entry Component with Expandable Details ============
function LogEntryItem({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <div
      className={`log-entry ${entry.type} ${hasDetails ? "has-details" : ""}`}
    >
      <div
        className="log-entry-main"
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <span className="log-entry-message">{entry.message}</span>
        {hasDetails && (
          <button className="log-entry-toggle" aria-label="Ver detalles">
            {expanded ? "▼" : "▶"}
          </button>
        )}
      </div>
      {expanded && entry.details && (
        <div className="log-entry-details">
          {entry.details.reason && (
            <div className="detail-item">
              <span className="detail-label">Razón:</span>
              <span className="detail-value">{entry.details.reason}</span>
            </div>
          )}
          {entry.details.fileName && (
            <div className="detail-item">
              <span className="detail-label">Archivo:</span>
              <span className="detail-value">
                {entry.details.fileName}
                {entry.details.fileUrl && (
                  <a
                    href={entry.details.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Abrir PDF
                  </a>
                )}
              </span>
            </div>
          )}
          {entry.details.searchedFor && (
            <div className="detail-item">
              <span className="detail-label">Buscado en PDFs:</span>
              <span className="detail-value">{entry.details.searchedFor}</span>
            </div>
          )}
          {entry.details.availableFiles &&
            entry.details.availableFiles.length > 0 && (
              <div className="detail-item">
                <span className="detail-label">
                  PDFs similares disponibles:
                </span>
                <span className="detail-value">
                  {entry.details.availableFiles.slice(0, 5).join(", ")}
                  {entry.details.availableFiles.length > 5 &&
                    ` ... y ${entry.details.availableFiles.length - 5} más`}
                </span>
              </div>
            )}
          {entry.details.ocrText && (
            <div className="detail-item detail-text">
              <span className="detail-label">📷 Texto OCR:</span>
              <pre className="detail-pre">{entry.details.ocrText}</pre>
            </div>
          )}
          {entry.details.embedText && (
            <div className="detail-item detail-text">
              <span className="detail-label">📄 Texto EMBED:</span>
              <pre className="detail-pre">{entry.details.embedText}</pre>
            </div>
          )}
          {entry.details.extractedText &&
            !entry.details.ocrText &&
            !entry.details.embedText && (
              <div className="detail-item detail-text">
                <span className="detail-label">Texto extraído:</span>
                <pre className="detail-pre">{entry.details.extractedText}</pre>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ============ Drop Zone Component ============
interface DropZoneProps {
  onFiles: (files: FileList | null) => void;
  accept: string;
  multiple?: boolean;
  icon: string;
  title: string;
  hint: string;
  files: File | FileList | null;
}

function DropZone({
  onFiles,
  accept,
  multiple,
  icon,
  title,
  hint,
  files,
}: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        onFiles(e.dataTransfer.files);
      }
    },
    [onFiles],
  );

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    // Resetear el input para permitir seleccionar los mismos archivos de nuevo
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const hasFiles =
    files !== null && (files instanceof FileList ? files.length > 0 : true);
  const fileCount = files instanceof FileList ? files.length : files ? 1 : 0;
  const fileName =
    files instanceof FileList
      ? files.length === 1
        ? files[0].name
        : `${files.length} archivos`
      : files?.name || "";

  return (
    <div
      className={`drop-zone ${dragOver ? "drag-over" : ""} ${hasFiles ? "has-file" : ""}`}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <div className="drop-zone-icon">{icon}</div>
      <p className="drop-zone-title">{title}</p>
      <p className="drop-zone-hint">{hint}</p>
      {hasFiles && (
        <div className="drop-zone-file">
          <span className="drop-zone-file-name">{fileName}</span>
          {fileCount > 1 && (
            <span className="drop-zone-file-count">seleccionados</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Main App ============
export default function App() {
  const [tab, setTab] = useState<"main" | "test" | "verify">("main");
  const [excel, setExcel] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]); // Array para poder manipular
  const [log, setLog] = useState<LogEntry[]>([]);

  // Verification mode state
  const [verifyExcel, setVerifyExcel] = useState<File | null>(null);
  const [verifyPdfs, setVerifyPdfs] = useState<File[]>([]);
  const [verifyLog, setVerifyLog] = useState<LogEntry[]>([]);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState({
    current: 0,
    total: 0,
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Test mode state
  const [testPdf, setTestPdf] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<{
    name?: string;
    id?: string;
    error?: string;
    extractedText?: string;
    ocrText?: string;
    embedText?: string;
    needsReview?: boolean;
    source?: string; // "OCR" o "texto embebido"
  } | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const pushLog = (
    message: string,
    type: LogEntry["type"] = "info",
    details?: LogEntry["details"],
  ) => setLog((l) => [...l, { message, type, details }]);

  const clearLog = () => setLog([]);

  // ============ Funciones para manejar PDFs ============
  // Agregar PDFs (combinando con existentes, solo RS-)
  const addPdfFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const filesToAdd = Array.from(newFiles).filter((file) => {
      const baseName = file.name.replace(/\.pdf$/i, "").toUpperCase();
      return baseName.startsWith("RS-");
    });

    if (filesToAdd.length === 0) {
      alert("Solo se aceptan archivos que empiezan con 'RS-'");
      return;
    }

    setPdfFiles((prev) => {
      // Evitar duplicados por nombre
      const existingNames = new Set(prev.map((f) => f.name));
      const uniqueNew = filesToAdd.filter((f) => !existingNames.has(f.name));
      return [...prev, ...uniqueNew];
    });
  };

  // Eliminar un PDF específico
  const removePdfFile = (fileName: string) => {
    setPdfFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  // Limpiar todos los PDFs
  const clearPdfFiles = () => {
    setPdfFiles([]);
  };

  // ============ Verification Mode Functions ============
  const addVerifyPdfs = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const filesToAdd = Array.from(newFiles).filter((file) => {
      const baseName = file.name.replace(/\.pdf$/i, "").toUpperCase();
      return baseName.startsWith("RS-");
    });
    if (filesToAdd.length === 0) {
      alert("Solo se aceptan archivos que empiezan con 'RS-'");
      return;
    }
    setVerifyPdfs((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const uniqueNew = filesToAdd.filter((f) => !existingNames.has(f.name));
      return [...prev, ...uniqueNew];
    });
  };

  const removeVerifyPdf = (fileName: string) => {
    setVerifyPdfs((prev) => prev.filter((f) => f.name !== fileName));
  };

  const clearVerifyPdfs = () => {
    setVerifyPdfs([]);
  };

  const pushVerifyLog = (
    message: string,
    type: LogEntry["type"],
    details?: LogEntry["details"],
  ) => {
    setVerifyLog((prev) => [...prev, { message, type, details }]);
  };

  const clearVerifyLog = () => {
    setVerifyLog([]);
  };

  // ============ Verification Processing ============
  const handleVerify = async () => {
    if (!verifyExcel || verifyPdfs.length === 0) return;
    setVerifyBusy(true);
    clearVerifyLog();

    try {
      const wb = await readWorkbook(verifyExcel);
      const { data: rows } = sheetToJson(wb);

      // Crear índice de PDFs
      const pdfIndex: Record<string, File> = {};
      for (const file of verifyPdfs) {
        const baseName = file.name.replace(/\.pdf$/i, "").toUpperCase();
        if (baseName.startsWith("RS-")) {
          pdfIndex[baseName] = file;
        }
      }

      // Filtrar filas COMPLETAS (las que queremos verificar)
      const completeRows = rows
        .map((r, i) => ({
          row: r,
          index: i,
          key: String(r[RES_COL] ?? "").trim(),
          existingUser: String(r[USER_COL] ?? "").trim(),
          existingId: String(r[ID_COL] ?? "").trim(),
        }))
        .filter(
          (item) =>
            item.key.length > 0 &&
            item.existingUser.length > 0 &&
            item.existingId.length > 0 &&
            !item.existingUser.includes("ERROR"),
        );

      pushVerifyLog(
        `Verificando ${completeRows.length} filas completas...`,
        "info",
      );
      setVerifyProgress({ current: 0, total: completeRows.length });

      let matches = 0;
      let mismatches = 0;
      let notFound = 0;

      for (let i = 0; i < completeRows.length; i++) {
        const { key, existingUser, existingId } = completeRows[i];
        setVerifyProgress({ current: i + 1, total: completeRows.length });

        // Extraer solo dígitos y pad a 4 dígitos
        const resNum = key.replace(/[^\d]/g, "");
        const paddedNum = resNum.padStart(4, "0");
        const searchKey = `RS-${paddedNum}`;
        const pdfNames = Object.keys(pdfIndex);

        // Buscar PDF
        let matchedFile: File | null = null;

        // 1. Buscar por prefijo RS-XXXX-
        for (const pdfName of pdfNames) {
          if (pdfName.startsWith(searchKey + "-") || pdfName === searchKey) {
            matchedFile = pdfIndex[pdfName];
            break;
          }
        }

        // 2. Fallback sin padding
        if (!matchedFile) {
          const keyUpper = `RS-${resNum}`.toUpperCase();
          for (const pdfName of pdfNames) {
            if (pdfName.startsWith(keyUpper + "-") || pdfName === keyUpper) {
              matchedFile = pdfIndex[pdfName];
              break;
            }
          }
        }

        if (!matchedFile) {
          notFound++;
          pushVerifyLog(`Sin PDF: ${key} (buscado: ${searchKey})`, "warning", {
            reason: "No se encontró el archivo PDF para verificar.",
          });
          continue;
        }

        // Extraer datos del PDF
        let text = "";
        try {
          text = await extractTextFromPdf(matchedFile);
        } catch {
          text = "";
        }

        let data = extractUserId(text);

        if (!data.Usuario || !data.Identificacion) {
          try {
            const ocrText = await ocrPdfWithTesseract(matchedFile);
            text = ocrText;
            data = extractUserId(ocrText);
          } catch {
            // Mantener texto embebido
          }
        }

        // Comparar con Excel - limpiar para comparación
        const cleanExistingUser = existingUser
          .replace(/\s*\[REVISAR\]\s*/gi, "")
          .trim()
          .toUpperCase();
        const cleanExistingId = existingId.replace(/[^\d]/g, "");
        const extractedUser = (data.Usuario || "").toUpperCase();
        const extractedId = (data.Identificacion || "").replace(/[^\d]/g, "");

        const userMatch = cleanExistingUser === extractedUser;
        const idMatch = cleanExistingId === extractedId;

        if (userMatch && idMatch) {
          matches++;
          pushVerifyLog(
            `✓ ${key}: Coincide - ${existingUser} - ${existingId}`,
            "success",
          );
        } else {
          mismatches++;
          const diffs: string[] = [];
          if (!userMatch) {
            diffs.push(
              `Usuario: Excel="${existingUser}" vs PDF="${data.Usuario || "NO ENCONTRADO"}"`,
            );
          }
          if (!idMatch) {
            diffs.push(
              `ID: Excel="${existingId}" vs PDF="${data.Identificacion || "NO ENCONTRADO"}"`,
            );
          }
          pushVerifyLog(`⚠ ${key}: DIFERENCIAS`, "error", {
            fileName: matchedFile.name,
            fileUrl: URL.createObjectURL(matchedFile),
            reason: diffs.join(" | "),
            extractedText: text,
          });
        }
      }

      pushVerifyLog(
        `Verificación completada: ${matches} coinciden, ${mismatches} difieren, ${notFound} sin PDF`,
        mismatches === 0 ? "success" : "warning",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      pushVerifyLog(`Error: ${msg}`, "error");
    } finally {
      setVerifyBusy(false);
      setVerifyProgress({ current: 0, total: 0 });
    }
  };

  // ============ Main Processing ============
  // Iterar sobre Excel y buscar PDFs correspondientes (SOLO RS-)
  const handleProcess = async () => {
    if (!excel || pdfFiles.length === 0) return;
    setBusy(true);
    clearLog();

    try {
      const wb = await readWorkbook(excel);
      const { data: rows, name: sheetName } = sheetToJson(wb);

      // Crear índice de PDFs: nombre (sin extensión, uppercase) -> File
      // SOLO archivos RS- (ya filtrados al agregar)
      const pdfIndex: Record<string, File> = {};
      const rsNames: string[] = [];

      for (const file of pdfFiles) {
        const baseName = file.name.replace(/\.pdf$/i, "").toUpperCase();
        // Solo procesar archivos RS-
        if (baseName.startsWith("RS-")) {
          pdfIndex[baseName] = file;
          rsNames.push(baseName);
        }
      }

      // Preparar columnas si no existen
      rows.forEach((r) => {
        if (!(USER_COL in r)) r[USER_COL] = "";
        if (!(ID_COL in r)) r[ID_COL] = "";
      });

      // Filtrar filas que tienen valor en Resolución Y que NO están completas
      const allRows = rows
        .map((r, i) => ({
          row: r,
          index: i,
          key: String(r[RES_COL] ?? "").trim(),
          isComplete:
            String(r[USER_COL] ?? "").trim().length > 0 &&
            String(r[ID_COL] ?? "").trim().length > 0 &&
            !String(r[USER_COL] ?? "").includes("ERROR"),
        }))
        .filter((item) => item.key.length > 0);

      // Contar filas ya completas (ignoradas)
      const skippedRows = allRows.filter((item) => item.isComplete);
      const rowsToProcess = allRows.filter((item) => !item.isComplete);

      if (skippedRows.length > 0) {
        pushLog(`Ignorando ${skippedRows.length} filas ya completas`, "info");
      }

      setProgress({ current: 0, total: rowsToProcess.length });

      let filled = 0;
      let notFound = 0;
      let errors = 0;
      let reviews = 0;
      let partials = 0;

      // Collect ALL results for the full report
      type ResultReport = {
        type:
          | "SUCCESS"
          | "REVIEW"
          | "PARTIAL"
          | "ERROR"
          | "NO_FILE"
          | "OCR_FAIL";
        resolution: string;
        fileName?: string;
        reason?: string;
        foundName?: string;
        foundId?: string;
        extractedText?: string;
        source?: string; // "OCR" or "texto embebido"
      };
      const allReports: ResultReport[] = [];

      for (let i = 0; i < rowsToProcess.length; i++) {
        const { row, key } = rowsToProcess[i];
        setProgress({ current: i + 1, total: rowsToProcess.length });

        // Extraer solo dígitos del número de resolución
        const resNum = key.replace(/[^\d]/g, "");
        // Pad a 4 dígitos (ej: "97" -> "0097", "1234" -> "1234")
        const paddedNum = resNum.padStart(4, "0");
        const searchKey = `RS-${paddedNum}`;

        // Buscar PDF correspondiente (SOLO en archivos RS-)
        let matchedFile: File | null = null;

        // 1. Buscar por prefijo RS-XXXX (ej: RS-0097-)
        for (const pdfName of rsNames) {
          if (pdfName.startsWith(searchKey + "-") || pdfName === searchKey) {
            matchedFile = pdfIndex[pdfName];
            break;
          }
        }

        // 2. Fallback: buscar sin padding por compatibilidad
        if (!matchedFile) {
          const keyUpper = `RS-${resNum}`.toUpperCase();
          for (const pdfName of rsNames) {
            if (pdfName.startsWith(keyUpper + "-") || pdfName === keyUpper) {
              matchedFile = pdfIndex[pdfName];
              break;
            }
          }
        }

        if (!matchedFile) {
          // No se encontró el PDF para esta fila
          row[USER_COL] = "ERROR - Sin archivo";
          row[ID_COL] = "ERROR - Sin archivo";
          notFound++;

          // Buscar nombres similares para ayudar al debug
          const similarFiles = rsNames.filter((name) => {
            return (
              name.includes(paddedNum) ||
              name.includes(resNum) ||
              name.startsWith(searchKey)
            );
          });

          pushLog(`Sin PDF: ${key} (buscado: ${searchKey})`, "warning", {
            searchedFor: searchKey,
            reason: `No se encontró archivo ${searchKey}-*.pdf`,
            availableFiles:
              similarFiles.length > 0 ? similarFiles : rsNames.slice(0, 10),
          });

          allReports.push({
            type: "NO_FILE",
            resolution: key,
            reason: `No se encontró archivo ${searchKey}-*.pdf`,
          });
          continue;
        }

        // Procesar el PDF encontrado
        // PRIORIDAD: OCR primero, EMBED como refuerzo
        let embedText = "";
        let ocrText = "";
        let finalSource = "";
        let usedEmbed = false; // Para marcar si se usó EMBED (siempre warning)

        // PASO 1: Intentar OCR PRIMERO (prioridad)
        try {
          ocrText = await ocrPdfWithTesseract(matchedFile);
        } catch (e) {
          const ocrError = e instanceof Error ? e.message : "Error en OCR";
          ocrText = "";
          pushLog(`OCR falló para ${key}, intentando EMBED...`, "info", {
            reason: ocrError,
          });
        }

        // PASO 2: Extraer datos del OCR
        const ocrData = extractUserId(ocrText);
        const finalData = { ...ocrData };
        let displayText = ocrText;

        // PASO 3: Si OCR no encontró todo, usar EMBED como refuerzo
        if (!ocrData.Usuario || !ocrData.Identificacion) {
          try {
            embedText = await extractTextFromPdf(matchedFile);
            const embedData = extractUserId(embedText);

            // Usar EMBED solo para completar lo que falta
            if (!finalData.Usuario && embedData.Usuario) {
              finalData.Usuario = embedData.Usuario;
              usedEmbed = true;
            }
            if (!finalData.Identificacion && embedData.Identificacion) {
              finalData.Identificacion = embedData.Identificacion;
              usedEmbed = true;
            }

            // Si no había texto OCR, usar embed como display
            if (!displayText) {
              displayText = embedText;
            }
          } catch {
            embedText = "";
          }
        }

        // Determinar fuente final
        if (finalData.Usuario || finalData.Identificacion) {
          if (usedEmbed && ocrText) {
            finalSource = "OCR+EMBED";
          } else if (usedEmbed) {
            finalSource = "EMBED";
          } else {
            finalSource = "OCR";
          }
        }

        // PASO 4: Procesar resultados
        // Si se usó EMBED en cualquier parte, SIEMPRE es warning
        if (finalData.Usuario && finalData.Identificacion) {
          // Ambos encontrados
          const needsReview = usedEmbed || finalData.needsReview;

          if (needsReview) {
            row[USER_COL] = `${finalData.Usuario} [${finalSource}]`;
            row[ID_COL] = finalData.Identificacion;
            reviews++;
            pushLog(
              `${key} → ${finalData.Usuario} - ${finalData.Identificacion} [${finalSource}]`,
              "review",
              {
                fileName: matchedFile.name,
                fileUrl: URL.createObjectURL(matchedFile),
                reason: usedEmbed
                  ? `Se usó EMBED (poco confiable). Fuente: ${finalSource}`
                  : `Baja confianza. Fuente: ${finalSource}`,
                extractedText: displayText,
              },
            );

            allReports.push({
              type: "REVIEW",
              resolution: key,
              fileName: matchedFile.name,
              foundName: finalData.Usuario,
              foundId: finalData.Identificacion,
              reason: usedEmbed
                ? `Se usó EMBED (poco confiable). Fuente: ${finalSource}`
                : `Baja confianza. Fuente: ${finalSource}`,
              source: finalSource,
              extractedText: displayText,
            });
          } else {
            // Encontrado solo con OCR y alta confianza - SUCCESS
            row[USER_COL] = `${finalData.Usuario} [${finalSource}]`;
            row[ID_COL] = finalData.Identificacion;
            filled++;
            pushLog(
              `${key} → ${finalData.Usuario} - ${finalData.Identificacion} [${finalSource}]`,
              "success",
              {
                fileName: matchedFile.name,
                fileUrl: URL.createObjectURL(matchedFile),
              },
            );

            allReports.push({
              type: "SUCCESS",
              resolution: key,
              fileName: matchedFile.name,
              foundName: finalData.Usuario,
              foundId: finalData.Identificacion,
              source: finalSource,
            });
          }
        } else if (finalData.Usuario || finalData.Identificacion) {
          // PARCIAL: Solo se encontró uno de los dos
          partials++;
          row[USER_COL] = finalData.Usuario
            ? `${finalData.Usuario} [${finalSource}]`
            : "ERROR - No encontrado";
          row[ID_COL] = finalData.Identificacion || "ERROR - No encontrado";

          const found = finalData.Usuario
            ? `Usuario: ${finalData.Usuario}`
            : `ID: ${finalData.Identificacion}`;
          const missing = finalData.Usuario ? "Identificación" : "Usuario";

          pushLog(`${key} → ${found} [PARCIAL - ${finalSource}]`, "partial", {
            fileName: matchedFile.name,
            fileUrl: URL.createObjectURL(matchedFile),
            reason: `Solo se encontró ${finalData.Usuario ? "el nombre" : "la cédula"}. Falta: ${missing}. Se probó OCR y EMBED.`,
            ocrText: ocrText || "(OCR no extrajo texto)",
            embedText: embedText || "(EMBED no extrajo texto)",
          });

          allReports.push({
            type: "PARTIAL",
            resolution: key,
            fileName: matchedFile.name,
            reason: `Solo se encontró ${finalData.Usuario ? "el nombre" : "la cédula"}. Falta: ${missing}. Se probó OCR y EMBED.`,
            foundName: finalData.Usuario,
            foundId: finalData.Identificacion,
            source: finalSource || "OCR+EMBED",
            extractedText: `=== TEXTO OCR ===\n${ocrText || "(vacío)"}\n\n=== TEXTO EMBED ===\n${embedText || "(vacío)"}`,
          });
        } else {
          // Ninguno encontrado (se probaron ambos métodos)
          row[USER_COL] = "ERROR [OCR+EMBED]";
          row[ID_COL] = "ERROR";
          errors++;

          // Usar el texto más largo para mostrar
          const allText = ocrText || embedText;
          let reason = "No se encontró el patrón esperado en el texto.";
          if (!allText || allText.length === 0) {
            reason = "No se pudo extraer ningún texto del PDF.";
          } else if (allText.length < 100) {
            reason = `Solo se extrajeron ${allText.length} caracteres.`;
          } else {
            const lower = allText.toLowerCase();
            const hasSenor = /se[ñn]or|senor|snor|sñor|senores/i.test(lower);
            const hasIdentificado = /identificad/i.test(lower);
            const hasCedula = /c[eé]dula|cedula/i.test(lower);

            if (!hasSenor && !hasIdentificado) {
              reason = "No se encontró 'señor/a' ni 'identificado/a'.";
            } else if (!hasCedula) {
              reason = "No se encontró 'cédula' en el texto.";
            } else {
              reason =
                "Se encontraron palabras clave pero no el patrón completo.";
            }
          }

          pushLog(`Error: ${key} [OCR+EMBED]`, "error", {
            fileName: matchedFile.name,
            fileUrl: URL.createObjectURL(matchedFile),
            reason: reason + " (Se probó OCR y EMBED)",
            ocrText: ocrText || "(OCR no extrajo texto)",
            embedText: embedText || "(EMBED no extrajo texto)",
          });

          allReports.push({
            type: "ERROR",
            resolution: key,
            fileName: matchedFile.name,
            reason: reason + " (Se probó OCR y EMBED)",
            source: "OCR+EMBED",
            extractedText: `=== TEXTO OCR ===\n${ocrText || "(vacío)"}\n\n=== TEXTO EMBED ===\n${embedText || "(vacío)"}`,
          });
        }
      }

      writeRows(wb, sheetName, rows);
      downloadWorkbook(wb, "resultado.xlsx");

      // Generate and download FULL report TXT (always)
      const reportLines: string[] = [
        "=".repeat(80),
        "REPORTE COMPLETO - FAST RESOLUCIONES",
        "=".repeat(80),
        `Fecha: ${new Date().toLocaleString()}`,
        `Archivo Excel: ${excel.name}`,
        `Total PDFs cargados: ${pdfFiles.length}`,
        "",
        "=".repeat(80),
        "RESUMEN",
        "=".repeat(80),
        `Total filas procesadas: ${rowsToProcess.length}`,
        `Filas ignoradas (ya completas): ${skippedRows.length}`,
        "",
        `✓ EXITOSOS (alta confianza): ${filled}`,
        `⚠ A REVISAR (baja confianza): ${reviews}`,
        `◐ PARCIALES (solo nombre o ID): ${partials}`,
        `✗ ERRORES (nada encontrado): ${errors}`,
        `? SIN ARCHIVO PDF: ${notFound}`,
        "",
        `Tasa de éxito: ${rowsToProcess.length > 0 ? ((filled / rowsToProcess.length) * 100).toFixed(1) : 0}%`,
        `Tasa con datos: ${rowsToProcess.length > 0 ? (((filled + reviews + partials) / rowsToProcess.length) * 100).toFixed(1) : 0}%`,
        "",
      ];

      // Group reports by type
      const successReports = allReports.filter((r) => r.type === "SUCCESS");
      const reviewReports = allReports.filter((r) => r.type === "REVIEW");
      const partialReports = allReports.filter((r) => r.type === "PARTIAL");
      const errorOnlyReports = allReports.filter(
        (r) => r.type === "ERROR" || r.type === "OCR_FAIL",
      );
      const noFileReports = allReports.filter((r) => r.type === "NO_FILE");

      // SUCCESS SECTION
      if (successReports.length > 0) {
        reportLines.push("=".repeat(80));
        reportLines.push(`✓ EXITOSOS (${successReports.length})`);
        reportLines.push("=".repeat(80));
        for (const report of successReports) {
          reportLines.push(
            `${report.resolution} → ${report.foundName} - ${report.foundId}`,
          );
        }
        reportLines.push("");
      }

      // REVIEW SECTION (concise format)
      if (reviewReports.length > 0) {
        reportLines.push("=".repeat(80));
        reportLines.push(`⚠ A REVISAR (${reviewReports.length})`);
        reportLines.push("=".repeat(80));
        for (const report of reviewReports) {
          reportLines.push(
            `${report.resolution} | ${report.foundName} | ${report.foundId} | ${report.source}`,
          );
        }
        reportLines.push("");
      }

      // Helper: truncate text for report (keep first 800 chars of each section)
      const truncateForReport = (text: string, maxLen = 800): string => {
        if (!text) return "(vacío)";
        // Split OCR and EMBED sections
        const parts = text.split(/===\s*TEXTO\s*(OCR|EMBED)\s*===/i);
        if (parts.length <= 1) {
          return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
        }
        // Reconstruct with truncated sections
        let result = "";
        for (let i = 1; i < parts.length; i += 2) {
          const label = parts[i];
          const content = (parts[i + 1] || "").trim();
          const truncated =
            content.length > maxLen / 2
              ? content.slice(0, maxLen / 2) + "..."
              : content;
          result += `[${label}]: ${truncated.slice(0, 300)}\n`;
        }
        return result.trim() || text.slice(0, maxLen);
      };

      // PARTIAL SECTION (concise format)
      if (partialReports.length > 0) {
        reportLines.push("=".repeat(80));
        reportLines.push(`◐ PARCIALES (${partialReports.length})`);
        reportLines.push("=".repeat(80));
        for (const report of partialReports) {
          reportLines.push("-".repeat(40));
          reportLines.push(
            `${report.resolution} | ${report.fileName} | ${report.source}`,
          );
          if (report.foundName)
            reportLines.push(`  NOMBRE: ${report.foundName}`);
          if (report.foundId) reportLines.push(`  ID: ${report.foundId}`);
          reportLines.push(`  FALTA: ${report.reason}`);
          if (report.extractedText) {
            reportLines.push(
              `  TEXTO: ${truncateForReport(report.extractedText)}`,
            );
          }
        }
        reportLines.push("");
      }

      // ERROR SECTION (concise format)
      if (errorOnlyReports.length > 0) {
        reportLines.push("=".repeat(80));
        reportLines.push(`✗ ERRORES (${errorOnlyReports.length})`);
        reportLines.push("=".repeat(80));
        for (const report of errorOnlyReports) {
          reportLines.push("-".repeat(40));
          reportLines.push(
            `${report.resolution} | ${report.fileName || "N/A"} | ${report.source}`,
          );
          reportLines.push(`  RAZÓN: ${report.reason}`);
          if (report.extractedText) {
            reportLines.push(
              `  TEXTO: ${truncateForReport(report.extractedText)}`,
            );
          }
        }
        reportLines.push("");
      }

      // NO FILE SECTION (compact: just list numbers)
      if (noFileReports.length > 0) {
        reportLines.push("=".repeat(80));
        reportLines.push(`? SIN ARCHIVO PDF (${noFileReports.length})`);
        reportLines.push("=".repeat(80));
        // Group in rows of 10 for compactness
        const nums = noFileReports.map((r) => r.resolution);
        for (let i = 0; i < nums.length; i += 10) {
          reportLines.push(nums.slice(i, i + 10).join(", "));
        }
        reportLines.push("");
      }

      reportLines.push("=".repeat(80));
      reportLines.push("FIN DEL REPORTE");
      reportLines.push("=".repeat(80));

      const reportText = reportLines.join("\n");
      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reporte_resoluciones.txt";
      a.click();
      URL.revokeObjectURL(url);

      const total = rowsToProcess.length;
      const reviewMsg = reviews > 0 ? `, ${reviews} a revisar` : "";
      const partialMsg = partials > 0 ? `, ${partials} parciales` : "";
      const skippedMsg =
        skippedRows.length > 0 ? ` (${skippedRows.length} ignoradas)` : "";
      pushLog(
        `Completado: ${filled} OK${reviewMsg}${partialMsg}, ${notFound} sin PDF, ${errors} errores de ${total}${skippedMsg}`,
        errors === 0 ? "success" : filled >= errors ? "warning" : "error",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      pushLog(`Error fatal: ${msg}`, "error", {
        reason: "Error crítico. Revisa que el Excel tenga el formato correcto.",
      });
    } finally {
      setBusy(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  // ============ Test Mode Processing ============
  const handleTest = async () => {
    if (!testPdf) return;
    setTestBusy(true);
    setTestResult(null);

    try {
      let embedText = "";
      let ocrText = "";
      let finalSource = "";
      let usedEmbed = false;

      // PASO 1: Intentar OCR PRIMERO (prioridad)
      try {
        ocrText = await ocrPdfWithTesseract(testPdf);
      } catch {
        ocrText = "";
      }

      // PASO 2: Extraer datos del OCR
      const ocrData = extractUserId(ocrText);
      const finalData = { ...ocrData };

      // PASO 3: Si OCR no encontró todo, usar EMBED como refuerzo
      if (!ocrData.Usuario || !ocrData.Identificacion) {
        try {
          embedText = await extractTextFromPdf(testPdf);
          const embedData = extractUserId(embedText);

          // Usar EMBED solo para completar lo que falta
          if (!finalData.Usuario && embedData.Usuario) {
            finalData.Usuario = embedData.Usuario;
            usedEmbed = true;
          }
          if (!finalData.Identificacion && embedData.Identificacion) {
            finalData.Identificacion = embedData.Identificacion;
            usedEmbed = true;
          }
        } catch {
          embedText = "";
        }
      }

      // Determinar fuente final
      if (finalData.Usuario || finalData.Identificacion) {
        if (usedEmbed && ocrText) {
          finalSource = "OCR+EMBED";
        } else if (usedEmbed) {
          finalSource = "EMBED";
        } else {
          finalSource = "OCR";
        }
      }

      // PASO 4: Mostrar resultados
      const displayText = ocrText || embedText;
      // Si se usó EMBED, SIEMPRE es warning
      const needsReview = usedEmbed || finalData.needsReview;

      if (finalData.Usuario && finalData.Identificacion) {
        setTestResult({
          name: finalData.Usuario,
          id: finalData.Identificacion,
          extractedText: displayText,
          needsReview: needsReview,
          source: finalSource,
        });
      } else if (finalData.Usuario || finalData.Identificacion) {
        // PARCIAL - mostrar ambos textos
        const found = finalData.Usuario
          ? `Usuario: ${finalData.Usuario}`
          : `ID: ${finalData.Identificacion}`;
        const missing = finalData.Usuario ? "Identificación" : "Usuario";
        setTestResult({
          name: finalData.Usuario,
          id: finalData.Identificacion,
          error: `PARCIAL: ${found}. Falta: ${missing} [${finalSource || "OCR+EMBED"}]`,
          ocrText: ocrText || "(OCR no extrajo texto)",
          embedText: embedText || "(EMBED no extrajo texto)",
          needsReview: true,
          source: finalSource || "OCR+EMBED",
        });
      } else {
        // ERROR - mostrar ambos textos
        const allText = ocrText || embedText;
        let errorMsg = "No se pudo extraer la información del PDF.";
        if (!allText || allText.length === 0) {
          errorMsg = "No se pudo extraer ningún texto del PDF.";
        } else {
          const lower = allText.toLowerCase();
          const hasSenor = /se[ñn]or|senor|snor|sñor|senores/i.test(lower);
          const hasIdentificado = /identificad/i.test(lower);
          const hasCedula = /c[eé]dula|cedula/i.test(lower);

          if (!hasSenor && !hasIdentificado) {
            errorMsg = "No se encontró 'señor/a' ni 'identificado/a'.";
          } else if (!hasCedula) {
            errorMsg = "No se encontró 'cédula' en el texto.";
          } else {
            errorMsg =
              "Se encontraron palabras clave pero no el patrón completo.";
          }
        }
        errorMsg += " (Se probó OCR y EMBED)";
        setTestResult({
          error: errorMsg,
          ocrText: ocrText || "(OCR no extrajo texto)",
          embedText: embedText || "(EMBED no extrajo texto)",
          source: "OCR+EMBED",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setTestResult({ error: msg });
    } finally {
      setTestBusy(false);
    }
  };

  const handleDownloadTestExcel = () => {
    if (!testResult || testResult.error) return;

    const ws = XLSX.utils.json_to_sheet([
      { Usuario: testResult.name, Identificacion: testResult.id },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prueba");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prueba.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showExtractedText, setShowExtractedText] = useState(false);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-top">
          <h1 className="app-title">Resoluciones</h1>
          <a
            href="https://github.com/Max-Bustamante69/fast-resoluciones#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-help"
            title="Ver guía de uso"
          >
            ? Ayuda
          </a>
        </div>
        <p className="app-subtitle">
          Extrae datos de PDFs y completa tu Excel automáticamente
        </p>
      </header>

      <div className="tabs-container">
        <button
          className={`tab-btn ${tab === "main" ? "active" : ""}`}
          onClick={() => setTab("main")}
        >
          Procesar
        </button>
        <button
          className={`tab-btn ${tab === "test" ? "active" : ""}`}
          onClick={() => setTab("test")}
        >
          Probar PDF
        </button>
        <button
          className={`tab-btn ${tab === "verify" ? "active" : ""}`}
          onClick={() => setTab("verify")}
        >
          Verificar
        </button>
      </div>

      {tab === "main" && (
        <>
          <DropZone
            onFiles={(f) => setExcel(f?.[0] || null)}
            accept=".xlsx,.xls"
            icon="📊"
            title="Excel base"
            hint="Arrastra tu archivo Excel o haz clic para seleccionar"
            files={excel}
          />

          <DropZone
            onFiles={addPdfFiles}
            accept=".pdf"
            multiple
            icon="📄"
            title="PDFs de resoluciones (RS-)"
            hint="Arrastra PDFs RS- para agregar (se combinan automáticamente)"
            files={null}
          />

          {/* Lista de archivos cargados */}
          {pdfFiles.length > 0 && (
            <div className="file-list-container">
              <div className="file-list-header">
                <span>
                  {pdfFiles.length} archivo{pdfFiles.length !== 1 ? "s" : ""}{" "}
                  RS- cargado{pdfFiles.length !== 1 ? "s" : ""}
                </span>
                <button
                  className="btn-clear"
                  onClick={clearPdfFiles}
                  disabled={busy}
                >
                  Limpiar todo
                </button>
              </div>
              <div className="file-list">
                {pdfFiles.map((file) => (
                  <div key={file.name} className="file-item">
                    <span className="file-name">{file.name}</span>
                    <button
                      className="btn-remove"
                      onClick={() => removePdfFile(file.name)}
                      disabled={busy}
                      title="Eliminar archivo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn"
            disabled={busy || !excel || pdfFiles.length === 0}
            onClick={handleProcess}
          >
            {busy ? (
              <span className="processing">
                Procesando... {progress.current}/{progress.total}
              </span>
            ) : (
              "Procesar y descargar"
            )}
          </button>

          {progress.total > 0 && (
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="progress-text">
                {progress.current} de {progress.total} filas del Excel
              </p>
            </div>
          )}

          {log.length > 0 && (
            <div className="log-container">
              <div className="log-header">
                <span>Registro de procesamiento</span>
                <span className="log-hint">
                  Clic en errores para ver detalles
                </span>
              </div>
              <div className="log-content">
                {log.map((entry, idx) => (
                  <LogEntryItem key={idx} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "test" && (
        <div className="test-section">
          <DropZone
            onFiles={(f) => {
              setTestPdf(f?.[0] || null);
              setTestResult(null);
              setShowExtractedText(false);
            }}
            accept=".pdf"
            icon="🔍"
            title="PDF de prueba"
            hint="Arrastra un PDF para probar la extracción"
            files={testPdf}
          />

          <button
            className="btn"
            disabled={testBusy || !testPdf}
            onClick={handleTest}
          >
            {testBusy ? (
              <span className="processing">Analizando...</span>
            ) : (
              "Analizar PDF"
            )}
          </button>

          {testResult && (
            <div className="test-result">
              <h3 className="test-result-title">Resultado</h3>
              {testResult.error ? (
                <>
                  <div className="test-result-item">
                    <div className="test-result-label">Error</div>
                    <div className="test-result-value error">
                      {testResult.error}
                    </div>
                  </div>
                  {(testResult.ocrText ||
                    testResult.embedText ||
                    testResult.extractedText) && (
                    <div className="test-result-item" style={{ marginTop: 16 }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setShowExtractedText(!showExtractedText)}
                      >
                        {showExtractedText ? "Ocultar" : "Ver"} textos extraídos
                      </button>
                      {showExtractedText && (
                        <>
                          {testResult.ocrText && (
                            <div style={{ marginTop: 8 }}>
                              <strong>📷 Texto OCR:</strong>
                              <pre className="extracted-text-preview">
                                {testResult.ocrText}
                              </pre>
                            </div>
                          )}
                          {testResult.embedText && (
                            <div style={{ marginTop: 8 }}>
                              <strong>📄 Texto EMBED:</strong>
                              <pre className="extracted-text-preview">
                                {testResult.embedText}
                              </pre>
                            </div>
                          )}
                          {testResult.extractedText &&
                            !testResult.ocrText &&
                            !testResult.embedText && (
                              <pre className="extracted-text-preview">
                                {testResult.extractedText}
                              </pre>
                            )}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {testResult.needsReview && (
                    <div className="review-badge">
                      ⚠️ REQUIERE REVISIÓN - Extracción con baja confianza
                    </div>
                  )}
                  <div className="test-result-grid">
                    <div className="test-result-item">
                      <div className="test-result-label">Usuario</div>
                      <div
                        className={`test-result-value ${testResult.needsReview ? "review" : "success"}`}
                      >
                        {testResult.name}
                        {testResult.needsReview && (
                          <span className="review-badge">REVISAR</span>
                        )}
                      </div>
                    </div>
                    <div className="test-result-item">
                      <div className="test-result-label">Identificación</div>
                      <div
                        className={`test-result-value ${testResult.needsReview ? "review" : "success"}`}
                      >
                        {testResult.id}
                      </div>
                    </div>
                    {testResult.source && (
                      <div className="test-result-item">
                        <div className="test-result-label">Fuente</div>
                        <div className="test-result-value">
                          {testResult.source}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={handleDownloadTestExcel}
                    style={{ marginTop: 16 }}
                  >
                    Descargar Excel de prueba
                  </button>
                  {(testResult.ocrText ||
                    testResult.embedText ||
                    testResult.extractedText) && (
                    <div style={{ marginTop: 16 }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setShowExtractedText(!showExtractedText)}
                      >
                        {showExtractedText ? "Ocultar" : "Ver"} textos extraídos
                      </button>
                      {showExtractedText && (
                        <>
                          {testResult.ocrText && (
                            <div style={{ marginTop: 8 }}>
                              <strong>📷 Texto OCR:</strong>
                              <pre className="extracted-text-preview">
                                {testResult.ocrText}
                              </pre>
                            </div>
                          )}
                          {testResult.embedText && (
                            <div style={{ marginTop: 8 }}>
                              <strong>📄 Texto EMBED:</strong>
                              <pre className="extracted-text-preview">
                                {testResult.embedText}
                              </pre>
                            </div>
                          )}
                          {testResult.extractedText &&
                            !testResult.ocrText &&
                            !testResult.embedText && (
                              <pre className="extracted-text-preview">
                                {testResult.extractedText}
                              </pre>
                            )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "verify" && (
        <div className="verify-section">
          <div className="drop-zones-row">
            <DropZone
              onFiles={(f) => setVerifyExcel(f?.[0] || null)}
              accept=".xlsx,.xls"
              icon="📊"
              title="Excel completo"
              hint="Con Usuario e Identificación"
              files={verifyExcel}
            />
            <DropZone
              onFiles={addVerifyPdfs}
              accept=".pdf"
              icon="📄"
              title="PDFs a verificar"
              hint="Solo archivos RS-*"
              files={null}
              multiple
            />
          </div>

          {verifyPdfs.length > 0 && (
            <div className="file-list-container">
              <div className="file-list-header">
                <span>{verifyPdfs.length} PDFs cargados</span>
                <button className="btn-clear" onClick={clearVerifyPdfs}>
                  Limpiar todo
                </button>
              </div>
              <div className="file-list">
                {verifyPdfs.slice(0, 10).map((f) => (
                  <div key={f.name} className="file-item">
                    <span>{f.name}</span>
                    <button
                      className="btn-remove"
                      onClick={() => removeVerifyPdf(f.name)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {verifyPdfs.length > 10 && (
                  <div className="file-item">
                    ... y {verifyPdfs.length - 10} más
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleVerify}
            disabled={!verifyExcel || verifyPdfs.length === 0 || verifyBusy}
          >
            {verifyBusy ? "Verificando..." : "Verificar coincidencias"}
          </button>

          {verifyProgress.total > 0 && (
            <div className="progress-container">
              <div
                className="progress-bar"
                style={{
                  width: `${(verifyProgress.current / verifyProgress.total) * 100}%`,
                }}
              />
              <span className="progress-text">
                {verifyProgress.current} / {verifyProgress.total}
              </span>
            </div>
          )}

          {verifyLog.length > 0 && (
            <div className="log-container">
              <div className="log-header">
                <h3>Resultado de verificación</h3>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={clearVerifyLog}
                >
                  Limpiar
                </button>
              </div>
              <div className="log-content">
                {verifyLog.map((entry, idx) => (
                  <LogEntryItem key={idx} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="app-footer">
        100% local — Tus archivos nunca salen de tu computador
      </footer>
    </div>
  );
}
