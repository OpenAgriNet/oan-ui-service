import { useMemo, useRef, useState } from "react";
import { X, FileText, Search } from "lucide-react";
import type { GroundedDocument } from "@/lib/document-grounding";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentResultCard } from "@/components/DocumentResultCard";

interface SearchResultsSidePanelProps {
  groundedDocuments: GroundedDocument[];
  onClose: () => void;
}

export function SearchResultsSidePanel({ groundedDocuments, onClose }: SearchResultsSidePanelProps) {
  const { t } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const query = searchQuery.trim().toLowerCase();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchQuery("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!query) return groundedDocuments;

    return groundedDocuments
      .map(({ doc, chunks }) => {
        const titleMatches = doc.title.toLowerCase().includes(query);
        const sourceMatches = (doc.source ?? "").toLowerCase().includes(query);
        const matchingChunks = chunks.filter((chunk) => chunk.text.toLowerCase().includes(query));
        // If the title/source itself matches but no individual chunk does,
        // still show every chunk for context rather than an empty card.
        const chunksToShow =
          matchingChunks.length > 0 ? matchingChunks : titleMatches || sourceMatches ? chunks : [];
        return { doc, chunks: chunksToShow };
      })
      .filter(({ chunks }) => chunks.length > 0);
  }, [groundedDocuments, query]);

  if (!groundedDocuments.length) return null;

  return (
    <aside
      className="hidden lg:flex lg:flex-col fixed top-[var(--header-height)] right-0 bottom-0 z-20 w-[30rem] border-l border-border bg-background shadow-[-4px_0_16px_-8px_rgba(0,0,0,0.15)] animate-fade-in"
      aria-label={(t("searchResults") as string) || "Search Results"}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-b from-background to-background/95 px-3.5 py-2.5 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate leading-tight">
              {(t("searchResults") as string) || "Search Results"}
            </h2>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              {groundedDocuments.length} {groundedDocuments.length === 1 ? "source" : "sources"} referenced
            </p>
          </div>
          {searchOpen && (
            <div className="relative w-36 flex-shrink-0 ml-3 animate-fade-in">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && toggleSearch()}
                placeholder="Search"
                className="h-7 pl-7 pr-6 text-[11px]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={toggleSearch}
            aria-label={searchOpen ? "Close search" : "Search within these results"}
          >
            {searchOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 rounded-full px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close search results"
          >
            Close
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {filteredDocuments.length === 0 ? (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              No results match "{searchQuery}"
            </p>
          ) : (
            filteredDocuments.map(({ doc, chunks }, i) => (
              <div
                key={doc.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 6) * 60}ms`, animationFillMode: "backwards" }}
              >
                <DocumentResultCard doc={doc} chunks={chunks} searchQuery={query} />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

export default SearchResultsSidePanel;
