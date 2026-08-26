import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import type { ChunkResource, DocumentResource } from "@/lib/ag-ui";
import type { GroundedDocument } from "@/lib/document-grounding";
import { filterGroundedDocuments } from "@/lib/document-grounding";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getSearchStatusText,
  isUsableHttpUrl,
  type SearchPanelSnapshot,
  type SearchPanelStatus,
} from "@/lib/search-lifecycle";
import { cn } from "@/lib/utils";

export interface SearchResultsPanelProps {
  open: boolean;
  groundedDocuments: GroundedDocument[];
  search?: SearchPanelSnapshot;
  onOpenChange: (open: boolean) => void;
}

function useSourceSearch(active = true) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) return;
    setOpen(false);
    setQuery("");
  }, [active]);

  const toggle = () => {
    if (open) {
      setQuery("");
      setOpen(false);
      return;
    }
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return { open, query, setQuery, inputRef, toggle, needle: query.trim().toLowerCase() };
}

function useSearchResultsModel(
  groundedDocuments: GroundedDocument[],
  search: SearchPanelSnapshot | undefined,
  filterActive = true
) {
  const { t } = useLanguage();
  const sourceSearch = useSourceSearch(filterActive);
  const status: SearchPanelStatus = search?.status ?? (groundedDocuments.length ? "results" : "idle");
  const statusText = getSearchStatusText(t, status, groundedDocuments.length);
  const title = (t("searchResults") as string) || "Search Results";
  const filtered = useMemo(
    () => filterGroundedDocuments(groundedDocuments, sourceSearch.needle),
    [groundedDocuments, sourceSearch.needle]
  );

  return { sourceSearch, status, statusText, title, filtered };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const re = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/25 text-foreground rounded px-0.5 not-italic">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function DocumentResultCard({
  doc,
  chunks,
  searchQuery,
  className,
}: {
  doc: DocumentResource;
  chunks: ChunkResource[];
  searchQuery?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const query = searchQuery?.trim() ?? "";
  const sourceUrl = isUsableHttpUrl(doc.url)
    ? doc.url
    : isUsableHttpUrl(doc.source)
      ? doc.source
      : null;

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
          <p className="text-sm font-medium leading-snug line-clamp-2 m-0">
            {highlightText(doc.title, query)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {doc.source && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {highlightText(doc.source, query)}
              </span>
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
              <p className="m-0 text-muted-foreground whitespace-pre-wrap">
                {highlightText(chunk.text, query)}
              </p>
            </div>
          ))}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open source
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SearchStatusIcon({ status, className }: { status: SearchPanelStatus; className?: string }) {
  const Icon = status === "searching" ? Loader2 : status === "error" ? AlertCircle : FileText;
  return (
    <Icon className={cn(className, status === "searching" && "animate-spin", status === "error" && "text-destructive")} />
  );
}

