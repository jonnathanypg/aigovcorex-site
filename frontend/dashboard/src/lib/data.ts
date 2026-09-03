import {
  LayoutDashboard,
  UserPlus,
  ClipboardCheck,
  CalendarCheck,
  Baby,
  HeartPulse,
  Users,
  Settings,
  AreaChart,
  FileText,
  Shield,
  Bell,
  FileInput,
  BrainCircuit,
  AlertTriangle,
  ClipboardList,
  Stethoscope,
  Scaling,
  Activity,
  FileSpreadsheet,
  Gamepad2,
} from 'lucide-react';
import { type ChartConfig } from "@/components/ui/chart"

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['license_admin', 'admin', 'coordinator', 'educator', 'doctor', 'psychologist', 'administrative', 'supervisor', 'social_worker'] },
  { href: '/registro', label: 'Registro', icon: UserPlus, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'psychologist', 'supervisor', 'social_worker'] },
  { href: '/admision', label: 'Admisión', icon: ClipboardCheck, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'psychologist', 'supervisor', 'social_worker'] },
  { href: '/asistencia', label: 'Asistencia', icon: CalendarCheck, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'administrative', 'supervisor'] },
  { href: '/seguimiento-idii', label: 'Seguimiento IDII', icon: Baby, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'psychologist', 'supervisor', 'social_worker'] },
  { href: '/salud-nutricion', label: 'Salud y Nutrición', icon: HeartPulse, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'supervisor'] },
  { href: '/planificaciones', label: 'Planificaciones', icon: Gamepad2, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'administrative', 'supervisor'] },
  { href: '/intervencion-familiar', label: 'Intervención Familiar', icon: Users, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'psychologist', 'supervisor', 'social_worker'] },
  { href: '/operaciones', label: 'Operaciones', icon: Settings, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'psychologist', 'administrative', 'supervisor', 'social_worker'] },
  { href: '/monitoreo', label: 'Monitoreo', icon: AreaChart, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'psychologist', 'administrative', 'supervisor', 'social_worker'] },
  { href: '/reportes', label: 'Reportes', icon: FileText, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'psychologist', 'administrative', 'supervisor', 'social_worker'] },
  { href: '/notificaciones', label: 'Notificaciones', icon: Bell, roles: ['license_admin', 'admin', 'coordinator', 'center_coordinator', 'educator', 'educadora', 'doctor', 'psychologist', 'administrative', 'supervisor', 'social_worker'] },
  { href: '/ingestion', label: 'Carga Masiva', icon: FileSpreadsheet, roles: ['license_admin', 'admin', 'coordinator', 'supervisor'] },
];

export const statsCardsAdmin = [
  { title: "Total Niños/as", value: "1,250", change: "+5.2% vs mes anterior", icon: Users },
  { title: "Asistencia General Hoy", value: "92.5%", change: "-1.8% vs ayer", icon: CalendarCheck },
  { title: "Alertas Críticas (Global)", value: "12", change: "+3 nuevas hoy", icon: AlertTriangle },
  { title: "Postulaciones Totales", value: "78", change: "15 en lista de espera", icon: ClipboardList }
];

export const statsCardsBahia = [
  { title: "Total Niños/as (Bahía)", value: "620", change: "+3.1% vs mes anterior", icon: Users },
  { title: "Asistencia Hoy (Bahía)", value: "94.1%", change: "+0.5% vs ayer", icon: CalendarCheck },
  { title: "Alertas Críticas (Bahía)", value: "4", change: "+1 nueva hoy", icon: AlertTriangle },
  { title: "Postulaciones (Bahía)", value: "45", change: "8 en lista de espera", icon: ClipboardList }
];

export const statsCardsGuasmo = [
  { title: "Total Niños/as (Guasmo)", value: "630", change: "+7.3% vs mes anterior", icon: Users },
  { title: "Asistencia Hoy (Guasmo)", value: "90.9%", change: "-4.1% vs ayer", icon: CalendarCheck },
  { title: "Alertas Críticas (Guasmo)", value: "8", change: "+2 nuevas hoy", icon: AlertTriangle },
  { title: "Postulaciones (Guasmo)", value: "33", change: "7 en lista de espera", icon: ClipboardList }
];


