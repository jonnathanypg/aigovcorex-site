"use client";

import {
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarFooter,
    SidebarGroupLabel,
    useSidebar,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Building2,
    Users,
    BarChart3,
    Settings,
    ShieldCheck
} from "lucide-react";
import { KindiCoreAILogo } from '@/components/icons';

const navItems = [
    {
        label: "Dashboard",
        href: "/license-admin",
        icon: LayoutDashboard
    },
    {
        label: "Centros",
        href: "/license-admin/centers",
        icon: Building2
    },
    {
        label: "Usuarios",
        href: "/license-admin/users",
        icon: Users
    },
];

export function LicenseAdminSidebar() {
    const pathname = usePathname();
    const { setOpenMobile } = useSidebar();

    return (
        <>
            <SidebarHeader>
                <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:justify-center min-h-[48px]">
                    {/* Expanded view */}
                    <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                        <img src="/favicon-kindicore.png" alt="KindiCore AI" className="h-7 w-7 object-contain dark:brightness-110" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold leading-none text-foreground">KindiCore AI</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">Admin. Licencia</span>
                        </div>
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
                    <SidebarGroupLabel>Gestión</SidebarGroupLabel>
                    {navItems.map((item) => (
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
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-2 text-xs text-center text-muted-foreground">
                    <ShieldCheck className="mx-auto h-4 w-4 mb-1" />
                    Panel de Licencia
                </div>
            </SidebarFooter>
        </>
    );
}
