import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useState } from "react";
import { type Language } from "@/config/theme.config";

interface LanguageOption {
  code: Language;
  nativeName: string;
  englishName: string;
  selectText: string;
}

export function LanguageSelectionScreen({ onLanguageSelected }: { onLanguageSelected: () => void }) {
  const { setLanguage, availableLanguages } = useLanguage();
  const [hoveredLanguage, setHoveredLanguage] = useState<string | null>(null);

  // All available language options
  const allLanguageOptions: Record<Language, LanguageOption> = {
    en: {
      code: "en",
      nativeName: "English",
      englishName: "English",
      selectText: "Select English"
    },
    hi: {
      code: "hi",
      nativeName: "हिंदी",
      englishName: "Hindi",
      selectText: "हिंदी चुनें"
    },
    mr: {
      code: "mr",
      nativeName: "मराठी",
      englishName: "Marathi",
      selectText: "मराठी निवडा"
    },
    am: {
      code: "am",
      nativeName: "አማርኛ",
      englishName: "Amharic",
      selectText: "አማርኛ ይምረጡ"
    }
  };

  // Filter language options based on tenant's available languages
  const languageOptions: LanguageOption[] = availableLanguages.map(lang => allLanguageOptions[lang]);
  
  const handleLanguageSelect = (languageCode: Language) => {
    setLanguage(languageCode);
    onLanguageSelected();
  };

  const playAudio = (languageCode: Language) => {
    const audioFiles: Record<Language, string> = {
      en: "/en.wav",
      hi: "/hi.wav",
      mr: "/mr.wav",
      am: "/am.wav",
    };

    const filePath = audioFiles[languageCode];
    if (filePath) {
      new Audio(filePath).play();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {languageOptions.map((lang) => (
          <div 
            key={lang.code}
            className="relative"
            onMouseEnter={() => setHoveredLanguage(lang.code)}
            onMouseLeave={() => setHoveredLanguage(null)}
          >
            <Button
              variant="outline"
              size="lg"
              className="w-full h-32 flex flex-col items-center justify-center gap-4 text-lg border-2 transition-all language-select-btn"
              onClick={() => handleLanguageSelect(lang.code)}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg font-medium text-muted-foreground">{lang.selectText}</span>
                <span className="text-2xl font-semibold">{lang.nativeName}</span>
                <span className="text-sm text-muted-foreground">{lang.englishName !== lang.nativeName ? lang.englishName : ""}</span>
              </div>
            </Button>
            
            {/* Only show hover text on desktop (hidden on mobile) */}
            <div className={`absolute -bottom-8 w-full text-center text-sm transition-opacity duration-300 hidden md:block ${hoveredLanguage === lang.code ? "opacity-100" : "opacity-0"}`}>
              <span className="text-foreground bg-background px-2 py-1 rounded-md shadow-sm">{lang.selectText}</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 -top-3 bg-background shadow-sm border"
              onClick={(e) => {
                e.stopPropagation();
                playAudio(lang.code);
              }}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
