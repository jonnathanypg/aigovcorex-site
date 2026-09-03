'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import { SheetTitle } from '@/components/ui/sheet';
import { usePathname } from 'next/navigation';
import { navItems } from '@/lib/data';
import Link from 'next/link';
import { KindiCoreAILogo } from '../icons';

import { useLicense } from '@/contexts/license-context';
import { Building2, Users, Brain } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useState, useEffect } from 'react';

function KnowledgeMenu() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkVisibility = () => {
      const user = authService.getStoredUser();
      if (user) {
        const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
        // Only show for coordinators in the main app sidebar
        // License Admins accept this module via their own LicenseAdminSidebar
        if (['center_coordinator', 'coordinator', 'doctor', 'nutritionist', 'social_worker', 'psychologist', 'administrative', 'supervisor', 'license_admin'].includes(roleName)) {
          setIsVisible(true);
        }
      }
      setIsLoading(false);
    };

    checkVisibility();
    // Listen for login/logout events if implemented, or just run once on mount
    window.addEventListener('user-login', checkVisibility);
    return () => window.removeEventListener('user-login', checkVisibility);
  }, []);

  if (isLoading || !isVisible) return null;

  return (
    <>
      <SidebarSeparator />
      <SidebarGroupLabel>Inteligencia Artificial</SidebarGroupLabel>
      <SidebarMenuItem onClick={() => setOpenMobile(false)}>
        <Link href="/knowledge">
          <SidebarMenuButton
            isActive={pathname === '/knowledge'}
            tooltip="Base de Conocimiento"
          >
            <Brain />
            <span>Base de Conocimiento</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    </>
  );
}

function LicenseAdminMenu() {
  const { isLicenseAdmin, isLoading } = useLicense();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [isAdminRole, setIsAdminRole] = useState(false);

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
      // Doctor has isLicenseAdmin=true for center switching but shouldn't see these menus
      setIsAdminRole(['license_admin', 'supervisor'].includes(roleName));
    }
  }, []);

  // Wait for context to load before deciding visibility
  if (isLoading || !isLicenseAdmin || !isAdminRole) return null;

  const items = [
    { label: 'Gestión de Centros', href: '/license-admin/centers', icon: Building2 },
    { label: 'Gestión de Usuarios', href: '/license-admin/users', icon: Users },
  ];

  return (
    <>
      <SidebarSeparator />
      <SidebarGroupLabel>Administración de Licencia</SidebarGroupLabel>
      {items.map((item) => (
        <SidebarMenuItem key={item.label} onClick={() => setOpenMobile(false)}>
          <Link href={item.href}>
            <SidebarMenuButton
              isActive={pathname === item.href}
              tooltip={item.label}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
      setUserRole(roleName);
    }
  }, []);

  // Filter nav items based on roles if specified, otherwise hide (fail safe)
  const filteredNavItems = navItems.filter(item =>
    !item.roles || item.roles.includes(userRole)
  );

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center justify-center p-2 group-data-[collapsible=icon]:p-1 min-h-[48px]">
          {/* Logo when sidebar is expanded */}
          <img 
            src="/Logo-Kindicore-Horizontal.png" 
            alt="KindiCore AI" 
            className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden dark:brightness-110" 
          />
          {/* Favicon icon only when sidebar is collapsed (icon mode) */}
          <img 
            src="/favicon-kindicore.png" 
            alt="KindiCore AI Icon" 
            className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block shrink-0 dark:brightness-110" 
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          {filteredNavItems.map((item) => {
            // Map route paths to onboarding tour IDs
            const routeToId: Record<string, string> = {
              '/dashboard': 'onboarding-nav-dashboard',
              '/registro': 'onboarding-nav-registro',
              '/admision': 'onboarding-nav-admision',
              '/asistencia': 'onboarding-nav-asistencia',
              '/seguimiento-idii': 'onboarding-nav-idii',
              '/salud-nutricion': 'onboarding-nav-salud',
              '/planificaciones': 'onboarding-nav-planificaciones',
              '/intervencion-familiar': 'onboarding-nav-intervencion',
              '/operaciones': 'onboarding-nav-operaciones',
              '/monitoreo': 'onboarding-nav-monitoreo',
              '/reportes': 'onboarding-nav-reportes',
              '/notificaciones': 'onboarding-nav-notificaciones',
              '/ingestion': 'onboarding-nav-ingestion',
            };
            const onboardingId = routeToId[item.href];

            return (
              <SidebarMenuItem key={item.label} id={onboardingId} onClick={() => setOpenMobile(false)}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}

          {/* Knowledge Base Menu (License Admin + Coordinator) */}
          <KnowledgeMenu />

          {/* License Admin Menu */}
          <LicenseAdminMenu />

        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {/* Can add user info or settings link here */}
      </SidebarFooter>
    </>
  );
}

