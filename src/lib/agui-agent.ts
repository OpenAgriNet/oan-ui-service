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
 *   - `present_video`       → TOOL_CALL_RESULT content `{"videos":[…]}`
 *   - `present_suggestions` → TOOL_CALL_RESULT content `{"questions":[…]}`
 *   - retrieved documents   → CUSTOM event `related_documents`
 *
 * Conversation history lives server-side in Redis keyed by session id, so each
 * run sends only the newest user turn and the run's own message list is ignored.
 */

import { HttpAgent, type AgentSubscriber, type Message } from "@ag-ui/client";
import {
  mergeDocuments,
  type DocumentResource,
  type VideoResource,
} from "@/lib/ag-ui";

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

  const subscriber: AgentSubscriber = {
    onTextMessageContentEvent: ({ event }) => {
      if (!event.delta) return;
      text += event.delta;
      onText(event.delta);
    },

    onToolCallStartEvent: ({ event }) => {
      onToolStart?.(event.toolCallName);
    },

    onToolCallResultEvent: ({ event }) => {
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
      if (event.name !== "related_documents") return;
      const value = event.value as { documents?: DocumentResource[] } | undefined;
      if (!Array.isArray(value?.documents) || !value.documents.length) return;
      documents = mergeDocuments(documents, value.documents);
      onDocuments?.(documents);
    },

    onRunErrorEvent: ({ event }) => {
      streamError = new Error(event.message || "AG-UI stream error");
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
