"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { PlusCircle, Loader2, MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { operationsService, type MaintenanceTask } from "@/services/operations.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateTaskDialog } from "./create-task-dialog";
import { ViewTaskDetailsDialog } from "./view-task-details-dialog";
import { toast } from "sonner";

const statusColorMap: { [key: string]: string } = {
  "Completado": "bg-green-100 text-green-800 hover:bg-green-100/80 border-green-200",
  "En Progreso": "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 border-yellow-200",
  "Pendiente": "bg-red-100 text-red-800 hover:bg-red-100/80 border-red-200",
};

const STATUS_OPTIONS = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En Progreso', label: 'En Progreso' },
  { value: 'Completado', label: 'Completado' },
];

const priorityColors: { [key: string]: string } = {
  "Alta": "text-red-500",
  "Critica": "text-red-600 font-bold",
  "Media": "text-yellow-500",
  "Baja": "text-green-500",
};

interface OperationsClientProps {
  tenantId?: number;
}

export function OperationsClient({ tenantId }: OperationsClientProps) {
  const { role, userId } = useRole();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [taskToView, setTaskToView] = useState<MaintenanceTask | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<MaintenanceTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permission checks based on actual user role
  const isLicenseAdmin = role === 'license_admin';
  const isCoordinator = role === 'coordinator';
  const canCreate = isLicenseAdmin || isCoordinator;
  const canEditTask = isLicenseAdmin || isCoordinator;
  const canDelete = isLicenseAdmin;

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await operationsService.getAll(tenantId);
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);
  useAgentRefresh(fetchTasks);

  const handleStatusChange = async (task: MaintenanceTask, newStatus: string) => {
    setUpdatingTaskId(task.id);
    try {
      await operationsService.update(task.id, { status: newStatus });
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: newStatus as MaintenanceTask['status'] } : t
      ));
      toast.success("Estado actualizado");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "No tiene permiso para actualizar esta tarea");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;

    setIsDeleting(true);
    try {
      await operationsService.delete(taskToDelete);
      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
      toast.success("Tarea eliminada exitosamente");
      setTaskToDelete(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error al eliminar tarea");
    } finally {
      setIsDeleting(false);
    }
  };

  // Only assignee or admins/coordinators can update status
  const canUpdateStatus = (task: MaintenanceTask) => {
    if (canEditTask) return true;
    return task.assigned_to_id === userId;
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
        {canCreate && (
          <div className="flex justify-end mb-4">
            <CreateTaskDialog
              onSuccess={() => {
                fetchTasks();
              }}
            >
              <Button><PlusCircle className="mr-2 h-4 w-4" /> Nueva Tarea</Button>
            </CreateTaskDialog>
          </div>
        )}

        {/* Edit Task Dialog (opened from three-dot menu) */}
        {taskToEdit && (
          <CreateTaskDialog
            taskToEdit={taskToEdit}
            onSuccess={() => {
              fetchTasks();
              setTaskToEdit(null);
            }}
            onClose={() => setTaskToEdit(null)}
          />
        )}

        <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
          <Table>
            <TableHeader>
              <TableRow className="hidden md:table-row hover:bg-transparent">
                <TableHead>ID</TableHead>
                <TableHead>Tarea</TableHead>
                {isLicenseAdmin && <TableHead>Centro</TableHead>}
                <TableHead>Área</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>F. Límite</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isLicenseAdmin ? 8 : 7} className="text-center py-4">No hay tareas de mantenimiento</TableCell>
                </TableRow>
              ) : (
                tasks.map((item) => (
                  <React.Fragment key={item.id}>
                    {/* Mobile View */}
                    <TableRow className="md:hidden flex flex-col p-4 space-y-2 border-b border-border/10">
                      <TableCell className="font-mono text-xs"><span className="font-semibold text-sm mr-2">ID:</span>{item.id}</TableCell>
                      <TableCell className="font-medium text-base">{item.task}</TableCell>
                      {isLicenseAdmin && <TableCell><span className="font-semibold mr-2">Centro:</span>{item.center}</TableCell>}
                      {item.center_area && <TableCell><span className="font-semibold mr-2">Área:</span><span className="capitalize">{item.center_area}</span></TableCell>}
                      <TableCell><span className="font-semibold mr-2">Prioridad:</span><span className={priorityColors[item.priority] || ''}>{item.priority}</span></TableCell>
                      {item.date_due && <TableCell><span className="font-semibold mr-2">F. Límite:</span>{new Date(item.date_due).toLocaleDateString('es-EC')}</TableCell>}
                      <TableCell>
                        <span className="font-semibold mr-2">Estado:</span>
                        {canUpdateStatus(item) ? (
                          <Select
                            value={item.status}
                            onValueChange={(value) => handleStatusChange(item, value)}
                            disabled={updatingTaskId === item.id}
                          >
                            <SelectTrigger className={`w-[140px] inline-flex ${statusColorMap[item.status] || ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={statusColorMap[item.status] || ''}>
                            {item.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setTaskToView(item)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalles
                            </DropdownMenuItem>
                            {canEditTask && (
                              <DropdownMenuItem onClick={() => setTaskToEdit(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setTaskToDelete(item.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {/* Desktop View */}
                    <TableRow className="hidden md:table-row hover:bg-white/5">
                      <TableCell className="font-mono text-xs">{item.id}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{item.task}</TableCell>
                      {isLicenseAdmin && <TableCell>{item.center}</TableCell>}
                      <TableCell className="capitalize">{item.center_area || '-'}</TableCell>
                      <TableCell><span className={priorityColors[item.priority] || ''}>{item.priority}</span></TableCell>
                      <TableCell>{item.date_due ? new Date(item.date_due).toLocaleDateString('es-EC') : '-'}</TableCell>
                      <TableCell>
                        {canUpdateStatus(item) ? (
                          <Select
                            value={item.status}
                            onValueChange={(value) => handleStatusChange(item, value)}
                            disabled={updatingTaskId === item.id}
                          >
                            <SelectTrigger className={`w-[140px] ${statusColorMap[item.status] || ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={statusColorMap[item.status] || ''}>
                            {item.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setTaskToView(item)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalles
                            </DropdownMenuItem>
                            {canEditTask && (
                              <DropdownMenuItem onClick={() => setTaskToEdit(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setTaskToDelete(item.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* View Task Details Dialog */}
        <ViewTaskDetailsDialog
          task={taskToView}
          open={!!taskToView}
          onOpenChange={(open) => !open && setTaskToView(null)}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente esta tarea. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}