"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    Building2,
    Users,
    Baby,
    DollarSign,
    Plus,
    Calendar,
    AlertCircle,
    CheckCircle,
    Loader2,
    LogOut
} from "lucide-react";
import { superAdminService, type License, type SuperAdminDashboard } from "@/services/super-admin.service";
import { CreateLicenseDialog } from "@/components/super-admin/create-license-dialog";
import { LicenseCard } from "@/components/super-admin/license-card";
import { ProfileDialog } from "@/components/super-admin/profile-dialog";

export function SuperAdminClient() {
    const router = useRouter();
    const [dashboard, setDashboard] = useState<SuperAdminDashboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async (silent = false) => {
        try {
            if (!silent) setIsLoading(true);
            setError(null);
            const data = await superAdminService.getDashboard();
            setDashboard(data);
        } catch (err: any) {
            console.error("Error loading super admin dashboard:", err);
            if (err.response?.status === 403) {
                setError("No tienes permisos de Super Administrador");
                setTimeout(() => router.push("/dashboard"), 2000);
            } else {
                setError("Error al cargar el dashboard");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-lg text-muted-foreground">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">Super Administrador</h1>
                        <p className="text-muted-foreground">Gestión de Licencias y Centros</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <ProfileDialog>
                        <Button variant="outline">
                            <Users className="mr-2 h-4 w-4" />
                            Mi Perfil
                        </Button>
                    </ProfileDialog>
                    <Button variant="outline" onClick={() => {
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('refresh_token');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                        }
                    }}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                    <CreateLicenseDialog onSuccess={() => loadDashboard(true)}>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Licencia
                        </Button>
                    </CreateLicenseDialog>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Licencias Totales</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard?.total_licenses || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-green-600">{dashboard?.active_licenses || 0} activas</span>
                            {" · "}
                            <span className="text-red-600">{dashboard?.expired_licenses || 0} expiradas</span>
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Centros Activos</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard?.total_centers || 0}</div>
                        <p className="text-xs text-muted-foreground">En todas las licencias</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboard?.total_users || 0}</div>
                        <p className="text-xs text-muted-foreground">Coordinadores y personal</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Anuales</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${(dashboard?.total_annual_revenue || 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Total de licencias activas</p>
                    </CardContent>
                </Card>
            </div>

            {/* Licenses List */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Licencias</h2>
                {dashboard?.licenses && dashboard.licenses.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {dashboard.licenses.map((license) => (
                            <LicenseCard
                                key={license.id}
                                license={license}
                                onUpdate={() => loadDashboard(true)}
                            />
                        ))}
                    </div>
                ) : (
                    <Card className="p-8 text-center">
                        <p className="text-muted-foreground">No hay licencias creadas</p>
                        <CreateLicenseDialog onSuccess={() => loadDashboard(true)}>
                            <Button variant="outline" className="mt-4">
                                <Plus className="mr-2 h-4 w-4" />
                                Crear Primera Licencia
                            </Button>
                        </CreateLicenseDialog>
                    </Card>
                )}
            </div>
        </div>
    );
}
