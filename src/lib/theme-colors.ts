import { getThemeConfig } from "@/config/theme.config";

/**
 * Apply tenant-specific theme colors as CSS variables
 * This function should be called whenever the theme mode changes
 */
export function applyThemeColors(mode: 'light' | 'dark' = 'light') {
  const config = getThemeConfig();
  const colors = config.colors[mode];

  // Apply all color variables to the root element
  const root = document.documentElement;

  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-foreground', colors.accentForeground);
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--popover', colors.popover);
  root.style.setProperty('--popover-foreground', colors.popoverForeground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.input);
  root.style.setProperty('--ring', colors.ring);

  // Component-specific UI colors
  root.style.setProperty('--icon-highlight', colors.iconHighlight);
  root.style.setProperty('--button-interactive', colors.buttonInteractive);
  root.style.setProperty('--button-interactive-foreground', colors.buttonInteractiveForeground);
  root.style.setProperty('--button-interactive-border', colors.buttonInteractiveBorder);
  root.style.setProperty('--input-focus-ring', colors.inputFocusRing);
}

/**
 * Initialize theme colors based on current theme preference
 * Automatically detects dark mode and applies appropriate colors
 */
export function initializeThemeColors() {
  // Check if user has dark mode preference
  const isDarkMode = document.documentElement.classList.contains('dark') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  applyThemeColors(isDarkMode ? 'dark' : 'light');

  // Watch for theme changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        const isDark = document.documentElement.classList.contains('dark');
        applyThemeColors(isDark ? 'dark' : 'light');
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  return observer;
}
