/**
 * Panel helpers: render the sources the server says back the answer.
 *
 * The server is authoritative. The Search Results Panel is driven by the
 * document ids the model reported via `present_search_results`, resolved and
 * chunk-pruned server-side and delivered as the `grounded_documents` CUSTOM
 * event. The client no longer parses `Source/स्रोत` lines or transliterates
 * names — that heuristic produced wrong/irrelevant sources. Here we only:
 *   - while streaming, show the retrieved hits so the panel isn't empty, and
 *   - once the server has grounded, render exactly what it sent.
 */
import type { ChunkResource, DocumentResource } from "./ag-ui";

function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GroundedDocument {
  doc: DocumentResource;
  chunks: ChunkResource[];
}

export interface GroundedDocumentsOptions {
  /** Full assistant text. Only used to tell "still streaming" from "finished". */
  responseText?: string;
  /** `related_documents` — the retrieval pool, shown while the server has not grounded yet. */
  candidates?: DocumentResource[];
  /** Server sent the `grounded_documents` CUSTOM event — render `documents` as-is. */
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

/**
 * Documents to render in the panel.
 *
 * - `serverGrounded`: the server already chose the exact sources (by document
 *   id) that back the answer — render them verbatim, no client filtering.
 * - otherwise (streaming, or the server sent nothing yet): show the retrieval
 *   pool so the panel shows progress. We never drop sources by matching the
 *   answer text — that is the server's job and its result arrives as
 *   `grounded_documents`.
 */
export function getGroundedDocuments(
  documents: DocumentResource[],
  options: GroundedDocumentsOptions = {}
): GroundedDocument[] {
  const { candidates = [], serverGrounded = false } = options;
  // Server chose the exact sources by id — render them verbatim, even when the
  // list is empty (e.g. a weather-only answer grounds to no document).
  if (serverGrounded) return toGrounded(documents);
  // Not grounded yet (streaming, or no server event): show the retrieval pool.
  const pool = documents.length > 0 ? documents : candidates;
  return toGrounded(pool);
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
