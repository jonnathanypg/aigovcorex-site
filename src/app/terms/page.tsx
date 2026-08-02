'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { ArrowLeft, Shield } from 'lucide-react';

export default function TermsPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen py-24 px-4 max-w-4xl mx-auto space-y-8">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:underline">
        <ArrowLeft className="w-4 h-4" />
        <span>{t('legal.backHome')}</span>
      </Link>

      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {t('legal.termsTitle')}
        </h1>
        <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
          {t('legal.lastUpdated')}
        </p>
      </div>

      <div className="glass-panel p-8 rounded-3xl space-y-6 text-sm text-gray-700 dark:text-slate-300 leading-relaxed border border-white/40 dark:border-white/10">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Platform Services & Governance</h2>
          <p>
            AI GovCoreX provides an autonomous agentic compliance operating system designed for public sector agencies, government contractors, and social welfare program administrators. By accessing or requesting beta registration, organizations agree to standard public-sector compliance protocols and data privacy guidelines.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Voice Data & Agentic Processing</h2>
          <p>
            Audio field reports sent via official messaging channels (e.g. WhatsApp, Telegram) are processed using natural language extraction models strictly scoped to program regulatory frameworks. No audio data is shared with unverified third parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Intellectual Property & Modular Architecture</h2>
          <p>
            AI GovCoreX and its vertical modules (including KindiCore AI, SocialCore AI, and HealthCore AI) remain the exclusive intellectual property of the parent entity.
          </p>
        </section>
      </div>
    </div>
  );
}
