'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { SupportedLanguage } from '@/types';
import { Locale, getLocale } from './locales';

interface I18nContextType {
  language: SupportedLanguage;
  t: Locale;
  setLanguage: (language: SupportedLanguage) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  language: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
}

export function I18nProvider({ children, language, onLanguageChange }: I18nProviderProps) {
  const t = getLocale(language);

  console.log('I18nProvider: Rendering with language:', language, 'Title:', t.nav.title);

  // Use useMemo to ensure the context value updates when language changes
  const value: I18nContextType = useMemo(() => ({
    language,
    t,
    setLanguage: onLanguageChange,
  }), [language, t, onLanguageChange]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Utility function for getting formatted messages
export function useTranslation() {
  const { t, language } = useI18n();
  
  return {
    t,
    language,
    formatMessage: (key: string, values?: Record<string, string | number>) => {
      // Simple template string replacement
      let message = key;
      if (values) {
        Object.entries(values).forEach(([key, value]) => {
          message = message.replace(new RegExp(`{${key}}`, 'g'), String(value));
        });
      }
      return message;
    },
  };
}