/**
 * Panel helpers: cite-filter retrieved documents and dedupe identical chunks.
 */
import type { ChunkResource, DocumentResource } from "./ag-ui";

const SOURCE_LINE_RE = /\*\*(?:Sources?|स्रोत):\s*([^*\n]+)\*\*/gi;

export function extractCitedSources(text: string): string[] {
  if (!text) return [];
  const names: string[] = [];
  for (const match of text.matchAll(SOURCE_LINE_RE)) {
    for (const part of (match[1] ?? "").split(/\s*[/,]\s*| and /i)) {
      const trimmed = part.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  return names;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_PLAIN_MENTION_LENGTH = 4;

export function filterDocumentsByCitedSources(
  documents: DocumentResource[],
  responseText: string
): DocumentResource[] {
  const cited = extractCitedSources(responseText).map(normalize).filter(Boolean);
  const normalizedResponse = normalize(responseText);
  const matches = (value: string) => {
    if (!value) return false;
    if (cited.some((name) => value.includes(name) || name.includes(value))) return true;
    return value.length >= MIN_PLAIN_MENTION_LENGTH && normalizedResponse.includes(value);
  };
  return documents.filter(
    (doc) => matches(doc.source ? normalize(doc.source) : "") || matches(normalize(doc.title))
  );
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
  const { responseText = "", candidates = [] } = options;
  const pool = documents.length > 0 ? documents : candidates;
  const selected = responseText.trim()
    ? filterDocumentsByCitedSources(pool, responseText)
    : documents;
  return toGrounded(selected);
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
