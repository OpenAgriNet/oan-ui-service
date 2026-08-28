/**
 * AG-UI transport for the chat stream, built on the official `@ag-ui/client`.
 *
 * Replaces the previous hand-rolled SSE frame parser: `HttpAgent` owns the
 * protocol (framing, event typing, abort), and we only subscribe to the events
 * we render. The backend (`POST /api/agui`) runs the same agent as `/api/chat/`
 * and streams real pydantic-ai events, so tool calls arrive when the model
 * actually makes them rather than being replayed after the text.
 *
 * Payloads we care about ride on ordinary protocol events — no custom transport:
 *   - `present_video`          → TOOL_CALL_RESULT content `{"videos":[…]}`
 *   - `present_suggestions`    → TOOL_CALL_RESULT content `{"questions":[…]}`
 *   - `search_documents`       → TOOL_CALL_START / ARGS (query) + RESULT hits shown in the panel
 *   - `present_search_results` → TOOL_CALL_RESULT content `{"documents":[…]}`
 *   - `related_search_results` → CUSTOM event, reconciliation / fallback
 *   - `related_documents`      → CUSTOM event, unfiltered retrieval candidates
 *   - `grounded_documents`     → CUSTOM event, server-filtered docs for the panel
 *
 * Conversation history lives server-side in Redis keyed by session id, so each
 * run sends only the newest user turn and the run's own message list is ignored.
 */

import { HttpAgent, type AgentSubscriber, type Message } from "@ag-ui/client";
import { type DocumentResource, type VideoResource } from "@/lib/ag-ui";
import {
  createSearchLifecycle,
  type SearchPanelSnapshot,
} from "@/lib/search-lifecycle";

export interface RunAgUiChatOptions {
  /** Absolute URL of the AG-UI endpoint, e.g. https://host/api/agui */
  url: string;
  headers: Record<string, string>;
  query: string;
  sessionId: string;
  sourceLang: string;
  targetLang: string;
  userId: string;
  onText: (delta: string) => void;
  onVideos?: (videos: VideoResource[]) => void;
  onDocuments?: (documents: DocumentResource[]) => void;
  onSuggestions?: (questions: string[]) => void;
  /** Progressive search-panel state from search_documents / present_search_results. */
  onSearchUpdate?: (snapshot: SearchPanelSnapshot) => void;
  /** Tool lifecycle, for a "looking things up…" indicator. */
  onToolStart?: (toolName: string) => void;
  signal?: AbortSignal;
}

export interface AgUiChatResult {
  text: string;
  videos?: VideoResource[];
  documents?: DocumentResource[];
  suggestions?: string[];
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Tool results are JSON strings; anything else is prose meant for the model. */
function parseToolResult(content: unknown): Record<string, unknown> | null {
  if (content && typeof content === "object") return content as Record<string, unknown>;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function runAgUiChat(options: RunAgUiChatOptions): Promise<AgUiChatResult> {
  const {
    url,
    headers,
    query,
    sessionId,
    sourceLang,
    targetLang,
    userId,
    onText,
    onVideos,
    onDocuments,
    onSuggestions,
    onSearchUpdate,
    onToolStart,
    signal,
  } = options;

  const userMessage: Message = { id: newId(), role: "user", content: query };

  // A fresh agent per run: the server owns history, so there is nothing to
  // accumulate or reset between turns.
  const agent = new HttpAgent({
    url,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    threadId: sessionId,
    initialMessages: [userMessage],
    initialState: {
      query,
      session_id: sessionId,
      thread_id: sessionId,
      source_lang: sourceLang,
      target_lang: targetLang,
      lang_code: targetLang,
      user_id: userId,
    },
  });

  let text = "";
  let videos: VideoResource[] = [];
  let documents: DocumentResource[] | undefined;
  let suggestions: string[] = [];
  let streamError: Error | null = null;
  const searchLifecycle = createSearchLifecycle();

  const emitSearch = (snapshot: SearchPanelSnapshot) => {
    if (snapshot.status === "idle") return;
    onSearchUpdate?.(snapshot);
    if (snapshot.documents.length || snapshot.candidates.length) {
      documents = snapshot.documents.length ? snapshot.documents : snapshot.candidates;
      onDocuments?.(documents);
    }
  };

  const subscriber: AgentSubscriber = {
    onTextMessageContentEvent: ({ event }) => {
      if (!event.delta) return;
      text += event.delta;
      onText(event.delta);
    },

    onToolCallStartEvent: ({ event }) => {
      onToolStart?.(event.toolCallName);
      emitSearch(
        searchLifecycle.apply({
          type: "TOOL_CALL_START",
          toolCallId: event.toolCallId,
          toolCallName: event.toolCallName,
        })
      );
    },

    onToolCallArgsEvent: ({ event, partialToolCallArgs }) => {
      emitSearch(
        searchLifecycle.apply({
          type: "TOOL_CALL_ARGS",
          toolCallId: event.toolCallId,
          delta: event.delta,
          partialArgs: partialToolCallArgs,
        })
      );
    },

    onToolCallResultEvent: ({ event }) => {
      emitSearch(
        searchLifecycle.apply({
          type: "TOOL_CALL_RESULT",
          toolCallId: event.toolCallId,
          content: event.content,
        })
      );

      const payload = parseToolResult(event.content);
      if (!payload) return;

      if (Array.isArray(payload.videos) && payload.videos.length) {
        videos = payload.videos as VideoResource[];
        onVideos?.(videos);
      }
      if (Array.isArray(payload.questions) && payload.questions.length) {
        suggestions = (payload.questions as unknown[]).filter(
          (q): q is string => typeof q === "string" && q.trim().length > 0
        );
        if (suggestions.length) onSuggestions?.(suggestions);
      }
    },

    onCustomEvent: ({ event }) => {
      emitSearch(
        searchLifecycle.apply({
          type: "CUSTOM",
          name: event.name,
          value: event.value,
        })
      );
    },

    onRunErrorEvent: ({ event }) => {
      streamError = new Error(event.message || "AG-UI stream error");
      emitSearch(searchLifecycle.apply({ type: "RUN_ERROR" }));
    },

    onRunFinishedEvent: () => {
      emitSearch(searchLifecycle.apply({ type: "RUN_FINISHED" }));
    },
  };

  const abort = () => agent.abortRun();
  signal?.addEventListener("abort", abort);

  try {
    await agent.runAgent({ runId: newId(), tools: [], context: [], forwardedProps: {} }, subscriber);
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  if (streamError) throw streamError;

  return {
    text,
    videos: videos.length ? videos : undefined,
    documents: documents?.length ? documents : undefined,
    suggestions: suggestions.length ? suggestions : undefined,
  };
}
