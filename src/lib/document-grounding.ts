/**
 * Panel helpers: cite-filter retrieved documents and dedupe identical chunks.
 *
 * Search hits are shown in the panel as soon as search_documents returns.
 * Prefer server `grounded_documents` when present. Otherwise every language
 * is narrowed the same way: keep docs named on a Source/स्रोत line (or
 * mentioned verbatim), falling back to the full pool when nothing matches —
 * e.g. because the citation was translated and no longer matches doc
 * metadata stored in another language/script.
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
    .normalize("NFC")
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

export interface GroundedDocument {
  doc: DocumentResource;
  chunks: ChunkResource[];
}

export interface GroundedDocumentsOptions {
  /** Full assistant text; when set, unused retrievals are dropped. */
  responseText?: string;
  /** `related_documents` — used only when no curated documents arrived. */
  candidates?: DocumentResource[];
  /** Server already filtered via CUSTOM grounded_documents — show as-is. */
  serverGrounded?: boolean;
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
  const { responseText = "", candidates = [], serverGrounded = false } = options;
  const pool = documents.length > 0 ? documents : candidates;

  if (serverGrounded) return toGrounded(documents.length ? documents : pool);

  // Search hits should stay visible in the panel as soon as they arrive.
  if (!responseText.trim()) return toGrounded(pool);

  // Same narrowing for every language — falls back to the full pool when the
  // citation doesn't match doc metadata (e.g. a translated Source name).
  const cited = filterDocumentsByCitedSources(pool, responseText);
  return toGrounded(cited.length ? cited : pool);
}

/** Filter panel cards by title, source, or chunk text. */
export function filterGroundedDocuments(
  documents: GroundedDocument[],
  query: string
): GroundedDocument[] {
  const q = query.trim().normalize("NFC").toLowerCase();
  if (!q) return documents;
  const fold = (value: string) => value.normalize("NFC").toLowerCase();
  return documents
    .map(({ doc, chunks }) => {
      const hit = fold(doc.title).includes(q) || fold(doc.source ?? "").includes(q);
      const matching = chunks.filter((chunk) => fold(chunk.text).includes(q));
      return { doc, chunks: matching.length ? matching : hit ? chunks : [] };
    })
    .filter(({ chunks }) => chunks.length > 0);
}
