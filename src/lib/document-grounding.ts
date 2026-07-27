/**
 * Frontend-only helpers for the Search Results (grounding) panel.
 *
 * The backend hands over every document `search_documents` retrieved, not just
 * the ones the model actually cited. These helpers narrow that down to the
 * documents named in the response's "**Source: X**" line(s), and highlight the
 * exact phrases reused in the response text, so a reviewer can quickly see
 * what actually grounded the answer.
 */
import type { ChunkResource, DocumentResource } from "./ag-ui";

const SOURCE_LINE_RE = /\*\*(?:Source|स्रोत):\s*([^*\n]+)\*\*/gi;

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

/** Keep only documents whose `source` is actually cited in the response text. */
export function filterDocumentsByCitedSources(
  documents: DocumentResource[],
  responseText: string
): DocumentResource[] {
  const cited = extractCitedSources(responseText).map(normalize).filter(Boolean);
  if (!cited.length) return [];

  return documents.filter((doc) => {
    if (!doc.source) return false;
    const docSource = normalize(doc.source);
    if (!docSource) return false;
    return cited.some((name) => docSource.includes(name) || name.includes(docSource));
  });
}

export interface TextSegment {
  text: string;
  highlighted: boolean;
}

interface Token {
  text: string;
  isWord: boolean;
}

/**
 * Split into alternating word / non-word (punctuation, whitespace) runs;
 * joining all tokens reconstructs the original text exactly. \p{M} (Mark) is
 * grouped with \p{L}/\p{N} for the same reason as in `normalize` — combining
 * marks (e.g. Devanagari vowel signs) must stay attached to their base
 * letter, not get split off as their own "non-word" token.
 */
function tokenize(text: string): Token[] {
  const parts = text.match(/[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu) ?? [];
  return parts.map((p) => ({ text: p, isWord: /[\p{L}\p{M}\p{N}]/u.test(p) }));
}

/** A chunk word shorter than this is too common to count as real evidence on its own. */
const MIN_SIGNIFICANT_WORD_LENGTH = 4;

/** Lowercased words of every word-token in `tokens`, for matching. */
function wordsOf(tokens: Token[]): string[] {
  const words: string[] = [];
  for (const tok of tokens) {
    if (tok.isWord) words.push(tok.text.toLowerCase());
  }
  return words;
}

/**
 * Highlight individual significant words in a chunk that also appear
 * (as whole words) in the response — not a contiguous-phrase requirement.
 * Simpler than phrase-matching, and it doubles as the cross-language signal
 * for free: the backend appends bracketed target-language glossary
 * translations onto otherwise-English chunk text for non-English sessions
 * (e.g. "Sow [बुवाई]" — see agents/tools/terms.py normalize_text_with_glossary).
 * Those bracketed words are ordinary word-tokens like any other, so this same
 * word-set check naturally catches them when they appear in a translated
 * response, without a separate special case.
 *
 * Takes the response as a pre-built word set so callers checking many chunks
 * against the same response tokenize the response once, not once per chunk.
 *
 * Still approximate: there's no real provenance signal from the model, only
 * whether matching vocabulary exists. Chunk text stays mostly English even in
 * non-English sessions (the backend doesn't translate it, only annotates
 * glossary terms), so most real reuse there still won't highlight — only the
 * rare word that happens to be glossary-annotated.
 */
function highlightMatchedWords(chunkText: string, respWordSet: Set<string>): TextSegment[] {
  const tokens = tokenize(chunkText);
  const segments: TextSegment[] = [];
  let buffer = "";
  let bufferHighlighted = false;

  for (const tok of tokens) {
    const isMatch =
      tok.isWord &&
      tok.text.length >= MIN_SIGNIFICANT_WORD_LENGTH &&
      respWordSet.has(tok.text.toLowerCase());

    if (buffer && isMatch !== bufferHighlighted) {
      segments.push({ text: buffer, highlighted: bufferHighlighted });
      buffer = "";
    }
    buffer += tok.text;
    bufferHighlighted = isMatch;
  }
  if (buffer) segments.push({ text: buffer, highlighted: bufferHighlighted });

  return segments.length ? segments : [{ text: chunkText, highlighted: false }];
}

/** Single chunk/response pair convenience wrapper around {@link highlightMatchedWords}. */
export function highlightMatchedSegments(chunkText: string, responseText: string): TextSegment[] {
  return highlightMatchedWords(chunkText, new Set(wordsOf(tokenize(responseText))));
}

/** Length of the longest contiguous run of identical words shared by two word lists. */
function longestCommonRun(wordsA: string[], wordsB: string[]): number {
  if (!wordsA.length || !wordsB.length) return 0;
  let prevRow = new Array(wordsB.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= wordsA.length; i++) {
    const currRow = new Array(wordsB.length + 1).fill(0);
    for (let j = 1; j <= wordsB.length; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        currRow[j] = prevRow[j - 1] + 1;
        if (currRow[j] > best) best = currRow[j];
      } else {
        currRow[j] = 0;
      }
    }
    prevRow = currRow;
  }
  return best;
}

