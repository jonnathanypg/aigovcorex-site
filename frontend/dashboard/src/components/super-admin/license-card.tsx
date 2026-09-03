"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2,
    Calendar,
    DollarSign,
    MoreVertical,
    Pencil,
    Trash2,
    UserPlus,
    AlertTriangle
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { superAdminService, type License } from "@/services/super-admin.service";
import { EditLicenseDialog } from "./edit-license-dialog";
import { AssignAdminDialog } from "./assign-admin-dialog";

interface LicenseCardProps {
    license: License;
    onUpdate: () => void;
}

export function LicenseCard({ license, onUpdate }: LicenseCardProps) {
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const getStatusBadge = () => {
        if (license.is_expired) {
            return <Badge variant="destructive">Expirada</Badge>;
        }
        if (license.status === 'suspended') {
            return <Badge variant="secondary">Suspendida</Badge>;
        }
        if (license.is_active) {
            return <Badge className="bg-green-600">Activa</Badge>;
        }
        return <Badge variant="outline">{license.status}</Badge>;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await superAdminService.deleteLicense(license.id);
            setShowDeleteDialog(false);
            onUpdate();
        } catch (err: any) {
            console.error("Error deleting license:", err);
            alert(err.response?.data?.error || "Error al eliminar la licencia");
        } finally {
            setIsDeleting(false);
        }
    };

    const canDelete = license.active_centers === 0;

    return (
        <>
            <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-lg">{license.name}</CardTitle>
                            {license.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {license.description}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {getStatusBadge()}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setShowAssignDialog(true)}>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Asignar Admin
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => setShowDeleteDialog(true)}
                                        className="text-destructive"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Centers Progress */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                Centros
                            </span>
                            <span className="font-medium">
                                {license.active_centers} / {license.max_centers}
                            </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{
                                    width: `${(license.active_centers / license.max_centers) * 100}%`
                                }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {license.available_centers} disponibles
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Vigencia:</span>
                        </div>
                        <span className="text-right">
                            {formatDate(license.end_date)}
                        </span>

                        {license.annual_cost && (
                            <>
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Costo Anual:</span>
                                </div>
                                <span className="text-right font-medium">
                                    ${license.annual_cost.toLocaleString()}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Enabled Modules Chips */}
                    <div className="pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Módulos Activos</span>
                            <span>{license.enabled_modules?.length || 5} de 5</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {[
                                { id: 'kindicore', label: 'KindiCore', color: '#f97316' },
                                { id: 'social', label: 'Social', color: '#0ea5e9' },
                                { id: 'geo', label: 'GeoInt', color: '#10b981' },
                                { id: 'channels', label: 'Canales', color: '#8b5cf6' },
                                { id: 'copilot', label: 'Copiloto', color: '#ec4899' },
                            ].map(m => {
                                const isEnabled = !license.enabled_modules || license.enabled_modules.includes(m.id);
                                return (
                                    <span
                                        key={m.id}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
                                        style={{
                                            background: isEnabled ? `${m.color}18` : 'rgba(255,255,255,0.04)',
                                            color: isEnabled ? m.color : 'rgba(255,255,255,0.25)',
                                            border: `1px solid ${isEnabled ? m.color + '40' : 'rgba(255,255,255,0.06)'}`,
                                            textDecoration: isEnabled ? 'none' : 'line-through'
                                        }}
                                        title={isEnabled ? `Módulo ${m.label} habilitado` : `Módulo ${m.label} inactivo`}
                                    >
                                        {m.label}
                                    </span>
                                );
                            })}
                        </div>
                        {license.public_org_slug && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono">
                                <span className="text-primary font-bold">Web Widget:</span>
                                <span className="truncate">/api/public/chat/{license.public_org_slug}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <EditLicenseDialog
                license={license}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                onSuccess={onUpdate}
            />

            {/* Assign Admin Dialog */}
            <AssignAdminDialog
                licenseId={license.id}
                licenseName={license.name}
                open={showAssignDialog}
                onOpenChange={setShowAssignDialog}
                onSuccess={onUpdate}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Eliminar Licencia
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Está seguro de eliminar la licencia <strong>{license.name}</strong>?
                            <br />
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
