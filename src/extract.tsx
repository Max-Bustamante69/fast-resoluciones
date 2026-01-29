// extract.ts - Extracción robusta y optimizada de nombre y cédula

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
const NO_PATTERN = /\bn[o°º*]\.?\s*/g;
const NUMERO = /\bnumero\s*/g;
const COMMA_NUMBER = /(\d),(\d{3})/g;

// === EXTRACTION PATTERNS (compiled once) ===

// Pattern 1: SENORES + NAME + identificado + cedula + NUM
const PATTERN_PLURAL =
  /SENORES\s+([A-Z][A-Z\s]+?)\s*,?\s*IDENTIFICAD[AO]\s+con\s+CEDULA\s+de\s+CIUDADANIA\s+NUM\s*([\d][\d.\s]{5,14})/i;

// Pattern 2: SENOR/A + NAME + identificado + cedula + NUM
const PATTERN_SINGULAR =
  /SENORA?\s+([A-Z][A-Z\s]+?)\s*,?\s*IDENTIFICAD[AO]\s+con\s+CEDULA\s+de\s+CIUDADANIA\s+NUM\s*([\d][\d.\s]{5,14})/i;

// Pattern 3: SENOR variants + NAME + identificado + NUM
const PATTERN_FLEXIBLE =
  /SENOR(?:ES|A)?\s+([A-Z][A-Z\s]+?)\s*,?\s*IDENTIFICAD[AO].*?NUM\s*([\d][\d.\s]{5,14})/i;

// Pattern 4: NAME + identificado + cedula + NUM (sin señor)
const PATTERN_NO_SENOR =
  /([A-Z][A-Z\s]{5,50}?)\s*,?\s*IDENTIFICAD[AO]\s+con\s+CEDULA.*?NUM\s*([\d][\d.\s]{5,14})/i;

// Pattern 5: NAME directly before "cedula de ciudadania" (no señor, no identificado)
// e.g., "VELANDIA, cédula de ciudadanía 91.274.677"
const PATTERN_NAME_BEFORE_CEDULA =
  /([A-Z][A-Z\s]{3,50}?)\s*,?\s*CEDULA\s+de\s+CIUDADANIA\s+NUM?\s*([\d][\d.\s]{5,14})/i;

// Pattern 6: NAME + identificado con cedula NUM (shorter)
const PATTERN_NAME_IDENTIFICADO =
  /([A-Z][A-Z\s]{5,50}?)\s+IDENTIFICAD[AO]\s+con\s+CEDULA[^0-9]*NUM\s*([\d][\d.\s]{5,14})/i;

// Pattern for extracting name only
const PATTERN_NAME_ONLY =
  /SENOR(?:ES|A)?\s+([A-Z][A-Z\s]{3,60}?)(?:\s*,|\s+IDENTIFICAD)/i;

// Pattern for extracting ID only
const PATTERN_ID_CEDULA = /CEDULA.*?NUM\s*([\d][\d.\s]{5,14})/i;
const PATTERN_ID_NUM = /NUM\s*([\d][\d.\s]{5,14})/i;

// Raw text patterns (for text with accents preserved)
const PATTERN_RAW_NAME =
  /(?:los\s+)?se[ñn]or(?:es|a)?\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)[,\s]+(?:identificad|con\s+c[eé]dula)/i;
const PATTERN_RAW_ID =
  /(?:c[eé]dula|ciudadan[ií]a)\s*(?:n[o°º]\.?|no\.?)\s*([\d][\d.\s]{5,14})/i;

// Pattern for name right before cedula in raw text
const PATTERN_RAW_NAME_BEFORE_CEDULA =
  /([A-Za-záéíóúñÁÉÍÓÚÑ\s]{5,50}?)\s*,?\s*(?:c[eé]dula\s+de\s+ciudadan[ií]a|identificad[oa]\s+con\s+c[eé]dula)\s*n?[o°º]?\.?\s*([\d][\d.\s]{5,14})/i;

// Aggressive ID pattern
const PATTERN_AGGRESSIVE_ID = /\b([\d]{1,3}[.\s][\d]{3}[.\s][\d]{3})\b/;

// Name cleaning patterns
const NAME_MARKERS =
  /\b(senor|senora|senores|senoras|identificad[oa]|cedula|ciudadania|num|propietar[iao]|representante|autorizada?)\b/gi;
const NAME_ARTICLES = /^(el|la|los|las|a|al)\s+/g;
const NAME_SPECIAL_END = /[,.\s:;/\\|]+$/g;
const NAME_SPECIAL_START = /^[,.\s:;/\\|]+/g;

// Validation
const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y"]);

// Quick check patterns for early exit
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
    .toLowerCase()
    .replace(NAME_MARKERS, "")
    .replace(NAME_ARTICLES, "")
    .replace(NAME_SPECIAL_END, "")
    .replace(NAME_SPECIAL_START, "")
    .replace(MULTI_SPACE, " ")
    .trim();

  return cleaned.length < 3 ? "" : titleCase(cleaned);
}