/**
 * Overlapping-window duplicates share a long *contiguous* run of identical
 * words, not just overlapping vocabulary — two distinct chunks on the same
 * topic can share plenty of ordinary words without being the same passage.
 */
const DUPLICATE_MIN_RUN_WORDS = 8;

/**
 * Drop chunks that are near-duplicates of a better (higher-scored, or longer)
 * chunk already kept — otherwise overlapping ingestion windows show the same
 * passage, and the same highlight, twice.
 */
function dedupeSimilarChunks(chunks: ChunkResource[]): ChunkResource[] {
  const ranked = [...chunks].sort((a, b) => {
    const scoreDiff = (b.score ?? -Infinity) - (a.score ?? -Infinity);
    return scoreDiff !== 0 ? scoreDiff : b.text.length - a.text.length;
  });

  const kept: { chunk: ChunkResource; words: string[] }[] = [];
  for (const chunk of ranked) {
    const words = normalize(chunk.text).split(" ").filter(Boolean);
    const isDuplicate = kept.some(
      ({ words: existing }) => longestCommonRun(words, existing) >= DUPLICATE_MIN_RUN_WORDS
    );
    if (!isDuplicate) kept.push({ chunk, words });
  }

  const keptIds = new Set(kept.map((k) => k.chunk.id));
  return chunks.filter((c) => keptIds.has(c.id));
}

export interface GroundedChunk {
  chunk: ChunkResource;
  segments: TextSegment[];
}

export interface GroundedDocument {
  doc: DocumentResource;
  chunks: GroundedChunk[];
}

/**
 * Full pipeline for the panel: keep only documents named in the response's
 * citation line when possible (reliable — an exact source-name match, not a
 * heuristic). But citation matching itself depends on the backend sending a
 * `source` field, which today it doesn't for non-English sessions (a
 * separate backend gap — `source_mr` is empty, so `source` is dropped from
 * the payload entirely). If citation matching finds nothing, this falls back
 * to every document retrieved this turn — the same underlying documents the
 * English panel shows, since retrieval itself doesn't depend on the response
 * language, only which source name got attached to them.
 *
 * Within a candidate document, if at least one chunk has a matched word,
 * only the matched chunks are kept — the rest add no debugging value. But if
 * *no* chunk in the document matches at all, its chunks are shown
 * unhighlighted rather than dropping the document — word-level matching only
 * works when the chunk and response share the same language/wording. Chunk
 * text stays mostly English even in non-English sessions (the backend only
 * appends bracketed glossary terms, it doesn't translate the chunk), so a
 * non-English response will often produce no highlight at all even when the
 * model genuinely used that chunk. Absence of a match is not absence of use —
 * only absence of *provable* use, so the document still deserves to be shown.
 */
export function getGroundedDocuments(
  documents: DocumentResource[],
  responseText: string
): GroundedDocument[] {
  const cited = filterDocumentsByCitedSources(documents, responseText);
  const candidates = cited.length ? cited : documents;
  if (!candidates.length) return [];

  // Build the response word set once and reuse across every chunk of every
  // candidate document, instead of re-tokenizing the same response per chunk.
  const respWordSet = new Set(wordsOf(tokenize(responseText)));
  const result: GroundedDocument[] = [];

  for (const doc of candidates) {
    const dedupedChunks = dedupeSimilarChunks(doc.chunks);
    const withSegments: GroundedChunk[] = dedupedChunks.map((chunk) => ({
      chunk,
      segments: highlightMatchedWords(chunk.text, respWordSet),
    }));

    const matched = withSegments.filter((c) => c.segments.some((s) => s.highlighted));
    const chunks = matched.length ? matched : withSegments;
    if (chunks.length) result.push({ doc, chunks });
  }

  return result;
}
