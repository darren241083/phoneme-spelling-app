const PRESENTATION_REPLACEMENTS = [
  [/\u00a0|\u202f|\u2007/g, " "],
  [/\ufeff|\u200b|\u200c|\u200d|\u2060/g, ""],
  [/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe58\ufe63\uff0d]/g, "-"],
  [/[\u2018\u2019\u201a\u201b\u2032\u00b4\u0060\u02bc]/g, "'"],
  [/[\u201c\u201d\u201e\u201f]/g, '"'],
  [/â€|â€‘|â€’|â€“|â€”|â€•|âˆ’/g, "-"],
  [/â€˜|â€™|â€š|â€›/g, "'"],
  [/â€œ|â€�|â€ž|â€Ÿ/g, '"'],
  [/Â /g, " "],
  [/Â/g, ""],
];

function normalizePresentationCharacters(value = "") {
  let normalized = String(value ?? "");
  for (const [pattern, replacement] of PRESENTATION_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

export function normalizeSpreadsheetText(value = "") {
  return normalizePresentationCharacters(value);
}

export function collapseWhitespace(value = "") {
  return normalizeSpreadsheetText(value).replace(/\s+/g, " ").trim();
}

export function normalizeHeader(value = "") {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[\s/-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeLookupKey(value = "") {
  return collapseWhitespace(value).toLowerCase();
}

export function normalizeGroupLookupKey(value = "") {
  return normalizeSpreadsheetText(value)
    .trim()
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe58\ufe63\uff0d]+/g, "-")
    .replace(/["']/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeEmail(value = "") {
  return collapseWhitespace(value).toLowerCase();
}

export function normalizeLooseId(value = "") {
  return collapseWhitespace(value);
}

export function splitSuggestionList(value = "") {
  const safeValue = normalizeSpreadsheetText(value);
  if (!safeValue.trim()) return [];
  return [...new Set(
    safeValue
      .split(/[;,\n|]+/g)
      .map((item) => collapseWhitespace(item))
      .filter(Boolean)
  )];
}

export function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function parseCsvMatrix(text = "") {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!insideQuotes && (character === "\n" || character === "\r")) {
      currentRow.push(currentCell);
      currentCell = "";
      const isMeaningfulRow = currentRow.some((cell) => collapseWhitespace(cell).length > 0);
      if (isMeaningfulRow) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => collapseWhitespace(cell).length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function buildNormalizedRowFingerprint(raw = {}, columns = []) {
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const safeColumns = Array.isArray(columns) && columns.length
    ? columns.filter(Boolean)
    : Object.keys(safeRaw);

  return safeColumns
    .map((column) => `${column}:${normalizeLookupKey(safeRaw?.[column] || "")}`)
    .join("|");
}

export function buildDuplicateValueMap(rows = [], getValue = () => "") {
  const duplicates = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const safeValue = String(getValue(row) || "").trim();
    if (!safeValue) continue;
    const next = duplicates.get(safeValue) || [];
    next.push(Number(row?.rowNumber || row?.row_number || 0) || 0);
    duplicates.set(safeValue, next);
  }
  for (const [key, rowNumbers] of duplicates.entries()) {
    if (rowNumbers.length < 2) {
      duplicates.delete(key);
    }
  }
  return duplicates;
}

export function formatRowNumberList(rowNumbers = []) {
  const safeNumbers = [...new Set(
    (Array.isArray(rowNumbers) ? rowNumbers : [])
      .map((value) => Number(value || 0))
      .filter((value) => value > 0)
  )].sort((a, b) => a - b);

  return safeNumbers.join(", ");
}

export function isNumericOnlyIdentifier(value = "") {
  return /^\d+$/.test(normalizeLooseId(value));
}
