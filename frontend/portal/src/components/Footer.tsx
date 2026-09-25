'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-950 text-slate-400 pt-20 pb-10 border-t border-white/10 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        {/* Footer CTA */}
        <div className="max-w-2xl mx-auto text-center mb-16 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t('footer.ctaTitle')}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {t('footer.ctaDesc')}
          </p>
          <div>
            <Link
              href="/beta-register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-bold bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-xl shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <span>{t('nav.beta')}</span>
            </Link>
          </div>
        </div>

        {/* Brand & Footer bottom */}
        <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/isotype-kindicore.png"
              alt="AI GovCoreX Isotype"
              width={28}
              height={28}
              className="object-contain"
            />
            <span className="text-lg font-bold text-white tracking-tight">AI GovCoreX</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
              {t('footer.privacy')}
            </Link>
            <Link href="/cookies" className="hover:text-cyan-400 transition-colors">
              {t('footer.cookies') || 'Cookies'}
            </Link>
            <Link href="/terms" className="hover:text-cyan-400 transition-colors">
              {t('footer.terms')}
            </Link>
            <a href="mailto:contact@aigovcorex.com" className="hover:text-cyan-400 transition-colors">
              {t('footer.contact')}
            </a>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-600">
          {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
};
