/**
 * Progressive search-panel state from AG-UI tool/custom events.
 * Display search_documents hits as soon as they return, then merge
 * present_search_results / related_search_results. grounded_documents replaces
 * the list when the server sends it. related_documents stays as candidates.
 */

import { mergeDocuments, type DocumentResource, type ChunkResource } from "@/lib/ag-ui";

export const SEARCH_DOCUMENTS_TOOL = "search_documents";
export const PRESENT_SEARCH_RESULTS_TOOL = "present_search_results";
export const RELATED_SEARCH_RESULTS_EVENT = "related_search_results";
export const RELATED_DOCUMENTS_EVENT = "related_documents";
/** Server-filtered docs that support the final answer (language-agnostic). */
export const GROUNDED_DOCUMENTS_EVENT = "grounded_documents";

const isSearchTool = (name?: string) => name === SEARCH_DOCUMENTS_TOOL;

export type SearchPanelStatus = "idle" | "searching" | "results" | "empty" | "error";

export const ACTIVE_SEARCH_STATUSES: SearchPanelStatus[] = [
  "searching",
  "results",
  "empty",
  "error",
];

export interface SearchCallSnapshot {
  toolCallId: string;
  query?: string;
  status: Exclude<SearchPanelStatus, "idle">;
}

export interface SearchPanelSnapshot {
  status: SearchPanelStatus;
  query?: string;
  queries: string[];
  documents: DocumentResource[];
  candidates: DocumentResource[];
  /** True when `documents` came from server `grounded_documents` (skip client cite-filter). */
  serverGrounded?: boolean;
  calls: SearchCallSnapshot[];
}

export function getSearchStatusText(
  t: (key: string) => unknown,
  status: SearchPanelStatus,
  count: number
): string {
  if (status === "searching") return (t("searchSearching") as string) || "Searching";
  if (status === "error") return (t("searchFailed") as string) || "Search failed";
  if (status === "empty" || (status === "results" && !count)) {
    return (t("searchNoResults") as string) || "No results";
  }
  const key = count === 1 ? "searchSource" : "searchSources";
  return `${count} ${(t(key) as string) || (count === 1 ? "source" : "sources")}`;
}

export type SearchLifecycleEvent =
  | { type: "TOOL_CALL_START"; toolCallId: string; toolCallName: string }
  | { type: "TOOL_CALL_ARGS"; toolCallId: string; delta?: string; partialArgs?: unknown }
  | { type: "TOOL_CALL_RESULT"; toolCallId: string; content: unknown }
  | { type: "CUSTOM"; name: string; value: unknown }
  | { type: "RUN_ERROR" }
  | { type: "RUN_FINISHED" };

interface SearchCallState {
  toolCallId: string;
  query?: string;
  argsBuffer: string;
  status: Exclude<SearchPanelStatus, "idle">;
  documents: DocumentResource[];
  presentToolCallId?: string;
}

type JsonObject = Record<string, unknown>;
const asRecord = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;

const text = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value.trim() : undefined;
};

const score = (...values: unknown[]) =>
  values.find((value): value is number => typeof value === "number");

export function isUsableHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function extractSearchQuery(args: unknown): string | undefined {
  if (typeof args === "string") {
    const trimmed = args.trim();
    if (!trimmed) return undefined;
    try {
      return extractSearchQuery(JSON.parse(trimmed));
    } catch {
      const match = trimmed.match(/"query"\s*:\s*"((?:\\.|[^"\\])*)(?:"|$)/);
      if (!match) return undefined;
      try {
        return JSON.parse(`"${match[1]}"`) as string;
      } catch {
        return match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }
  }
  const record = asRecord(args);
  return record ? text(record.query) : undefined;
}

function normalizeChunk(raw: unknown, fallbackId: string): ChunkResource | null {
  if (typeof raw === "string") return raw.trim() ? { id: fallbackId, text: raw.trim() } : null;
  const record = asRecord(raw);
  const chunkText =
    record &&
    text(record.text, record.content, record.page_content, record.snippet, record.highlight);
  return record && chunkText
    ? {
        id: text(record.id, record._id) ?? fallbackId,
        text: chunkText,
        score: score(record.score, record._score),
      }
    : null;
}

