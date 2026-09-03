"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nutritionService, type NutritionRecord } from "@/services/nutrition.service";
import { Loader2, PlusCircle, MoreHorizontal, FileEdit, Trash2, CalendarIcon } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateEditNutritionDialog } from "./create-edit-nutrition-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface NutritionClientProps {
    tenantId?: number;
    readOnly?: boolean;
}

export function NutritionClient({ tenantId, readOnly = false }: NutritionClientProps) {
    const { role, canDelete } = useRole();
    const { toast } = useToast();
    const [records, setRecords] = useState<NutritionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState("");

    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [editingRecord, setEditingRecord] = useState<NutritionRecord | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await nutritionService.getDailyRecords(selectedDate, tenantId);
            setRecords(data);
        } catch (error) {
            console.error(error);
            setRecords([]);
        } finally {
            setIsLoading(false);
        }
    }, [tenantId, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    useAgentRefresh(fetchData);

    const handleEdit = (record: NutritionRecord) => {
        setEditingRecord(record);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingRecord(null);
        setIsDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!recordToDelete) return;
        try {
            await nutritionService.deleteRecord(recordToDelete);
            toast({ title: "Registro eliminado", description: "El registro ha sido eliminado." });
            // Optimistic update
            setRecords(prev => prev.filter(r => r.id !== recordToDelete));
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo eliminar el registro", variant: "destructive" });
        } finally {
            setRecordToDelete(null);
        }
    };

    const getConsumptionColor = (level: string) => {
        switch (level) {
            case 'todo': return 'text-green-500 font-bold';
            case 'la_mayoria': return 'text-green-400';
            case 'la_mitad': return 'text-yellow-500';
            case 'poco': return 'text-orange-500';
            case 'nada': return 'text-red-500 font-bold';
            default: return '';
        }
    };

    const getConsumptionLabel = (level: string) => {
        const labels: Record<string, string> = {
            'todo': 'Todo',
            'la_mayoria': 'La Mayoría',
            'la_mitad': 'La Mitad',
            'poco': 'Poco',
            'nada': 'Nada'
        };
        return labels[level] || level;
    };

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0 pt-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-[180px] bg-background/50 backdrop-blur-sm"
                        />
                    </div>
                    <Input
                        placeholder="Buscar por nombre, cédula o comida..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="max-w-full md:max-w-sm bg-background/50 backdrop-blur-sm"
                    />

                    {!readOnly && (
                        <Button onClick={handleCreate} className="w-full md:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nuevo Registro
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Niño/a</TableHead>
                                    <TableHead>Comida</TableHead>
                                    <TableHead>Consumo</TableHead>
                                    <TableHead>Menú / Notas</TableHead>
                                    {!readOnly && <TableHead className="text-right">Acciones</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    const filteredRecords = records.filter(item => {
                                        if (!filter.trim()) return true;
                                        const q = filter.toLowerCase();
                                        return item.child_name?.toLowerCase().includes(q) || 
                                               item.child_cedula?.toLowerCase().includes(q) ||
                                               item.meal_type?.replace('_', ' ').toLowerCase().includes(q);
                                    });
                                    return filteredRecords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No hay registros que coincidan
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRecords.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-white/5">
                                            <TableCell className="font-medium">{item.child_name}</TableCell>
                                            <TableCell className="capitalize">{item.meal_type.replace('_', ' ')}</TableCell>
                                            <TableCell>
                                                <span className={getConsumptionColor(item.consumption_level)}>
                                                    {getConsumptionLabel(item.consumption_level)} ({item.consumption_percentage ?? item.quantity ?? ''}%)
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    {item.menu_description && <span className="font-medium">{item.menu_description}</span>}
                                                    {item.notes && <span className="text-sm text-muted-foreground">{item.notes}</span>}
                                                </div>
                                            </TableCell>
                                            {!readOnly && (
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                                                <span className="sr-only">Abrir menú</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                                <FileEdit className="mr-2 h-4 w-4" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {canDelete && (
                                                                <DropdownMenuItem className="text-destructive" onClick={() => setRecordToDelete(item.id)}>
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Eliminar
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                );
                                })()}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <CreateEditNutritionDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    recordToEdit={editingRecord}
                    onSuccess={fetchData}
                />

                <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Está seguro de eliminar este registro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. El registro de nutrición será eliminado permanentemente.
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
            </CardContent>
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
