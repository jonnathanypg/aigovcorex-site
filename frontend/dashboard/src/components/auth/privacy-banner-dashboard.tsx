'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Check, Cookie, X, Settings2 } from 'lucide-react';

const CONSENT_STORAGE_KEY = 'aigovcorex_privacy_consent';
const CONSENT_COOKIE_NAME = 'aigovcorex_privacy_consent';

function hasUserConsented(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed && (parsed.accepted === true || parsed === true)) {
        return true;
      }
    }
  } catch {}

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

export function PrivacyBannerDashboard() {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [prefAnalytics, setPrefAnalytics] = useState(false);

  useEffect(() => {
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

  if (!isVisible) return null;

  return (
    <>
      {/* HUD Banner Glassmorphism */}
      <aside
        role="dialog"
        aria-live="polite"
        aria-label="Aviso de Privacidad y Cookies de AI GovCoreX"
        className="fixed inset-x-0 bottom-0 z-[99999] pointer-events-none p-3 sm:p-5 flex justify-center animate-in fade-in slide-in-from-bottom-6 duration-300"
      >
        <div className="pointer-events-auto w-full max-w-4xl rounded-2xl bg-zinc-950/95 border border-sky-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-zinc-200 p-4 sm:p-6 ring-1 ring-white/10 transition-all">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            
            {/* Contenido e Icono */}
            <div className="flex items-start space-x-4 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center flex-shrink-0 text-sky-400 mt-0.5 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 uppercase tracking-wider bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-500/40 shadow-sm">
                    <Lock className="w-3 h-3" /> Privacidad & LOPDP / RGPD
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    <Cookie className="w-3 h-3 text-amber-400" /> Cookies Técnicas Esenciales
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed">
                  En <strong className="text-white font-semibold">AI GovCoreX OS</strong> protegemos los expedientes ciudadanos y datos de programas sociales. Empleamos cookies técnicas necesarias para autenticación segura (JWT), prevención CSRF y aislamiento multi-tenant. <strong className="text-sky-300 font-medium">No comercializamos ni rastreamos tus datos personales con fines publicitarios.</strong>
                </p>

                {/* Enlaces Legales Rápidos */}
                <div className="pt-1 flex flex-wrap items-center gap-x-2.5 text-xs text-zinc-400">
                  <span>Marco legal aplicable:</span>
                  <Link
                    href="/privacy"
                    className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    Privacidad y LOPDP
                  </Link>
                  <span className="text-zinc-600">&bull;</span>
                  <Link
                    href="/cookies"
                    className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    Política de Cookies
                  </Link>
                  <span className="text-zinc-600">&bull;</span>
                  <Link
                    href="/terms"
                    className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    Términos de Servicio
                  </Link>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-800">
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="h-9 px-3.5 rounded-xl border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Configurar</span>
              </button>

              <button
                type="button"
                onClick={() => saveConsent(true, false)}
                className="h-9 px-3.5 rounded-xl border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-all"
              >
                <span>Solo Esenciales</span>
              </button>

              <button
                type="button"
                onClick={() => saveConsent(true, true)}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-amber-500 to-orange-500 hover:from-sky-400 hover:to-orange-400 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                <span>Aceptar Todas</span>
              </button>
            </div>

          </div>
        </div>
      </aside>

      {/* Modal de Configuración */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-zinc-950 border border-zinc-800 p-6 sm:p-7 shadow-2xl space-y-5 text-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Cookie className="w-5 h-5 text-sky-400" />
                <h3 className="text-lg font-bold text-white">Preferencias de Cookies & Privacidad</h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Configura las tecnologías de almacenamiento permitidas en tu navegador. Las cookies técnicas son indispensables para mantener la sesión cifrada y los controles de acceso institucional.
            </p>

            <div className="space-y-3.5 pt-1">
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Cookies Técnicas Esenciales</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">Obligatorias</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Tokens JWT, persistencia de consentimiento, protección CSRF y aislamiento multi-tenant por licencia.
                  </p>
                </div>
                <div className="w-10 h-6 bg-sky-500/30 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-80">
                  <div className="w-4 h-4 rounded-full bg-sky-400 shadow-sm" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Telemetría Operativa Anónima</span>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">Opcional</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Medición anónima de latencia en la transcripción de notas de voz sin almacenar datos de carácter personal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefAnalytics(!prefAnalytics)}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${
                    prefAnalytics ? 'bg-sky-500 justify-end' : 'bg-zinc-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => saveConsent(true, prefAnalytics)}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition shadow-md shadow-sky-500/20"
              >
                Guardar Preferencias
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
