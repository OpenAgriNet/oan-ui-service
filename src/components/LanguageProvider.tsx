import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import enMahavistarrTranslations from "../translations/en-mahavistaar.json";
import enAtiTranslations from "../translations/en-ati.json";
import hiTranslations from "../translations/hi.json";
import mrTranslations from "../translations/mr.json";
import amTranslations from "../translations/am.json";
import { getThemeConfig, isLanguageSupported, getDefaultLanguage, getCurrentTenant, type Language } from "@/config/theme.config";

type TranslationValue = string | string[] | Record<string, any>;

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => TranslationValue;
  hasSelectedLanguage: boolean;
  availableLanguages: Language[];
};

// Load tenant-specific English translations
const enTranslations = getCurrentTenant() === 'ATI' ? enAtiTranslations : enMahavistarrTranslations;

const translations = {
  en: enTranslations,
  hi: hiTranslations,
  mr: mrTranslations,
  am: amTranslations
};

const themeConfig = getThemeConfig();

const LanguageContext = createContext<LanguageContextType>({
  language: themeConfig.defaultLanguage,
  setLanguage: () => {},
  t: () => "",
  hasSelectedLanguage: false,
  availableLanguages: themeConfig.languages,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get language from localStorage
    const savedLanguage = localStorage.getItem("language") as Language;

    // Check if saved language is supported by current tenant
    if (savedLanguage && isLanguageSupported(savedLanguage)) {
      return savedLanguage;
    }

    // Fall back to tenant's default language
    return getDefaultLanguage();
  });
  
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);

  // Wrapper to validate language before setting
  const setLanguage = (newLanguage: Language) => {
    if (isLanguageSupported(newLanguage)) {
      setLanguageState(newLanguage);
    } else {
      console.warn(`Language ${newLanguage} is not supported by current tenant. Ignoring.`);
    }
  };

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem("language", language);
    setHasSelectedLanguage(true);
  }, [language]);

  const t = (key: string): TranslationValue => {
    const keys = key.split('.');
    let result: any = translations[language];

    for (const k of keys) {
      if (result && result[k] !== undefined) {
        result = result[k];
      } else {
        return key; // Return the key if translation not found
      }
    }

    return result;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        hasSelectedLanguage,
        availableLanguages: themeConfig.languages
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
