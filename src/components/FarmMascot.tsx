import { useEffect, useState } from "react";
import { getThemeConfig } from "@/config/theme.config";

export function FarmMascot() {
  const [animate, setAnimate] = useState(false);
  const themeConfig = getThemeConfig();

  return (
    <div className="relative w-36 h-36 mx-auto">
      <picture>
        <source srcSet={themeConfig.logo.webp} type="image/webp" />
        <img
          src={themeConfig.logo.primary}
          alt={`${themeConfig.name} Mascot`}
          loading="eager"
          decoding="async"
          className="w-full h-full"
        />
      </picture>
    </div>
  );
}
