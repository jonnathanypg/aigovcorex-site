'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  Lock,
  Database,
  FileCheck,
  Scale,
  Globe,
  Mic,
  Eye,
  Building2,
  Users,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

export default function PrivacyPage() {
  const { language } = useLanguage();
  const isEs = language === 'es';

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
          <Shield className="w-3.5 h-3.5" />
          <span>{isEs ? 'Soberanía de Datos & Blindaje Regulatorio' : 'Data Sovereignty & Regulatory Compliance'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {isEs
            ? 'Política Integral de Privacidad y Tratamiento de Datos Personales'
            : 'Comprehensive Privacy Policy & Personal Data Governance'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
          {isEs
            ? 'Conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), el Reglamento General de Protección de Datos (RGPD UE 2016/679), directrices de la Organización Mundial de la Salud (OMS) y normativas para la gestión de programas sociales estatales.'
            : 'In compliance with Ecuador’s Organic Personal Data Protection Law (LOPDP), the EU General Data Protection Regulation (GDPR 2016/679), WHO health guidelines, and state welfare program compliance frameworks.'}
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-gray-500 dark:text-slate-500">
          <span>{isEs ? 'Versión: 2.6.0 (Edición 2026 - AI GovCoreX OS)' : 'Version: 2.6.0 (2026 Edition - AI GovCoreX OS)'}</span>
          <span>&bull;</span>
          <span>{isEs ? 'Última actualización: 8 de Septiembre de 2026' : 'Last updated: September 8, 2026'}</span>
          <span>&bull;</span>
          <span>{isEs ? 'Operador Matriz: WeblifeTech LLC / AI GovCoreX OS' : 'Parent Operator: WeblifeTech LLC / AI GovCoreX OS'}</span>
        </div>
      </div>

      {/* Commitment Callout */}
      <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs sm:text-sm leading-relaxed flex items-start space-x-3.5 shadow-lg">
        <Lock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-1">
            {isEs ? 'Compromiso Institucional de No Comercialización y Soberanía Pública:' : 'Public Sovereignty & Non-Commercialization Guarantee:'}
          </strong>
          {isEs ? (
            <>
              AI GovCoreX OS <strong>nunca comercializa, cede, sublicencia ni monetiza</strong> los datos personales de beneficiarios, niños de centros infantiles, registros antropométricos, notas de voz ni expedientes de programas sociales. Toda la información es procesada con fines estrictamente normativos, de fiscalización pública transparente y acreditación ante entidades gubernamentales o cooperantes internacionales.
            </>
          ) : (
            <>
              AI GovCoreX OS <strong>never monetizes, sells, sublicenses, or commercializes</strong> the personal records of children, welfare beneficiaries, anthropometric evaluations, or voice recordings. All data processing is strictly conducted for program compliance, statutory state audits, and verified multi-lateral oversight.
            </>
          )}
        </div>
      </div>

      {/* Main Legal Sections */}
      <div className="glass-panel p-8 rounded-3xl space-y-9 text-sm text-gray-700 dark:text-slate-300 leading-relaxed border border-white/40 dark:border-white/10 shadow-2xl">
        
        {/* 1. Responsable del Tratamiento */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">1.</span>
            {isEs ? 'Identidad y Contacto del Responsable del Tratamiento' : 'Identity and Contact of Data Controller'}
          </h2>
          <p>
            {isEs
              ? 'El responsable del tratamiento de los datos personales recopilados a través del Portal Matriz y el Sistema Operativo AI GovCoreX es WeblifeTech en articulación técnica y operativa con las entidades licenciadas (organismos multilaterales, ministerios, gobiernos autónomos descentralizados y ONGs ejecutoras):'
              : 'The data controller for information processed through the Matrix Portal and AI GovCoreX OS is WeblifeTech in technical coordination with authorized licensed entities (multilateral bodies, ministries, municipalities, and operating NGOs):'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
            <li><strong>{isEs ? 'Razón Social / Plataforma:' : 'Entity Name:'}</strong> WeblifeTech / AI GovCoreX OS</li>
            <li><strong>{isEs ? 'Oficial de Cumplimiento Normativo y DPO:' : 'Data Protection Officer (DPO):'}</strong> Privacy & Governance Compliance Division</li>
            <li><strong>{isEs ? 'Correo Oficial de Contacto:' : 'Official Privacy Contact:'}</strong> <a href="mailto:privacy@aigovcorex.com" className="text-cyan-400 underline font-medium">privacy@aigovcorex.com</a> / <a href="mailto:contact@aigovcorex.com" className="text-cyan-400 underline font-medium">contact@aigovcorex.com</a></li>
            <li><strong>{isEs ? 'Jurisdicción Primaria:' : 'Primary Jurisdiction:'}</strong> República del Ecuador (con plena aplicación de la LOPDP y alcance extraterritorial conforme a estándares internacionales RGPD).</li>
          </ul>
        </section>

        {/* 2. Categorías de Datos Tratados y Datos Sensibles */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">2.</span>
            {isEs ? 'Categorías de Datos Tratados y Tratamiento Especial de Datos Sensibles' : 'Categories of Data Processed & Special Treatment of Sensitive Data'}
          </h2>
          <p>
            {isEs
              ? 'AI GovCoreX OS procesa distintas categorías de información necesarias para el cumplimiento de programas sociales y desarrollo infantil:'
              : 'AI GovCoreX OS processes distinct information tiers required for social welfare programs and early-childhood governance:'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
              <span className="font-semibold text-white text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {isEs ? 'Datos de Funcionarios y Operadores' : 'Worker & Operator Data'}
              </span>
              <p className="text-xs text-slate-300">
                {isEs
                  ? 'Nombres, cargo institucional, credenciales de acceso institucional, correo electrónico profesional y logs de auditoría de actividad.'
                  : 'Official names, titles, enterprise credentials, institutional emails, and immutable audit activity logs.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
              <span className="font-semibold text-white text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> {isEs ? 'Datos de Menores y Beneficiarios (Sensibles)' : 'Children & Beneficiary Data (Sensitive)'}
              </span>
              <p className="text-xs text-slate-300">
                {isEs
                  ? 'Identificación (cédula), fecha de nacimiento, edad en meses, registros antropométricos (peso, talla, z-score OMS), tamizaje de anemia y fichas de vulnerabilidad socioeconómica familiar.'
                  : 'National ID, date of birth, age in months, anthropometric metrics (weight, height, WHO Z-score), anemia screening, and socioeconomic vulnerability intake.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
              <span className="font-semibold text-white text-xs uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" /> {isEs ? 'Notas de Voz de Campo y Transcripción' : 'Field Voice Audio & Transcripts'}
              </span>
              <p className="text-xs text-slate-300">
                {isEs
                  ? 'Archivos de audio de reportes diarios emitidos por educadoras o brigadistas vía WhatsApp o interfaz directa, convertidos a texto mediante modelos locales Faster-Whisper sin persistencia innecesaria de ficheros brutos.'
                  : 'Daily voice audio reports submitted by educators via WhatsApp or browser HUD, transcribed with Faster-Whisper models with prompt deletion of raw audio post-extraction.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
              <span className="font-semibold text-white text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> {isEs ? 'Geolocalización & Cercos Digitales' : 'Geolocation & Geofencing'}
              </span>
              <p className="text-xs text-slate-300">
                {isEs
                  ? 'Coordenadas GPS de centros infantiles, polígonos de cobertura cantonal y puntos de alerta nutricional para la fiscalización territorial del &ldquo;Ojo de Dios&rdquo;.'
                  : 'GPS coordinates of community centers, municipal boundary polygons, and geographic health alerts for territorial visual auditing.'}
              </p>
            </div>
          </div>
        </section>

        {/* 3. Protección de Menores y Base Legal LOPDP Art. 21 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">3.</span>
            {isEs ? 'Protección Reforzada de Datos de Niñas, Niños y Adolescentes' : 'Enhanced Protection of Children’s Personal Data'}
          </h2>
          <p>
            {isEs ? (
              <>
                Conforme al <strong>artículo 21 de la LOPDP de Ecuador</strong> y el <strong>artículo 8 del RGPD</strong>, el tratamiento de datos de niñas, niños y adolescentes está supeditado al principio de <em>Interés Superior del Menor</em>. En AI GovCoreX OS, los datos de infantes ingresados en centros infantiles o programas de nutrición se tratan exclusivamente para garantizar su derecho a la salud, nutrición integral y desarrollo infantil, contando con el consentimiento legal de sus representantes o el mandato de políticas públicas estatutarias.
              </>
            ) : (
              <>
                Under <strong>Article 21 of Ecuador’s LOPDP</strong> and <strong>Article 8 of the GDPR</strong>, the processing of minors’ data is strictly governed by the <em>Best Interests of the Child</em> doctrine. Records are gathered exclusively to uphold healthcare, growth monitoring, and welfare entitlements authorized by statutory mandates and legal guardians.
              </>
            )}
          </p>
        </section>

        {/* 4. Tratamiento por Inteligencia Artificial y No Elaboración de Decisiones Automatizadas sin Supervisión Humana */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">4.</span>
            {isEs ? 'Gobernanza de Inteligencia Artificial (Human-in-the-Loop)' : 'AI Governance & Human-in-the-Loop Oversight'}
          </h2>
          <p>
            {isEs ? (
              <>
                En cumplimiento del <strong>artículo 23 de la LOPDP</strong> (Derecho a no ser objeto de una decisión basada exclusivamente en valoraciones automatizadas), AI GovCoreX OS opera bajo el principio de <strong>Human-in-the-Loop</strong>:
              </>
            ) : (
              <>
                In compliance with <strong>Article 23 of the LOPDP</strong> (Right not to be subject to solely automated decision-making), AI GovCoreX OS incorporates strict <strong>Human-in-the-Loop</strong> governance:
              </>
            )}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
            <li>{isEs ? 'Los modelos de IA (RAG con Pinecone, LangGraph y Whisper) actúan como asistentes de extracción y cotejo contra normativas públicas.' : 'AI models (Pinecone RAG, LangGraph, Faster-Whisper) function as extraction and compliance assistants.'}</li>
            <li>{isEs ? 'Ningún beneficiario es admitido, rechazado o suspendido de un programa social por decisión exclusiva de un algoritmo.' : 'No citizen is admitted, denied, or removed from a public program through automated decisions alone.'}</li>
            <li>{isEs ? 'Toda alerta nutricional o diagnóstico de curva antropométrica es revisada y validada por el médico o nutricionista del centro.' : 'All clinical alerts or nutritional growth flags require sign-off by credentialed doctors or specialists.'}</li>
            <li>{isEs ? 'Los datos no se emplean para entrenar modelos públicos de terceros ni se envían a repositorios de aprendizaje abierto.' : 'User data is never utilized to fine-tune public multi-tenant foundation models.'}</li>
          </ul>
        </section>

        {/* 5. Aislamiento Multi-Tenant y Medidas de Seguridad */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">5.</span>
            {isEs ? 'Aislamiento Criptográfico y Seguridad de la Infraestructura' : 'Cryptographic Isolation & Infrastructure Security'}
          </h2>
          <p>
            {isEs
              ? 'Se implementan rigurosas salvaguardas técnicas y organizativas para asegurar la confidencialidad, integridad y disponibilidad:'
              : 'Comprehensive technical and organizational security controls guarantee confidentiality, integrity, and availability:'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl">
              <strong className="text-cyan-300 block mb-1">Cifrado de Extremo a Extremo</strong>
              <span>Tránsito bajo TLS 1.3 / HTTPS y cifrado en reposo para bases de datos relacionales y vectores RAG.</span>
            </div>
            <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl">
              <strong className="text-cyan-300 block mb-1">Aislamiento Multi-Tenant</strong>
              <span>Separación lógica y estricta por <code>license_id</code> y <code>tenant_id</code> que impide la fuga de datos entre organizaciones.</span>
            </div>
            <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl">
              <strong className="text-cyan-300 block mb-1">Trazabilidad Inmutable</strong>
              <span>Registro de auditoría forense con sellado temporal para cada edición de ficha, pesaje o autorización de fondos.</span>
            </div>
          </div>
        </section>

        {/* 6. Derechos del Titular (Derechos ARCO / LOPDP) */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">6.</span>
            {isEs ? 'Ejercicio de Derechos del Titular (Acceso, Rectificación, Cancelación y Oposición)' : 'Data Subject Rights (Access, Rectification, Erasure, Objection)'}
          </h2>
          <p>
            {isEs ? (
              <>
                Conforme a los <strong>artículos 12 al 20 de la LOPDP</strong> y artículos 15 al 22 del RGPD, el titular o su representante legal puede ejercer en todo momento sus derechos de:
              </>
            ) : (
              <>
                Pursuant to <strong>Articles 12-20 of the LOPDP</strong> and Articles 15-22 of the GDPR, data subjects or authorized representatives may exercise:
              </>
            )}
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-300">
            <li><strong>{isEs ? 'Acceso e Información:' : 'Right of Access:'}</strong> {isEs ? 'Conocer qué datos personales reposan en el sistema y para qué fines.' : 'Obtain confirmation and copy of personal records processed.'}</li>
            <li><strong>{isEs ? 'Rectificación y Actualización:' : 'Right to Rectification:'}</strong> {isEs ? 'Subsanar datos erróneos, inexactos o desactualizados.' : 'Correct inaccurate or incomplete profile records.'}</li>
            <li><strong>{isEs ? 'Eliminación (Supresión):' : 'Right to Erasure:'}</strong> {isEs ? 'Solicitar el borrado cuando no exista obligación legal o regulatoria de conservación pública.' : 'Request deletion when statutory retention obligations expire.'}</li>
            <li><strong>{isEs ? 'Oposición y Limitación:' : 'Right to Object:'}</strong> {isEs ? 'Oponerse a tratamientos no esenciales o revocar consentimientos otorgados.' : 'Oppose non-statutory processing or withdraw consent.'}</li>
          </ul>
          <p className="text-xs pt-1 text-slate-400">
            {isEs
              ? 'Para ejercer estos derechos, remite una solicitud formal con copia de tu documento de identidad a privacy@aigovcorex.com. El plazo de respuesta no superará los 15 días laborables previstos por la normativa.'
              : 'To exercise these rights, submit a written inquiry accompanied by identification proof to privacy@aigovcorex.com. Response times adhere to the statutory 15-business-day window.'}
          </p>
        </section>

      </div>
    </div>
  );
}