export function normalizeDocument(raw: unknown, index = 0): DocumentResource | null {
  const record = asRecord(raw);
  if (!record) return null;
  const inner = asRecord(record.document) ?? asRecord(record.doc) ?? record;
  const meta = asRecord(inner.metadata);
  const title = text(
    inner.title,
    inner.name,
    inner.file_name,
    inner.filename,
    meta?.title,
    meta?.name,
    record.title,
    record.name
  );
  const id =
    text(inner.id, inner._id, inner.document_id, record.id, record._id, record.document_id) ??
    title ??
    `doc-${index}`;
  const source = text(inner.source, inner.source_name, meta?.source, record.source) ?? null;
  const url =
    [inner.url, inner.source_url, record.url, record.source_url, meta?.url].find(isUsableHttpUrl)?.trim() ??
    null;
  const rawChunks =
    inner.chunks ?? record.chunks ?? (inner.chunk ? [inner.chunk] : record.chunk ? [record.chunk] : undefined);
  let chunks = Array.isArray(rawChunks)
    ? rawChunks
        .map((chunk, i) => normalizeChunk(chunk, `${id}-chunk-${i}`))
        .filter((chunk): chunk is ChunkResource => chunk !== null)
    : [];
  const inlineText = text(
    inner.text,
    inner.content,
    inner.page_content,
    inner.snippet,
    inner.highlight,
    record.text,
    record.snippet,
    record.content,
    record.highlight
  );
  if (!chunks.length && inlineText) {
    chunks = [
      {
        id: `${id}-chunk-0`,
        text: inlineText,
        score: score(inner.score, inner._score, record.score, record._score),
      },
    ];
  }
  return {
    id,
    title: title ?? id,
    source,
    url,
    chunks,
    score: score(inner.score, inner._score, record.score, record._score),
  };
}

export type DocumentsParseResult =
  | { ok: true; documents: DocumentResource[] }
  | { ok: false; documents: DocumentResource[] };

function documentsFromUnknown(value: unknown): DocumentResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => normalizeDocument(item, index))
    .filter((doc): doc is DocumentResource => doc !== null);
}

export function parseDocumentsPayload(content: unknown): DocumentsParseResult {
  let value = content;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ok: true, documents: [] };
    try {
      value = JSON.parse(trimmed);
    } catch {
      return { ok: false, documents: [] };
    }
  }
  if (Array.isArray(value)) return { ok: true, documents: documentsFromUnknown(value) };
  const record = asRecord(value);
  if (!record) return { ok: false, documents: [] };
  const nested =
    record.data ??
    record.payload ??
    record.result ??
    record.return_value ??
    record.output ??
    record.content;
  if (nested !== undefined && nested !== record && !Array.isArray(record.documents) && !Array.isArray(record.hits)) {
    const fromNested = parseDocumentsPayload(nested);
    if (fromNested.ok && fromNested.documents.length) return fromNested;
  }
  const docs =
    record.documents ??
    record.related_documents ??
    record.grounded_documents ??
    record.search_results ??
    record.retrieved_documents ??
    record.sources ??
    record.results ??
    record.hits;
  if (typeof record.error === "string" && docs === undefined) {
    return { ok: false, documents: [] };
  }
  if (docs === undefined) return { ok: true, documents: [] };
  if (!Array.isArray(docs)) return { ok: false, documents: [] };
  return { ok: true, documents: documentsFromUnknown(docs) };
}

const EMPTY_SNAPSHOT: SearchPanelSnapshot = {
  status: "idle",
  queries: [],
  documents: [],
  candidates: [],
  calls: [],
};

