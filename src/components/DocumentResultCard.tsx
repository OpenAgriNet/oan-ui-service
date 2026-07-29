import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import type { DocumentResource, ChunkResource } from "@/lib/ag-ui";
import { cn } from "@/lib/utils";

interface DocumentResultCardProps {
  doc: DocumentResource;
  chunks: ChunkResource[];
  className?: string;
}

export function DocumentResultCard({ doc, chunks, className }: DocumentResultCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={cn(
        "group rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug line-clamp-2 m-0">{doc.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {doc.source && (
              <span className="text-xs text-muted-foreground line-clamp-1">{doc.source}</span>
            )}
            {chunks.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                {chunks.length} {chunks.length === 1 ? "chunk" : "chunks"}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border/40 px-3 py-2.5 animate-fade-in">
          {chunks.map((chunk, i) => (
            <div
              key={chunk.id}
              className="relative rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-xs leading-relaxed transition-colors hover:bg-muted/60"
            >
              <span className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary ring-2 ring-card">
                {i + 1}
              </span>
              <p className="m-0 text-muted-foreground whitespace-pre-wrap">{chunk.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentResultCard;
