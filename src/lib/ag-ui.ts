/**
 * Shared AG-UI payload types plus the assistant-text normalisation the chat
 * bubble applies before rendering.
 *
 * SSE framing and event decoding live in `@ag-ui/client` (see
 * `src/lib/agui-agent.ts`); this module does not parse the wire format.
 */

export interface VideoResource {
  id: string;
  title: string;
  url: string;
  provider?: string;
  embed_url?: string | null;
  thumbnail_url?: string | null;
  description?: string | null;
  source?: string | null;
}

const CUE_EN =
  /for more information,\s*watch (?:the videos below|the below video)\.?/i;
const CUE_HI =
  /अधिक जानकारी के लिए नीचे (?:दिए गए वीडियो|दिया गया वीडियो) देखें।?/;
const CUE_MR = /अधिक माहितीसाठी खालील व्हिडिओ पहा\.?/;

/** User only asked whether / for videos (not a full advisory). */
export function isVideoOnlyUserQuery(query?: string): boolean {
  if (!query?.trim()) return false;
  const q = query.trim().toLowerCase();

  const videoAsk =
    /\b(video|videos|clip|youtube)\b/.test(q) ||
    /वीडियो|व्हिडिओ|विडियो/.test(query);

  if (!videoAsk) return false;

  const advisory =
    /\b(how|what|when|why|which|manage|control|treat|fertiliz|irrigat|spray|dose|symptom|prevent|grow|cultivat|sowing|pest|disease)\b/.test(
      q
    ) ||
    /कसे|काय|कधी|कसे करावे|नियंत्रण|व्यवस्थापन|खत|सिंचन|रोग|कीड|कैसे|क्या|कब|नियंत्रण|खाद/.test(
      query
    );

  if (advisory && /\b(how|what|manage|control|treat)\b/.test(q)) return false;

  if (
    /^(is there|are there|any|do you have|show me|give me|find|got any)\b.*\b(video|videos)\b/i.test(
      q
    ) ||
    /\b(video|videos)\b.*(on|for|about|of)\b/i.test(q) ||
    /^(show|play|watch)\b.*\b(video|videos)\b/i.test(q) ||
    /(कोई वीडियो|व्हिडिओ आहे|वीडियो है|वीडियो दिखा|व्हिडिओ दाखव)/.test(query)
  ) {
    return true;
  }

  if (videoAsk && q.split(/\s+/).length <= 12 && !advisory) {
    return true;
  }

  return false;
}

function stripVideoCueLines(text: string): string {
  return text
    .replace(new RegExp(`\\n?${CUE_EN.source}\\n?`, "gi"), "\n")
    .replace(new RegExp(`\\n?${CUE_HI.source}\\n?`, "g"), "\n")
    .replace(new RegExp(`\\n?${CUE_MR.source}\\n?`, "g"), "\n");
}

/**
 * True when the answer has real advisory content (not only a short video intro).
 */
export function hasSubstantiveAnswer(text: string): boolean {
  let t = text
    .replace(/\*\*Source:[^*]*\*\*/gi, "")
    .replace(/\*\*स्रोत:[^*]*\*\*/gi, "");
  t = stripVideoCueLines(t);
  t = t.replace(/[#>*_\-•]/g, " ").replace(/\s+/g, " ").trim();
  return t.length >= 120 || (t.split(/[.!?।]/).filter(Boolean).length >= 2 && t.length >= 80);
}

function videoCueLine(language?: string): string {
  const lang = (language || "en").toLowerCase();
  if (lang === "hi") return "अधिक जानकारी के लिए नीचे दिया गया वीडियो देखें।";
  if (lang === "mr" || lang === "bhb") return "अधिक माहितीसाठी खालील व्हिडिओ पहा.";
  return "For more information, watch the below video.";
}

/**
 * Place cue after Source (if any), otherwise before a trailing follow-up question.
 * Never leave it after the follow-up question.
 */
function insertVideoCue(text: string, cue: string): string {
  const out = stripVideoCueLines(text).replace(/\n{3,}/g, "\n\n").trim();

  // After the last **Source: ...** / **स्रोत: ...** line
  const sourceRe = /(\*\*(?:Source|स्रोत):[^*\n]+\*\*)/gi;
  let lastSource: { index: number; length: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = sourceRe.exec(out)) !== null) {
    lastSource = { index: m.index, length: m[0].length };
  }
  if (lastSource) {
    const insertAt = lastSource.index + lastSource.length;
    return `${out.slice(0, insertAt)}\n\n${cue}${out.slice(insertAt)}`
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Before trailing follow-up question (last paragraph ending with ?)
  const parts = out.split(/\n\n+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    if (/\?\s*$/.test(last) && last.length < 200) {
      parts.splice(parts.length - 1, 0, cue);
      return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    }
  }

  return `${out}\n\n${cue}`.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Normalize assistant text around videos:
 * - Always strip hallucinated video cue when there are no videos
 * - When videos exist with a full answer: one cue after Source, before follow-up
 * - When user only asked for videos: no cue
 */
export function normalizeVideoMentionText(
  text: string,
  hasVideos: boolean,
  language?: string,
  userQuery?: string
): string {
  if (!text) return text;

  let out = text;

  // Drop common "Related Videos" dumps
  const sectionPatterns = [
    /\n{0,2}\*{0,2}Related Videos:?\*{0,2}\s*\n(?:[-*•].+\n?)*/gi,
    /\n{0,2}\*{0,2}संबंधित वीडियो:?\*{0,2}\s*\n(?:[-*•].+\n?)*/gi,
    /\n{0,2}\*{0,2}संबंधित व्हिडिओ:?\*{0,2}\s*\n(?:[-*•].+\n?)*/gi,
  ];
  for (const re of sectionPatterns) {
    out = out.replace(re, "\n");
  }

  out = out.replace(/\n?[-*•]?\s*\[[^\]]+\]\((https?:\/\/[^\s)]+)\)\s*/gi, "\n");
  out = out.replace(
    /\n?[^\n]*(?:these videos cover|you can access them|videos are available|guidance videos available)[^\n]*\n?/gi,
    "\n"
  );

  // Always remove video-only source lines
  out = out.replace(/\*\*Source:\s*Video Resource\*\*\s*/gi, "");
  out = out.replace(/\*\*स्रोत:\s*वीडियो संसाधन\*\*\s*/gi, "");
  out = out.replace(/\*\*स्रोत:\s*व्हिडिओ संसाधन\*\*\s*/gi, "");
  out = out.replace(/\*\*Source:\s*[^*\n]*_[^*\n]*\*\*\s*/gi, "");
  out = out.replace(/\*\*स्रोत:\s*[^*\n]*_[^*\n]*\*\*\s*/gi, "");

  // No inline videos → never show the cue (model sometimes adds it anyway)
  if (!hasVideos) {
    return stripVideoCueLines(out).replace(/\n{3,}/g, "\n\n").trim();
  }

  const videoOnlyAsk = isVideoOnlyUserQuery(userQuery);
  const wantCue = !videoOnlyAsk && hasSubstantiveAnswer(out);

  if (!wantCue) {
    return stripVideoCueLines(out).replace(/\n{3,}/g, "\n\n").trim();
  }

  // Re-place cue in the correct position (after Source, before follow-up)
  return insertVideoCue(out, videoCueLine(language));
}
