import { useMemo, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import type { DocumentResource } from "@/lib/ag-ui";
import { getGroundedDocuments } from "@/lib/document-grounding";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import { DocumentResultCard } from "@/components/DocumentResultCard";

interface SearchResultsPanelProps {
  documents?: DocumentResource[];
  /** Full assistant response text — used to match cited sources and highlight grounding lines. */
  responseText: string;
  className?: string;
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
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {groundedDocuments.map(({ doc, chunks }) => (
            <DocumentResultCard key={doc.id} doc={doc} chunks={chunks} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchResultsPanel;