function isValidName(name: string): boolean {
  if (!name || name.length < 5) return false;
  const words = name.split(/\s+/).filter((w) => w.length > 1);
  return words.length >= 2 && words.length <= 10;
}

function isValidId(id: string): boolean {
  return id.length >= 6 && id.length <= 12;
}

export type ExtractionResult = {
  Usuario?: string;
  Identificacion?: string;
  needsReview?: boolean;
  confidence?: "high" | "medium" | "low";
};

/**
 * Extrae el usuario y la identificación del texto
 * Optimizado con early exit y patterns pre-compilados
 */
export function extractUserId(text: string): ExtractionResult {
  if (!text || text.length < 30) {
    return {};
  }

  // Early exit: verificar si el texto tiene las palabras clave mínimas
  const hasKeywords =
    HAS_SENOR.test(text) || HAS_IDENTIFICAD.test(text) || HAS_CEDULA.test(text);
  if (!hasKeywords) {
    return {};
  }

  const norm = normalizeText(text);

  // Estrategia 1: Patrón completo SENORES (plural)
  let match = norm.match(PATTERN_PLURAL);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return { Usuario: name, Identificacion: id, confidence: "high" };
    }
  }

  // Estrategia 2: Patrón completo SENOR/A singular
  match = norm.match(PATTERN_SINGULAR);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return { Usuario: name, Identificacion: id, confidence: "high" };
    }
  }

  // Estrategia 3: Patrón flexible
  match = norm.match(PATTERN_FLEXIBLE);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return { Usuario: name, Identificacion: id, confidence: "high" };
    }
  }

  // Estrategia 4: Sin señor, pero con identificado
  match = norm.match(PATTERN_NO_SENOR);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return { Usuario: name, Identificacion: id, confidence: "medium" };
    }
  }

  // Estrategia 5: NAME + identificado con cedula
  match = norm.match(PATTERN_NAME_IDENTIFICADO);
  if (match?.[1] && match[2]) {
    const name = cleanName(match[1]);
    const id = cleanId(match[2]);
    if (isValidName(name) && isValidId(id)) {
      return { Usuario: name, Identificacion: id, confidence: "medium" };
    }
  }

  // Estrategia 6: Nombre directamente antes de "cedula de ciudadania"
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
      };
    }
  }

  // Estrategia 7: Búsqueda separada
  let foundName: string | null = null;
  let foundId: string | null = null;

  match = norm.match(PATTERN_NAME_ONLY);
  if (match?.[1]) {
    const name = cleanName(match[1]);
    if (isValidName(name)) foundName = name;
  }

  match = norm.match(PATTERN_ID_CEDULA);
  if (match?.[1]) {
    const id = cleanId(match[1]);
    if (isValidId(id)) foundId = id;
  }

  if (!foundId) {
    match = norm.match(PATTERN_ID_NUM);
    if (match?.[1]) {
      const id = cleanId(match[1]);
      if (isValidId(id)) foundId = id;
    }
  }

  if (foundName && foundId) {
    return {
      Usuario: foundName,
      Identificacion: foundId,
      confidence: "medium",
    };
  }

  // Estrategia 8: Búsqueda en texto original (sin normalizar)
  // Try the new pattern for name before cedula in raw text
  if (!foundName || !foundId) {
    const rawMatch = text.match(PATTERN_RAW_NAME_BEFORE_CEDULA);
    if (rawMatch?.[1] && rawMatch[2]) {
      const name = cleanName(rawMatch[1]);
      const id = cleanId(rawMatch[2]);
      if (isValidName(name) && isValidId(id)) {
        return {
          Usuario: name,
          Identificacion: id,
          confidence: "low",
          needsReview: true,
        };
      }
      if (!foundName && isValidName(name)) foundName = name;
      if (!foundId && isValidId(id)) foundId = id;
    }
  }

  if (!foundName) {
    const rawMatch = text.match(PATTERN_RAW_NAME);
    if (rawMatch?.[1]) {
      const name = cleanName(rawMatch[1]);
      if (isValidName(name)) foundName = name;
    }
  }

  if (!foundId) {
    const rawMatch = text.match(PATTERN_RAW_ID);
    if (rawMatch?.[1]) {
      const id = cleanId(rawMatch[1]);
      if (isValidId(id)) foundId = id;
    }
  }

  if (foundName && foundId) {
    return {
      Usuario: foundName,
      Identificacion: foundId,
      confidence: "low",
      needsReview: true,
    };
  }

  // Estrategia 9: Super agresiva para cédula
  if (!foundId) {
    match = norm.match(PATTERN_AGGRESSIVE_ID);
    if (match?.[1]) {
      const id = cleanId(match[1]);
      if (isValidId(id)) foundId = id;
    }
  }

  if (foundName && foundId) {
    return {
      Usuario: foundName,
      Identificacion: foundId,
      confidence: "low",
      needsReview: true,
    };
  }

  // Resultados parciales
  if (foundName) {
    return { Usuario: foundName, needsReview: true, confidence: "low" };
  }
  if (foundId) {
    return { Identificacion: foundId, needsReview: true, confidence: "low" };
  }

  return {};
}
