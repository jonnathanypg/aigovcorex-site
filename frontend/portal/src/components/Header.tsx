'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from 'next-themes';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Sun, Moon, Sparkles, Menu, X } from 'lucide-react';

export const Header: React.FC = () => {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-4 transition-all">
      <div className="max-w-6xl mx-auto px-4">
        <div className="glass-nav rounded-full px-5 py-3 flex items-center justify-between shadow-xl border border-white/40 dark:border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-cyan-950/20 group-hover:scale-105 transition-transform">
              <Image
                src="/isotype-kindicore.png"
                alt="AI GovCoreX Isotype"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-lg font-space tracking-tight text-gray-900 dark:text-white">
              AI GovCoreX
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#product" className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-cyan-400 transition-colors">
              {t('nav.product')}
            </a>
            <a href="#how" className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-cyan-400 transition-colors">
              {t('nav.how')}
            </a>
            <a href="#traction" className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-cyan-400 transition-colors">
              {t('nav.traction')}
            </a>
            <Link href="/terms" className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-cyan-400 transition-colors">
              {t('nav.legal')}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full glass-panel hover:border-cyan-400/50 transition-all text-amber-500 dark:text-indigo-400"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <Link
              href={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:9002'}
              className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold glass-panel hover:border-cyan-400/60 hover:text-cyan-400 transition-all text-gray-700 dark:text-gray-200"
            >
              <span>{t('nav.dashboard')}</span>
            </Link>

            <Link
              href="/beta-register"
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>{t('nav.beta')}</span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full glass-panel text-gray-700 dark:text-gray-200"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden mt-3 p-6 rounded-3xl glass-panel flex flex-col gap-4 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-2xl">
            <a
              href="#product"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold text-gray-800 dark:text-gray-200"
            >
              {t('nav.product')}
            </a>
            <a
              href="#how"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold text-gray-800 dark:text-gray-200"
            >
              {t('nav.how')}
            </a>
            <a
              href="#traction"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold text-gray-800 dark:text-gray-200"
            >
              {t('nav.traction')}
            </a>
            <Link
              href="/terms"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-semibold text-gray-800 dark:text-gray-200"
            >
              {t('nav.legal')}
            </Link>
            <Link
              href={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:9002'}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold glass-panel border border-cyan-500/30 text-cyan-400"
            >
              <span>{t('nav.dashboard')}</span>
            </Link>
            <Link
              href="/beta-register"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{t('nav.beta')}</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
