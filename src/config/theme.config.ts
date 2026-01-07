export type TenantType = 'MAHAVISTAAR' | 'ATI';
export type Language = 'en' | 'hi' | 'mr' | 'am'; // am = Amharic

export interface TenantConfig {
  name: string;
  logo: {
    primary: string;      // Main logo (PNG)
    webp: string;         // WebP version
    favicon: string;      // Favicon path
  };
  showLogo: boolean;      // Show logo image in header (true) or app title text (false)
  languages: Language[];
  defaultLanguage: Language;
  colors: {
    light: {
      primary: string;
      primaryForeground: string;
      secondary: string;
      secondaryForeground: string;
      accent: string;
      accentForeground: string;
      background: string;
      foreground: string;
      card: string;
      cardForeground: string;
      popover: string;
      popoverForeground: string;
      muted: string;
      mutedForeground: string;
      border: string;
      input: string;
      ring: string;
      // Component-specific UI colors
      iconHighlight: string;           // For highlighted icons (e.g., Ask icon)
      buttonInteractive: string;       // For interactive buttons (send, mic)
      buttonInteractiveForeground: string;
      buttonInteractiveBorder: string;
      inputFocusRing: string;         // For input focus ring
    };
    dark: {
      primary: string;
      primaryForeground: string;
      secondary: string;
      secondaryForeground: string;
      accent: string;
      accentForeground: string;
      background: string;
      foreground: string;
      card: string;
      cardForeground: string;
      popover: string;
      popoverForeground: string;
      muted: string;
      mutedForeground: string;
      border: string;
      input: string;
      ring: string;
      // Component-specific UI colors
      iconHighlight: string;
      buttonInteractive: string;
      buttonInteractiveForeground: string;
      buttonInteractiveBorder: string;
      inputFocusRing: string;
    };
  };
  meta: {
    title: string;
    description: string;
    ogImage: string;
  };
  footer: {
    copyrightName: string;
  };
}

