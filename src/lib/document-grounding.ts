/**
 * Frontend-only helpers for the Search Results (grounding) panel.
 *
 * The backend hands over every document `search_documents` retrieved, not just
 * the ones the model actually used. These helpers narrow that down to the
 * documents actually referenced in the response text — either via a
 * "**Source: X**" line or just named in prose — so the panel only ever shows
 * the sources the answer actually points to.
 */
import type { ChunkResource, DocumentResource } from "./ag-ui";

// "s?" after Source: the model writes "**Sources: A, B**" (plural) when
// citing more than one document together in a single line — without it,
// that whole line fails to match and both names are lost from `cited`.
const SOURCE_LINE_RE = /\*\*(?:Sources?|स्रोत):\s*([^*\n]+)\*\*/gi;

/** Extract cited source names from a "**Source: A / B**" style line, split on separators. */
export function extractCitedSources(text: string): string[] {
  if (!text) return [];
  const names: string[] = [];
  for (const match of text.matchAll(SOURCE_LINE_RE)) {
    const raw = match[1] ?? "";
    for (const part of raw.split(/\s*[/,]\s*| and /i)) {
      const trimmed = part.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  return names;
}

// \p{M} (Mark) must be kept alongside \p{L} (Letter) — Devanagari (and other
// Indic script) vowel signs/virama/anusvara are combining marks, a separate
// Unicode category from letters. Stripping them corrupts the text instead of
// just removing punctuation, e.g. "कृषि" -> "कष" (vowel signs silently gone).
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A name shorter than this is too generic to safely substring-match against
 * the whole response body (would false-positive on common short titles).
 */
const MIN_PLAIN_MENTION_LENGTH = 4;

/**
 * Keep only documents actually referenced in the response text. `source` and
 * `title` are checked independently — one can be empty/missing while the
 * other still carries the match (e.g. a backend gap leaves `source` blank,
 * but the full descriptive `title` still contains the cited name) — so a
 * document counts as referenced if *either* field matches in *either* of two
 * ways:
 *  1. Overlaps a name pulled from an explicit "**Source: X**" citation line
 *     (e.g. cited name "ICAR" is a substring of a longer title like
 *     "Biofertilizers for Sustainable Crop Production by ICAR").
 *  2. Otherwise appears verbatim in the plain response text — the model
 *     doesn't always use the formal citation tag even when it did use a
 *     document, so relying on (1) alone silently excludes genuinely-used
 *     sources whenever the model phrases the reference differently.
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

/**
 * Collapse chunks that are word-for-word the same passage (after
 * normalizing case/punctuation/whitespace) — e.g. the same physical chunk
 * coming back from two separate search_documents calls with different ids.
 * Deliberately an exact-match bar, not a fuzzy/word-overlap one: two chunks
 * that merely discuss similar things, or partially overlap, are kept as
 * distinct — only a literal repeat of the same text is removed.
 */
function dedupeExactChunks(chunks: ChunkResource[]): ChunkResource[] {
  const seen = new Set<string>();
  const result: ChunkResource[] = [];
  for (const chunk of chunks) {
    const key = normalize(chunk.text);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(chunk);
  }
  return result;
}

/**
 * Full pipeline for the panel: keep only documents actually referenced in
 * the response text (see `filterDocumentsByCitedSources`), and for each of
 * those documents, every retrieved chunk exactly as retrieved, minus literal
 * repeats of the same passage (see `dedupeExactChunks`). Nothing is dropped
 * based on word-overlap with the response or on fuzzy similarity between
 * chunks: once a document is referenced, every distinct chunk from it stays
 * visible, matching what shows up in Langfuse.
 */
export function getGroundedDocuments(
  documents: DocumentResource[],
  responseText: string
): GroundedDocument[] {
  const candidates = filterDocumentsByCitedSources(documents, responseText);
  if (!candidates.length) return [];

  return candidates
    .map((doc) => ({ doc, chunks: dedupeExactChunks(doc.chunks) }))
    .filter(({ chunks }) => chunks.length > 0);
}
