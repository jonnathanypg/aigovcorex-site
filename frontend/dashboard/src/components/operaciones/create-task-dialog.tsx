"use client";

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { operationsService } from "@/services/operations.service";
import { licenseAdminService, type LicenseUser, type Center } from "@/services/license-admin.service";
import { useRole } from "@/hooks/use-role";

interface CreateTaskDialogProps {
    children?: React.ReactNode;
    taskToEdit?: any | null;
    onSuccess?: () => void;
    onClose?: () => void;
}

const PRIORITIES = [
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Media' },
    { value: 'baja', label: 'Baja' },
];

export function CreateTaskDialog({ children, taskToEdit, onSuccess, onClose }: CreateTaskDialogProps) {
    const { role } = useRole();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isEditMode = !!taskToEdit;

    // Form state
    const [task, setTask] = useState("");
    const [centerArea, setCenterArea] = useState("");
    const [selectedCenterId, setSelectedCenterId] = useState<string>("");
    const [assignedToId, setAssignedToId] = useState<string>("");
    const [priority, setPriority] = useState("media");
    const [dateDue, setDateDue] = useState("");
    const [notes, setNotes] = useState("");

    // Data state
    const [centers, setCenters] = useState<Center[]>([]);
    const [availableUsers, setAvailableUsers] = useState<LicenseUser[]>([]);

    // Auto-open when taskToEdit is provided
    useEffect(() => {
        if (taskToEdit) {
            setIsOpen(true);
            // Prefill form
            setTask(taskToEdit.task || '');
            setCenterArea(taskToEdit.center_area || '');
            setSelectedCenterId(taskToEdit.center_id?.toString() || '');
            setAssignedToId(taskToEdit.assigned_to_id?.toString() || '');
            setPriority(taskToEdit.priority?.toLowerCase() || 'media');
            setDateDue(taskToEdit.date_due || '');
        }
    }, [taskToEdit]);

    useEffect(() => {
        if (isOpen) {
            setupInitialData();
        }
    }, [isOpen]);

    // Fetch users when center changes (for license admin)
    useEffect(() => {
        if (selectedCenterId && role === 'license_admin') {
            loadUsersForCenter(parseInt(selectedCenterId));
        }
    }, [selectedCenterId, role]);

    const setupInitialData = async () => {
        if (role === 'license_admin') {
            try {
                const centersData = await licenseAdminService.getCenters();
                setCenters(centersData);
            } catch (err) {
                console.error("Error loading centers", err);
            }
        } else if (role === 'coordinator') {
            // Pre-select current center or just load users for current context
            // Assuming tenant object from useRole or context has id?
            // If not available, fetch users without center_id (backend uses context)
            loadUsersForCenter();
        }
    };

    const loadUsersForCenter = async (centerId?: number) => {
        try {

            if (role === 'license_admin') {
                const users = await licenseAdminService.getUsers(centerId);
                setAvailableUsers(users);
            } else {
                // For coordinator, use operationsService which calls /users/
                const users = await operationsService.getUsers();
                setAvailableUsers(users);
            }
        } catch (err) {
            console.error("Error loading users", err);
        }
    };

    const resetForm = () => {
        setTask("");
        setCenterArea("");
        setAssignedToId("");
        setSelectedCenterId("");
        setPriority("media");
        setDateDue("");
        setNotes("");
        setAvailableUsers([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task) return;

        setIsLoading(true);
        try {
            if (isEditMode && taskToEdit) {
                // Update existing task
                await operationsService.update(taskToEdit.id, {
                    task,
                    center_area: centerArea,
                    assigned_to_id: assignedToId ? parseInt(assignedToId) : undefined,
                    priority,
                    date_due: dateDue,
                });
            } else {
                // Create new task
                await operationsService.create({
                    task,
                    center_area: centerArea,
                    center_id: role === 'license_admin' ? parseInt(selectedCenterId) : undefined,
                    assigned_to_id: assignedToId ? parseInt(assignedToId) : undefined,
                    priority,
                    date_due: dateDue,
                    notes,
                    status: 'Pendiente'
                });
            }

            setIsOpen(false);
            resetForm();
            onClose?.();
            onSuccess?.();
        } catch (error) {
            console.error(isEditMode ? "Error updating task:" : "Error creating task:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        resetForm();
        onClose?.();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(open); }}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Editar Tarea' : 'Nueva Tarea de Mantenimiento'}</DialogTitle>
                    <DialogDescription>
                        Registre una nueva tarea de mantenimiento u operación.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="task">Descripción de la Tarea *</Label>
                        <Textarea
                            id="task"
                            placeholder="Describa la tarea a realizar..."
                            value={task}
                            onChange={(e) => setTask(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {role === 'license_admin' && (
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="center">Centro *</Label>
                                <Select value={selectedCenterId} onValueChange={setSelectedCenterId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Centro" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {centers.map(center => (
                                            <SelectItem key={center.id} value={center.id.toString()}>
                                                {center.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="centerArea">Área del Centro</Label>
                            <Select value={centerArea} onValueChange={setCenterArea}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar área" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="aulas">Aulas</SelectItem>
                                    <SelectItem value="cocina">Cocina</SelectItem>
                                    <SelectItem value="baños">Baños</SelectItem>
                                    <SelectItem value="patio">Patio</SelectItem>
                                    <SelectItem value="oficina">Oficina</SelectItem>
                                    <SelectItem value="bodega">Bodega</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="assignedTo">Asignado a</Label>
                            <Select value={assignedToId} onValueChange={setAssignedToId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar Responsable" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUsers.map(user => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                            {user.first_name} {user.last_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="priority">Prioridad</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORITIES.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dateDue">Fecha Límite</Label>
                            <Input
                                id="dateDue"
                                type="date"
                                value={dateDue}
                                onChange={(e) => setDateDue(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas Adicionales</Label>
                        <Textarea
                            id="notes"
                            placeholder="Observaciones..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading || !task || (!isEditMode && role === 'license_admin' && !selectedCenterId)}>
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditMode ? 'Actualizando...' : 'Guardando...'}</>
                            ) : (
                                isEditMode ? "Actualizar Tarea" : "Crear Tarea"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
