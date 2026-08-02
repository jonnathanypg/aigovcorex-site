'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Sparkles, ArrowRight, Shield, Mic, CheckCircle2, Clock, Activity, Building, Zap, Layers, FileCheck } from 'lucide-react';

export default function HomePage() {
  const { t } = useLanguage();
  const [ledgerIndex, setLedgerIndex] = useState(0);

  const ledgerItems = [
    {
      in: t('ledger.in1'),
      out: t('ledger.out1'),
      status: t('ledger.status1'),
    },
    {
      in: t('ledger.in2'),
      out: t('ledger.out2'),
      status: t('ledger.status2'),
    },
    {
      in: t('ledger.in3'),
      out: t('ledger.out3'),
      status: t('ledger.status3'),
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setLedgerIndex((prev) => (prev + 1) % ledgerItems.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [ledgerItems.length]);

  return (
    <div className="min-h-screen flex flex-col pt-24 selection:bg-cyan-500/30">
      {/* HERO SECTION */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        {/* Ambient Glow background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel text-xs font-mono font-semibold text-cyan-400 border border-cyan-500/30">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                <span>{t('hero.eyebrow')}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-gray-900 dark:text-white">
                {t('hero.title1')}
                <span className="gradient-text">{t('hero.titleAccent')}</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                {t('hero.lead')}
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/beta-register"
                  className="px-7 py-3.5 rounded-full font-bold text-sm bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-xl shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>{t('hero.ctaPrimary')}</span>
                </Link>

                <a
                  href="#how"
                  className="px-7 py-3.5 rounded-full font-semibold text-sm glass-panel hover:bg-white/10 text-gray-800 dark:text-white transition-all"
                >
                  {t('hero.ctaSecondary')}
                </a>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-gray-500 dark:text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  {t('hero.trust1')}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-cyan-400" />
                  {t('hero.trust2')}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-teal-400" />
                  {t('hero.trust3')}
                </span>
              </div>
            </div>

            {/* Right Interactive Live Ledger */}
            <div className="lg:col-span-5">
              <div className="glass-panel p-6 rounded-3xl border border-white/30 dark:border-white/15 shadow-2xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-teal-400">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                    <span>{t('hero.ledgerTitle')}</span>
                  </div>
                </div>

                <div className="space-y-4 font-mono text-xs min-h-[190px]">
                  {ledgerItems.map((item, idx) => {
                    const isActive = idx === ledgerIndex;
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl transition-all duration-500 border ${
                          isActive
                            ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg scale-[1.02]'
                            : 'bg-white/40 dark:bg-slate-900/40 border-transparent opacity-60'
                        }`}
                      >
                        <div className="text-gray-600 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                          <Mic className="w-3 h-3 text-cyan-400" />
                          <span>{item.in}</span>
                        </div>
                        <div className="text-cyan-600 dark:text-cyan-400 font-bold mt-1 text-[11px]">
                          → {item.out}
                        </div>
                        <div className="text-teal-600 dark:text-teal-400 text-[10px] mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{item.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-500 dark:text-slate-500">
                  <span>{t('hero.ledgerEngine')}</span>
                  <span>{t('hero.ledgerRegion')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-20 bg-gray-100/60 dark:bg-slate-950/60 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-14 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-500">
              {t('problem.eyebrow')}
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('problem.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
              {t('problem.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-3xl space-y-3 border border-white/40 dark:border-white/10">
              <div className="text-4xl font-extrabold font-space text-gray-900 dark:text-white">
                {t('problem.stat1Num')}
              </div>
              <div className="font-bold text-sm text-gray-900 dark:text-slate-200">
                {t('problem.stat1Label')}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {t('problem.stat1Sub')}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-3 border border-cyan-500/30">
              <div className="text-4xl font-extrabold font-space gradient-text">
                {t('problem.stat2Num')}
              </div>
              <div className="font-bold text-sm text-gray-900 dark:text-slate-200">
                {t('problem.stat2Label')}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {t('problem.stat2Sub')}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-3 border border-white/40 dark:border-white/10">
              <div className="text-4xl font-extrabold font-space text-gray-900 dark:text-white">
                {t('problem.stat3Num')}
              </div>
              <div className="font-bold text-sm text-gray-900 dark:text-slate-200">
                {t('problem.stat3Label')}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {t('problem.stat3Sub')}
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-2xl glass-panel border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-mono text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t('problem.impact')}
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400 text-center sm:text-right max-w-md">
              {t('problem.impactSub')}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how" className="py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-16 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-500">
              {t('how.eyebrow')}
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('how.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
              {t('how.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel p-8 rounded-3xl border border-white/40 dark:border-white/10 space-y-4 hover:border-cyan-400/50 transition-all">
              <div className="w-10 h-10 rounded-full border border-cyan-400/40 flex items-center justify-center font-mono text-sm font-bold text-cyan-400 bg-cyan-500/10">
                {t('how.step1Num')}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('how.step1Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {t('how.step1Desc')}
              </p>
            </div>

            <div className="glass-panel p-8 rounded-3xl border border-cyan-500/30 space-y-4 hover:border-cyan-400/50 transition-all">
              <div className="w-10 h-10 rounded-full border border-teal-400/40 flex items-center justify-center font-mono text-sm font-bold text-teal-400 bg-teal-500/10">
                {t('how.step2Num')}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('how.step2Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {t('how.step2Desc')}
              </p>
            </div>

            <div className="glass-panel p-8 rounded-3xl border border-white/40 dark:border-white/10 space-y-4 hover:border-cyan-400/50 transition-all">
              <div className="w-10 h-10 rounded-full border border-cyan-400/40 flex items-center justify-center font-mono text-sm font-bold text-cyan-400 bg-cyan-500/10">
                {t('how.step3Num')}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('how.step3Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {t('how.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MODULES ARCHITECTURE SECTION */}
      <section id="product" className="py-20 bg-gray-100/60 dark:bg-slate-950/60 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-16 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-500">
              {t('modules.eyebrow')}
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('modules.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
              {t('modules.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Active Beachhead Module */}
            <div className="glass-panel p-8 rounded-3xl border-2 border-cyan-400/60 shadow-xl relative overflow-hidden space-y-4">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                {t('modules.m1Tag')}
              </span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('modules.m1Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                {t('modules.m1Desc')}
              </p>
            </div>

            {/* Next Vertical Module */}
            <div className="glass-panel p-8 rounded-3xl border border-white/30 dark:border-white/10 space-y-4">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                {t('modules.m2Tag')}
              </span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('modules.m2Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {t('modules.m2Desc')}
              </p>
            </div>

            {/* Roadmap Vertical Module */}
            <div className="glass-panel p-8 rounded-3xl border border-white/30 dark:border-white/10 space-y-4">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                {t('modules.m3Tag')}
              </span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('modules.m3Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {t('modules.m3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRACTION SECTION */}
      <section id="traction" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-16 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-500">
              {t('traction.eyebrow')}
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('traction.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
              {t('traction.desc')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/30 dark:border-white/10 space-y-2">
              <div className="text-xs font-mono font-bold text-cyan-400">{t('traction.t1Tag')}</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{t('traction.t1Title')}</div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">{t('traction.t1Sub')}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/30 dark:border-white/10 space-y-2">
              <div className="text-xs font-mono font-bold text-cyan-400">{t('traction.t2Tag')}</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{t('traction.t2Title')}</div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">{t('traction.t2Sub')}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/30 dark:border-white/10 space-y-2">
              <div className="text-xs font-mono font-bold text-cyan-400">{t('traction.t3Tag')}</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{t('traction.t3Title')}</div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">{t('traction.t3Sub')}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/30 dark:border-white/10 space-y-2">
              <div className="text-xs font-mono font-bold text-cyan-400">{t('traction.t4Tag')}</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{t('traction.t4Title')}</div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">{t('traction.t4Sub')}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border-2 border-teal-400/50 bg-teal-500/10 space-y-2 col-span-2 md:col-span-1">
              <div className="text-xs font-mono font-bold text-teal-400">{t('traction.t5Tag')}</div>
              <div className="text-xl font-extrabold text-teal-400">{t('traction.t5Title')}</div>
              <div className="text-[11px] text-gray-600 dark:text-slate-300">{t('traction.t5Sub')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* DEFENSIVE MOAT QUADRANT SECTION */}
      <section className="py-20 bg-gray-100/60 dark:bg-slate-950/60 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-14 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-500">
              {t('moat.eyebrow')}
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t('moat.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 leading-relaxed">
              {t('moat.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* 2x2 Positioning Quadrant */}
            <div className="lg:col-span-7">
              <div className="relative aspect-[4/3] rounded-3xl glass-panel border border-white/40 dark:border-white/10 grid grid-cols-2 grid-rows-2 p-4 gap-3">
                <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 text-xs text-gray-600 dark:text-slate-400 flex flex-col justify-end">
                  {t('moat.q1')}
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400 text-xs font-bold text-gray-900 dark:text-white flex flex-col justify-end shadow-lg shadow-cyan-500/10">
                  <span className="text-cyan-400 font-mono text-[10px] uppercase font-extrabold mb-1">⭐ LEADER</span>
                  {t('moat.q2')}
                </div>
                <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 text-xs text-gray-600 dark:text-slate-400 flex flex-col justify-end">
                  {t('moat.q3')}
                </div>
                <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 text-xs text-gray-600 dark:text-slate-400 flex flex-col justify-end">
                  {t('moat.q4')}
                </div>
              </div>
            </div>

            {/* Moat Bullet points */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                  01
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{t('moat.m1Title')}</h4>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">{t('moat.m1Desc')}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                  02
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{t('moat.m2Title')}</h4>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">{t('moat.m2Desc')}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                  03
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{t('moat.m3Title')}</h4>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">{t('moat.m3Desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
