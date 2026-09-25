'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { ArrowLeft, Cookie, ShieldCheck, Check, Info, Lock, Trash2, Cpu, Database, Eye } from 'lucide-react';

export default function CookiesPage() {
  const { language } = useLanguage();
  const isEs = language === 'es';

  const handleResetConsent = () => {
    try {
      localStorage.removeItem('aigovcorex_privacy_consent');
      if (typeof document !== 'undefined') {
        const hostname = window.location.hostname;
        let domainAttr = '';
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !/^(\d+\.){3}\d+$/.test(hostname)) {
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            domainAttr = `; domain=.${parts.slice(-2).join('.')}`;
          }
        }
        document.cookie = `aigovcorex_privacy_consent=; path=/${domainAttr}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
        document.cookie = `aigovcorex_privacy_consent=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
      }
      window.dispatchEvent(new Event('aigovcorex_privacy_consent_changed'));
      alert(
        isEs
          ? 'Tus preferencias de cookies y consentimiento de privacidad han sido restablecidos. El banner de políticas se mostrará nuevamente.'
          : 'Your cookie preferences and privacy consent have been reset. The policy banner will appear again.'
      );
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen py-24 px-4 max-w-4xl mx-auto space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{isEs ? 'Volver al Inicio de AI GovCoreX' : 'Back to AI GovCoreX Home'}</span>
      </Link>

      {/* Header */}
      <div className="border-b border-white/10 pb-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
          <Cookie className="w-3.5 h-3.5" />
          <span>{isEs ? 'Transparencia Digital & Telemetría' : 'Digital Transparency & Telemetry'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {isEs
            ? 'Política de Cookies y Almacenamiento Local'
            : 'Cookie Policy & Local Storage'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
          {isEs
            ? 'Detalle exhaustivo sobre las tecnologías de cookies, tokens JWT, almacenamiento local y mecanismos de sesión empleados en la plataforma AI GovCoreX OS, conforme a la LOPDP (Ecuador), el Reglamento General de Protección de Datos (RGPD UE 2016/679) y estándares internacionales.'
            : 'Detailed disclosure of cookies, JWT tokens, local storage, and session mechanisms utilized across the AI GovCoreX OS platform in accordance with the LOPDP (Ecuador), GDPR (EU 2016/679), and international standards.'}
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-gray-500 dark:text-slate-500">
          <span>{isEs ? 'Versión: 2026.1 (Blindaje Regulatorio)' : 'Version: 2026.1 (Regulatory Shield)'}</span>
          <span>&bull;</span>
          <span>{isEs ? 'Compromiso: 0% Cookies Publicitarias de Terceros' : 'Commitment: 0% Third-Party Ad Cookies'}</span>
        </div>
      </div>

      {/* Principle Callout */}
      <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs sm:text-sm leading-relaxed flex items-start space-x-3.5">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-1">
            {isEs ? 'Enfoque Soberano Privacy-First & Sector Público:' : 'Privacy-First & Sovereign Public Sector Focus:'}
          </strong>
          {isEs ? (
            <>
              AI GovCoreX OS <strong>no implementa píxeles publicitarios, redes de rastreo comercial, ni cookies de retargeting de terceros</strong>. Todas las tecnologías de almacenamiento se circunscriben estrictamente a la seguridad operativa, autenticación criptográfica de funcionarios, aislamiento multi-tenant y resiliencia en la ingesta de notas de voz de campo.
            </>
          ) : (
            <>
              AI GovCoreX OS <strong>does not employ advertising pixels, commercial tracking networks, or third-party retargeting cookies</strong>. All storage technologies are strictly scoped to operational security, cryptographic worker authentication, multi-tenant database isolation, and resilient field voice ingestion.
            </>
          )}
        </div>
      </div>

      {/* Main Sections */}
      <div className="glass-panel p-8 rounded-3xl space-y-8 text-sm text-gray-700 dark:text-slate-300 leading-relaxed border border-white/40 dark:border-white/10 shadow-2xl">
        
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">1.</span>
            {isEs ? '¿Qué son las Cookies y el Almacenamiento Web?' : 'What are Cookies and Web Storage?'}
          </h2>
          <p>
            {isEs
              ? 'Las cookies son pequeños ficheros de datos que un servidor web deposita en el navegador del usuario para recordar estados de sesión o configuraciones de navegación. El almacenamiento web moderno (como localStorage y sessionStorage de HTML5) permite conservar información de forma segura en el dispositivo sin transmitirla automáticamente en cada cabecera de petición HTTP, optimizando el rendimiento, reduciendo el ancho de banda y protegiendo la confidencialidad en entornos con conectividad móvil limitada.'
              : 'Cookies are small data files deposited by a web server into the user browser to preserve session states or settings. Modern web storage (such as HTML5 localStorage and sessionStorage) securely maintains local state without transmitting payloads across every HTTP header, optimizing mobile throughput and protecting confidentiality in field environments.'}
          </p>
        </section>

        {/* Section 2: Table of Cookies */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">2.</span>
            {isEs ? 'Inventario de Tecnologías Utilizadas en AI GovCoreX' : 'Inventory of Technologies Used in AI GovCoreX'}
          </h2>
          <p>
            {isEs
              ? 'A continuación se desglosan las tecnologías activas clasificadas según su estricta finalidad técnica:'
              : 'The following matrix details all active technologies categorized by their strict technical purpose:'}
          </p>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 p-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="text-slate-300 border-b border-white/10 bg-white/5 font-semibold">
                  <th className="p-3">Identificador</th>
                  <th className="p-3">Tipo / Origen</th>
                  <th className="p-3">Caducidad</th>
                  <th className="p-3">Finalidad Técnica Específica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                <tr>
                  <td className="p-3 font-mono text-cyan-300 font-semibold">aigovcorex_privacy_consent</td>
                  <td className="p-3">Cookie / LocalStorage</td>
                  <td className="p-3">1 año</td>
                  <td className="p-3">Registra y valida el consentimiento informado otorgado por el usuario conforme a la LOPDP y RGPD.</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-cyan-300 font-semibold">access_token / jwt</td>
                  <td className="p-3">LocalStorage / Cookie segura</td>
                  <td className="p-3">Sesión / 15 min</td>
                  <td className="p-3">Token criptográfico de autenticación de usuario y verificación de rol (RBAC: super_admin, license_admin, supervisor, etc.).</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-cyan-300 font-semibold">refresh_token</td>
                  <td className="p-3">Cookie HttpOnly / LocalStorage</td>
                  <td className="p-3">30 días</td>
                  <td className="p-3">Renovación automática de credenciales sin requerir re-autenticación constante de funcionarios en campo.</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-cyan-300 font-semibold">user / user_role</td>
                  <td className="p-3">LocalStorage</td>
                  <td className="p-3">Persistente local</td>
                  <td className="p-3">Caché de perfil, centro/tenant asignado y permisos modulares habilitados (KindiCore, SocialCore, GeoMap OS).</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-cyan-300 font-semibold">aigovcorex_lang</td>
                  <td className="p-3">LocalStorage / Cookie</td>
                  <td className="p-3">1 año</td>
                  <td className="p-3">Almacena el idioma preferido de interfaz (Español, Inglés, Portugués, Francés, Alemán).</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-cyan-300 font-semibold">theme / next-theme</td>
                  <td className="p-3">LocalStorage</td>
                  <td className="p-3">Persistente local</td>
                  <td className="p-3">Conserva el modo visual de la interfaz (Dark Glassmorphism HUD o modo Claro).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Legal Basis */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">3.</span>
            {isEs ? 'Base Jurídica del Uso de Cookies Técnicas' : 'Legal Basis for Technical Cookies'}
          </h2>
          <p>
            {isEs ? (
              <>
                Conforme al <strong>artículo 7, numeral 1 y 2 de la Ley Orgánica de Protección de Datos Personales (LOPDP) de Ecuador</strong>, así como al <strong>artículo 6, numeral 1, letras b) y c) del RGPD</strong> y la Directiva europea 2002/58/CE (ePrivacy), la utilización de cookies y almacenamiento estrictamente necesarios no requiere el consentimiento previo cuando su única finalidad sea efectuar la transmisión de una comunicación a través de una red electrónica o proporcionar un servicio expresamente solicitado por el titular.
              </>
            ) : (
              <>
                Under <strong>Article 7 of Ecuador’s LOPDP</strong>, <strong>Article 6(1)(b)(c) of the EU GDPR</strong>, and Directive 2002/58/EC (ePrivacy), strictly necessary technical cookies do not require prior opt-in consent when their exclusive objective is enabling network transmission or fulfilling an authenticated service explicitly initiated by the user.
              </>
            )}
          </p>
        </section>

        {/* Section 4: Browser Management */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">4.</span>
            {isEs ? '¿Cómo Gestionar o Bloquear Cookies en tu Navegador?' : 'How to Manage or Block Cookies in Your Browser?'}
          </h2>
          <p>
            {isEs
              ? 'Puedes configurar tu navegador en cualquier momento para alertar sobre la recepción de cookies o bloquearlas íntegramente. Ten en cuenta que si desactivas las cookies técnicas necesarias, la funcionalidad de login, el guardado de fichas de beneficiarios y el acceso a los módulos operativos de AI GovCoreX OS quedarán inhabilitados:'
              : 'You may adjust your browser settings at any time to block cookies. Note that disabling essential technical cookies will prevent user sign-in, beneficiary profile saving, and operational module loading:'}
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-300">
            <li><strong>Google Chrome:</strong> Configuración &rarr; Privacidad y seguridad &rarr; Cookies y otros datos de sitios.</li>
            <li><strong>Mozilla Firefox:</strong> Opciones &rarr; Privacidad & Seguridad &rarr; Cookies y datos del sitio.</li>
            <li><strong>Apple Safari:</strong> Preferencias &rarr; Privacidad &rarr; Bloquear todas las cookies.</li>
            <li><strong>Microsoft Edge:</strong> Configuración &rarr; Permisos del sitio &rarr; Cookies y datos del sitio.</li>
          </ul>
        </section>

        {/* Section 5: Reset Preferences Button */}
        <section className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-white text-base">
                {isEs ? 'Restablecer Preferencias de Consentimiento' : 'Reset Consent Preferences'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEs
                  ? 'Borra el registro local de tu aceptación para reabrir el banner de configuración de cookies.'
                  : 'Clear your locally stored consent record to reactivate the cookie configuration banner.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetConsent}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition"
          >
            {isEs ? 'Restablecer mi Consentimiento de Cookies' : 'Reset My Cookie Consent'}
          </button>
        </section>

      </div>
    </div>
  );
}
