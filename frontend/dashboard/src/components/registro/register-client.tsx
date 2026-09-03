"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { MoreHorizontal, FileEdit, Trash2, UserPlus, Loader2, Users, TrendingUp, FileDown } from "lucide-react";
import { Input } from "../ui/input";
import { useRole } from "@/hooks/use-role";
import { CreateEditChildDialog } from "./create-edit-child-dialog";
import { RepresentativesEditDialog } from "./representatives-edit-dialog";
import { GrowthChartDialog } from "./growth-chart-dialog";
import { childrenService } from "@/services/children.service";
import { reportsService } from "@/services/reports.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import type { Child } from "@/types";
import type { ChildRecordFormValues } from "./child-record-form";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const statusVariantMap: { [key: string]: "default" | "outline" | "secondary" | "destructive" } = {
    activo: "default",
    inactivo: "outline",
    egresado: "secondary",
    lista_espera: "outline",
    eliminado: "destructive",
};

const statusLabelMap: { [key: string]: string } = {
    activo: "Activo",
    inactivo: "Inactivo",
    egresado: "Egresado",
    lista_espera: "Lista de Espera",
    eliminado: "Eliminado",
};

interface RegisterClientProps {
    readOnly?: boolean;
    tenantId?: number;
}

export function RegisterClient({ readOnly = false, tenantId }: RegisterClientProps) {
    const { role, center, canDelete } = useRole();
    const { toast } = useToast();
    const [records, setRecords] = useState<Child[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("activo");

    // Edit Dialog State
    const [editingChild, setEditingChild] = useState<Child | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Reps Dialog State
    const [repsChild, setRepsChild] = useState<Child | null>(null);
    const [isRepsDialogOpen, setIsRepsDialogOpen] = useState(false);

    // Growth Chart Dialog State
    const [growthChild, setGrowthChild] = useState<Child | null>(null);
    const [isGrowthDialogOpen, setIsGrowthDialogOpen] = useState(false);

    const loadChildren = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await childrenService.getAll({
                status: statusFilter,
                tenantId
            });
            setRecords(data);
        } catch (error) {
            console.error("Error loading children:", error);
            toast({ title: "Error", description: "No se pudieron cargar los registros", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, tenantId, toast]);

    useEffect(() => {
        loadChildren();
    }, [loadChildren]);
    useAgentRefresh(loadChildren);

    const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

    const handleSaveRecord = async (data: ChildRecordFormValues) => {
        try {
            if (editingChild) {
                await childrenService.update(editingChild.id, data);
                toast({ title: "Actualizado", description: "Registro actualizado correctamente" });
            } else {
                await childrenService.create(data);
                toast({ title: "Creado", description: "Registro creado correctamente" });
            }
            loadChildren();
            setIsEditDialogOpen(false);
            setEditingChild(null);
        } catch (error: any) {
            console.error(error);
            const backendMsg = error.response?.data?.error;
            toast({ title: "Error", description: backendMsg || "No se pudo guardar el registro", variant: "destructive" });
        }
    };

    const confirmDelete = async () => {
        if (!recordToDelete) return;
        try {
            await childrenService.delete(recordToDelete);
            toast({ title: "Eliminado", description: "Niño/a eliminado correctamente" });
            // Optimistic update
            setRecords(prev => prev.filter(r => r.id !== recordToDelete));
        } catch (error: any) {
            console.error("Error deleting child:", error);
            toast({
                title: "Error",
                description: error.response?.data?.error || "No se pudo eliminar el registro",
                variant: "destructive"
            });
        } finally {
            setRecordToDelete(null);
        }
    };

    const openEdit = (child: Child) => {
        setEditingChild(child);
        setIsEditDialogOpen(true);
    };

    const openCreate = () => {
        setEditingChild(null);
        setIsEditDialogOpen(true);
    };

    const openReps = (child: Child) => {
        setRepsChild(child);
        setIsRepsDialogOpen(true);
    };

    const openGrowthChart = (child: Child) => {
        setGrowthChild(child);
        setIsGrowthDialogOpen(true);
    };

    const handleExportMatrix = async () => {
        try {
            toast({ title: "Generando...", description: "Estamos preparando la matriz de datos de los niños" });
            const response = await reportsService.generate({
                report_type: 'ninos_matriz',
                start_date: new Date().toISOString().split('T')[0], // Not used for matrix but required
                end_date: new Date().toISOString().split('T')[0],
                export_format: 'excel'
            }, tenantId);

            if (response.report.id) {
                const blob = await reportsService.download(response.report.id);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Matriz_Ninos_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast({ title: "Éxito", description: "Matriz exportada correctamente" });
            }
        } catch (error: any) {
            console.error("Error exporting matrix:", error);
            toast({ 
                title: "Error", 
                description: error.response?.data?.error || "No se pudo generar la matriz", 
                variant: "destructive" 
            });
        }
    };

    const filteredRecords = records.filter(
        (record) => {
            const searchLower = filter.toLowerCase();
            return (
                record.full_name.toLowerCase().includes(searchLower) ||
                (record.cedula && record.cedula.includes(searchLower))
            );
        }
    );

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
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:max-w-xl">
                        <Input
                            placeholder="Buscar por nombre o cédula..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-background/50 flex-1"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[160px] bg-background/50">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="inactivo">Inactivos</SelectItem>
                                <SelectItem value="egresado">Egresados</SelectItem>
                                <SelectItem value="lista_espera">Lista de Espera</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportMatrix} className="border-primary/20 hover:bg-primary/5 text-primary">
                            <FileDown className="mr-2 h-4 w-4" /> Exportar Matriz
                        </Button>
                        {!readOnly && (
                            <Button onClick={openCreate} className="w-full md:w-auto">
                                <UserPlus className="mr-2 h-4 w-4" /> Nuevo Registro
                            </Button>
                        )}
                    </div>
                </div>

                <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
                    <Table>
                        <TableHeader>
                            <TableRow className="hidden md:table-row hover:bg-transparent">
                                <TableHead>Cédula Identidad</TableHead>
                                <TableHead>Nombre Completo</TableHead>
                                <TableHead>Edad</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4">No se encontraron registros</TableCell>
                                </TableRow>
                            ) : filteredRecords.map((record) => (
                                <React.Fragment key={record.id}>
                                    <TableRow className="md:hidden flex flex-col p-4 space-y-2 border-b border-border/10">
                                        <TableCell>
                                            <div className="font-medium text-base">{record.full_name}</div>
                                            <div className="text-sm text-muted-foreground">{record.cedula || 'S/C'}</div>
                                        </TableCell>
                                        <TableCell><span className="font-semibold md:hidden mr-2">Edad:</span>{record.age_display}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariantMap[record.status] || 'default'}>
                                                {statusLabelMap[record.status] || record.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-left md:text-right">
                                            {!readOnly && (
                                                <div className="flex gap-2 mt-2">
                                                    <Button variant="outline" size="sm" onClick={() => openEdit(record)}>
                                                        Editar
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="hidden md:table-row hover:bg-white/5">
                                        <TableCell className="font-medium">{record.cedula || 'S/C'}</TableCell>
                                        <TableCell>{record.full_name}</TableCell>
                                        <TableCell>{record.age_display}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariantMap[record.status] || 'default'}>
                                                {statusLabelMap[record.status] || record.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!readOnly && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                                            <span className="sr-only">Abrir menú</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-background/80 backdrop-blur-lg border-border/30">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => openEdit(record)}>
                                                            <FileEdit className="mr-2 h-4 w-4" /> Editar Información
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openReps(record)}>
                                                            <Users className="mr-2 h-4 w-4" /> Representantes
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openGrowthChart(record)}>
                                                            <TrendingUp className="mr-2 h-4 w-4" /> Curvas de Crecimiento
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {canDelete && (
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setRecordToDelete(record.id)}>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Eliminar Registro
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <CreateEditChildDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onSave={handleSaveRecord}
                recordToEdit={editingChild}
            />

            {repsChild && (
                <RepresentativesEditDialog
                    open={isRepsDialogOpen}
                    onOpenChange={setIsRepsDialogOpen}
                    child={repsChild}
                />
            )}

            <GrowthChartDialog
                open={isGrowthDialogOpen}
                onOpenChange={setIsGrowthDialogOpen}
                child={growthChild}
            />

            <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar este niño/a?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el registro del niño/a, incluyendo su historial de asistencia, salud, nutrición e hitos. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

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
