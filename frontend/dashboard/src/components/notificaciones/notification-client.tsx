"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bell, CheckCheck, Info, AlertTriangle, FileText, Loader2, Plus, Trash2, User, MapPin, Calendar, Globe, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { notificationsService, type Notification } from "@/services/notifications.service";
import { useRole } from "@/hooks/use-role";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { toast } from "sonner";

import { licenseAdminService } from "@/services/license-admin.service";

const iconMap: { [key: string]: React.ElementType } = {
    "Alerta": AlertTriangle,
    "Reporte": FileText,
    "Info": Info,
    "Aviso": Bell,
};

const colorMap: { [key: string]: string } = {
    "Alerta": "text-red-500",
    "Reporte": "text-blue-500",
    "Info": "text-sky-500",
    "Aviso": "text-yellow-500",
};

const badgeColorMap: { [key: string]: string } = {
    "Alerta": "bg-red-100 text-red-700 border-red-200",
    "Reporte": "bg-blue-100 text-blue-700 border-blue-200",
    "Info": "bg-sky-100 text-sky-700 border-sky-200",
    "Aviso": "bg-yellow-100 text-yellow-700 border-yellow-200",
};

interface NotificationClientProps {
    tenantId?: number;
}

export function NotificationClient({ tenantId }: NotificationClientProps) {
    const { role, userId } = useRole();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

    // Create form state
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newType, setNewType] = useState("Info");

    // License Admin Global State
    const [centers, setCenters] = useState<{ id: number, name: string }[]>([]);
    const [selectedCenterIds, setSelectedCenterIds] = useState<number[]>([]);
    const [allCentersSelected, setAllCentersSelected] = useState(false);

    // Scheduling state
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");

    const isGlobal = !tenantId;
    const canDeleteAny = ['coordinator', 'license_admin', 'super_admin'].includes(role);
    const isLicenseAdmin = role === 'license_admin';

    useEffect(() => {
        fetchNotifications();
    }, [tenantId]);

    useEffect(() => {
        if (isLicenseAdmin && isGlobal) {
            fetchCenters();
        }
    }, [isLicenseAdmin, isGlobal]);

    const fetchCenters = async () => {
        try {
            const data = await licenseAdminService.getCenters();
            setCenters(data);
        } catch (error) {
            console.error("Error fetching centers:", error);
        }
    };

    const fetchNotifications = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await notificationsService.getAll(tenantId);
            setNotifications(data);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);
    useAgentRefresh(fetchNotifications);

    const handleCreate = async () => {
        if (!newTitle.trim()) {
            toast.error("El título es obligatorio");
            return;
        }

        // License admin in global view can select multiple centers
        let targetTenantId = tenantId;
        let targetTenants: number[] | undefined = undefined;

        if (isGlobal && isLicenseAdmin) {
            if (allCentersSelected) {
                targetTenants = centers.map(c => c.id);
            } else if (selectedCenterIds.length > 0) {
                targetTenants = selectedCenterIds;
            } else {
                toast.error("Debe seleccionar al menos un centro");
                return;
            }
            // Use the first one as primary if available
            targetTenantId = targetTenants[0];
        }

        if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
            toast.error('La fecha/hora de "Ocultar en" debe ser posterior a "Mostrar desde".');
            return;
        }

        setIsCreating(true);
        try {
            const startAtUtc = startAt ? new Date(startAt).toISOString() : undefined;
            const endAtUtc = endAt ? new Date(endAt).toISOString() : undefined;
            await notificationsService.create({
                title: newTitle.trim(),
                description: newDescription.trim(),
                type: newType,
                start_at: startAtUtc,
                end_at: endAtUtc,
                target_tenants: targetTenants
            }, targetTenantId);

            toast.success("Notificación creada exitosamente");
            setNewTitle("");
            setNewDescription("");
            setNewType("Info");
            setSelectedCenterIds([]);
            setAllCentersSelected(false);
            setStartAt("");
            setEndAt("");
            setShowCreateForm(false);
            await fetchNotifications();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al crear notificación");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await notificationsService.delete(id);
            toast.success("Notificación eliminada");
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al eliminar");
        } finally {
            setDeleteTarget(null);
        }
    };

    const markAsRead = async (id: number) => {
        try {
            await notificationsService.markRead(id);
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const canDeleteNotification = (notif: Notification): boolean => {
        if (canDeleteAny) return true;
        return notif.created_by_id === userId;
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
        <div className="space-y-6">
            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar notificación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. La notificación será eliminada permanentemente para todos los usuarios.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteTarget && handleDelete(deleteTarget)}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Notification Form */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notificaciones
                    </CardTitle>
                    <Button
                        variant={showCreateForm ? "outline" : "default"}
                        size="sm"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        {showCreateForm ? "Cancelar" : "Nueva"}
                    </Button>
                </CardHeader>
                {showCreateForm && (
                    <CardContent className="pt-0 border-t mt-0 pt-4">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="notif-title">Título *</Label>
                                    <Input
                                        id="notif-title"
                                        placeholder="Ej: Reunión de padres"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="notif-type">Tipo</Label>
                                    <Select value={newType} onValueChange={setNewType}>
                                        <SelectTrigger id="notif-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Info">ℹ️ Información</SelectItem>
                                            <SelectItem value="Aviso">🔔 Aviso</SelectItem>
                                            <SelectItem value="Alerta">⚠️ Alerta Crítica</SelectItem>
                                            <SelectItem value="Reporte">📄 Reporte</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Center Selector for Global Admin View */}
                            {isGlobal && isLicenseAdmin && (
                                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-primary" />
                                            Centros Destino *
                                        </Label>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="select-all"
                                                checked={allCentersSelected}
                                                onCheckedChange={(checked) => {
                                                    setAllCentersSelected(!!checked);
                                                    if (checked) setSelectedCenterIds([]);
                                                }}
                                            />
                                            <label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                                                Todos los centros
                                            </label>
                                        </div>
                                    </div>

                                    {!allCentersSelected && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto p-1">
                                            {centers.map(center => (
                                                <div key={center.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded transition-colors">
                                                    <Checkbox
                                                        id={`center-${center.id}`}
                                                        checked={selectedCenterIds.includes(center.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedCenterIds([...selectedCenterIds, center.id]);
                                                            } else {
                                                                setSelectedCenterIds(selectedCenterIds.filter(id => id !== center.id));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`center-${center.id}`} className="text-xs cursor-pointer truncate">
                                                        {center.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {allCentersSelected ? (
                                        <p className="text-xs text-muted-foreground italic">Se enviará a todos los centros creados.</p>
                                    ) : selectedCenterIds.length > 0 ? (
                                        <p className="text-xs text-primary font-medium">{selectedCenterIds.length} centros seleccionados.</p>
                                    ) : (
                                        <p className="text-xs text-destructive">Seleccione al menos un centro.</p>
                                    )}
                                </div>
                            )}

                            {/* Scheduling Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start-at" className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Mostrar desde (Opcional)
                                    </Label>
                                    <Input
                                        id="start-at"
                                        type="datetime-local"
                                        value={startAt}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setStartAt(v);
                                            if (v && endAt) {
                                                const start = new Date(v);
                                                const end = new Date(endAt);
                                                if (end <= start) {
                                                    const sameDayEnd = new Date(start);
                                                    sameDayEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);
                                                    const y = sameDayEnd.getFullYear(), m = String(sameDayEnd.getMonth() + 1).padStart(2, '0'), d = String(sameDayEnd.getDate()).padStart(2, '0'), h = String(sameDayEnd.getHours()).padStart(2, '0'), min = String(sameDayEnd.getMinutes()).padStart(2, '0');
                                                    setEndAt(`${y}-${m}-${d}T${h}:${min}`);
                                                }
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Dejar vacío para mostrar inmediatamente.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end-at" className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Ocultar en (Opcional)
                                    </Label>
                                    <Input
                                        id="end-at"
                                        type="datetime-local"
                                        value={endAt}
                                        onChange={(e) => setEndAt(e.target.value)}
                                        min={startAt || undefined}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Dejar vacío para que sea permanente.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notif-desc">Descripción</Label>
                                <Textarea
                                    id="notif-desc"
                                    placeholder="Detalle de la notificación..."
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleCreate} disabled={isCreating || !newTitle.trim()}>
                                    {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Crear Notificación
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Notifications List */}
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        {notifications.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                                No hay notificaciones en este momento.
                            </div>
                        ) : (
                            notifications.map((notification) => {
                                const Icon = iconMap[notification.type] || Bell;
                                const iconColor = colorMap[notification.type] || "text-gray-500";
                                const badgeColor = badgeColorMap[notification.type] || "";

                                return (
                                    <div
                                        key={notification.id}
                                        className={`flex items-start p-4 rounded-lg border transition-colors ${notification.read ? 'bg-card/30 opacity-70' : 'bg-card border-l-4 border-l-primary'}`}
                                    >
                                        <div className={`mr-4 mt-1 ${iconColor}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className={`font-medium ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                        {notification.title}
                                                    </h4>
                                                    <Badge variant="outline" className={`text-xs ${badgeColor}`}>
                                                        {notification.type}
                                                    </Badge>
                                                    {isGlobal && notification.center_name && (
                                                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {notification.center_name}
                                                        </Badge>
                                                    )}
                                                    {isLicenseAdmin && Array.isArray(notification.target_tenants) && notification.target_tenants.length > 1 && (
                                                        <Badge variant="secondary" className="text-xs border-primary/30 text-primary flex items-center gap-1">
                                                            <Globe className="h-3 w-3" />
                                                            Difusión
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                    {notification.time ? new Date(notification.time).toLocaleDateString('es-EC', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }) : ''}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {notification.description}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                <User className="h-3 w-3" />
                                                <span>{notification.created_by_name}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            {!notification.read && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => markAsRead(notification.id)}
                                                    title="Marcar como leída"
                                                >
                                                    <CheckCheck className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {canDeleteNotification(notification) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => setDeleteTarget(notification.id)}
                                                    title="Eliminar notificación"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