function SearchFilterField({
  value,
  onChange,
  onClose,
  inputRef,
  className,
  inputClassName,
  disableDrag,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  className?: string;
  inputClassName?: string;
  disableDrag?: boolean;
}) {
  return (
    <div className={cn("relative", className)} data-vaul-no-drag={disableDrag ? "" : undefined}>
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Search"
        className={cn("pl-8 pr-8", inputClassName)}
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SearchResultsList({
  status,
  groundedCount,
  filtered,
  query,
  searchQuery,
  statusText,
}: {
  status: SearchPanelStatus;
  groundedCount: number;
  filtered: GroundedDocument[];
  query: string;
  searchQuery: string;
  statusText: string;
}) {
  if (status === "searching" && !groundedCount) {
    return (
      <div className="space-y-3" aria-label={statusText}>
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-border/50 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-14 animate-pulse rounded-lg bg-muted/70" />
          </div>
        ))}
      </div>
    );
  }
  if (!groundedCount) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        {status === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
        <p>{statusText}</p>
      </div>
    );
  }
  if (!filtered.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No results match "{searchQuery}"
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {filtered.map(({ doc, chunks }, i) => (
        <div
          key={doc.id}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(i, 6) * 50}ms`, animationFillMode: "backwards" }}
        >
          <DocumentResultCard doc={doc} chunks={chunks} searchQuery={query} />
        </div>
      ))}
    </div>
  );
}

function DesktopSearchResults({
  groundedDocuments,
  search,
  onClose,
}: {
  groundedDocuments: GroundedDocument[];
  search?: SearchPanelSnapshot;
  onClose: () => void;
}) {
  const { sourceSearch, status, statusText, title, filtered } = useSearchResultsModel(
    groundedDocuments,
    search
  );

  return (
    <aside
      className="hidden lg:flex lg:flex-col fixed top-[var(--header-height)] right-0 bottom-0 z-20 w-[30rem] border-l border-border bg-background shadow-[-4px_0_16px_-8px_rgba(0,0,0,0.15)] animate-fade-in"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-b from-background to-background/95 px-3.5 py-2.5 flex-shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SearchStatusIcon status={status} className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight">{title}</h2>
            <p
              className={cn(
                "truncate text-[10px] leading-tight text-muted-foreground",
                status === "error" && "text-destructive"
              )}
              title={search?.query}
            >
              {search?.query ? `“${search.query}” · ` : ""}
              {statusText}
            </p>
          </div>
          {sourceSearch.open && (
            <SearchFilterField
              className="ml-3 w-36 flex-shrink-0"
              inputClassName="h-7 text-[11px]"
              value={sourceSearch.query}
              onChange={sourceSearch.setQuery}
              onClose={sourceSearch.toggle}
              inputRef={sourceSearch.inputRef}
            />
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {groundedDocuments.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full text-muted-foreground"
              onClick={sourceSearch.toggle}
              aria-label={sourceSearch.open ? "Close search" : "Search within these results"}
            >
              {sourceSearch.open ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          )}
          {status !== "searching" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full px-2.5 text-[11px] font-medium text-muted-foreground"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          <SearchResultsList
            status={status}
            groundedCount={groundedDocuments.length}
            filtered={filtered}
            query={sourceSearch.needle}
            searchQuery={sourceSearch.query}
            statusText={statusText}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

function MobileSearchResults({
  open,
  groundedDocuments,
  search,
  onOpenChange,
}: SearchResultsPanelProps) {
  const { sourceSearch, status, statusText, title, filtered } = useSearchResultsModel(
    groundedDocuments,
    search,
    open
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        hideHandle
        overlayClassName="z-[60] bg-foreground/10 backdrop-blur-[1px] supports-[backdrop-filter]:bg-foreground/5"
        className="z-[60] mt-0 h-[min(82dvh,42rem)] rounded-t-[1.5rem] border-border/60 bg-background p-0 shadow-[0_-16px_48px_rgba(0,0,0,0.18)] after:hidden"
      >
        <div className="flex h-full min-h-0 flex-col pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-shrink-0 flex-col items-center px-4 pt-2.5">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            <div className="mt-3 flex w-full items-start gap-3 pb-3">
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
                  status === "error" && "bg-destructive/10 text-destructive"
                )}
              >
                <SearchStatusIcon status={status} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-base font-semibold leading-tight">{title}</DrawerTitle>
                <DrawerDescription
                  className={cn(
                    "mt-0.5 text-xs leading-snug text-muted-foreground",
                    status === "error" && "text-destructive"
                  )}
                >
                  {search?.query ? `“${search.query}” · ${statusText}` : statusText}
                </DrawerDescription>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {groundedDocuments.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-full text-muted-foreground",
                      sourceSearch.open && "bg-muted text-foreground"
                    )}
                    onClick={sourceSearch.toggle}
                    aria-label={sourceSearch.open ? "Close search" : "Search within these results"}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close search results"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {sourceSearch.open && (
              <SearchFilterField
                className="w-full pb-3"
                inputClassName="h-9 text-sm"
                value={sourceSearch.query}
                onChange={sourceSearch.setQuery}
                onClose={sourceSearch.toggle}
                inputRef={sourceSearch.inputRef}
                disableDrag
              />
            )}
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 [-webkit-overflow-scrolling:touch]"
            data-vaul-no-drag=""
          >
            <SearchResultsList
              status={status}
              groundedCount={groundedDocuments.length}
              filtered={filtered}
              query={sourceSearch.needle}
              searchQuery={sourceSearch.query}
              statusText={statusText}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Desktop side panel and mobile bottom sheet for cited search sources. */
export function SearchResultsPanel({
  open,
  groundedDocuments,
  search,
  onOpenChange,
}: SearchResultsPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileSearchResults
        open={open}
        groundedDocuments={groundedDocuments}
        search={search}
        onOpenChange={onOpenChange}
      />
    );
  }

  if (!open) return null;

  return (
    <DesktopSearchResults
      groundedDocuments={groundedDocuments}
      search={search}
      onClose={() => onOpenChange(false)}
    />
  );
}

export default SearchResultsPanel;
