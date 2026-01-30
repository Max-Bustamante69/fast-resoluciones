// extract.ts - Extracción robusta basada en sección RESUELVE

// === REGEX COMPILADOS UNA VEZ (optimización) ===
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /\x0c/g;
const WHITESPACE = /[\r\n\t]+/g;
const MULTI_SPACE = /\s+/g;

// Acentos
const ACCENTS_A = /[áàâä]/g;
const ACCENTS_E = /[éèêë]/g;
const ACCENTS_I = /[íìîï]/g;
const ACCENTS_O = /[óòôö]/g;
const ACCENTS_U = /[úùûü]/g;
const ACCENTS_N = /[ñ]/g;

// OCR cleanup
const OCR_CHARS = /[/\\|¡!¿?]+/g;
const PUNCTUATION = /[:;]+\s*/g;

// Keywords normalization
const LAS_SENORAS = /\blas?\s+senoras?\b/g;
const LOS_SENORES = /\blos?\s+senores?\b/g;
const SENORA = /\bsenora\b/g;
const SENOR = /\bsenor\b/g;
const SNORA = /\bsnora\b/g;
const SNOR = /\bsnor\b/g;
const IDENTIFICADA = /identificada/g;
const IDENTIFICADO = /identificado/g;
const CEDULA = /cedula/g;
const CIUDADANIA = /ciudadania/g;
const NO_PATTERN = /\bn[o°º*]\.?\s*/gi;
const NUMERO = /\bnumero\s*/g;
const COMMA_NUMBER = /(\d),(\d{3})/g;

// =====================================================
// PATRONES PRINCIPALES - Basados en sección RESUELVE
// =====================================================

// PATRÓN PRINCIPAL: Captura MAYÚSCULAS después de "a favor de" + NIT/cédula
// Este es el patrón MÁS CONFIABLE porque:
// 1. El nombre (persona o empresa) siempre está en MAYÚSCULAS
// 2. Siempre va seguido de "identificad@" con NIT o cédula
//
// Ejemplo empresa: "a favor de la EMPRESA DE ENERGÍA DE PEREIRA S.A. E.S.P., identificada con NIT.816.002.019-9"
// Ejemplo persona: "a favor de la señora MARÍA GARCÍA LÓPEZ, identificada con cédula No. 12345678"

// Patrón para capturar MAYÚSCULAS después de "a favor de" hasta "identificad@"
// Captura: texto en mayúsculas (puede incluir puntos para S.A., E.S.P., etc.)
// NOTA: N* es variante OCR de N° o No.
// "del" = "de" + "el", "de la" son opcionales
// Incluye variantes OCR: Senores, Senora, Snor, etc.
// OCR puede leer "identificada" como: lentificaca, ldentificada, etc.
const PATTERN_MAYUSCULAS_NIT =
  /a\s+favor\s+de(?:l|\s+la|\s+el)?\s+(?:(?:se[ñn]or[ea]?s?|senor[ea]?s?|snor[ea]?)\s+)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.,]+?)\s*,?\s*[il][deo]?[en]?tific[aáeo][dcg]?[aoe]?\s+con\s+NIT[.\s:]*\s*([\d][\d.\s,-]{5,15})/i;

// Patrón cédula - incluye N* como variante OCR de N°
// N*10.023 (sin espacio después de N*) también debe funcionar
// Incluye variantes OCR: Senores, Senora, Snor, etc.
// OCR puede leer "identificada" como: lentificaca, ldentificada, etc.
const PATTERN_MAYUSCULAS_CEDULA =
  /a\s+favor\s+de(?:l|\s+la|\s+el)?\s+(?:(?:se[ñn]or[ea]?s?|senor[ea]?s?|snor[ea]?)\s+)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.,]+?)\s*,?\s*[il][deo]?[en]?tific[aáeo][dcg]?[aoe]?\s+con\s+c[eé]dula\s+(?:de\s+ciudadan[ií]a\s+)?[Nn][o°º*]?\.?\s*([\d][\d.\s,-]{5,15})/i;

