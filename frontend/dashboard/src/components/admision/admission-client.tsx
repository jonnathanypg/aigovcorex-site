"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserPlus, Check, X, Loader2, FileText, Pencil, Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { useRole } from "@/hooks/use-role";
import { applicationsService, type Application } from "@/services/applications.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateApplicationDialog } from "./create-application-dialog";
import { ViewApplicationDialog } from "./view-application-dialog";
import { toast } from "@/hooks/use-toast";

const statusVariantMap: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
    approved: "default",
    pending: "outline",
    waitlist: "secondary",
    rejected: "destructive",
};

const statusLabelMap: { [key: string]: string } = {
    approved: "Aprobado",
    pending: "Pendiente",
    waitlist: "Lista de Espera",
    rejected: "Rechazado"
};

export function AdmissionClient() {
    const { role, center } = useRole();
    const [admissions, setAdmissions] = useState<Application[]>([]);
    const [filter, setFilter] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // State for dialogs
    const [viewId, setViewId] = useState<number | null>(null);
    const [editId, setEditId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await applicationsService.getAll();
            setAdmissions(data);
        } catch (error) {
            console.error("Error loading admissions:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    useAgentRefresh(fetchData);

    const handleStatusChange = async (id: number, newStatus: string) => {
        try {
            if (newStatus === 'approved') {
                await applicationsService.approve(id);
            } else if (newStatus === 'rejected') {
                await applicationsService.reject(id);
            } else if (newStatus === 'waitlist') {
                await applicationsService.waitlist(id);
            }
            // Refresh data after status change
            await fetchData();
            toast({
                title: "Estado actualizado",
                description: "El estado de la postulación ha sido actualizado.",
            });
        } catch (error) {
            console.error("Error changing status:", error);
            toast({
                title: "Error",
                description: "No se pudo actualizar el estado.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await applicationsService.delete(id);
            toast({
                title: "Eliminado",
                description: "La postulación ha sido eliminada correctamente.",
            });
            await fetchData();
        } catch (error: any) {
            console.error("Error deleting application:", error);
            const message = error.message || "No se pudo eliminar la postulación.";
            // Try to extract response error if available (assuming axios-like structure)
            const serverError = error.response?.data?.error || message;

            toast({
                title: "Error",
                description: serverError,
                variant: "destructive",
            });
        }
    };

    const filteredAdmissions = admissions.filter(
        (admission) => {
            const q = filter.toLowerCase();
            const statusLabel = statusLabelMap[admission.status] || admission.status;
            return admission.child_name.toLowerCase().includes(q) ||
                admission.child_cedula?.toLowerCase().includes(q) ||
                String(admission.id).includes(filter) ||
                statusLabel.toLowerCase().includes(q);
        }
    );

    const renderActionsMenu = (admission: Application) => {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10 text-muted-foreground hover:text-foreground">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-lg border-border/30">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleStatusChange(admission.id, "approved")}>
                        <Check className="mr-2 h-4 w-4 text-green-500" />
                        Aprobar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(admission.id, "waitlist")}>
                        <MoreHorizontal className="mr-2 h-4 w-4 text-yellow-500" />
                        Poner en Lista de Espera
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(admission.id, "rejected")}>
                        <X className="mr-2 h-4 w-4 text-destructive" />
                        <span className="text-destructive">Rechazar</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setViewId(admission.id)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Ficha Completa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditId(admission.id)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDelete(admission.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6 flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                    <Input
                        placeholder="Buscar por nombre, cédula, ID o estado..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="max-w-full md:max-w-sm bg-background/50"
                    />
                    <CreateApplicationDialog onSuccess={fetchData}>
                        <Button className="w-full md:w-auto">
                            <UserPlus className="mr-2" />
                            Nueva Postulación
                        </Button>
                    </CreateApplicationDialog>
                </div>
                <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hidden md:table-row hover:bg-transparent">
                                    <TableHead>Niño/a</TableHead>
                                    <TableHead>Edad (Meses)</TableHead>
                                    <TableHead>Fecha Postulación</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAdmissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4">No hay postulaciones registradas</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAdmissions.map((admission) => (
                                        <React.Fragment key={admission.id}>
                                            <TableRow className="md:hidden flex flex-col p-4 space-y-2 border-b border-border/10">
                                                <TableCell>
                                                    <div className="font-medium text-base">{admission.child_name}</div>
                                                    <div className="text-sm text-muted-foreground">ID: {admission.id}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-semibold text-muted-foreground md:hidden mr-2">Edad:</span>
                                                    {admission.child_age_months} meses
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-semibold text-muted-foreground md:hidden mr-2">Fecha:</span>
                                                    {admission.application_date}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-semibold text-muted-foreground md:hidden mr-2">Estado:</span>
                                                    <Badge variant={statusVariantMap[admission.status] || 'secondary'}>
                                                        {statusLabelMap[admission.status] || admission.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-left md:text-right pt-2">
                                                    {renderActionsMenu(admission)}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow className="hidden md:table-row hover:bg-white/5">
                                                <TableCell>
                                                    <div className="font-medium">{admission.child_name}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        ID: {admission.id}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{admission.child_age_months} meses</TableCell>
                                                <TableCell>{admission.application_date}</TableCell>
                                                <TableCell>
                                                    <Badge variant={statusVariantMap[admission.status] || 'secondary'}>
                                                        {statusLabelMap[admission.status] || admission.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {renderActionsMenu(admission)}
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    )))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>

            {/* Dialogs */}
            <ViewApplicationDialog
                open={!!viewId}
                applicationId={viewId}
                onOpenChange={(open) => !open && setViewId(null)}
            />

            <CreateApplicationDialog
                open={!!editId}
                applicationId={editId}
                onOpenChange={(open) => !open && setEditId(null)}
                onSuccess={() => {
                    setEditId(null);
                    fetchData();
                    toast({
                        title: "Éxito",
                        description: "Postulación actualizada correctamente.",
                    });
                }}
            />
        </Card>
    );
}