'use client';

import { useState } from 'react';


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
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { KindiCoreAILogo } from '@/components/icons';
import { navItems } from '@/lib/data';
import { Building2, Users, LayoutDashboard, Brain, UtensilsCrossed, FileSpreadsheet } from 'lucide-react';

export function LicenseAdminSidebar() {
    const pathname = usePathname();
    const { setOpenMobile } = useSidebar();

    // Custom Management Items
    const managementItems = [
        { label: 'Gestión de Centros', href: '/license-admin/centers', icon: Building2 },
        { label: 'Gestión de Usuarios', href: '/license-admin/users', icon: Users },
        { label: 'Menú Nutricional', href: '/license-admin/salud-nutricion/menu', icon: UtensilsCrossed },
        { label: 'Base de Conocimiento', href: '/license-admin/knowledge', icon: Brain },
    ];

    return (
        <>
            <SidebarHeader>
                <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:justify-center min-h-[48px]">
                    {/* Expanded view */}
                    <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                        <img src="/favicon-kindicore.png" alt="KindiCore AI" className="h-7 w-7 object-contain dark:brightness-110" />
                        <span className="text-sm font-bold text-foreground">KindiCore AI</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Admin</span>
                    </div>
                    {/* Collapsed view */}
                    <img 
                        src="/favicon-kindicore.png" 
                        alt="KindiCore AI" 
                        className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block shrink-0 dark:brightness-110" 
                    />
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {/* 1. Global View (Dashboard) */}
                    <SidebarMenuItem onClick={() => setOpenMobile(false)}>
                        <Link href="/license-admin/dashboard">
                            <SidebarMenuButton
                                isActive={pathname === '/license-admin/dashboard'}
                                tooltip="Dashboard Global"
                            >
                                <LayoutDashboard />
                                <span>Torre de Control</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>

                    {/* 2. Management Tools */}
                    <SidebarSeparator />
                    <SidebarGroupLabel>Administración</SidebarGroupLabel>
                    {managementItems.map((item) => (
                        <SidebarMenuItem key={item.label} onClick={() => setOpenMobile(false)}>
                            <Link href={item.href}>
                                <SidebarMenuButton
                                    isActive={pathname.startsWith(item.href)}
                                    tooltip={item.label}
                                >
                                    <item.icon />
                                    <span>{item.label}</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    ))}

                    {/* 3. Standard Modules (Mirrored) */}
                    <SidebarSeparator />
                    <SidebarGroupLabel>Módulos de Centro</SidebarGroupLabel>
                    {navItems.filter(i => i.href !== '/dashboard').map((item) => (
                        <SidebarMenuItem key={item.label} onClick={() => setOpenMobile(false)}>
                            <Link href={`/license-admin${item.href}`}>
                                <SidebarMenuButton
                                    isActive={pathname === `/license-admin${item.href}`}
                                    tooltip={item.label}
                                >
                                    <item.icon />
                                    <span>{item.label}</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    ))}

                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
            </SidebarFooter>
        </>
    );
}