// Patrón alternativo más flexible (incluye N*)
// Incluye variantes OCR: Senores, Senora, Snor, etc.
// OCR puede leer "identificada" como: lentificaca, ldentificada, etc.
const PATTERN_A_FAVOR_FLEXIBLE =
  /a\s+favor\s+de(?:l|\s+la|\s+el)?\s+(?:(?:se[ñn]or[ea]?s?|senor[ea]?s?|snor[ea]?)\s+)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.,]+?)\s*,?\s*(?:[il][deo]?[en]?tific[aáeo][dcg]?[aoe]?\s+)?con\s+(?:NIT|c[eé]dula)[.\s:]*(?:de\s+ciudadan[ií]a\s+)?(?:[Nn][o°º*]?\.?\s*)?([\d][\d.\s,-]{5,15})/i;

// Para texto normalizado (sin acentos) - respaldo (NUM incluye variantes)
// OCR puede leer "IDENTIFICADA" como variantes
const PATTERN_A_FAVOR_NORM =
  /a\s+favor\s+de(?:l|\s+la|\s+el)?\s+(?:SENOR[EA]?\s+)?([A-Z][A-Z\s.,]+?)\s*,?\s*(?:[IL][DEO]?[EN]?TIFIC[AEO][DCG]?[AOE]?\s+)?(?:con\s+)?(?:CEDULA|NIT)[.\s:]*(?:de\s+CIUDADANIA\s+)?(?:NUM|N[o°º*]?)?\s*([\d][\d.\s]{5,14})/i;

// =====================================================
// PATRONES DE RESPALDO (los anteriores)
// =====================================================

const PATTERN_PLURAL =
  /SENORES\s+([A-Z][A-Z\s]+?)\s*,?\s*IDENTIFICAD[AO]\s+con\s+CEDULA\s+de\s+CIUDADANIA\s+NUM\s*([\d][\d.\s]{5,14})/i;

const PATTERN_SINGULAR =
  /SENORA?\s+([A-Z][A-Z\s]+?)\s*,?\s*IDENTIFICAD[AO]\s+con\s+CEDULA\s+de\s+CIUDADANIA\s+NUM\s*([\d][\d.\s]{5,14})/i;

const PATTERN_FLEXIBLE =
  /SENOR(?:ES|A)?\s+([A-Z][A-Z\s]+?)\s*,?\s*IDENTIFICAD[AO].*?NUM\s*([\d][\d.\s]{5,14})/i;

const PATTERN_NO_SENOR =
  /([A-Z][A-Z\s]{5,50}?)\s*,?\s*IDENTIFICAD[AO]\s+con\s+CEDULA.*?NUM\s*([\d][\d.\s]{5,14})/i;

const PATTERN_NAME_BEFORE_CEDULA =
  /([A-Z][A-Z\s]{3,50}?)\s*,?\s*CEDULA\s+de\s+CIUDADANIA\s+NUM?\s*([\d][\d.\s]{5,14})/i;

// Patrones para extracción de nombre solo
const PATTERN_NAME_A_FAVOR =
  /a\s+favor\s+de\s+(?:(?:el|la)\s+)?(?:se[ñn]or[ea]?\s+)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s*,|\s+(?:identificad|con\s+c[eé]dula|con\s+nit))/i;

// Patrones para extracción de ID solo
const PATTERN_ID_NIT = /\bnit\s*[:\s]?\s*([\d][\d.\s,-]{5,15})/i;

const PATTERN_ID_CEDULA =
  /c[eé]dula\s+(?:de\s+ciudadan[ií]a\s+)?(?:n[o°º]?\.?\s*|numero\s*)([\d][\d.\s,-]{5,15})/i;

// Name cleaning patterns
const NAME_MARKERS =
  /\b(senor|senora|senores|senoras|identificad[oa]|cedula|ciudadania|num|propietar[iao]|representante|autorizada?|el|la)\b/gi;
const NAME_SPECIAL_END = /[,.\s:;/\\|]+$/g;
const NAME_SPECIAL_START = /^[,.\s:;/\\|]+/g;

// Validation
const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y"]);

// Quick check patterns
const HAS_A_FAVOR = /a\s+favor\s+de/i;
const HAS_RESUELVE = /\bRESUELVE\s*:/i;
const HAS_SENOR = /se[ñn]or|senor|snor/i;
const HAS_IDENTIFICAD = /identificad/i;
const HAS_CEDULA = /c[eé]dula|cedula/i;

/**
 * Normaliza el texto para facilitar la búsqueda de patrones
 */