export const recentAdmissions = [
  { id: "ADM-001", childName: "Ana Lucía Pérez", entryDate: "2023-09-01", status: "APROBADO", center: "Centro Bahía" },
  { id: "ADM-002", childName: "Juan José García", entryDate: "2023-09-01", status: "LISTA_ESPERA", center: "Centro Guasmo" },
  { id: "ADM-003", childName: "María Emilia Torres", entryDate: "2023-08-25", status: "APROBADO", center: "Centro Bahía" },
  { id: "ADM-004", childName: "Carlos David Romero", entryDate: "2023-08-20", status: "VALIDANDO", center: "Centro Guasmo" },
  { id: "ADM-005", childName: "Sofía Valentina Vera", entryDate: "2023-09-02", status: "POSTULADO", center: "Centro Bahía" },
  { id: "ADM-006", childName: "Luis Felipe Mendoza", entryDate: "2023-08-15", status: "RECHAZADO", center: "Centro Guasmo" },
  { id: "ADM-007", childName: "Isabella Castro", entryDate: "2023-09-03", status: "VALIDANDO", center: "Centro Bahía" },
  { id: "ADM-008", childName: "Mateo Ortiz", entryDate: "2023-09-03", status: "POSTULADO", center: "Centro Guasmo" },
];

export const developmentChartData = [
  { area: "Motricidad", "Centro Bahía": 82, "Centro Guasmo": 75, date: "2024-01" },
  { area: "Lenguaje", "Centro Bahía": 78, "Centro Guasmo": 85, date: "2024-02" },
  { area: "Socio-Afectivo", "Centro Bahía": 90, "Centro Guasmo": 88, date: "2024-03" },
  { area: "Cognitivo", "Centro Bahía": 85, "Centro Guasmo": 80, date: "2024-04" },
  { area: "Adaptativo", "Centro Bahía": 75, "Centro Guasmo": 78, date: "2024-05" },
];

