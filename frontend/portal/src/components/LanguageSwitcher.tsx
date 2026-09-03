'use client';

import React, { useState } from 'react';
import { useLanguage, Language } from '@/context/LanguageContext';
import { Globe } from 'lucide-react';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold glass-panel hover:border-cyan-400/50 transition-all text-gray-700 dark:text-gray-200"
        aria-label="Select Language"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400" />
        <span>{currentLang.flag}</span>
        <span className="uppercase font-mono">{currentLang.code}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl glass-panel shadow-2xl z-50 py-2 border border-white/20 dark:border-white/10 backdrop-blur-xl">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors ${
                language === lang.code
                  ? 'bg-cyan-500/20 text-cyan-400 font-bold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