export function normalizeText(s: string): string {
  const t = s
    .replace(CONTROL_CHARS, " ")
    .replace(WHITESPACE, " ")
    .toLowerCase()
    .replace(ACCENTS_A, "a")
    .replace(ACCENTS_E, "e")
    .replace(ACCENTS_I, "i")
    .replace(ACCENTS_O, "o")
    .replace(ACCENTS_U, "u")
    .replace(ACCENTS_N, "n")
    .replace(OCR_CHARS, " ")
    .replace(PUNCTUATION, " ")
    .replace(LAS_SENORAS, "SENORES")
    .replace(LOS_SENORES, "SENORES")
    .replace(SENORA, "SENORA")
    .replace(SENOR, "SENOR")
    .replace(SNORA, "SENORA")
    .replace(SNOR, "SENOR")
    .replace(IDENTIFICADA, "IDENTIFICADA")
    .replace(IDENTIFICADO, "IDENTIFICADO")
    .replace(CEDULA, "CEDULA")
    .replace(CIUDADANIA, "CIUDADANIA")
    .replace(NO_PATTERN, "NUM ")
    .replace(NUMERO, "NUM ")
    .replace(COMMA_NUMBER, "$1.$2")
    .replace(MULTI_SPACE, " ")
    .trim();

  return t;
}

function cleanId(s: string): string {
  return s.replace(/[^\d]/g, "");
}

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function cleanName(name: string): string {
  const cleaned = name
    .replace(NAME_MARKERS, "")
    .replace(NAME_SPECIAL_END, "")
    .replace(NAME_SPECIAL_START, "")
    .replace(MULTI_SPACE, " ")
    .trim();

  if (cleaned.length < 3) return "";

  // Si el nombre está todo en mayúsculas, convertir a title case
  if (cleaned === cleaned.toUpperCase()) {
    return titleCase(cleaned);
  }

  return cleaned;
}

function isValidName(name: string): boolean {
  if (!name || name.length < 5) return false;
  const words = name.split(/\s+/).filter((w) => w.length > 1);
  return words.length >= 2 && words.length <= 12;
}

function isValidId(id: string): boolean {
  return id.length >= 6 && id.length <= 12;
}

export type ExtractionResult = {
  Usuario?: string;
  Identificacion?: string;
  needsReview?: boolean;
  confidence?: "high" | "medium" | "low";
  method?: string; // Para saber qué patrón se usó
};

/**
 * Limpia nombre capturado (persona o empresa)
 * Mantiene puntos para abreviaturas como S.A., E.S.P.
 */
function cleanCapturedName(name: string): string {
  let cleaned = name
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+/, "")
    .replace(/[,\s]+$/, "")
    .trim();

  // Remover prefijos de tratamiento que OCR puede incluir erróneamente
  // (señor, señora, senores, etc. y sus variantes OCR)
  cleaned = cleaned
    .replace(/^(se[ñn]or[ea]?s?|senor[ea]?s?|sr[a.]?|sra\.?)\s+/i, "")
    .trim();

  // Remover sufijos que no son parte del nombre
  // OCR puede leer "identificada" como: lentificaca, ldentificada, Identificaca, etc.
  // Patrón flexible: [il]..entific... o variantes
  cleaned = cleaned
    .replace(
      /\s*,?\s*[il][deo]?[en]?tific[aáeo][dcg]?[aoe]?\s*(?:con)?.*$/i,
      "",
    )
    .trim();

  // Si termina con coma, quitarla
  cleaned = cleaned.replace(/,+$/, "").trim();

  return cleaned;
}

/**
 * Valida si el nombre capturado es válido
 */
function isValidCapturedName(name: string): boolean {
  if (!name || name.length < 5) return false;
  // Debe tener al menos 2 palabras o ser nombre largo (empresa)
  const words = name.split(/\s+/).filter((w) => w.length > 1);
  return words.length >= 2 || name.length >= 15;
}

/**
 * Extrae datos usando el patrón "a favor de" (RESUELVE section)
 * Busca MAYÚSCULAS después de "a favor de" + NIT o cédula
 */
