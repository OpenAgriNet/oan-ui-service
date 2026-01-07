import { useLanguage } from "./LanguageProvider";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const { language, setLanguage, availableLanguages } = useLanguage();

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case "en": return "EN";
      case "hi": return "हिं";
      case "mr": return "मर";
      case "am": return "አማ";
      default: return "EN";
    }
  };

  return (
    <div className="bg-muted rounded-lg p-1 flex text-xs font-semibold border border-border">
      {availableLanguages.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          className={cn(
            'px-3 py-1.5 rounded-md transition-all',
            language === lang
              ? 'bg-background shadow-sm text-[hsl(37_83%_52%)]'
              : 'text-muted-foreground hover:bg-muted-foreground/10'
          )}
        >
          {getLanguageLabel(lang)}
        </button>
      ))}
    </div>
  );
}