export const developmentChartConfig = {
  "Centro Bahía": {
    label: "Centro Bahía",
    color: "hsl(var(--chart-1))",
  },
  "Centro Guasmo": {
    label: "Centro Guasmo",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export type ChildRecord = {
  id: string;
  name: string;
  age: string;
  center: string;
  lastCheck: string;
  status: "Activo" | "Inactivo";
}

export const childrenRecords: ChildRecord[] = [
  { id: "CI-0123", name: "Ana Lucía Pérez", age: "3 años", center: "Centro Bahía", lastCheck: "2024-05-15", status: "Activo" },
  { id: "CI-0456", name: "Juan José García", age: "4 años", center: "Centro Guasmo", lastCheck: "2024-05-12", status: "Activo" },
  { id: "CI-0789", name: "María Emilia Torres", age: "2 años", center: "Centro Bahía", lastCheck: "2024-05-20", status: "Activo" },
  { id: "CI-1011", name: "Carlos David Romero", age: "3 años", center: "Centro Guasmo", lastCheck: "2024-05-18", status: "Inactivo" },
  { id: "CI-1213", name: "Sofía Valentina Vera", age: "5 años", center: "Centro Bahía", lastCheck: "2024-05-21", status: "Activo" },
  { id: "CI-1415", name: "Luis Felipe Mendoza", age: "4 años", center: "Centro Guasmo", lastCheck: "2024-05-10", status: "Activo" },
];

// Key is 'yyyy-MM-dd'
type AttendanceRecord = { childId: string, status: "Presente" | "Ausente" | "Retraso", time: string | null };
export const attendanceData: { [key: string]: AttendanceRecord[] } = {
  "2024-07-28": [
    { childId: "CI-0123", status: "Presente", time: "08:05 AM" },
    { childId: "CI-0456", status: "Ausente", time: null },
    { childId: "CI-0789", status: "Presente", time: "08:15 AM" },
    { childId: "CI-1213", status: "Presente", time: "07:55 AM" },
    { childId: "CI-1415", status: "Retraso", time: "08:35 AM" },
  ],
  "2024-07-27": [
    { childId: "CI-0123", status: "Presente", time: "08:00 AM" },
    { childId: "CI-0456", status: "Presente", time: "08:20 AM" },
    { childId: "CI-0789", status: "Ausente", time: null },
  ]
};


export const notifications = [
  { id: 1, title: "Alerta de Nutrición", description: "Bajo peso detectado en 3 niños del Centro Guasmo. Requiere intervención.", type: "Alerta", time: "Hace 15m", read: false },
  { id: 2, title: "Reporte Mensual Generado", description: "El reporte de asistencia de Mayo 2024 está listo para su revisión.", type: "Reporte", time: "Hace 1h", read: false },
  { id: 3, title: "Nueva Postulación", description: "Se ha recibido una nueva postulación para el Centro Bahía.", type: "Info", time: "Hace 3h", read: true },
  { id: 4, title: "Mantenimiento Programado", description: "El sistema estará en mantenimiento el Sábado a las 10 PM.", type: "Aviso", time: "Ayer", read: true },
];

export const idiiRecords = [
  { childId: "CI-0123", childName: "Ana Lucía Pérez", date: "2024-05-20", area: "Motricidad", result: "En desarrollo", professional: "Laura Paz" },
  { childId: "CI-0456", childName: "Juan José García", date: "2024-05-18", area: "Lenguaje", result: "Esperado", professional: "Carlos Vera" },
  { childId: "CI-0789", childName: "María Emilia Torres", date: "2024-05-22", area: "Socio-Afectivo", result: "Avanzado", professional: "Laura Paz" },
];

export const healthRecords = [
  { childId: "CI-0123", childName: "Ana Lucía Pérez", date: "2024-05-15", type: "Control de Peso/Talla", result: "Peso normal para la talla", professional: "Dr. Almeida" },
  { childId: "CI-0456", childName: "Juan José García", date: "2024-05-12", type: "Vacunación", result: "Esquema completo para la edad", professional: "Lic. Suárez" },
  { childId: "CI-1011", childName: "Carlos David Romero", date: "2024-05-18", type: "Control de Hemoglobina", result: "Anemia leve (10.5 g/dL)", professional: "Dr. Almeida" },
];

export const familyInterventions = [
  { familyId: "FAM-012", familyName: "Pérez", date: "2024-05-10", type: "Visita Domiciliaria", reason: "Seguimiento nutricional", professional: "Luisa Ríos" },
  { familyId: "FAM-045", familyName: "García", date: "2024-05-12", type: "Taller para padres", reason: "Pautas de crianza positiva", professional: "Sofía Campos" },
];

export const users = [
  { id: "USR-001", name: "Admin Master", role: "Administrador Master", center: "Todos" },
  { id: "USR-002", name: "Laura Paz", role: "Coordinador", center: "Centro Bahía" },
  { id: "USR-003", name: "Carlos Vera", role: "Coordinador", center: "Centro Guasmo" },
  { id: "USR-004", name: "Ana Gómez", role: "Docente", center: "Centro Bahía" },
];

export const reports = [
  { id: "REP-001", title: "Reporte de Asistencia Mensual - Mayo", type: "Asistencia", icon: CalendarCheck, date: "2024-06-01" },
  { id: "REP-002", title: "Consolidado de Evaluación IDII - Q1", type: "Desarrollo", icon: Baby, date: "2024-04-05" },
  { id: "REP-003", title: "Estado Nutricional General", type: "Salud", icon: Stethoscope, date: "2024-05-28" },
];

export const monitoringKpis = [
  { title: "Cobertura de Vacunación", value: "95%", icon: Stethoscope, target: "98%", status: "warning" },
  { title: "Adherencia a Talleres", value: "82%", icon: Users, target: "90%", status: "danger" },
  { title: "Ejecución Presupuestaria", value: "98%", icon: Scaling, target: "95%", status: "success" },
  { title: "Rotación de Personal", value: "5%", icon: Activity, target: "< 10%", status: "success" },
];

export const operationsTasks = [
  { id: "OP-001", task: "Compra de material didáctico", assignedTo: "Laura Paz", status: "En Progreso", center: "Centro Bahía" },
  { id: "OP-002", task: "Mantenimiento de área de juegos", assignedTo: "Carlos Vera", status: "Pendiente", center: "Centro Guasmo" },
  { id: "OP-003", task: "Planificación de menú mensual", assignedTo: "Laura Paz", status: "Completado", center: "Centro Bahía" },
];