function extractFromResuelve(text: string): ExtractionResult {
  // =====================================================
  // ESTRATEGIA: Buscar MAYÚSCULAS después de "a favor de"
  // El nombre (persona o empresa) siempre está en MAYÚSCULAS
  // =====================================================

  // PASO 1: Intentar con NIT primero (empresas)
  let match = text.match(PATTERN_MAYUSCULAS_NIT);
  if (match?.[1] && match[2]) {
    const name = cleanCapturedName(match[1]);
    const id = cleanId(match[2]);
    if (isValidCapturedName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "high",
        method: "mayusculas_nit",
      };
    }
  }

  // PASO 2: Intentar con cédula (personas)
  match = text.match(PATTERN_MAYUSCULAS_CEDULA);
  if (match?.[1] && match[2]) {
    const name = cleanCapturedName(match[1]);
    const id = cleanId(match[2]);
    if (isValidCapturedName(name) && isValidId(id)) {
      // Convertir a Title Case si es nombre de persona
      const finalName =
        name.includes("S.A.") ||
        name.includes("E.S.P.") ||
        name.includes("LTDA")
          ? name // Mantener como está si es empresa
          : titleCase(name); // Convertir a Title Case si es persona
      return {
        Usuario: finalName,
        Identificacion: id,
        confidence: "high",
        method: "mayusculas_cedula",
      };
    }
  }

  // PASO 3: Patrón flexible (fallback)
  match = text.match(PATTERN_A_FAVOR_FLEXIBLE);
  if (match?.[1] && match[2]) {
    const name = cleanCapturedName(match[1]);
    const id = cleanId(match[2]);
    if (isValidCapturedName(name) && isValidId(id)) {
      const finalName =
        name.includes("S.A.") ||
        name.includes("E.S.P.") ||
        name.includes("LTDA")
          ? name
          : titleCase(name);
      return {
        Usuario: finalName,
        Identificacion: id,
        confidence: "medium",
        needsReview: true,
        method: "a_favor_flexible",
      };
    }
  }

  return {};
}

/**
 * Extrae el usuario y la identificación del texto
 * PRIORIDAD: Patrones de sección RESUELVE > Patrones legacy
 */
export function extractUserId(text: string): ExtractionResult {
  if (!text || text.length < 30) {
    return {};
  }

  // =====================================================
  // PASO 1: Buscar con patrón "a favor de" (más confiable)
  // =====================================================
  if (HAS_A_FAVOR.test(text)) {
    const resuelveResult = extractFromResuelve(text);
    if (resuelveResult.Usuario && resuelveResult.Identificacion) {
      return resuelveResult;
    }
  }

  // Intentar con texto normalizado
  const norm = normalizeText(text);

  if (/a\s+favor\s+de/i.test(norm)) {
    const match = norm.match(PATTERN_A_FAVOR_NORM);
    if (match?.[1] && match[2]) {
      const name = cleanCapturedName(match[1]);
      const id = cleanId(match[2]);
      if (isValidCapturedName(name) && isValidId(id)) {
        // Determinar si es empresa o persona
        const isEmpresa =
          name.includes("S.A") ||
          name.includes("E.S.P") ||
          name.includes("LTDA") ||
          name.includes("S.A.S");
        return {
          Usuario: isEmpresa ? name : titleCase(name),
          Identificacion: id,
          confidence: "high",
          method: "a_favor_norm",
        };
      }
    }
  }

  // =====================================================
  // PASO 2: Patrones legacy (respaldo)
  // =====================================================
  const hasKeywords =
    HAS_SENOR.test(text) || HAS_IDENTIFICAD.test(text) || HAS_CEDULA.test(text);
  if (!hasKeywords) {
    // Último intento: buscar solo el patrón de nombre y ID por separado
    return extractSeparate(text);
  }

  // Detectar plural "SENORES"
  const hasSenoresPlural = /\bSENORES\b/i.test(norm);

  // Patrón SENORES (plural)
  let match = norm.match(PATTERN_PLURAL);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "medium",
        needsReview: true,
        method: "plural",
      };
    }
  }

  // Patrón SENOR/A singular
  match = norm.match(PATTERN_SINGULAR);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: hasSenoresPlural ? "medium" : "high",
        needsReview: hasSenoresPlural || undefined,
        method: "singular",
      };
    }
  }

  // Patrón flexible
  match = norm.match(PATTERN_FLEXIBLE);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: hasSenoresPlural ? "medium" : "high",
        needsReview: hasSenoresPlural || undefined,
        method: "flexible",
      };
    }
  }

  // Sin señor, pero con identificado
  match = norm.match(PATTERN_NO_SENOR);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "medium",
        needsReview: hasSenoresPlural || undefined,
        method: "no_senor",
      };
    }
  }

  // Nombre antes de cédula
  match = norm.match(PATTERN_NAME_BEFORE_CEDULA);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "medium",
        needsReview: true,
        method: "name_before_cedula",
      };
    }
  }

  // =====================================================
  // PASO 3: Búsqueda separada de nombre e ID
  // =====================================================
  return extractSeparate(text);
}

