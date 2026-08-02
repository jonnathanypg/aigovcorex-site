'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { ArrowLeft, Lock } from 'lucide-react';

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen py-24 px-4 max-w-4xl mx-auto space-y-8">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:underline">
        <ArrowLeft className="w-4 h-4" />
        <span>{t('legal.backHome')}</span>
      </Link>

      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {t('legal.privacyTitle')}
        </h1>
        <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
          {t('legal.lastUpdated')}
        </p>
      </div>

      <div className="glass-panel p-8 rounded-3xl space-y-6 text-sm text-gray-700 dark:text-slate-300 leading-relaxed border border-white/40 dark:border-white/10">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Data Protection & Government Compliance</h2>
          <p>
            AI GovCoreX employs multi-tenant database isolation, SSL encryption, and strict role-based access control (RBAC). All compliance data and field audio reports are stored in secure cloud environments compliant with state and international privacy standards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Usage of Collected Information</h2>
          <p>
            Information submitted through the Beta Waitlist registration is exclusively used for organization qualification, capacity estimation, and onboarding credentials delivery.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Information Security</h2>
          <p>
            We implement administrative and technical safeguards to prevent unauthorized access, disclosure, or alteration of public program records.
          </p>
        </section>
      </div>
    </div>
  );
}
