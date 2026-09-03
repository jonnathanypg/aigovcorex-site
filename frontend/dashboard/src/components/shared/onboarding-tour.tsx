'use client';

/**
 * KindiCore AI — Onboarding Tour
 * Spotlight-based guided tour adapted from EnpiAI pattern.
 * Highlights each main navigation item with contextual tooltips.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import { useOnboardingStore } from '@/store/use-onboarding-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { navItems } from '@/lib/data';
import { authService } from '@/services/auth.service';

interface TourStep {
    targetId: string;
    route: string;
    titleKey: string;
    descKey: string;
    placement: 'right' | 'left' | 'bottom' | 'top';
}

// Tour steps aligned with KindiCore's navigation structure
const TOUR_STEPS: TourStep[] = [
    {
        targetId: 'onboarding-nav-dashboard',
        route: '/dashboard',
        titleKey: 'Panel Principal',
        descKey: 'Visualiza KPIs globales del CDI: asistencia, alertas nutricionales, postulaciones recientes y tendencias de desarrollo infantil en tiempo real.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-registro',
        route: '/registro',
        titleKey: 'Registro de Niños',
        descKey: 'Registra nuevos niños con sus datos personales, familiares and médicos. Genera automáticamente la ficha MIES para presentar al organismo regulador.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-admision',
        route: '/admision',
        titleKey: 'Proceso de Admisión',
        descKey: 'Gestiona el flujo completo de postulaciones: revisión de documentos, entrevistas, priorización por score socioeconómico y notificaciones a familias.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-asistencia',
        route: '/asistencia',
        titleKey: 'Control de Asistencia',
        descKey: 'Registra la asistencia diaria en segundos. El sistema detecta ausencias repetidas y activa automáticamente protocolos de seguimiento familiar.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-idii',
        route: '/seguimiento-idii',
        titleKey: 'Seguimiento IDII',
        descKey: 'Aplica y registra los Instrumentos de Desarrollo Infantil Integral (IDII). La IA analiza los resultados y sugiere planes de estimulación personalizados.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-salud',
        route: '/salud-nutricion',
        titleKey: 'Salud & Nutrición',
        descKey: 'Gestiona controles de peso/talla, esquemas de vacunación, menús semanales y recibe alertas automáticas cuando un niño no consumió proteínas hoy.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-planificaciones',
        route: '/planificaciones',
        titleKey: 'Planificaciones',
        descKey: 'Crea y gestiona planificaciones pedagógicas semanales. La IA sugiere actividades según los hitos de desarrollo de cada grupo de edad.',
        placement: 'right',
    },
    {
        targetId: 'onboarding-nav-reportes',
        route: '/reportes',
        titleKey: 'Reportes & MIES',
        descKey: 'Genera reportes consolidados de asistencia, desarrollo nutricional y evaluaciones IDII. Exporta en formato oficial para presentaciones al MIES.',
        placement: 'right',
    },
];

export function OnboardingTour() {
    const router = useRouter();
    const pathname = usePathname();
    const { isTourActive, tourStepIndex, nextTourStep, prevTourStep, stopTour } =
        useOnboardingStore();

    const [userRole, setUserRole] = useState<string>('');
    const [coords, setCoords] = useState<{
        top: number;
        left: number;
        width: number;
        height: number;
    } | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const [isNavigating, setIsNavigating] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Get user role on mount
    useEffect(() => {
        const user = authService.getStoredUser();
        if (user) {
            const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
            setUserRole(roleName || '');
        }
    }, []);

    // Dynamically filter tour steps based on user role permissions
    const activeSteps = useMemo(() => {
        if (!userRole) return [];
        return TOUR_STEPS.filter(step => {
            const navItem = navItems.find(item => item.href === step.route);
            if (!navItem) return true;
            return !navItem.roles || navItem.roles.includes(userRole);
        });
    }, [userRole]);

    const currentStep = activeSteps[tourStepIndex];

    // Handle routing if step route doesn't match current route
    useEffect(() => {
        if (!isTourActive || !currentStep) return;

        if (pathname !== currentStep.route) {
            setIsNavigating(true);
            setCoords(null);
            router.push(currentStep.route);
        } else {
            const timer = setTimeout(() => {
                setIsNavigating(false);
                updateSpotlight();
            }, 300);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTourActive, tourStepIndex, pathname, currentStep]);

    const updateSpotlight = () => {
        if (!isTourActive || !currentStep || isNavigating) return;

        const element = document.getElementById(currentStep.targetId);
        if (!element) {
            setCoords(null);
            return;
        }

        const rect = element.getBoundingClientRect();
        setCoords({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        });
    };

    useEffect(() => {
        if (!isTourActive) return;
        window.addEventListener('resize', updateSpotlight);
        window.addEventListener('scroll', updateSpotlight, true);
        return () => {
            window.removeEventListener('resize', updateSpotlight);
            window.removeEventListener('scroll', updateSpotlight, true);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTourActive, tourStepIndex, isNavigating]);

    useEffect(() => {
        if (isTourActive && !isNavigating) {
            const intervals = [100, 500, 1000, 2000].map((delay) =>
                setTimeout(updateSpotlight, delay)
            );
            return () => intervals.forEach(clearTimeout);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTourActive, isNavigating, tourStepIndex]);

    // Position tooltip based on target element and screen
    useEffect(() => {
        if (!isTourActive) return;

        if (isNavigating || !coords) {
            setTooltipStyle({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '340px',
                maxWidth: '90vw',
            });
            return;
        }

        const tooltipWidth = tooltipRef.current?.offsetWidth || 340;
        const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Mobile fallback
        if (screenWidth < 768) {
            setTooltipStyle({
                position: 'fixed',
                bottom: '16px',
                left: '16px',
                right: '16px',
                margin: '0 auto',
                width: 'auto',
                maxWidth: 'calc(100vw - 32px)',
            });
            return;
        }

        let top = 0;
        let left = 0;

        if (currentStep.placement === 'right') {
            left = coords.left + coords.width + 16;
            top = coords.top + (coords.height - tooltipHeight) / 2;

            if (left + tooltipWidth > screenWidth) {
                left = coords.left - tooltipWidth - 16;
                if (left < 0) {
                    left = (screenWidth - tooltipWidth) / 2;
                    top = coords.top + coords.height + 16;
                }
            }
        } else if (currentStep.placement === 'bottom') {
            left = coords.left + (coords.width - tooltipWidth) / 2;
            top = coords.top + coords.height + 16;
        } else if (currentStep.placement === 'left') {
            left = coords.left - tooltipWidth - 16;
            top = coords.top + (coords.height - tooltipHeight) / 2;
        } else {
            left = coords.left + (coords.width - tooltipWidth) / 2;
            top = coords.top - tooltipHeight - 16;
        }

        if (top < 16) top = 16;
        if (top + tooltipHeight > screenHeight) top = screenHeight - tooltipHeight - 16;
        if (left < 16) left = 16;
        if (left + tooltipWidth > screenWidth) left = screenWidth - tooltipWidth - 16;

        setTooltipStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`,
            transform: 'none',
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTourActive, coords, isNavigating, tourStepIndex]);

    if (!isTourActive) return null;

    const handleNext = () => {
        if (tourStepIndex < activeSteps.length - 1) {
            nextTourStep();
        } else {
            stopTour();
        }
    };

    const handleBack = () => {
        if (tourStepIndex > 0) {
            prevTourStep();
        }
    };

    const progressPercentage = activeSteps.length > 0 ? ((tourStepIndex + 1) / activeSteps.length) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/45 pointer-events-auto transition-opacity duration-300"
                onClick={stopTour}
            />

            {/* Spotlight cut-out ring — KindiCore amber accent */}
            {coords && !isNavigating && (
                <div
                    className="absolute z-50 rounded-xl border-2 border-amber-400 ring-[4px] ring-amber-400/40 shadow-[0_0_0_9999px_rgba(10,10,10,0.65)] transition-all duration-300 pointer-events-none ease-out"
                    style={{
                        top: `${coords.top - 6}px`,
                        left: `${coords.left - 6}px`,
                        width: `${coords.width + 12}px`,
                        height: `${coords.height + 12}px`,
                    }}
                />
            )}

            {/* Tooltip Card */}
            <div
                ref={tooltipRef}
                style={tooltipStyle}
                className="absolute z-[10000] pointer-events-auto transition-all duration-300 ease-out"
            >
                <Card className="p-5 border border-amber-200/30 dark:border-amber-700/30 shadow-2xl !bg-white dark:!bg-zinc-950 !opacity-100 rounded-2xl relative overflow-hidden max-w-[340px]">
                    {/* Progress bar — KindiCore amber gradient */}
                    <div
                        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                    />

                    <button
                        onClick={stopTour}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted/80 rounded-full"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-600 bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full">
                                {tourStepIndex + 1} / {activeSteps.length}
                            </span>
                            {isNavigating && (
                                <span className="text-[11px] text-amber-500 animate-pulse font-medium">
                                    Navegando...
                                </span>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <h4 className="font-bold text-foreground text-base">
                                {currentStep?.titleKey}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {currentStep?.descKey}
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopTour}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Salir del tour
                            </Button>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={tourStepIndex === 0}
                                    onClick={handleBack}
                                    className="h-8 px-2 text-xs"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Atrás
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleNext}
                                    className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium"
                                >
                                    {tourStepIndex === activeSteps.length - 1 ? (
                                        <>
                                            ¡Listo!
                                            <Check className="h-3.5 w-3.5 ml-1" />
                                        </>
                                    ) : (
                                        <>
                                            Siguiente
                                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
