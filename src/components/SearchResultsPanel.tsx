import { useMemo, useState } from "react";
import { ChevronDown, FileText, Info } from "lucide-react";
import type { DocumentResource } from "@/lib/ag-ui";
import { getGroundedDocuments, type GroundedChunk } from "@/lib/document-grounding";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchResultsPanelProps {
  documents?: DocumentResource[];
  /** Full assistant response text — used to match cited sources and highlight grounding lines. */
  responseText: string;
  className?: string;
}

function formatScore(score?: number): string | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return score.toFixed(2);
}

export function SearchResultsPanel({ documents, responseText, className }: SearchResultsPanelProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const groundedDocuments = useMemo(
    () => getGroundedDocuments(documents ?? [], responseText),
    [documents, responseText]
  );

  if (!groundedDocuments.length) return null;

  return (
    <div className={cn("mt-3 w-full max-w-full", className)}>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>
            {(t("searchResults") as string) || "Search Results"} ({groundedDocuments.length})
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/70 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Highlighted words also appear in the response. Only chunks with at least one such
              match are shown here — content the model paraphrased with different wording may not
              appear, even if it was genuinely used.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-border/60 bg-background/60 overflow-hidden">
          <Accordion type="multiple" className="w-full">
            {groundedDocuments.map(({ doc, chunks }) => (
              <DocumentItem key={doc.id} doc={doc} chunks={chunks} />
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

function DocumentItem({ doc, chunks }: { doc: DocumentResource; chunks: GroundedChunk[] }) {
  const { t } = useLanguage();
  const score = formatScore(doc.score);

  return (
    <AccordionItem value={doc.id} className="border-border/40 px-3">
      <AccordionTrigger className="py-2.5 text-sm hover:no-underline">
        <div className="flex flex-1 flex-col items-start gap-1 text-left pr-2">
          <span className="font-medium line-clamp-2">{doc.title}</span>
          <div className="flex items-center gap-2">
            {doc.source && (
              <span className="text-xs text-muted-foreground line-clamp-1">{doc.source}</span>
            )}
            {score && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {(t("relevanceScore") as string) || "Score"}: {score}
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3 pt-0">
        <div className="flex flex-col gap-2">
          {chunks.map(({ chunk, segments }) => {
            const chunkScore = formatScore(chunk.score);
            return (
              <div
                key={chunk.id}
                className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed"
              >
                {chunkScore && (
                  <Badge variant="outline" className="mb-1.5 text-[10px] px-1.5 py-0">
                    {(t("relevanceScore") as string) || "Score"}: {chunkScore}
                  </Badge>
                )}
                <p className="m-0 text-muted-foreground whitespace-pre-wrap">
                  {segments.map((seg, i) =>
                    seg.highlighted ? (
                      <mark
                        key={i}
                        className="bg-primary/25 text-foreground rounded px-0.5 not-italic"
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default SearchResultsPanel;
