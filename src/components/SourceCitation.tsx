import { ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceCitationProps {
  sources: string[];
  className?: string;
}

export function SourceCitation({ sources, className }: SourceCitationProps) {
  if (!sources || sources.length === 0) return null;

  const isUrl = (source: string): boolean => {
    return source.startsWith('http://') || source.startsWith('https://');
  };

  const getDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getDisplayText = (source: string, index: number): string => {
    if (isUrl(source)) {
      const domain = getDomain(source);
      return sources.length > 1 ? `${index + 1}. ${domain}` : domain;
    }
    return sources.length > 1 ? `${index + 1}. ${source}` : source;
  };

  return (
    <div className={cn("mt-3 pt-3 border-t border-border/40", className)}>
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground" style={{fontStyle: 'italic'}}>
        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-shrink-0">
          {sources.length === 1 ? 'Source:' : 'Sources:'}
        </span>
        {sources.map((source, index) => (
          <div key={index}>
            {isUrl(source) ? (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 hover:text-muted-foreground/80 transition-colors underline decoration-dotted underline-offset-2"
              >
                <span className="truncate max-w-[200px]">
                  {getDisplayText(source, index)}
                </span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50 group-hover:opacity-70 transition-opacity" />
              </a>
            ) : (
              <span className="truncate max-w-[200px]">
                {getDisplayText(source, index)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
