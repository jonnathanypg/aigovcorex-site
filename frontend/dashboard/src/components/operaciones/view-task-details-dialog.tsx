"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type MaintenanceTask } from "@/services/operations.service";

interface ViewTaskDetailsDialogProps {
    task: MaintenanceTask | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewTaskDetailsDialog({ task, open, onOpenChange }: ViewTaskDetailsDialogProps) {
    if (!task) return null;

    const statusVariantMap: { [key: string]: "default" | "secondary" | "outline" } = {
        "Completado": "default",
        "En Progreso": "secondary",
        "Pendiente": "outline",
    };

    const priorityColors: { [key: string]: string } = {
        "Alta": "text-red-500",
        "Critica": "text-red-600 font-bold",
        "Media": "text-yellow-500",
        "Baja": "text-green-500",
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle>Detalles de la Tarea</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID</label>
                            <p className="font-mono text-sm">{task.id}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</label>
                            <div>
                                <Badge variant={statusVariantMap[task.status] || 'secondary'}>
                                    {task.status}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descripción</label>
                        <p className="text-sm">{task.task}</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Centro</label>
                            <p className="text-sm">{task.center}</p>
                        </div>
                        {task.center_area && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Área del Centro</label>
                                <p className="text-sm capitalize">{task.center_area}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asignado a</label>
                            <p className="text-sm">{task.assignedTo}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prioridad</label>
                            <p className={`text-sm capitalize ${priorityColors[task.priority] || ''}`}>{task.priority}</p>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                        {task.date_created && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Creación</label>
                                <p className="text-sm">{new Date(task.date_created).toLocaleDateString('es-EC')}</p>
                            </div>
                        )}
                        {task.date_due && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha Límite</label>
                                <p className="text-sm">{new Date(task.date_due).toLocaleDateString('es-EC')}</p>
                            </div>
                        )}
                    </div>

                    {task.notes && (
                        <>
                            <Separator />
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notas Adicionales</label>
                                <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
