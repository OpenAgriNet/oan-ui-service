/**
 * AG-UI transport for the chat stream, built on the official `@ag-ui/client`.
 *
 * `HttpAgent` owns the protocol (framing, event typing, abort); we only
 * subscribe to the events this app renders. The backend (`POST /api/streaming`)
 * runs the same agent as `/api/chat/` and streams real pydantic-ai events, so
 * tool calls arrive when the model actually makes them rather than being
 * replayed after the text.
 *
 * The one payload we care about rides on an ordinary protocol event — no
 * custom transport:
 *   - `present_video` → TOOL_CALL_RESULT content `{"videos":[…]}`
 *
 * Conversation history lives server-side in Redis keyed by session id, so each
 * run sends only the newest user turn and the run's own message list is ignored.
 *
 * Follow-up suggestions are NOT handled here — this backend has no
 * `present_suggestions` tool; suggestions keep coming from the existing
 * `/api/suggest/` poll (see `ApiService.getSuggestions`), unchanged.
 */

import { HttpAgent, type AgentSubscriber, type Message } from "@ag-ui/client";
import { type VideoResource } from "@/lib/ag-ui";

export interface RunAgUiChatOptions {
  /** Absolute URL of the AG-UI endpoint, e.g. https://host/api/streaming */
  url: string;
  headers: Record<string, string>;
  query: string;
  sessionId: string;
  sourceLang: string;
  targetLang: string;
  userId: string;
  onText: (delta: string) => void;
  onVideos?: (videos: VideoResource[]) => void;
  signal?: AbortSignal;
}

export interface AgUiChatResult {
  text: string;
  videos?: VideoResource[];
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
  let streamError: Error | null = null;
  // The model can call a tool (e.g. present_video) mid-answer, which starts a
  // *new* text message for the continuation once the tool result is back —
  // normal for tool-interleaved streaming. Without a separator, that
  // continuation's first delta lands directly against the prior message's
  // last delta with no space, e.g. "...documente Would you like...".
  let sawTextMessage = false;

  const subscriber: AgentSubscriber = {
    onTextMessageStartEvent: () => {
      if (!sawTextMessage) {
        sawTextMessage = true;
        return;
      }
      text += "\n\n";
      onText("\n\n");
    },

    onTextMessageContentEvent: ({ event }) => {
      if (!event.delta) return;
      text += event.delta;
      onText(event.delta);
    },

    onToolCallResultEvent: ({ event }) => {
      const payload = parseToolResult(event.content);
      if (!payload) return;

      if (Array.isArray(payload.videos) && payload.videos.length) {
        videos = payload.videos as VideoResource[];
        onVideos?.(videos);
      }
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
  };
}
