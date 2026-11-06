import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ThemeConfig {
  accentColor: string;
  fontFamily: string;
  primaryHex: string;
  tertiaryHex: string;
  strata0Hex: string;
  strata1Hex: string;
  borderHex: string;
  fontBody: string;
  fontTelemetry: string;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  accentColor: '#00E5FF',
  fontFamily: 'JetBrains Mono',
  primaryHex: '#5322FF',
  tertiaryHex: '#00E676',
  strata0Hex: '#080A0F',
  strata1Hex: '#0D1017',
  borderHex: '#1F1F2E',
  fontBody: 'Inter',
  fontTelemetry: 'Space Grotesk',
};

const STORAGE_KEY_THEME = 'vibepath_custom_theme_v1';

export function getStoredThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THEME);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_THEME_CONFIG,
        ...parsed,
      };
    }
  } catch (_) {}
  return DEFAULT_THEME_CONFIG;
}

interface ThemeContextValue {
  theme: ThemeConfig;
  accentColor: string;
  fontFamily: string;
  setAccentColor: (color: string) => void;
  setFontFamily: (font: string) => void;
  updateTheme: (partial: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_CONFIG,
  accentColor: DEFAULT_THEME_CONFIG.accentColor,
  fontFamily: DEFAULT_THEME_CONFIG.fontFamily,
  setAccentColor: () => {},
  setFontFamily: () => {},
  updateTheme: () => {},
  resetTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => getStoredThemeConfig());

  useEffect(() => {
    const root = document.documentElement;
    const cleanAccent = theme.accentColor || '#00E5FF';
    const cleanFont = theme.fontFamily || 'JetBrains Mono';

    // Bind required root CSS properties: --accent-color, --font-family
    root.style.setProperty('--accent-color', cleanAccent);
    root.style.setProperty('--font-family', `"${cleanFont}", monospace`);

    // Sync existing design system tokens
    root.style.setProperty('--cyan-cyber', cleanAccent);
    root.style.setProperty('--vp-secondary', cleanAccent);
    root.style.setProperty('--vp-primary', theme.primaryHex || '#5322FF');
    root.style.setProperty('--vp-tertiary', theme.tertiaryHex || '#00E676');
    root.style.setProperty('--vp-strata-0', theme.strata0Hex || '#080A0F');
    root.style.setProperty('--vp-strata-1', theme.strata1Hex || '#0D1017');
    root.style.setProperty('--vp-border-sharp', theme.borderHex || '#1F1F2E');
    root.style.setProperty('--vp-font-brand', `"${cleanFont}", monospace`);
    root.style.setProperty('--vp-font-body', `"${theme.fontBody || 'Inter'}", sans-serif`);
    root.style.setProperty(
      '--vp-font-telemetry',
      `"${theme.fontTelemetry || 'Space Grotesk'}", sans-serif`
    );

    try {
      localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(theme));
    } catch (_) {}

    window.dispatchEvent(
      new CustomEvent('vibepath_theme_updated', {
        detail: {
          accentColor: cleanAccent,
          fontFamily: cleanFont,
        },
      })
    );
  }, [theme]);

  const setAccentColor = (accentColor: string) => {
    setTheme((prev) => ({ ...prev, accentColor }));
  };

  const setFontFamily = (fontFamily: string) => {
    setTheme((prev) => ({ ...prev, fontFamily }));
  };

  const updateTheme = (partial: Partial<ThemeConfig>) => {
    setTheme((prev) => ({ ...prev, ...partial }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME_CONFIG);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accentColor: theme.accentColor,
        fontFamily: theme.fontFamily,
        setAccentColor,
        setFontFamily,
        updateTheme,
        resetTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
