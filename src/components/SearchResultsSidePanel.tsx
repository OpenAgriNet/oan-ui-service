import { X, FileText } from "lucide-react";
import type { GroundedDocument } from "@/lib/document-grounding";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentResultCard } from "@/components/DocumentResultCard";

interface SearchResultsSidePanelProps {
  groundedDocuments: GroundedDocument[];
  onClose: () => void;
}

export function SearchResultsSidePanel({ groundedDocuments, onClose }: SearchResultsSidePanelProps) {
  const { t } = useLanguage();

  if (!groundedDocuments.length) return null;

  return (
    <aside
      className="hidden lg:flex lg:flex-col fixed top-[var(--header-height)] right-0 bottom-0 z-20 w-[30rem] border-l border-border bg-background shadow-[-4px_0_16px_-8px_rgba(0,0,0,0.15)] animate-fade-in"
      aria-label={(t("searchResults") as string) || "Search Results"}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-border/60 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate leading-tight">
              {(t("searchResults") as string) || "Search Results"}
            </h2>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {groundedDocuments.length} {groundedDocuments.length === 1 ? "source" : "sources"} referenced
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0 rounded-full hover:bg-muted"
          onClick={onClose}
          aria-label="Close search results"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {groundedDocuments.map(({ doc, chunks }, i) => (
            <div
              key={doc.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 6) * 60}ms`, animationFillMode: "backwards" }}
            >
              <DocumentResultCard doc={doc} chunks={chunks} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

export default SearchResultsSidePanel;
