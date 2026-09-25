'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import {
  ArrowLeft,
  Scale,
  Shield,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Cpu,
  Building2,
  Layers,
  Lock,
  FileSpreadsheet,
  Globe
} from 'lucide-react';

export default function TermsPage() {
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
          <Scale className="w-3.5 h-3.5" />
          <span>{isEs ? 'Marco Jurídico Institucional & Gobernanza' : 'Institutional Legal Framework & Governance'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {isEs
            ? 'Términos y Condiciones Generales de Uso del Sistema Operativo'
            : 'General Terms & Conditions of Service'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
          {isEs
            ? 'Regulación aplicable al acceso, licenciamiento, operación multi-actor, procesamiento agéntico de notas de voz y fiscalización de programas sociales a través de AI GovCoreX OS.'
            : 'Terms governing platform access, multi-tier licensing, autonomous voice processing, and social program compliance across AI GovCoreX OS.'}
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-gray-500 dark:text-slate-500">
          <span>{isEs ? 'Edición: 2026.1 (Blindaje para Sector Público y Cooperación Internacional)' : 'Edition: 2026.1 (Public Sector & Multilateral Standard)'}</span>
          <span>&bull;</span>
          <span>{isEs ? 'Efectividad: Inmediata' : 'Effective: Immediate'}</span>
          <span>&bull;</span>
          <span>{isEs ? 'Operador Matriz: WeblifeTech LLC' : 'Operator: WeblifeTech LLC'}</span>
        </div>
      </div>

      {/* Institutional Disclaimer */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm leading-relaxed space-y-2.5 shadow-lg">
        <div className="flex items-center space-x-2 font-bold text-amber-400 text-sm sm:text-base">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{isEs ? 'AVISO INSTITUCIONAL DE CUMPLIMIENTO Y ALCANCE DE LA INTELIGENCIA ARTIFICIAL:' : 'REGULATORY NOTICE ON AI COMPLIANCE SCOPE:'}</span>
        </div>
        <p>
          {isEs ? (
            <>
              AI GovCoreX OS es una <strong>infraestructura tecnológica de software como servicio (SaaS / On-Premise Goverment OS)</strong> diseñada para facilitar el cumplimiento regulatorio, la auditoría continua y la reducción del 95% de la carga burocrática en programas sociales.
            </>
          ) : (
            <>
              AI GovCoreX OS is an <strong>agentic compliance infrastructure software</strong> developed to enable continuous auditability and reduce 95% of field bureaucratic overhead across welfare programs.
            </>
          )}
        </p>
        <p className="font-medium text-amber-100">
          {isEs ? (
            <>
              Los reportes automáticos, curvas antropométricas de la OMS y alertas generadas por los modelos neuronales constituyen <strong>herramientas de asistencia técnica y soporte operativo</strong>. La responsabilidad final sobre la firma de actas de entrega-recepción, asignación presupuestaria y diagnósticos médicos recae en las autoridades competentes y profesionales colegiados de cada entidad operadora.
            </>
          ) : (
            <>
              Automated reports, WHO anthropometric curves, and generated alerts constitute <strong>operational support and supervisory tools</strong>. Statutory budget approvals and diagnostic verifications remain under the purview of certified authorities.
            </>
          )}
        </p>
      </div>

      {/* Main Sections */}
      <div className="glass-panel p-8 rounded-3xl space-y-9 text-sm text-gray-700 dark:text-slate-300 leading-relaxed border border-white/40 dark:border-white/10 shadow-2xl">
        
        {/* 1. Objeto y Alcance */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">1.</span>
            {isEs ? 'Objeto y Ámbito de Aplicación' : 'Scope and Purpose'}
          </h2>
          <p>
            {isEs
              ? 'Los presentes Términos y Condiciones regulan la relación entre WeblifeTech y las entidades usuarias (organismos multilaterales, ministerios, municipios, organizaciones de la sociedad civil y operadores de campo) que acceden o utilizan el Portal Matriz (aigovcorex.com), el Dashboard Operativo (app.aigovcorex.com) y las interfaces de voz de WhatsApp y Telegram.'
              : 'These Terms govern the relationship between WeblifeTech and authorized entities (multilaterals, ministries, local municipalities, NGOs, and field staff) accessing the Matrix Portal, the Operational Dashboard, and official messaging gateways.'}
          </p>
        </section>

        {/* 2. Jerarquía de Roles y Modelo Multi-Actor */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">2.</span>
            {isEs ? 'Jerarquía de Roles y Responsabilidad Institucional' : 'Multi-Tier Role Hierarchy & Entity Responsibility'}
          </h2>
          <p>
            {isEs
              ? 'AI GovCoreX OS implementa un modelo de gobernanza multinivel. Cada usuario opera bajo un perfil estrictamente delimitado por su licencia:'
              : 'AI GovCoreX OS enforces role-based governance. Each account operates under licensed boundaries:'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
            <li><strong>Nivel 1 (Organismos Multilaterales / Funder):</strong> Acceso a métricas macro ODS, fiscalización presupuestaria y trazabilidad en modo auditor.</li>
            <li><strong>Nivel 2 (Gobierno Central / Ministerios):</strong> Administración de licencias nacionales, normativas y supervisión de convenios de cooperación.</li>
            <li><strong>Nivel 3 (GAD / Municipios):</strong> Supervisión territorial cantonal, cercos geográficos en &ldquo;Ojo de Dios&rdquo; y coordinación local.</li>
            <li><strong>Nivel 4 (ONGs / Entidades Ejecutoras):</strong> Coordinación operativa de centros infantiles, administración de nóminas y admisión de beneficiarios.</li>
            <li><strong>Nivel 5 (Personal Técnico y de Campo):</strong> Médicos, nutricionistas, trabajadoras sociales y educadoras encargadas del registro diario de asistencia, tamizaje y reportes por voz.</li>
          </ul>
        </section>

        {/* 3. Propiedad Intelectual y Arquitectura Modular */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">3.</span>
            {isEs ? 'Propiedad Intelectual y Licenciamiento del Software' : 'Intellectual Property & Licensing Terms'}
          </h2>
          <p>
            {isEs
              ? 'AI GovCoreX OS, sus algoritmos de orquestación (LangGraph, SimpleOrchestrator), interfaces HUD, bases vectoriales y módulos especializados (KindiCore AI, SocialCore AI, GeoMap OS) son propiedad intelectual exclusiva de WeblifeTech LLC. La contratación o uso de la plataforma otorga una licencia de uso no exclusiva, intransferible y temporal durante la vigencia del convenio o suscripción institucional.'
              : 'AI GovCoreX OS, its multi-agent pipelines, HUD interfaces, and vertical modules (KindiCore AI, SocialCore AI, GeoMap OS) are proprietary intellectual property of WeblifeTech LLC. Licensing grants non-exclusive, non-transferable rights for institutional execution.'}
          </p>
        </section>

        {/* 4. Canales de Ingesta por Voz y WhatsApp */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">4.</span>
            {isEs ? 'Uso de Canales de Ingesta por Voz (WhatsApp / Telegram)' : 'Voice Ingestion Gateways (WhatsApp / Telegram)'}
          </h2>
          <p>
            {isEs
              ? 'El microservicio de ingesta de voz permite a brigadistas remitir notas de audio para actualización de bitácoras:'
              : 'The voice gateway allows field workers to dictate daily updates through audio notes:'}
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-300">
            <li>{isEs ? 'Los números de WhatsApp deben estar previamente enrolados por el Coordinador de la licencia para autorizar la recepción de mensajes.' : 'Phone numbers must be pre-authorized by License Coordinators before accepting audio ingestion.'}</li>
            <li>{isEs ? 'Los audios se transcriben en memoria o almacenamiento temporal cifrado y se eliminan una vez extraída la información estructurada.' : 'Audio notes are transcribed in secure memory and purged after structured compliance extraction.'}</li>
            <li>{isEs ? 'Está prohibido el envío de contenido malicioso, archivos ejecutables o lenguaje que vulnere derechos fundamentales.' : 'Transmitting malware or unauthorized content is strictly prohibited and logged for audit.'}</li>
          </ul>
        </section>

        {/* 5. Disponibilidad del Servicio y SLA */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">5.</span>
            {isEs ? 'Acuerdo de Nivel de Servicio (SLA) y Continuidad Operativa' : 'Service Level Agreement (SLA) & Resilience'}
          </h2>
          <p>
            {isEs
              ? 'AI GovCoreX OS mantiene un compromiso de disponibilidad del 99.5% para sus APIs críticas y dashboards. Las ventanas de mantenimiento programado se notifican con al menos 48 horas de antelación a los administradores de licencia, ejecutándose prioritariamente en horarios no laborables para no interferir con las operaciones de campo.'
              : 'AI GovCoreX OS targets 99.5% uptime for core compliance APIs and dashboards. Scheduled maintenance windows are communicated 48 hours in advance to License Administrators.'}
          </p>
        </section>

        {/* 6. Ley Aplicable y Jurisdicción */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-cyan-400 font-mono">6.</span>
            {isEs ? 'Legislación Aplicable y Resolución de Controversias' : 'Governing Law & Dispute Resolution'}
          </h2>
          <p>
            {isEs
              ? 'Estos términos se interpretan y rigen conforme a las leyes de la República del Ecuador, con sujeción a los principios de contratación pública y protección de datos. En caso de discrepancias que no puedan resolverse de mutuo acuerdo en un plazo de 30 días, las partes se someterán a los mecanismos de mediación y arbitraje del Centro de Arbitraje y Mediación de la Cámara de Comercio de Guayaquil.'
              : 'These terms are governed by the laws of the Republic of Ecuador. Unresolved disputes shall be referred to arbitration proceedings in Guayaquil, Ecuador.'}
          </p>
        </section>

      </div>
    </div>
  );
}
