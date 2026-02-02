import { useEffect } from "react";
import { getThemeConfig } from "@/config/theme.config";

/**
 * Component that updates document meta tags based on tenant configuration
 * Should be rendered once at the app root level
 */
export function TenantMetaTags() {
  const config = getThemeConfig();

  useEffect(() => {
    // Update document title
    document.title = config.meta.title;

    // Update meta description
    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.setAttribute('name', 'description');
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.setAttribute('content', config.meta.description);

    // Update OG meta tags
    let ogTitleMeta = document.querySelector('meta[property="og:title"]');
    if (!ogTitleMeta) {
      ogTitleMeta = document.createElement('meta');
      ogTitleMeta.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitleMeta);
    }
    ogTitleMeta.setAttribute('content', config.meta.title);

    let ogDescriptionMeta = document.querySelector('meta[property="og:description"]');
    if (!ogDescriptionMeta) {
      ogDescriptionMeta = document.createElement('meta');
      ogDescriptionMeta.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescriptionMeta);
    }
    ogDescriptionMeta.setAttribute('content', config.meta.description);

    let ogImageMeta = document.querySelector('meta[property="og:image"]');
    if (!ogImageMeta) {
      ogImageMeta = document.createElement('meta');
      ogImageMeta.setAttribute('property', 'og:image');
      document.head.appendChild(ogImageMeta);
    }
    ogImageMeta.setAttribute('content', config.meta.ogImage);

    // Update favicon
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.setAttribute('rel', 'icon');
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = config.logo.favicon;

    // Update apple-touch-icon
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.setAttribute('rel', 'apple-touch-icon');
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = config.logo.primary;
  }, [config]);

  // This component doesn't render anything
  return null;
}
