'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Check, Cookie } from 'lucide-react';

const CONSENT_STORAGE_KEY = 'aigovcorex_privacy_consent';
const CONSENT_COOKIE_NAME = 'aigovcorex_privacy_consent';

function getCookieDomain(): string {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^(\d+\.){3}\d+$/.test(hostname)) {
    return '';
  }
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`;
  }
  return '';
}

function hasUserConsented(): boolean {
  if (typeof window === 'undefined') return true;

  // 1. Verificar localStorage
  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed && (parsed.accepted === true || parsed === true)) {
        return true;
      }
    }
  } catch {}

  // 2. Verificar cookie compartida entre subdominios
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const cookies = document.cookie.split(';');
      for (const item of cookies) {
        const [k, v] = item.trim().split('=');
        if (k === CONSENT_COOKIE_NAME && (v === 'true' || v === '1')) {
          try {
            localStorage.setItem(
              CONSENT_STORAGE_KEY,
              JSON.stringify({ accepted: true, timestamp: Date.now(), version: '2026.1' })
            );
          } catch {}
          return true;
        }
      }
    }
  } catch {}

  return false;
}

export function PrivacyBannerDashboard() {
  const [isVisible, setIsVisible] = useState(false);

  const evaluateConsent = () => {
    setIsVisible(!hasUserConsented());
  };

  useEffect(() => {
    evaluateConsent();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_STORAGE_KEY || e.key === null) {
        evaluateConsent();
      }
    };

    const handleCustomEvent = () => {
      evaluateConsent();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('aigovcorex_privacy_consent_changed', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('aigovcorex_privacy_consent_changed', handleCustomEvent);
    };
  }, []);

  const handleAccept = () => {
    const consentPayload = {
      accepted: true,
      essential: true,
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
        const cookieDomain = getCookieDomain();
        const domainAttr = cookieDomain ? `; domain=${cookieDomain}` : '';
        document.cookie = `${CONSENT_COOKIE_NAME}=true; path=/${domainAttr}; max-age=31536000; SameSite=Lax${secureFlag}`;
      }
    } catch {}

    try {
      window.dispatchEvent(new Event('aigovcorex_privacy_consent_changed'));
    } catch {}

    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de Privacidad y Cookies de AI GovCoreX"
      className="fixed inset-x-0 bottom-0 z-[99999] pointer-events-none p-3 sm:p-5 flex justify-center animate-in fade-in slide-in-from-bottom-6 duration-300"
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl bg-slate-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-xl text-slate-200 p-4 sm:p-5 ring-1 ring-white/10 transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Contenido e Ícono */}
          <div className="flex items-start space-x-3.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0 text-cyan-400 mt-0.5 sm:mt-0 shadow-inner">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 uppercase tracking-wider bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40">
                  <Lock className="w-3 h-3" /> Privacidad & LOPDP / RGPD
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Cookie className="w-3 h-3 text-amber-400" /> Cookies Técnicas
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                En AI GovCoreX OS protegemos tus consultas y datos institucionales. Utilizamos cookies técnicas esenciales para garantizar la seguridad de tu sesión y la funcionalidad del sistema. Tus datos no se comercializan con terceros ni se emplean para publicidad.
              </p>

              {/* Enlaces Legales Rápidos */}
              <div className="pt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                <span>Consulta nuestras políticas:</span>
                <Link
                  href="/privacy"
                  className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 hover:underline-offset-4 transition-colors"
                >
                  Privacidad
                </Link>
                <span className="text-slate-600">&bull;</span>
                <Link
                  href="/terms"
                  className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 hover:underline-offset-4 transition-colors"
                >
                  Términos
                </Link>
                <span className="text-slate-600">&bull;</span>
                <Link
                  href="/cookies"
                  className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 hover:underline-offset-4 transition-colors"
                >
                  Cookies
                </Link>
              </div>
            </div>
          </div>

          {/* Botones de Acción: Cerrar y Aceptar y Continuar */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="h-9 px-3.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition"
              title="Cerrar"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleAccept}
              className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white text-xs font-medium transition shadow-md shadow-cyan-900/50 flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Aceptar y Continuar</span>
            </button>
          </div>

        </div>
      </div>
    </aside>
  );
}
