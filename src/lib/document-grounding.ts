/**
 * Panel helpers: cite-filter retrieved documents and dedupe identical chunks.
 *
 * Prefer server `grounded_documents` when present (all languages).
 * English fallback: strict Source-line match against title/source.
 * Other-language fallback (legacy servers): Latin/citation match only — never
 * score-pad unrelated related_documents.
 */
import type { ChunkResource, DocumentResource } from "./ag-ui";

const SOURCE_LABEL = "(?:Sources?|स्रोत|स्त्रोत|संदर्भ)";
// Include Devanagari ः (visarga) — common in Hindi/Marathi "स्रोतः"
const COLON = "[:：\\u0903\\-]";
const SOURCE_LINE_RE = new RegExp(`\\*\\*${SOURCE_LABEL}\\s*${COLON}\\s*([^*\\n]+)\\*\\*`, "gi");
const SOURCE_LABEL_THEN_REST_RE = new RegExp(
  `\\*\\*${SOURCE_LABEL}\\s*${COLON}\\s*\\*\\*\\s*([^\\n]+)`,
  "gi"
);
const SOURCE_LINE_PLAIN_RE = new RegExp(`^${SOURCE_LABEL}\\s*${COLON}\\s*(.+)$`, "i");
const NAME_SPLIT_RE = /\s*[/,;]\s*|\s+and\s+|\s+और\s+|\s+व\s+|\s+तथा\s+/i;

export function extractCitedSources(text: string): string[] {
  if (!text) return [];
  const names: string[] = [];
  const add = (raw: string) => {
    for (const part of raw.split(NAME_SPLIT_RE)) {
      const trimmed = part.replace(/\*+/g, "").trim();
      if (trimmed) names.push(trimmed);
    }
  };

  for (const line of text.split(/\n/)) {
    const stripped = line.replace(/\*+/g, "").trim();
    const match = stripped.match(SOURCE_LINE_PLAIN_RE);
    if (match?.[1]) add(match[1]);
  }

  SOURCE_LINE_RE.lastIndex = 0;
  for (const match of text.matchAll(SOURCE_LINE_RE)) {
    if (match[1]) add(match[1]);
  }

  SOURCE_LABEL_THEN_REST_RE.lastIndex = 0;
  for (const match of text.matchAll(SOURCE_LABEL_THEN_REST_RE)) {
    if (match[1]) add(match[1]);
  }

  return [...new Set(names)];
}

/** Strict normalize — no fuzzy transliteration (keeps English matching tight). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_PLAIN_MENTION_LENGTH = 4;

/**
 * Strict citation filter (English behavior):
 * keep docs whose title/source overlaps a Source / स्रोत name, or appears
 * verbatim in the answer when no Source line exists.
 */
export function filterDocumentsByCitedSources(
  documents: DocumentResource[],
  responseText: string
): DocumentResource[] {
  const cited = extractCitedSources(responseText).map(normalize).filter(Boolean);
  const normalizedResponse = normalize(responseText);

  const matches = (value: string): boolean => {
    if (!value) return false;
    if (cited.some((name) => value.includes(name) || name.includes(value))) return true;
    return value.length >= MIN_PLAIN_MENTION_LENGTH && normalizedResponse.includes(value);
  };

  return documents.filter((doc) => {
    const docSource = doc.source ? normalize(doc.source) : "";
    const docTitle = normalize(doc.title);
    return matches(docSource) || matches(docTitle);
  });
}

/** Latin-only needles from a स्रोत line (e.g. "**स्रोत: Maharashtra SOP**"). */
function latinCitationNeedles(responseText: string): string[] {
  const needles = new Set<string>();
  for (const name of extractCitedSources(responseText)) {
    for (const phrase of name.match(/[A-Za-z][A-Za-z0-9&.'\-\s]{2,}/g) ?? []) {
      const n = normalize(phrase.trim());
      if (n.length >= 4) needles.add(n);
    }
  }
  return [...needles];
}

function filterByLatinCitations(
  documents: DocumentResource[],
  responseText: string
): DocumentResource[] {
  const needles = latinCitationNeedles(responseText);
  if (!needles.length) return [];
  return documents.filter((doc) => {
    const fields = [normalize(doc.title), doc.source ? normalize(doc.source) : ""];
    return needles.some((needle) =>
      fields.some((field) => field && (field.includes(needle) || needle.includes(field)))
    );
  });
}

export interface GroundedDocument {
  doc: DocumentResource;
  chunks: ChunkResource[];
}

export interface GroundedDocumentsOptions {
  /** Full assistant text; when set, unused retrievals are dropped. */
  responseText?: string;
  /** `related_documents` — used only when no curated documents arrived. */
  candidates?: DocumentResource[];
  /** UI / answer language (`en`, `hi`, `mr`, `bhb`). */
  language?: string;
  /** Server already filtered via CUSTOM grounded_documents — show as-is. */
  serverGrounded?: boolean;
}

function isTranslatedAnswer(responseText: string, language?: string): boolean {
  const lang = (language || "").toLowerCase();
  if (lang && lang !== "en") return true;
  return /\p{Script=Devanagari}/u.test(responseText);
}

function dedupeExactChunks(chunks: ChunkResource[]): ChunkResource[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = normalize(chunk.text);
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
}

function toGrounded(documents: DocumentResource[]): GroundedDocument[] {
  return documents
    .map((doc) => ({ doc, chunks: dedupeExactChunks(doc.chunks ?? []) }))
    .filter(({ doc, chunks }) => chunks.length > 0 || Boolean(doc.title || doc.source));
}

export function getGroundedDocuments(
  documents: DocumentResource[],
  options: GroundedDocumentsOptions = {}
): GroundedDocument[] {
  const { responseText = "", candidates = [], language, serverGrounded = false } = options;
  const curated = documents;

  // Server already chose the supporting docs — do not re-filter by स्रोत text.
  if (serverGrounded) return toGrounded(curated);

  // Still streaming: show curated present_search_results as they arrive.
  if (!responseText.trim()) return toGrounded(curated);

  const translated = isTranslatedAnswer(responseText, language);
  const pool = curated.length > 0 ? curated : candidates;

  // English — strict Source matching only.
  if (!translated) {
    return toGrounded(filterDocumentsByCitedSources(pool, responseText));
  }

  // Legacy other-language path (no server grounded_documents yet):
  // match Latin/English names or exact title/source; never score-pad.
  const latinHit = filterByLatinCitations(pool, responseText);
  if (latinHit.length) return toGrounded(latinHit);

  const strict = filterDocumentsByCitedSources(pool, responseText);
  if (strict.length) return toGrounded(strict);

  return [];
}

/** Filter panel cards by title, source, or chunk text. */
export function filterGroundedDocuments(
  documents: GroundedDocument[],
  query: string
): GroundedDocument[] {
  const q = query.trim().toLowerCase();
  if (!q) return documents;
  return documents
    .map(({ doc, chunks }) => {
      const hit =
        doc.title.toLowerCase().includes(q) || (doc.source ?? "").toLowerCase().includes(q);
      const matching = chunks.filter((chunk) => chunk.text.toLowerCase().includes(q));
      return { doc, chunks: matching.length ? matching : hit ? chunks : [] };
    })
    .filter(({ chunks }) => chunks.length > 0);
}
