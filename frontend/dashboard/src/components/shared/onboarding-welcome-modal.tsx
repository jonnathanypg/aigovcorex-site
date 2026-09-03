'use client';

/**
 * KindiCore AI — Onboarding Welcome Modal
 * Adapted from EnpiAI onboarding system.
 * Shows once per user session, introduces core modules.
 */

import { useState, useEffect } from 'react';
import { Baby, Play, Compass, Heart, ClipboardCheck, CalendarCheck, Brain } from 'lucide-react';
import { useOnboardingStore } from '@/store/use-onboarding-store';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';

export function OnboardingWelcomeModal() {
    const { hasSeenWelcome, setHasSeenWelcome, startTour } = useOnboardingStore();
    const [open, setOpen] = useState(false);
    const [userName, setUserName] = useState('');

    useEffect(() => {
        if (!hasSeenWelcome) {
            const user = authService.getStoredUser();
            if (user?.first_name) setUserName(user.first_name);
            const timer = setTimeout(() => {
                setOpen(true);
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [hasSeenWelcome]);

    const handleStartTour = () => {
        setOpen(false);
        setHasSeenWelcome(true);
        setTimeout(() => {
            startTour(0);
        }, 300);
    };

    const handleDismiss = () => {
        setOpen(false);
        setHasSeenWelcome(true);
    };

    const features = [
        {
            icon: '👶',
            title: 'Registro & Admisión',
            desc: 'Gestiona el ingreso de niños y expedientes completos en segundos.',
        },
        {
            icon: '📊',
            title: 'Seguimiento IDII',
            desc: 'Monitorea el desarrollo infantil con instrumentos MIES integrados.',
        },
        {
            icon: '🥗',
            title: 'Salud & Nutrición',
            desc: 'Control de peso, vacunas, menús y alertas nutricionales automáticas.',
        },
        {
            icon: '🤖',
            title: 'IA Pedagógica',
            desc: 'Agentes IA que asisten en reportes, planificaciones y cumplimiento normativo.',
        },
    ];

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) handleDismiss();
            }}
        >
            <DialogContent className="w-[calc(100%-2rem)] max-w-[560px] sm:w-full sm:max-w-[560px] p-0 overflow-hidden border border-amber-200/30 dark:border-amber-700/30 !bg-white dark:!bg-zinc-950 !opacity-100 shadow-2xl rounded-2xl [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-black/10 [&_[data-slot=dialog-close]]:hover:bg-black/20 [&_[data-slot=dialog-close]]:text-white/80 [&_[data-slot=dialog-close]]:hover:text-white [&_[data-slot=dialog-close]]:p-1.5 [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:right-5">
                {/* Premium Header — KindiCore warm gradient */}
                <div className="relative overflow-hidden pt-6 pb-5 px-6 text-white h-40 flex flex-col justify-end bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500">
                    {/* Glassmorphism decorative orbs */}
                    <div className="absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-orange-300/20 blur-2xl" />
                    <div className="absolute right-12 bottom-4 h-20 w-20 rounded-full bg-yellow-300/15 blur-2xl" />

                    <div className="relative z-10 flex items-start gap-3 w-full">
                        <div className="bg-white/20 p-2.5 rounded-xl border border-white/25 backdrop-blur-md shadow-inner shrink-0">
                            <Baby className="h-6 w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-amber-100">
                                KindiCore AI — Sistema CDI
                            </span>
                            <h2 className="text-2xl font-extrabold leading-tight text-white mt-0.5 break-words">
                                {userName ? `¡Bienvenido/a, ${userName}! 🎉` : '¡Bienvenido a KindiCore AI! 🎉'}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-6 space-y-5">
                    <div className="space-y-1.5">
                        <h3 className="text-lg font-bold text-foreground">
                            Tu sistema operativo para CDIs está listo
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Hemos preparado un tour rápido para que conozcas las principales herramientas.
                            Podrás gestionar niños, reportes MIES, menús y mucho más desde un solo lugar.
                        </p>
                    </div>

                    {/* Features grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {features.map((feature, idx) => (
                            <div
                                key={idx}
                                className="flex gap-2.5 p-3 rounded-xl border border-border/60 bg-amber-50/50 dark:bg-amber-900/10 hover:border-amber-300/60 dark:hover:border-amber-700/40 transition-colors duration-200"
                            >
                                <span className="text-lg shrink-0">{feature.icon}</span>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-foreground">{feature.title}</h4>
                                    <p className="text-muted-foreground mt-0.5 leading-relaxed">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                        <Button
                            onClick={handleStartTour}
                            className="w-full sm:flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md shadow-amber-500/20 h-11 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Iniciar Tour Guiado
                        </Button>
                        <Button
                            onClick={handleDismiss}
                            variant="outline"
                            className="w-full sm:flex-1 border-border/80 hover:bg-muted/50 h-11 rounded-xl"
                        >
                            <Compass className="h-4 w-4 mr-2 text-muted-foreground" />
                            Explorar por mi cuenta
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
