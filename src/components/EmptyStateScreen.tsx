import { Snowflake, Zap, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useTheme } from "@/components/ThemeProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface EmptyStateScreenProps {
  setInputValue: (value: string) => void;
}

export function EmptyStateScreen({ setInputValue }: EmptyStateScreenProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  // Sample questions based on language
  const questions = t("questions");

  // Capabilities text
  const capabilities = t("capabilities");


  // Limitations/remember text
  const limitations = t("limitations");

  // Section titles
  const titles = {
    en: { ask: "Ask", capabilities: "Capabilities", remember: "Remember" },
    hi: { ask: "पूछें", capabilities: "क्षमताएँ", remember: "याद रखें" },
    mr: { ask: "विचारा", capabilities: "क्षमता", remember: "लक्षात ठेवा" },
    am: { ask: "ይጠይቁ", capabilities: "ችሎታዎች", remember: "ያስታውሱ" }
  }[language];

  const handleQuestionClick = (question: string) => {
    setInputValue(question);
  };

  const content = (
    <div className="flex flex-col px-4 py-8 w-full mx-auto animate-fade-in">
      <div className="flex justify-center w-full pb-24 md:pb-28 md:pt-24">
        {/* Ask Section */}
        <div className="flex flex-col items-center max-w-md w-full">
          <div className="flex flex-col items-center mb-4">
            <Snowflake className="h-8 w-8 mb-2" style={{ color: 'hsl(var(--icon-highlight))' }} />
            <h2 className="text-xl font-semibold">{titles.ask}</h2>
          </div>
          <div className="w-full space-y-3">
            {Array.isArray(questions) && questions.map((question, index) => (
              <div
                key={index}
                className="bg-muted px-3 py-2 rounded-lg cursor-pointer hover:bg-accent/10 transition-colors flex items-center justify-center h-auto min-h-[6rem]"
                onClick={() => handleQuestionClick(question)}
              >
                <p className="text-sm md:text-base text-center px-4 py-2">{question}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Capabilities Section */}
        {/* <div className="flex flex-col items-center">
          <div className="flex flex-col items-center mb-4">
            <Zap className={`h-8 w-8 mb-2 ${capIconColor}`} />
            <h2 className="text-xl font-semibold">{titles.capabilities}</h2>
          </div>
          <div className="w-full space-y-3">
            {Array.isArray(capabilities) && capabilities.map((capability, index) => (
              <div key={index} className="bg-muted p-4 rounded-lg h-auto min-h-[6rem]">
                <p className="text-sm md:text-base">{capability}</p>
              </div>
            ))}
          </div>
        </div> */}

        {/* Remember Section */}
        {/* <div className="flex flex-col items-center">
          <div className="flex flex-col items-center mb-4">
            <AlertTriangle className={`h-8 w-8 mb-2 ${remIconColor}`} />
            <h2 className="text-xl font-semibold">{titles.remember}</h2>
          </div>
          <div className="w-full space-y-3">
            {Array.isArray(limitations) && limitations.map((limitation, index) => (
              <div key={index} className="bg-muted p-4 rounded-lg h-auto min-h-[6rem]">
                <p className="text-sm md:text-base">{limitation}</p>
              </div>
            ))}
          </div>
        </div> */}
      </div>
    </div>
  );

  // On mobile, wrap in ScrollArea for better scrolling
  return isMobile ? (
    <ScrollArea className="h-[calc(100vh-var(--header-height)-var(--input-height))]">
      {content}
    </ScrollArea>
  ) : content;
}
