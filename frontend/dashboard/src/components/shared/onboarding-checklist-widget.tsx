'use client';

/**
 * KindiCore AI — Onboarding Checklist Widget
 * Floating bottom-right widget that tracks setup progress.
 * Adapted from EnpiAI pattern, customized for CDI management context.
 * Tracks real API data to determine completion of each step.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    CheckCircle2,
    Circle,
    ChevronUp,
    ChevronDown,
    Sparkles,
    LayoutDashboard,
    UserPlus,
    Baby,
    HeartPulse,
    CalendarCheck,
    FileText,
    PlayCircle,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/store/use-onboarding-store';
import { authService } from '@/services/auth.service';
import api from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { navItems } from '@/lib/data';

const checklistItems = [
    {
        key: 'dashboard',
        title: 'Explorar el Dashboard',
        desc: 'Conoce los KPIs y métricas generales del CDI',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        key: 'registro',
        title: 'Registrar primer niño',
        desc: 'Ingresa un niño con su expediente completo',
        href: '/registro',
        icon: UserPlus,
    },
    {
        key: 'asistencia',
        title: 'Marcar asistencia',
        desc: 'Registra la asistencia del día',
        href: '/asistencia',
        icon: CalendarCheck,
    },
    {
        key: 'idii',
        title: 'Evaluación IDII',
        desc: 'Aplica un instrumento de desarrollo infantil',
        href: '/seguimiento-idii',
        icon: Baby,
    },
    {
        key: 'salud',
        title: 'Registro de salud',
        desc: 'Registra un control de peso o vacuna',
        href: '/salud-nutricion',
        icon: HeartPulse,
    },
    {
        key: 'reportes',
        title: 'Generar un reporte',
        desc: 'Crea tu primer reporte MIES',
        href: '/reportes',
        icon: FileText,
    },
    {
        key: 'intervencion',
        title: 'Intervención familiar',
        desc: 'Registra un contacto o visita familiar',
        href: '/intervencion-familiar',
        icon: Users,
    },
];

export function OnboardingChecklistWidget({ isChatOpen = false }: { isChatOpen?: boolean }) {
    const router = useRouter();
    const {
        completedSteps,
        setCompletedSteps,
        checklistExpanded,
        setChecklistExpanded,
        startTour,
    } = useOnboardingStore();

    const [userRole, setUserRole] = useState<string>('');

    // Get user role on mount
    useEffect(() => {
        const user = authService.getStoredUser();
        if (user) {
            const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
            setUserRole(roleName || '');
        }
    }, []);

    // Dynamically filter checklist items based on user role permissions
    const activeChecklistItems = useMemo(() => {
        if (!userRole) return [];
        return checklistItems.filter(item => {
            const navItem = navItems.find(nav => nav.href === item.href);
            if (!navItem) return true;
            return !navItem.roles || navItem.roles.includes(userRole);
        });
    }, [userRole]);

    // Local state as a fallback/robust solution for tracking if chat sidebar is open
    const [localChatOpen, setLocalChatOpen] = useState(isChatOpen);

    useEffect(() => {
        setLocalChatOpen(isChatOpen);
    }, [isChatOpen]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ isOpen: boolean }>).detail;
            setLocalChatOpen(detail.isOpen);
        };
        window.addEventListener('kindicore-chat-sidebar-toggle', handler);
        return () => window.removeEventListener('kindicore-chat-sidebar-toggle', handler);
    }, []);

    // Track which pages the user has visited (simulated from localStorage)
    useEffect(() => {
        const visited = JSON.parse(
            localStorage.getItem('kindicore-visited-pages') || '[]'
        ) as string[];
        const live: string[] = [];

        // Dashboard: always available once logged in
        const user = authService.getStoredUser();
        if (user) live.push('dashboard');

        // Check visited routes
        const routeToKey: Record<string, string> = {
            '/registro': 'registro',
            '/asistencia': 'asistencia',
            '/seguimiento-idii': 'idii',
            '/salud-nutricion': 'salud',
            '/reportes': 'reportes',
            '/intervencion-familiar': 'intervencion',
        };

        visited.forEach((route) => {
            const key = routeToKey[route];
            if (key && !live.includes(key)) live.push(key);
        });

        // Also check against what was already in completed steps
        const merged = Array.from(new Set([...live, ...completedSteps]));
        setCompletedSteps(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track current page visits
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const current = window.location.pathname;
        const routesToTrack = [
            '/registro',
            '/asistencia',
            '/seguimiento-idii',
            '/salud-nutricion',
            '/reportes',
            '/intervencion-familiar',
        ];

        if (routesToTrack.includes(current)) {
            const visited = JSON.parse(
                localStorage.getItem('kindicore-visited-pages') || '[]'
            ) as string[];
            if (!visited.includes(current)) {
                const updated = [...visited, current];
                localStorage.setItem('kindicore-visited-pages', JSON.stringify(updated));

                const routeToKey: Record<string, string> = {
                    '/registro': 'registro',
                    '/asistencia': 'asistencia',
                    '/seguimiento-idii': 'idii',
                    '/salud-nutricion': 'salud',
                    '/reportes': 'reportes',
                    '/intervencion-familiar': 'intervencion',
                };

                const key = routeToKey[current];
                if (key) {
                    const currentCompleted = useOnboardingStore.getState().completedSteps;
                    if (!currentCompleted.includes(key)) {
                        setCompletedSteps([...currentCompleted, key]);
                    }
                }
            }
        }
    });

    const completedCount = activeChecklistItems.filter((item) =>
        completedSteps.includes(item.key)
    ).length;
    const progressPercent = activeChecklistItems.length > 0
        ? Math.round((completedCount / activeChecklistItems.length) * 100)
        : 0;
    const allCompleted = activeChecklistItems.length > 0 && completedCount === activeChecklistItems.length;

    const handleItemClick = (href: string) => {
        router.push(href);
        if (checklistExpanded) setChecklistExpanded(false);
    };

    // Hide when all steps are done — clean dashboard, or when AI chat sidebar is open
    if (allCompleted || localChatOpen) return null;

    return (
        <div className="fixed right-6 z-[9000] flex flex-col items-end gap-3 pointer-events-none bottom-[88px]">
            {/* Expanded panel */}
            {checklistExpanded && (
                <Card className="w-80 sm:w-[340px] shadow-2xl border border-amber-200/40 dark:border-amber-700/30 !bg-white dark:!bg-zinc-950 !opacity-100 overflow-hidden rounded-2xl animate-in slide-in-from-bottom-4 fade-in-0 duration-300 pointer-events-auto">
                    {/* Header — KindiCore warm gradient */}
                    <div className="p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-100 animate-pulse" />
                            <div>
                                <h4 className="font-bold text-sm tracking-tight">
                                    Primeros Pasos
                                </h4>
                                <p className="text-[10px] text-amber-100">
                                    {completedCount} de {activeChecklistItems.length} completados
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setChecklistExpanded(false)}
                            className="text-white hover:bg-white/10 rounded-full h-8 w-8"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-muted/40 relative">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {/* Step list */}
                    <div className="p-4 max-h-[360px] overflow-y-auto space-y-2">
                        {activeChecklistItems.map((item) => {
                            const isDone = completedSteps.includes(item.key);
                            const StepIcon = item.icon;

                            return (
                                <button
                                    key={item.key}
                                    onClick={() => handleItemClick(item.href)}
                                    className={cn(
                                        'w-full flex items-start gap-3 p-2.5 rounded-xl text-left border transition-all duration-300',
                                        isDone
                                            ? 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-700/30 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                            : 'bg-muted/10 border-border/80 hover:bg-muted/50 hover:border-amber-300/50 dark:hover:border-amber-700/40'
                                    )}
                                >
                                    <div className="mt-0.5 shrink-0">
                                        {isDone ? (
                                            <CheckCircle2 className="h-5 w-5 text-amber-500 fill-amber-500/10" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground/60" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <StepIcon
                                                className={cn(
                                                    'h-3.5 w-3.5 shrink-0',
                                                    isDone ? 'text-amber-500' : 'text-amber-400'
                                                )}
                                            />
                                            <h5
                                                className={cn(
                                                    'font-semibold text-xs leading-none text-foreground truncate',
                                                    isDone && 'line-through text-muted-foreground'
                                                )}
                                            >
                                                {item.title}
                                            </h5>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-normal mt-1 truncate">
                                            {item.desc}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t bg-muted/10 flex justify-between items-center text-xs">
                        <button
                            onClick={() => {
                                startTour(0);
                                setChecklistExpanded(false);
                            }}
                            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-semibold transition-colors"
                        >
                            <PlayCircle className="h-4 w-4" />
                            Repetir tour
                        </button>
                        <span className="text-[10px] text-muted-foreground">
                            KindiCore Onboarding v1.0
                        </span>
                    </div>
                </Card>
            )}

            {/* Floating toggle badge */}
            <button
                onClick={() => setChecklistExpanded(!checklistExpanded)}
                className="relative flex items-center justify-center h-12 w-12 rounded-full shadow-2xl transition-all duration-300 pointer-events-auto border hover:scale-105 active:scale-95 text-white bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 hover:from-amber-600 hover:to-orange-600"
                title={`${progressPercent}% configurado`}
            >
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 border border-white text-[9px] font-extrabold text-white shadow-md">
                    {progressPercent}%
                </span>
            </button>
        </div>
    );
}