/**
 * Extracción separada de nombre e ID cuando no hay patrón completo
 */
function extractSeparate(text: string): ExtractionResult {
  let foundName: string | null = null;
  let foundId: string | null = null;

  // Buscar nombre con "a favor de"
  const nameMatch = text.match(PATTERN_NAME_A_FAVOR);
  if (nameMatch?.[1]) {
    const name = cleanName(nameMatch[1]);
    if (isValidName(name)) foundName = name;
  }

  // Buscar ID con diferentes patrones
  let idMatch = text.match(PATTERN_ID_CEDULA);
  if (idMatch?.[1]) {
    const id = cleanId(idMatch[1]);
    if (isValidId(id)) foundId = id;
  }

  if (!foundId) {
    idMatch = text.match(PATTERN_ID_NIT);
    if (idMatch?.[1]) {
      const id = cleanId(idMatch[1]);
      if (isValidId(id)) foundId = id;
    }
  }

  if (!foundId && HAS_A_FAVOR.test(text)) {
    // Buscar número después de "a favor de ... No."
    idMatch = text.match(
      /a\s+favor\s+de[^]*?(?:n[o°º]\.?\s*|nit\s*)([\d][\d.\s,-]{5,15})/i,
    );
    if (idMatch?.[1]) {
      const id = cleanId(idMatch[1]);
      if (isValidId(id)) foundId = id;
    }
  }

  if (foundName && foundId) {
    return {
      Usuario: foundName,
      Identificacion: foundId,
      confidence: "low",
      needsReview: true,
      method: "separate",
    };
  }

  // Resultados parciales
  if (foundName) {
    return {
      Usuario: foundName,
      needsReview: true,
      confidence: "low",
      method: "partial_name",
    };
  }

  if (foundId) {
    return {
      Identificacion: foundId,
      needsReview: true,
      confidence: "low",
      method: "partial_id",
    };
  }

  return {};
}

/**
 * Verifica si el texto contiene la sección RESUELVE
 */
export function hasResuelveSection(text: string): boolean {
  return HAS_RESUELVE.test(text);
}

/**
 * Verifica si el texto contiene el patrón "a favor de"
 */
export function hasAFavorPattern(text: string): boolean {
  return HAS_A_FAVOR.test(text);
}

/**
 * Extracción de respaldo usando patrones señor/señora (primera página)
 * Se usa cuando NO se encuentra la sección RESUELVE
 * SIEMPRE marca los resultados para revisión
 */
export function extractFallbackFirstPage(text: string): ExtractionResult {
  const norm = normalizeText(text);

  // Verificar si hay patrón señor/señora en el texto
  const hasSenor = HAS_SENOR.test(norm) || HAS_SENOR.test(text);
  const hasIdentificad =
    HAS_IDENTIFICAD.test(norm) || HAS_IDENTIFICAD.test(text);

  if (!hasSenor && !hasIdentificad) {
    return {};
  }

  // Intentar patrones de señor/señora
  // Patrón SENORES (plural)
  let match = norm.match(PATTERN_PLURAL);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "low",
        needsReview: true,
        method: "fallback_plural",
      };
    }
  }

  // Patrón SENOR/A singular
  match = norm.match(PATTERN_SINGULAR);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "low",
        needsReview: true,
        method: "fallback_singular",
      };
    }
  }

  // Patrón flexible
  match = norm.match(PATTERN_FLEXIBLE);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "low",
        needsReview: true,
        method: "fallback_flexible",
      };
    }
  }

  // Sin señor, pero con identificado
  match = norm.match(PATTERN_NO_SENOR);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "low",
        needsReview: true,
        method: "fallback_no_senor",
      };
    }
  }

  // Nombre antes de cédula
  match = norm.match(PATTERN_NAME_BEFORE_CEDULA);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return {
        Usuario: name,
        Identificacion: id,
        confidence: "low",
        needsReview: true,
        method: "fallback_name_cedula",
      };
    }
  }

  // Intentar extracción separada de nombre e ID
  const separateResult = extractSeparate(text);
  if (separateResult.Usuario || separateResult.Identificacion) {
    return {
      ...separateResult,
      confidence: "low",
      needsReview: true,
      method: "fallback_separate",
    };
  }

  return {};
}