export const tenantConfigs: Record<TenantType, TenantConfig> = {
  MAHAVISTAAR: {
    name: 'MahaVISTAAR',
    logo: {
      primary: '/MH.png',
      webp: '/MH2.webp',
      favicon: '/favicon.ico',
    },
    showLogo: false,        // Show app title text instead of logo
    languages: ['en', 'mr'],
    defaultLanguage: 'mr',
    colors: {
      light: {
        primary: '145 35% 27%',      // Farm green
        primaryForeground: '48 30% 96%',
        secondary: '29 45% 37%',      // Brown
        secondaryForeground: '48 30% 96%',
        accent: '43 85% 62%',         // Gold
        accentForeground: '145 35% 27%',
        background: '48 30% 96%',     // Cream
        foreground: '145 35% 15%',    // Dark green
        card: '0 0% 100%',
        cardForeground: '145 35% 15%',
        popover: '0 0% 100%',
        popoverForeground: '145 35% 15%',
        muted: '48 30% 90%',
        mutedForeground: '145 35% 40%',
        border: '48 30% 82%',
        input: '48 30% 82%',
        ring: '145 35% 27%',
        // Component-specific UI colors
        iconHighlight: '145 35% 27%',           // Primary green for icons
        buttonInteractive: '145 35% 27%',       // Primary green for buttons
        buttonInteractiveForeground: '48 30% 96%',  // White text
        buttonInteractiveBorder: '145 35% 27%',     // Primary green border
        inputFocusRing: '145 35% 27%',         // Primary green for focus
      },
      dark: {
        primary: '145 35% 45%',
        primaryForeground: '48 30% 96%',
        secondary: '29 45% 45%',
        secondaryForeground: '165 15% 15%',
        accent: '43 85% 62%',
        accentForeground: '165 15% 15%',
        background: '165 15% 15%',
        foreground: '48 30% 96%',
        card: '165 15% 20%',
        cardForeground: '48 30% 96%',
        popover: '165 15% 20%',
        popoverForeground: '48 30% 96%',
        muted: '165 15% 30%',
        mutedForeground: '48 30% 80%',
        border: '165 15% 30%',
        input: '165 15% 30%',
        ring: '145 35% 45%',
        // Component-specific UI colors
        iconHighlight: '145 35% 45%',           // Primary green for icons
        buttonInteractive: '145 35% 45%',       // Primary green for buttons
        buttonInteractiveForeground: '48 30% 96%',  // White text
        buttonInteractiveBorder: '145 35% 45%',     // Primary green border
        inputFocusRing: '145 35% 45%',         // Primary green for focus
      },
    },
    meta: {
      title: 'MahaVistaar - Your Farming Assistant',
      description: 'Get information about farm practices, weather, mandi prices and government schemes',
      ogImage: 'https://vistaar.kenpath.ai/vistaarName.png',
    },
    footer: {
      copyrightName: 'MahaVistaar App',
    },
  },
  ATI: {
    name: 'ATI',
    logo: {
      primary: '/logo.png',
      webp: '/logo.png',      // Using PNG as WebP doesn't exist yet
      favicon: '/favicon-ati.ico',
    },
    showLogo: true,         // Show logo image in header
    languages: ['en', 'am'],          // Amharic instead of Marathi
    defaultLanguage: 'en',
    colors: {
      light: {
        primary: '152 90% 27%',       // Dark green (#078148)
        primaryForeground: '0 0% 100%', // White text on green buttons
        secondary: '37 83% 52%',      // Gold for secondary/hover (#ea9d21)
        secondaryForeground: '0 0% 100%', // White text on gold elements
        accent: '37 83% 52%',         // Gold for hover (#ea9d21)
        accentForeground: '0 0% 100%', // White text on accent
        background: '0 0% 100%',      // White background
        foreground: '0 0% 10%',       // Black text
        card: '0 0% 100%',            // White cards
        cardForeground: '0 0% 10%',   // Black text
        popover: '0 0% 100%',
        popoverForeground: '0 0% 10%',
        muted: '37 40% 95%',          // Light golden for muted backgrounds
        mutedForeground: '37 70% 45%', // Golden for muted text
        border: '37 30% 85%',         // Light golden border
        input: '37 25% 94%',          // Light golden input
        ring: '152 90% 27%',
        // Component-specific UI colors
        iconHighlight: '37 83% 52%',           // Gold for icons
        buttonInteractive: '37 83% 52%',       // Gold for interactive buttons
        buttonInteractiveForeground: '0 0% 100%',  // White text
        buttonInteractiveBorder: '37 83% 52%',     // Gold border
        inputFocusRing: '37 83% 52%',         // Gold for focus ring
      },
      dark: {
        primary: '152 80% 45%',       // Lighter green for dark mode
        primaryForeground: '0 0% 100%', // White text
        secondary: '37 83% 62%',      // Gold for secondary/hover
        secondaryForeground: '0 0% 100%', // White text
        accent: '37 83% 62%',         // Gold for hover in dark mode
        accentForeground: '0 0% 100%', // White text
        background: '152 25% 8%',     // Dark green background
        foreground: '0 0% 98%',
        card: '152 20% 12%',
        cardForeground: '0 0% 98%',
        popover: '152 20% 12%',
        popoverForeground: '0 0% 98%',
        muted: '37 30% 18%',          // Dark gold tint for muted
        mutedForeground: '37 70% 70%', // Gold for muted text hover
        border: '152 15% 20%',
        input: '152 15% 20%',
        ring: '152 80% 45%',
        // Component-specific UI colors
        iconHighlight: '37 83% 62%',           // Gold for icons
        buttonInteractive: '37 83% 62%',       // Gold for interactive buttons
        buttonInteractiveForeground: '0 0% 100%',  // White text
        buttonInteractiveBorder: '37 83% 62%',     // Gold border
        inputFocusRing: '37 83% 62%',         // Gold for focus ring
      },
    },
    meta: {
      title: 'ATI - Agricultural Information Service',
      description: 'Access agricultural information and support',
      ogImage: '/logo.png',
    },
    footer: {
      copyrightName: 'ATI',
    },
  },
};

// Get current tenant from environment variable
const getCurrentTenantFromEnv = (): TenantType => {
  const envTenant = import.meta.env.VITE_TENANT as string | undefined;

  if (!envTenant) {
    console.warn('VITE_TENANT not set, defaulting to MAHAVISTAAR');
    return 'MAHAVISTAAR';
  }

  const tenant = envTenant.toUpperCase() as TenantType;

  if (!tenantConfigs[tenant]) {
    console.error(`Invalid tenant: ${tenant}. Falling back to MAHAVISTAAR.`);
    return 'MAHAVISTAAR';
  }

  return tenant;
};

const currentTenant = getCurrentTenantFromEnv();

/**
 * Get the theme configuration for the current tenant
 */
export const getThemeConfig = (): TenantConfig => {
  return tenantConfigs[currentTenant];
};

/**
 * Get the current tenant type
 */
export const getCurrentTenant = (): TenantType => {
  return currentTenant;
};

/**
 * Check if a language is supported by the current tenant
 */
export const isLanguageSupported = (language: Language): boolean => {
  const config = getThemeConfig();
  return config.languages.includes(language);
};

/**
 * Get the default language for the current tenant
 */
export const getDefaultLanguage = (): Language => {
  return getThemeConfig().defaultLanguage;
};
