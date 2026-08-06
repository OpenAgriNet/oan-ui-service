import { ExternalLink } from "lucide-react";
import type { VideoResource } from "@/lib/ag-ui";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

interface RelatedVideosProps {
  videos: VideoResource[];
  className?: string;
}

function canEmbed(video: VideoResource): boolean {
  const provider = (video.provider || "").toLowerCase();
  if (provider === "youtube" || provider === "vimeo") {
    return Boolean(video.embed_url);
  }
  if (provider === "direct") {
    return Boolean(video.embed_url || video.url);
  }
  return Boolean(video.embed_url);
}

export function RelatedVideos({ videos, className }: RelatedVideosProps) {
  const { t } = useLanguage();

  if (!videos?.length) return null;

  // No extra "Related Videos" heading — assistant text already says
  // "For more information, watch the below video."
  return (
    <div className={cn("mt-3 space-y-3 w-full max-w-full", className)}>
      <div className="flex flex-col gap-3">
        {videos.map((video) => (
          <VideoCard key={video.id || video.url} video={video} />
        ))}
      </div>
    </div>
  );
}

function humanizeTitle(raw: string | undefined, fallback: string): string {
  if (!raw?.trim()) return fallback;
  let t = raw.trim().replace(/\.(mp4|webm|mov|mkv|avi)$/i, "");
  if (t.includes("_") || (/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(t))) {
    t = t.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return t || fallback;
}

function VideoCard({ video }: { video: VideoResource }) {
  const { t } = useLanguage();
  const title = humanizeTitle(video.title, (t("video") as string) || "Video");
  const embed = video.embed_url || undefined;
  const provider = (video.provider || "").toLowerCase();
  const showIframe = canEmbed(video) && embed && provider !== "direct";
  const showNativeVideo =
    canEmbed(video) && (provider === "direct" || (!showIframe && embed?.match(/\.(mp4|webm|m3u8|mov|ogg)(\?|$)/i)));

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-border/40">
        <p className="text-sm font-medium line-clamp-2 m-0">{title}</p>
      </div>

      {showIframe && (
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={embed}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}

      {showNativeVideo && !showIframe && (
        <div className="relative w-full aspect-video bg-black">
          <video
            className="absolute inset-0 h-full w-full"
            src={embed || video.url}
            controls
            playsInline
            preload="metadata"
            poster={video.thumbnail_url || undefined}
          >
            {(t("videoNotSupported") as string) || "Your browser does not support video playback."}
          </video>
        </div>
      )}

      {!showIframe && !showNativeVideo && video.thumbnail_url && (
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative w-full aspect-video bg-muted"
        >
          <img
            src={video.thumbnail_url}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </a>
      )}

      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {(t("openVideoExternally") as string) || "Open video"}
        </a>
      </div>
    </div>
  );
}

export default RelatedVideos;
