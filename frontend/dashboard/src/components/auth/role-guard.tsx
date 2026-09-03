"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { useLicense } from '@/contexts/license-context';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    requiredModule?: string;
    redirectTo?: string;
}

/**
 * RoleGuard - Restricts access to routes based on user role AND module licensing.
 * If user does not have permission or module is not in their license, access is blocked.
 */
export function RoleGuard({
    children,
    allowedRoles,
    requiredModule,
    redirectTo = '/dashboard'
}: RoleGuardProps) {
    const router = useRouter();
    const { hasModule, isSuperAdmin, isLoading: licenseLoading } = useLicense();
    const [authorized, setAuthorized] = useState(false);
    const [moduleDenied, setModuleDenied] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = authService.getStoredUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;

            // 1. Check module access if requiredModule is provided
            if (requiredModule && !isSuperAdmin && !hasModule(requiredModule)) {
                console.warn(`[RoleGuard] Module access denied. Module '${requiredModule}' not enabled in license.`);
                setModuleDenied(true);
                setAuthorized(false);
                setChecking(false);
                return;
            }

            // 2. Check role access if allowedRoles is provided
            if (!allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(roleName) || roleName === 'super_admin') {
                setAuthorized(true);
            } else {
                console.warn(`[RoleGuard] Access denied. Role '${roleName}' not in allowed: [${allowedRoles.join(', ')}]`);
                router.push(redirectTo);
            }
            setChecking(false);
        }
    }, [router, allowedRoles, requiredModule, redirectTo, hasModule, isSuperAdmin]);

    if (checking || licenseLoading) {
        return (
            <div className="h-96 w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (moduleDenied) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[450px] p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                    <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                    <h2 className="text-xl font-bold text-foreground">Módulo No Habilitado</h2>
                    <p className="text-sm text-muted-foreground">
                        Tu organización no tiene habilitado el módulo <strong>{requiredModule}</strong> en su licencia activa de AI GovCoreX OS.
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                        Contacta a tu Administrador de Licencia o al Super Administrador para solicitar la ampliación del alcance modular.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Dashboard
                </Button>
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="h-96 w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <>{children}</>;
}
