import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { vi, LocaleTranslations } from '../locales/vi';
import { en } from '../locales/en';

export type LanguageCode = 'vi' | 'en';

export const dictionaries: Record<LanguageCode, LocaleTranslations> = {
  vi,
  en,
};

export interface LanguageContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  translations: LocaleTranslations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export interface LanguageProviderProps {
  children: React.ReactNode;
  initialLang?: LanguageCode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLang = 'vi',
}) => {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vibepath_lang');
      if (saved === 'vi' || saved === 'en') {
        return saved;
      }
    }
    return initialLang;
  });

  const setLang = useCallback((nextLang: LanguageCode) => {
    setLangState(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vibepath_lang', nextLang);
      window.dispatchEvent(new CustomEvent('vibepath_lang_changed', { detail: { lang: nextLang } }));
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLang(lang === 'vi' ? 'en' : 'vi');
  }, [lang, setLang]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'vibepath_lang' && (e.newValue === 'vi' || e.newValue === 'en')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const dict = dictionaries[lang] || dictionaries.vi;
      const keys = path.split('.');
      let current: any = dict;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return fallback !== undefined ? fallback : path;
        }
      }
      return typeof current === 'string' ? current : fallback || path;
    },
    [lang]
  );

  const value = useMemo<LanguageContextType>(
    () => ({
      lang,
      setLang,
      toggleLanguage,
      t,
      translations: dictionaries[lang],
    }),
    [lang, setLang, toggleLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useTranslation(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export function useLanguage(): LanguageContextType {
  return useTranslation();
}
