'use client';

/**
 * AI GovCoreX OS — App Header v3.0
 * Global HUD header with module context, voice copilot trigger, and breadcrumb navigation.
 */

import { UserNav } from './user-nav';
import { ClientOnly } from './client-only';
import { ThemeSwitcher } from './theme-switcher';
import { CenterSelector } from './center-selector';
import { usePathname, useRouter } from 'next/navigation';
import { getModuleByRoute, OS_MODULES } from '@/lib/os-modules';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

import { useLicense } from '@/contexts/license-context';
import { authService } from '@/services/auth.service';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/registro': 'Registro de Niños',
  '/admision': 'Proceso de Admisión',
  '/asistencia': 'Control de Asistencia',
  '/seguimiento-idii': 'Seguimiento IDII',
  '/salud-nutricion': 'Salud & Nutrición',
  '/planificaciones': 'Planificaciones',
  '/intervencion-familiar': 'Intervención Familiar',
  '/operaciones': 'Operaciones',
  '/monitoreo': 'Monitoreo',
  '/reportes': 'Reportes',
  '/notificaciones': 'Notificaciones',
  '/ingestion': 'Carga Masiva',
  '/knowledge': 'Base de Conocimiento',
  '/license-admin/centers': 'Gestión de Centros',
  '/license-admin/users': 'Gestión de Usuarios',
  // New OS routes
  '/social/dashboard': 'Social AI',
  '/social/programas/nuevo': 'Crear Programa Social',
  '/social/postulaciones': 'Postulaciones',
  '/social/beneficiarios': 'Beneficiarios',
  '/social/red': 'Red Interinstitucional',
  '/social/equipos': 'Equipos & Roles',
  '/social/proyectos': 'Proyectos Activos',
  '/social/reportes': 'Reportes Sociales',
  '/social/formularios': 'Formularios Dinámicos',
  '/geo/mapa': 'Mapa Interactivo',
  '/geo/heatmap': 'Mapa de Calor & Incidencias',
  '/geo/cercas': 'Cercos Digitales',
  '/geo/barridos': 'Barridos Territoriales',
  '/geo/grafos': 'Grafo Institucional',
  '/geo/trazabilidad': 'Trazabilidad de Red',
  '/geo/equipos-campo': 'Equipos en Campo',
  '/canales/dashboard': 'Canales de Comunicación',
  '/canales/whatsapp': 'WhatsApp',
  '/canales/telegram': 'Telegram',
  '/canales/conversaciones': 'Conversaciones',
  '/canales/conexiones': 'Conexiones de Canal',
  '/canales/herencias': 'Herencias de Canal',
  '/canales/plantillas': 'Plantillas de Mensajes',
  '/copiloto': 'Copiloto RAG',
  '/copiloto/voz': 'Voz Interactiva',
  '/copiloto/documentos': 'Documentos RAG',
  '/copiloto/web': 'Web Scraping',
  '/copiloto/config': 'Configuración IA',
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const pageLabel = routeLabels[pathname] || 'AI GovCoreX OS';
  const currentMod = getModuleByRoute(pathname);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const { hasModule } = useLicense();

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
      setUserRole(roleName);
    }
  }, []);

  // Filter modules based on user license and role
  const allowedModules = OS_MODULES.filter(m =>
    (!userRole || m.requiredRoles.includes(userRole)) && hasModule(m.id)
  );

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectRoute = (href: string) => {
    setIsSearchOpen(false);
    router.push(href);
  };

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-xl lg:h-[58px] lg:px-5 transition-all duration-300 relative bg-background/80 border-border/70"
      >
        {/* Module accent left border */}
        {currentMod && (
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all duration-300"
            style={{ background: currentMod.color }}
          />
        )}

        {/* Breadcrumb + Module Context */}
        <div className="flex-1 flex items-center gap-2 min-w-0 ml-2">
          {/* Module chip */}
          {currentMod && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold shrink-0"
              style={{
                background: `${currentMod.color}15`,
                border: `1px solid ${currentMod.color}30`,
                color: currentMod.color,
              }}
            >
              <currentMod.icon className="w-3 h-3" />
              <span>{currentMod.shortLabel}</span>
            </div>
          )}

          {currentMod && (
            <span className="text-muted-foreground/40 text-xs hidden sm:block">/</span>
          )}

          <span className="text-sm font-semibold text-foreground/90 truncate">{pageLabel}</span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5">
          {/* Search Button (clickable on desktop and tablet) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex gap-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs px-3 py-1.5 h-8 rounded-lg border border-border cursor-pointer"
            title="Buscar módulo o sección (⌘K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar...</span>
            <kbd className="ml-1 text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono border border-border">⌘K</kbd>
          </Button>

          {/* Search icon for very small mobile screens */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-accent border border-border"
            title="Buscar sección"
          >
            <Search className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>

          {/* Notifications Button (Navigates to /notificaciones) */}
          <button
            onClick={() => router.push('/notificaciones')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-accent border border-border relative cursor-pointer"
            title="Ver Notificaciones"
          >
            <Bell className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
          </button>

          <CenterSelector />
          <ThemeSwitcher />
          <ClientOnly>
            <UserNav />
          </ClientOnly>
        </div>
      </header>

      {/* Global Quick Search Dialog (⌘K) */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-lg border-border/80 shadow-2xl">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder="Escribe para buscar cualquier módulo o función..." />
            <CommandList className="max-h-[350px] overflow-y-auto">
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              {allowedModules.map((mod) => (
                <CommandGroup key={mod.id} heading={mod.label}>
                  {mod.sections.flatMap(s => s.items).map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.href}
                        onSelect={() => handleSelectRoute(item.href)}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{ background: `${mod.color}18`, color: mod.color }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                          {item.href}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
