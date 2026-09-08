'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Check, Cookie, X, Settings2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const CONSENT_STORAGE_KEY = 'aigovcorex_privacy_consent';
const CONSENT_COOKIE_NAME = 'aigovcorex_privacy_consent';

function hasUserConsented(): boolean {
  if (typeof window === 'undefined') return true;

  // 1. Check localStorage
  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed && (parsed.accepted === true || parsed === true)) {
        return true;
      }
    }
  } catch {
    // LocalStorage blocked or restricted (strict private browsing)
  }

  // 2. Check document.cookie as robust fallback
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const cookies = document.cookie.split(';');
      for (const item of cookies) {
        const [k, v] = item.trim().split('=');
        if (k === CONSENT_COOKIE_NAME && (v === 'true' || v === '1')) {
          return true;
        }
      }
    }
  } catch {}

  return false;
}

export function PrivacyBanner() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Preference options state
  const [prefAnalytics, setPrefAnalytics] = useState(false);

  useEffect(() => {
    // Check if user has consented
    setIsVisible(!hasUserConsented());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_STORAGE_KEY || e.key === null) {
        setIsVisible(!hasUserConsented());
      }
    };

    const handleCustomEvent = () => {
      setIsVisible(!hasUserConsented());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('aigovcorex_privacy_consent_changed', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('aigovcorex_privacy_consent_changed', handleCustomEvent);
    };
  }, []);

  const saveConsent = (accepted: boolean, analytics: boolean = false) => {
    const consentPayload = {
      accepted,
      essential: true,
      analytics,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      version: '2026.1',
    };

    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentPayload));
    } catch {}

    try {
      if (typeof document !== 'undefined') {
        const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${CONSENT_COOKIE_NAME}=true; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
      }
    } catch {}

    try {
      window.dispatchEvent(new Event('aigovcorex_privacy_consent_changed'));
    } catch {}

    setIsVisible(false);
    setShowConfigModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent(true, true);
  };

  const handleAcceptEssential = () => {
    saveConsent(true, false);
  };

  const handleSaveCustom = () => {
    saveConsent(true, prefAnalytics);
  };

  if (!isVisible) return null;

  const isEs = language === 'es';

  return (
    <>
      {/* Banner Principal flotante estilo HUD Glassmorphism */}
      <aside
        role="dialog"
        aria-live="polite"
        aria-label={isEs ? "Aviso de Privacidad y Cookies de AI GovCoreX" : "AI GovCoreX Privacy and Cookies Notice"}
        className="fixed inset-x-0 bottom-0 z-[99999] pointer-events-none p-3 sm:p-5 flex justify-center animate-in fade-in slide-in-from-bottom-6 duration-300"
      >
        <div className="pointer-events-auto w-full max-w-4xl rounded-2xl bg-slate-950/95 border border-cyan-500/30 shadow-[0_20px_50px_rgba(6,14,31,0.8)] backdrop-blur-2xl text-slate-200 p-4 sm:p-6 ring-1 ring-white/10 transition-all">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            
            {/* Contenido e Icono */}
            <div className="flex items-start space-x-4 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center flex-shrink-0 text-cyan-400 mt-0.5 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 uppercase tracking-wider bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/40 shadow-sm">
                    <Lock className="w-3 h-3" /> {isEs ? 'Privacidad & LOPDP / RGPD' : 'Privacy & Compliance LOPDP / GDPR'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    <Cookie className="w-3 h-3 text-amber-400" /> {isEs ? 'Cookies Técnicas Esenciales' : 'Essential Technical Cookies'}
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                  {isEs ? (
                    <>
                      En <strong className="text-white font-semibold">AI GovCoreX OS</strong> protegemos la soberanía de los datos públicos y programas sociales. Empleamos cookies técnicas y almacenamiento estrictamente necesario para garantizar la seguridad de sesión, autenticación JWT, prevención CSRF y gobernanza multi-tenant. <strong className="text-cyan-300 font-medium">No comercializamos ni perfilamos datos personales con fines publicitarios.</strong>
                    </>
                  ) : (
                    <>
                      At <strong className="text-white font-semibold">AI GovCoreX OS</strong> we safeguard public sector records and governance privacy. We use technical cookies and strictly necessary local storage for authenticated sessions, JWT validation, CSRF defenses, and multi-tenant security. <strong className="text-cyan-300 font-medium">We never monetize, resell, or profile personal data for third-party advertising.</strong>
                    </>
                  )}
                </p>

                {/* Enlaces Legales Rápidos */}
                <div className="pt-1 flex flex-wrap items-center gap-x-2.5 text-xs text-slate-400">
                  <span>{isEs ? 'Documentación legal pública:' : 'Public regulatory docs:'}</span>
                  <Link
                    href="/privacy"
                    className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    {isEs ? 'Privacidad y LOPDP' : 'Privacy & LOPDP'}
                  </Link>
                  <span className="text-slate-600">&bull;</span>
                  <Link
                    href="/cookies"
                    className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    {isEs ? 'Política de Cookies' : 'Cookie Policy'}
                  </Link>
                  <span className="text-slate-600">&bull;</span>
                  <Link
                    href="/terms"
                    className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    {isEs ? 'Términos de Servicio' : 'Terms of Service'}
                  </Link>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="h-9 px-3.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
                title={isEs ? "Configurar preferencias de cookies" : "Configure cookie preferences"}
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{isEs ? 'Configurar' : 'Configure'}</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptEssential}
                className="h-9 px-3.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all"
                title={isEs ? "Aceptar únicamente cookies técnicas esenciales" : "Accept essential only"}
              >
                <span>{isEs ? 'Solo Esenciales' : 'Essential Only'}</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptAll}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 active:scale-[0.98] text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                <span>{isEs ? 'Aceptar Todas' : 'Accept All'}</span>
              </button>
            </div>

          </div>
        </div>
      </aside>

      {/* Modal de Configuración Granular */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Cookie className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">
                  {isEs ? 'Preferencias de Cookies & Privacidad' : 'Cookie & Privacy Preferences'}
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {isEs
                ? 'Controla qué tecnologías de almacenamiento y telemetría deseas habilitar durante tu interacción con AI GovCoreX OS. Las cookies esenciales no se pueden desactivar ya que son necesarias para la seguridad del sistema.'
                : 'Control which storage and telemetry technologies you allow while interacting with AI GovCoreX OS. Essential technical cookies cannot be disabled as they maintain system integrity.'}
            </p>

            <div className="space-y-3.5 pt-1">
              {/* Categoría 1: Esenciales */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {isEs ? 'Cookies Técnicas y de Seguridad' : 'Essential Security & Technical'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                      {isEs ? 'Obligatorias' : 'Required'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isEs
                      ? 'Autenticación mediante JWT, protección CSRF, persistencia de consentimiento y aislamiento multi-tenant.'
                      : 'JWT authentication tokens, CSRF defenses, consent state, and multi-tenant isolation.'}
                  </p>
                </div>
                <div className="w-10 h-6 bg-cyan-500/30 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-80">
                  <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-sm" />
                </div>
              </div>

              {/* Categoría 2: Rendimiento y Telemetría Anónima */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {isEs ? 'Métricas Anónimas de Rendimiento' : 'Anonymous Performance Analytics'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                      {isEs ? 'Opcional' : 'Optional'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isEs
                      ? 'Nos ayuda a medir tiempos de carga y latencia en el procesamiento de notas de voz sin registrar identificadores personales.'
                      : 'Helps us evaluate latency and loading speed for voice processing without collecting personally identifiable data.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefAnalytics(!prefAnalytics)}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${
                    prefAnalytics ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
              >
                {isEs ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow-md shadow-cyan-500/20"
              >
                {isEs ? 'Guardar Preferencias' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
