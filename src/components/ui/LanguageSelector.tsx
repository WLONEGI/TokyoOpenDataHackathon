'use client';

import { useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { Language } from '@/types';

const languages = [
  { code: 'ja' as Language, name: '日本語', flag: '🇯🇵' },
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
];

export default function LanguageSelector() {
  const { currentLanguage, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  const handleLanguageChange = (langCode: Language) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t('language', '言語選択')}
      >
        <Globe className="w-4 h-4" />
        <span className="flex items-center space-x-1">
          <span>{currentLang?.flag}</span>
          <span>{currentLang?.name}</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`flex items-center space-x-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 ${
                  currentLanguage === language.code 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-700'
                }`}
              >
                <span>{language.flag}</span>
                <span>{language.name}</span>
                {currentLanguage === language.code && (
                  <span className="ml-auto text-primary-600">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}