export function createSearchLifecycle() {
  const toolNames = new Map<string, string>();
  const calls = new Map<string, SearchCallState>();
  const presentations = new Map<string, SearchCallState>();
  let documents: DocumentResource[] = [];
  let candidates: DocumentResource[] = [];
  let serverGrounded = false;

  const ensureCall = (id: string): SearchCallState => {
    const existing = calls.get(id);
    if (existing) return existing;
    const call: SearchCallState = { toolCallId: id, argsBuffer: "", status: "searching", documents: [] };
    calls.set(id, call);
    return call;
  };

  const pairPresentation = (id: string): SearchCallState | undefined => {
    const existing = presentations.get(id);
    if (existing) return existing;
    const call = [...calls.values()].find((item) => !item.presentToolCallId);
    if (!call) return undefined;
    call.presentToolCallId = id;
    presentations.set(id, call);
    return call;
  };

  function snapshot(): SearchPanelSnapshot {
    if (!calls.size && !documents.length && !candidates.length) return EMPTY_SNAPSHOT;
    const callSnapshots: SearchCallSnapshot[] = [...calls.values()].map((call) => ({
      toolCallId: call.toolCallId,
      query: call.query,
      status: call.status,
    }));
    const queries = callSnapshots.map((call) => call.query).filter((query): query is string => Boolean(query));
    const searchingCall = callSnapshots.find((call) => call.status === "searching");
    const status: SearchPanelStatus =
      searchingCall && !documents.length
        ? "searching"
        : documents.length || candidates.length
          ? "results"
          : callSnapshots.some((call) => call.status === "error")
            ? "error"
            : callSnapshots.some((call) => call.status === "empty" || call.status === "results")
              ? "empty"
              : "idle";
    const query =
      searchingCall?.query ?? [...callSnapshots].reverse().find((call) => call.query)?.query;
    return {
      status,
      query,
      queries,
      documents,
      candidates,
      serverGrounded: serverGrounded || undefined,
      calls: callSnapshots,
    };
  }

  function applySearchHits(id: string, content: unknown) {
    const call = ensureCall(id);
    const parsed = parseDocumentsPayload(content);
    if (!parsed.ok) return;
    candidates = mergeDocuments(candidates, parsed.documents);
    if (serverGrounded) {
      call.status = documents.length ? "results" : parsed.documents.length ? "results" : "empty";
      return;
    }
    call.documents = mergeDocuments(call.documents, parsed.documents);
    documents = mergeDocuments(documents, parsed.documents);
    call.status = documents.length ? "results" : "empty";
  }

  function applyPresentResult(id: string, content: unknown) {
    const parsed = parseDocumentsPayload(content);
    let call = pairPresentation(id);
    if (!call) {
      call = ensureCall(id);
      call.presentToolCallId = id;
      presentations.set(id, call);
    }
    if (!parsed.ok) {
      if (call.status === "searching" && !call.documents.length && !documents.length) {
        call.status = "error";
      }
      return;
    }
    // Agent presentation is provisional; server grounded_documents may replace it.
    if (!serverGrounded) {
      call.documents = mergeDocuments(call.documents, parsed.documents);
      call.status = parsed.documents.length || call.documents.length ? "results" : "empty";
      documents = mergeDocuments(documents, parsed.documents);
    }
  }

  function applyServerGrounded(value: unknown) {
    const parsed = parseDocumentsPayload(value);
    if (!parsed.ok) return;
    serverGrounded = true;
    documents = parsed.documents;
    const next = documents.length ? "results" : "empty";
    calls.forEach((call) => {
      call.documents = documents;
      if (call.status === "searching" || call.status === "empty" || call.status === "results") {
        call.status = next;
      }
    });
  }

  function reconcile(value: unknown) {
    const parsed = parseDocumentsPayload(value);
    if (!parsed.ok || serverGrounded) return;
    documents = mergeDocuments(documents, parsed.documents);
    const next = parsed.documents.length || documents.length ? "results" : "empty";
    calls.forEach((call) => {
      if (call.status === "searching" || (next === "results" && call.status === "empty")) {
        call.status = next;
      }
    });
  }

  function apply(event: SearchLifecycleEvent): SearchPanelSnapshot {
    switch (event.type) {
      case "TOOL_CALL_START": {
        toolNames.set(event.toolCallId, event.toolCallName);
        if (isSearchTool(event.toolCallName)) ensureCall(event.toolCallId);
        if (event.toolCallName === PRESENT_SEARCH_RESULTS_TOOL) pairPresentation(event.toolCallId);
        break;
      }
      case "TOOL_CALL_ARGS": {
        const name = toolNames.get(event.toolCallId);
        if (name && !isSearchTool(name) && !calls.has(event.toolCallId)) break;
        if (isSearchTool(name) || calls.has(event.toolCallId)) {
          const call = ensureCall(event.toolCallId);
          if (event.delta) call.argsBuffer += event.delta;
          const query = extractSearchQuery(event.partialArgs) ?? extractSearchQuery(call.argsBuffer);
          if (query) call.query = query;
        }
        break;
      }
      case "TOOL_CALL_RESULT": {
        const name = toolNames.get(event.toolCallId);
        if (isSearchTool(name)) {
          applySearchHits(event.toolCallId, event.content);
          break;
        }
        if (name === PRESENT_SEARCH_RESULTS_TOOL || presentations.has(event.toolCallId)) {
          applyPresentResult(event.toolCallId, event.content);
          break;
        }
        if (!name) {
          const parsed = parseDocumentsPayload(event.content);
          if (parsed.ok && (parsed.documents.length || calls.size)) {
            applyPresentResult(event.toolCallId, event.content);
          }
        }
        break;
      }
      case "CUSTOM": {
        if (event.name === GROUNDED_DOCUMENTS_EVENT) applyServerGrounded(event.value);
        else if (event.name === RELATED_SEARCH_RESULTS_EVENT) reconcile(event.value);
        else if (event.name === RELATED_DOCUMENTS_EVENT) {
          const parsed = parseDocumentsPayload(event.value);
          if (parsed.ok) {
            candidates = mergeDocuments(candidates, parsed.documents);
          }
        }
        break;
      }
      case "RUN_ERROR":
        calls.forEach((call) => {
          if (call.status === "searching") call.status = "error";
        });
        break;
      case "RUN_FINISHED":
        calls.forEach((call) => {
          if (call.status === "searching") call.status = documents.length ? "results" : "empty";
        });
        break;
    }
    return snapshot();
  }

  return { apply, snapshot };
}
