'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  Building2,
  Briefcase,
  Users,
  Package,
  Cpu,
  Sparkles,
  User,
  Mail,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  Sun,
  Moon,
  CornerDownLeft,
  Check,
  ChevronRight,
  ShieldCheck,
  Rocket
} from 'lucide-react';

export default function BetaRegisterPage() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    employee_count: '',
    products_services: '',
    ai_experience: '',
    ai_expectations: '',
    contact_name: '',
    role_in_company: '',
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [touchedOption, setTouchedOption] = useState<string | null>(null);
  const [bottomOffset, setBottomOffset] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const topAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboardH = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      setBottomOffset(keyboardH);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const QUESTIONS = useMemo(() => [
    {
      id: 'company_name',
      title: t('beta.q1Title'),
      subtitle: t('beta.q1Subtitle'),
      type: 'text',
      field: 'company_name',
      placeholder: t('beta.q1Placeholder'),
      icon: Building2,
      badge: t('beta.q1Badge')
    },
    {
      id: 'industry',
      title: t('beta.q2Title'),
      subtitle: t('beta.q2Subtitle'),
      type: 'select',
      field: 'industry',
      options: [
        { label: t('beta.q2Opt1'), value: 'early_childhood', desc: t('beta.q2Opt1Desc'), badge: ' Beachhead' },
        { label: t('beta.q2Opt2'), value: 'social_assistance', desc: t('beta.q2Opt2Desc') },
        { label: t('beta.q2Opt3'), value: 'public_health', desc: t('beta.q2Opt3Desc') },
        { label: t('beta.q2Opt4'), value: 'education', desc: t('beta.q2Opt4Desc') },
        { label: t('beta.q2Opt5'), value: 'municipal_gov', desc: t('beta.q2Opt5Desc') },
        { label: t('beta.q2Opt6'), value: 'other_b2g', desc: t('beta.q2Opt6Desc') }
      ],
      icon: Briefcase,
      badge: t('beta.q2Badge')
    },
    {
      id: 'employee_count',
      title: t('beta.q3Title'),
      subtitle: t('beta.q3Subtitle'),
      type: 'select',
      field: 'employee_count',
      options: [
        { label: t('beta.q3Opt1'), value: '1-5', desc: t('beta.q3Opt1Desc') },
        { label: t('beta.q3Opt2'), value: '6-20', desc: t('beta.q3Opt2Desc') },
        { label: t('beta.q3Opt3'), value: '21-50', desc: t('beta.q3Opt3Desc') },
        { label: t('beta.q3Opt4'), value: '50+', desc: t('beta.q3Opt4Desc'), badge: 'Enterprise Gov' }
      ],
      icon: Users,
      badge: t('beta.q3Badge')
    },
    {
      id: 'products_services',
      title: t('beta.q4Title'),
      subtitle: t('beta.q4Subtitle'),
      type: 'textarea',
      field: 'products_services',
      placeholder: t('beta.q4Placeholder'),
      icon: Package,
      badge: t('beta.q4Badge')
    },
    {
      id: 'ai_experience',
      title: t('beta.q5Title'),
      subtitle: t('beta.q5Subtitle'),
      type: 'select',
      field: 'ai_experience',
      options: [
        { label: t('beta.q5Opt1'), value: 'none', desc: t('beta.q5Opt1Desc') },
        { label: t('beta.q5Opt2'), value: 'intermediate', desc: t('beta.q5Opt2Desc') },
        { label: t('beta.q5Opt3'), value: 'advanced', desc: t('beta.q5Opt3Desc') }
      ],
      icon: Cpu,
      badge: t('beta.q5Badge')
    },
    {
      id: 'ai_expectations',
      title: t('beta.q6Title'),
      subtitle: t('beta.q6Subtitle'),
      type: 'textarea',
      field: 'ai_expectations',
      placeholder: t('beta.q6Placeholder'),
      icon: Sparkles,
      badge: t('beta.q6Badge')
    },
    {
      id: 'contact_info',
      title: t('beta.q7Title'),
      subtitle: t('beta.q7Subtitle'),
      type: 'contact_group',
      field: 'contact_group',
      icon: User,
      badge: t('beta.q7Badge')
    }
  ], [t]);

  const step = QUESTIONS[currentStep];

  const updateField = (field: string, value: string) => {
    setErrorMsg(null);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectOption = (field: string, value: string) => {
    setErrorMsg(null);
    setTouchedOption(value);
    updateField(field, value);

    setTimeout(() => {
      setTouchedOption(null);
      if (currentStep < QUESTIONS.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    }, 200);
  };

  const handleSubmit = useCallback(async () => {
    if (!formData.contact_name || !formData.email || !formData.phone || !formData.role_in_company) {
      setErrorMsg(t('beta.valContact'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      setIsCompleted(true);
    } catch (err: any) {
      console.error('Beta registration error:', err);
      setErrorMsg(err.message || 'Error sending registration. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, t]);

  const handleNext = useCallback(() => {
    setErrorMsg(null);

    if (step.type === 'text' && !formData[step.field as keyof typeof formData]?.trim()) {
      setErrorMsg(t('beta.valText'));
      return;
    }
    if (step.type === 'select' && !formData[step.field as keyof typeof formData]) {
      setErrorMsg(t('beta.valSelect'));
      return;
    }
    if (step.type === 'textarea' && !formData[step.field as keyof typeof formData]?.trim()) {
      setErrorMsg(t('beta.valText'));
      return;
    }

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  }, [currentStep, formData, QUESTIONS.length, handleSubmit, step, t]);

  const handlePrev = () => {
    setErrorMsg(null);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && step.type !== 'textarea' && !isCompleted && !isSubmitting) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, isCompleted, isSubmitting, step.type]);

  useEffect(() => {
    if (topAnchorRef.current) {
      topAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const progressPercentage = Math.round(((currentStep + 1) / QUESTIONS.length) * 100);

  if (isCompleted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950/30 p-4 text-slate-100 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="w-full max-w-lg rounded-3xl border border-cyan-500/30 glass-panel p-8 text-center shadow-2xl backdrop-blur-2xl relative z-10"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/15 text-teal-400 ring-8 ring-teal-500/10">
            <CheckCircle2 className="h-10 w-10 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-semibold mb-3 border border-teal-500/20">
            <Rocket className="h-3.5 w-3.5" />
            <span>{t('beta.completedBadge')}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t('beta.completedTitle')}
          </h2>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            {t('beta.completedSubtitle').replace('{{company}}', formData.company_name)}
          </p>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            {t('beta.completedDesc').replace('{{email}}', formData.email)}
          </p>

          <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 text-amber-400 text-xs font-medium">
              <Clock className="h-5 w-5 shrink-0" />
              <span>{t('beta.statusPending')}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link href="/">
              <button className="w-full bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold py-4 rounded-2xl text-base shadow-xl shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
                {t('beta.goToHome')}
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950 text-slate-100 transition-colors duration-300 relative selection:bg-cyan-500/30">
      <div ref={topAnchorRef} />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 sm:px-8 py-3.5 backdrop-blur-xl bg-slate-950/80 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/isotype-kindicore.png" alt="AI GovCoreX" width={32} height={32} className="object-contain" />
            <span className="text-lg font-black tracking-tight text-white font-space">
              AI GovCoreX
            </span>
          </Link>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
            BETA VIP
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <LanguageSwitcher />

          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full p-2 glass-panel border border-white/10 text-amber-400 dark:text-indigo-400"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}

          <Link href="/" className="flex items-center gap-1 text-cyan-400 hover:underline font-bold pl-1">
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </header>

      {/* Sticky Progress Bar */}
      <div className="sticky top-[57px] sm:top-[65px] z-40 bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>{t('beta.step').replace('{{current}}', (currentStep + 1).toString()).replace('{{total}}', QUESTIONS.length.toString())}</span>
        </div>

        <div className="flex items-center gap-3 w-1/2 max-w-xs">
          <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-black text-cyan-400 w-9 text-right">{progressPercentage}%</span>
        </div>
      </div>

      {/* Main Form Content */}
      <main className="flex-1 w-full px-4 py-6 sm:px-6 sm:py-10 max-w-2xl mx-auto pb-32">
        <div className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-6 sm:space-y-8"
            >
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/15 px-3.5 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/30">
                    <step.icon className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{step.badge}</span>
                  </div>
                </div>

                <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  {step.title}
                </h1>
                <p className="text-slate-400 text-xs sm:text-base leading-relaxed">
                  {step.subtitle}
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              {/* Dynamic Inputs */}
              <div className="pt-1">
                {step.type === 'text' && (
                  <div className="space-y-3">
                    <input
                      autoFocus
                      value={formData[step.field as keyof typeof formData]}
                      onChange={e => updateField(step.field, e.target.value)}
                      placeholder={step.placeholder}
                      className="w-full h-14 sm:h-16 bg-slate-900/80 border border-white/20 text-base sm:text-xl text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-cyan-400 px-5 transition-all"
                    />
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                      <CornerDownLeft className="h-3.5 w-3.5" />
                      <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">Enter ↵</kbd> to continue</span>
                    </div>
                  </div>
                )}

                {step.type === 'textarea' && (
                  <div className="space-y-3">
                    <textarea
                      autoFocus
                      rows={4}
                      value={formData[step.field as keyof typeof formData]}
                      onChange={e => updateField(step.field, e.target.value)}
                      placeholder={step.placeholder}
                      className="w-full bg-slate-900/80 border border-white/20 text-base sm:text-lg text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-cyan-400 p-4 sm:p-5 transition-all resize-none min-h-[140px]"
                    />
                  </div>
                )}

                {step.type === 'select' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {step.options?.map((opt, idx) => {
                      const isSelected = formData[step.field as keyof typeof formData] === opt.value;
                      const isTouched = touchedOption === opt.value;

                      return (
                        <motion.button
                          key={opt.value}
                          type="button"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectOption(step.field, opt.value)}
                          className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-150 relative overflow-hidden ${
                            isSelected || isTouched
                              ? 'border-cyan-400 bg-cyan-500/20 text-white ring-2 ring-cyan-400/40 shadow-md'
                              : 'border-white/10 bg-slate-900/60 text-slate-200 hover:border-cyan-400/50 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 pr-2">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors mt-0.5 ${
                              isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                            <div className="space-y-0.5">
                              <div className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                                <span>{opt.label}</span>
                                {opt.badge && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-400 border border-cyan-400/30">
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              {opt.desc && (
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  {opt.desc}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700'
                          }`}>
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {step.type === 'contact_group' && (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-cyan-400" />
                        {t('beta.q7Name')}
                      </label>
                      <input
                        value={formData.contact_name}
                        onChange={e => updateField('contact_name', e.target.value)}
                        placeholder={t('beta.q7NamePh')}
                        className="w-full bg-slate-900/80 border border-white/20 text-white text-sm rounded-xl h-12 px-4 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
                        {t('beta.q7Role')}
                      </label>
                      <input
                        value={formData.role_in_company}
                        onChange={e => updateField('role_in_company', e.target.value)}
                        placeholder={t('beta.q7RolePh')}
                        className="w-full bg-slate-900/80 border border-white/20 text-white text-sm rounded-xl h-12 px-4 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-cyan-400" />
                        {t('beta.q7Email')}
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => updateField('email', e.target.value)}
                        placeholder={t('beta.q7EmailPh')}
                        className="w-full bg-slate-900/80 border border-white/20 text-white text-sm rounded-xl h-12 px-4 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-cyan-400" />
                        {t('beta.q7Phone')}
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={e => updateField('phone', e.target.value)}
                        placeholder={t('beta.q7PhonePh')}
                        className="w-full bg-slate-900/80 border border-white/20 text-white text-sm rounded-xl h-12 px-4 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-2 flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-xl border border-white/10">
                      <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
                      <span>{t('beta.q7Security')}</span>
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <div
        className="fixed left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 shadow-2xl transition-[bottom] duration-150"
        style={{ bottom: `${bottomOffset}px` }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isSubmitting}
              className="rounded-xl h-12 px-4 border border-white/20 shrink-0 font-bold text-slate-300 hover:bg-slate-800 text-sm flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('beta.prev')}</span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold h-12 rounded-xl shadow-lg shadow-cyan-500/25 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 text-sm transition-all"
          >
            {currentStep === QUESTIONS.length - 1 ? (
              isSubmitting ? t('beta.submitting') : t('beta.submit')
            ) : (
              <>
                <span>{t('beta.next')}</span>
                <ChevronRight className="h-4 w-4 stroke-[3] sm:hidden" />
                <ArrowRight className="h-4 w-4 ml-1 stroke-[2.5] hidden sm:block" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
