/**
 * AI GovCoreX OS — Module System Configuration
 * Defines all modules, their sub-navigation items, roles and metadata.
 */
import {
  Baby, Map, MessageSquare, Brain, LayoutGrid,
  ClipboardList, UserCheck, Network, Radio,
  BookOpen, Layers, Mic, FileText,
  Scan, AlertTriangle, Users, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ModuleId = 'kindicore' | 'social' | 'geo' | 'channels' | 'copilot';

export interface SubNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

export interface NavSection {
  title: string;
  items: SubNavItem[];
}

export interface OSModule {
  id: ModuleId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  glowClass: string;
  badgeLabel?: string;
  badgeColor?: string;
  sections: NavSection[];
  requiredRoles: string[];
  href: string;
}

export const OS_MODULES: OSModule[] = [
  {
    id: 'kindicore',
    label: 'KindiCore AI',
    shortLabel: 'Kindi',
    icon: Baby,
    color: '#f97316',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-400',
    glowClass: 'glow-kindicore',
    badgeLabel: 'ACTIVO',
    badgeColor: 'bg-amber-500/20 text-amber-300',
    href: '/dashboard',
    requiredRoles: ['super_admin','license_admin','supervisor','coordinator','center_coordinator','educator','educadora','doctor','nutritionist','psychologist','social_worker','administrative'],
    sections: [
      {
        title: 'Operaciones CDI',
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
          { label: 'Registro de Niños', href: '/registro', icon: Baby },
          { label: 'Admisión', href: '/admision', icon: ClipboardList },
          { label: 'Asistencia', href: '/asistencia', icon: UserCheck },
        ],
      },
      {
        title: 'Desarrollo Integral',
        items: [
          { label: 'Seguimiento IDII', href: '/seguimiento-idii', icon: Layers },
          { label: 'Salud y Nutrición', href: '/salud-nutricion', icon: Shield },
          { label: 'Planificaciones', href: '/planificaciones', icon: FileText },
          { label: 'Intervención Familiar', href: '/intervencion-familiar', icon: Users },
        ],
      },
      {
        title: 'Gestión y Análisis',
        items: [
          { label: 'Monitoreo', href: '/monitoreo', icon: Scan },
          { label: 'Reportes', href: '/reportes', icon: FileText },
          { label: 'Operaciones', href: '/operaciones', icon: LayoutGrid },
          { label: 'Carga Masiva', href: '/ingestion', icon: Layers },
          { label: 'Notificaciones', href: '/notificaciones', icon: AlertTriangle },
          { label: 'Base de Conocimiento', href: '/knowledge', icon: BookOpen },
        ],
      },
    ],
  },
  {
    id: 'social',
    label: 'Programas Sociales',
    shortLabel: 'Social',
    icon: ClipboardList,
    color: '#0ea5e9',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/30',
    textClass: 'text-sky-400',
    glowClass: 'glow-social',
    badgeLabel: 'NUEVO',
    badgeColor: 'bg-sky-500/20 text-sky-300',
    href: '/social/dashboard',
    requiredRoles: ['super_admin','license_admin','supervisor','coordinator','social_worker'],
    sections: [
      {
        title: 'Gestión de Programas',
        items: [
          { label: 'Mis Programas', href: '/social/dashboard', icon: LayoutGrid },
          { label: 'Crear Programa', href: '/social/programas/nuevo', icon: ClipboardList },
          { label: 'Postulaciones', href: '/social/postulaciones', icon: UserCheck },
          { label: 'Beneficiarios', href: '/social/beneficiarios', icon: Users },
        ],
      },
      {
        title: 'Red Interinstitucional',
        items: [
          { label: 'Vinculación de Entes', href: '/social/red', icon: Network },
          { label: 'Equipos & Roles', href: '/social/equipos', icon: Shield },
          { label: 'Proyectos Activos', href: '/social/proyectos', icon: Layers },
        ],
      },
      {
        title: 'Seguimiento & Reportes',
        items: [
          { label: 'Reportes Sociales', href: '/social/reportes', icon: FileText },
          { label: 'Formularios Dinámicos', href: '/social/formularios', icon: FileText },
        ],
      },
    ],
  },
  {
    id: 'geo',
    label: 'Geo Análisis',
    shortLabel: 'GeoInt',
    icon: Map,
    color: '#10b981',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-400',
    glowClass: 'glow-geo',
    badgeLabel: 'GEO',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    href: '/geo/mapa',
    requiredRoles: ['super_admin','license_admin','supervisor','coordinator'],

    sections: [
      {
        title: 'Inteligencia Geoespacial',
        items: [
          { label: 'Mapa Interactivo', href: '/geo/mapa', icon: Map },
          { label: 'Calor & Incidencias', href: '/geo/heatmap', icon: AlertTriangle },
          { label: 'Cercos Digitales', href: '/geo/cercas', icon: Scan },
          { label: 'Barridos Territoriales', href: '/geo/barridos', icon: Radio },
        ],
      },
      {
        title: 'Redes & Grafos',
        items: [
          { label: 'Grafo Institucional', href: '/geo/grafos', icon: Network },
          { label: 'Trazabilidad de Red', href: '/geo/trazabilidad', icon: Layers },
          { label: 'Equipos en Campo', href: '/geo/equipos-campo', icon: Users },
        ],
      },
    ],
  },
  {
    id: 'channels',
    label: 'Canales',
    shortLabel: 'Canales',
    icon: MessageSquare,
    color: '#8b5cf6',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/30',
    textClass: 'text-violet-400',
    glowClass: 'glow-channels',
    badgeLabel: 'COMM',
    badgeColor: 'bg-violet-500/20 text-violet-300',
    href: '/canales/dashboard',
    requiredRoles: ['super_admin','license_admin','supervisor','coordinator'],
    sections: [
      {
        title: 'Mensajería',
        items: [
          { label: 'Dashboard Canales', href: '/canales/dashboard', icon: LayoutGrid },
          { label: 'WhatsApp', href: '/canales/whatsapp', icon: MessageSquare },
          { label: 'Telegram', href: '/canales/telegram', icon: MessageSquare },
          { label: 'Conversaciones', href: '/canales/conversaciones', icon: Radio },
        ],
      },
      {
        title: 'Configuración',
        items: [
          { label: 'Conexiones', href: '/canales/conexiones', icon: Network },
          { label: 'Herencias de Canal', href: '/canales/herencias', icon: Layers },
          { label: 'Plantillas', href: '/canales/plantillas', icon: FileText },
        ],
      },
    ],
  },
  {
    id: 'copilot',
    label: 'Copiloto RAG',
    shortLabel: 'Copilot',
    icon: Brain,
    color: '#ec4899',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/30',
    textClass: 'text-pink-400',
    glowClass: 'glow-copilot',
    badgeLabel: 'IA',
    badgeColor: 'bg-pink-500/20 text-pink-300',
    href: '/copiloto',
    requiredRoles: ['super_admin','license_admin','supervisor','coordinator','social_worker'],
    sections: [
      {
        title: 'Asistente IA',
        items: [
          { label: 'Chat Copiloto', href: '/copiloto', icon: Brain },
          { label: 'Voz Interactiva', href: '/copiloto/voz', icon: Mic },
        ],
      },
      {
        title: 'Base de Conocimiento',
        items: [
          { label: 'Documentos RAG', href: '/copiloto/documentos', icon: BookOpen },
          { label: 'Web Scraping', href: '/copiloto/web', icon: Layers },
          { label: 'Configuración IA', href: '/copiloto/config', icon: Shield },
        ],
      },
    ],
  },
];

export function getModuleById(id: ModuleId): OSModule | undefined {
  return OS_MODULES.find(m => m.id === id);
}

export function getModuleByRoute(pathname: string): OSModule | undefined {
  return (
    OS_MODULES.find(
      m =>
        pathname === m.href ||
        m.sections.some(s =>
          s.items.some(
            item => pathname === item.href || pathname.startsWith(item.href + '/'),
          ),
        ),
    ) ?? OS_MODULES[0]
  );
}
