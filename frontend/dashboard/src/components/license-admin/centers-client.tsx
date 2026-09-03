"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Building2,
    Users,
    MapPin,
    Plus,
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    AlertTriangle,
    RotateCcw,
    ShieldAlert,
    Eye,
    EyeOff
} from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { licenseAdminService, type Center } from "@/services/license-admin.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateCenterDialog } from "./create-center-dialog";
import { EditCenterDialog } from "./edit-center-dialog";
import { toast } from "sonner";

export function CentersClient() {
    const [centers, setCenters] = useState<Center[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Edit state
    const [centerToEdit, setCenterToEdit] = useState<Center | null>(null);

    // Delete state
    const [centerToDelete, setCenterToDelete] = useState<Center | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Reset state
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [resetConfirmation, setResetConfirmation] = useState("");
    const [resetPassword, setResetPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetCountdown, setResetCountdown] = useState(0);

    const loadCenters = useCallback(async () => {
        try {
            const data = await licenseAdminService.getCenters();
            setCenters(data);
        } catch (error) {
            console.error("Error loading centers:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCenters();
    }, [loadCenters]);

    useAgentRefresh(loadCenters);

    // Countdown timer for reset button
    useEffect(() => {
        if (resetCountdown > 0) {
            const timer = setTimeout(() => setResetCountdown(resetCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resetCountdown]);

    // Start countdown when confirmation is correct
    useEffect(() => {
        if (resetConfirmation === "RESETEAR" && resetPassword.length >= 4) {
            if (resetCountdown === 0) {
                setResetCountdown(3);
            }
        }
    }, [resetConfirmation, resetPassword]);

    const handleDelete = async () => {
        if (!centerToDelete) return;
        setIsDeleting(true);
        try {
            await licenseAdminService.deleteCenter(centerToDelete.id);
            await loadCenters();
            setCenterToDelete(null);
        } catch (error) {
            console.error("Error deleting center:", error);
            toast.error("No se pudo eliminar el centro", {
                description: "Verifique que no tenga usuarios ni niños activos."
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReset = async () => {
        if (resetConfirmation !== "RESETEAR" || !resetPassword) return;
        setIsResetting(true);
        try {
            const result = await licenseAdminService.resetLicense(resetConfirmation, resetPassword);
            toast.success(result.message, {
                description: `Usuarios: ${result.deleted_counts.users || 0}, Niños: ${result.deleted_counts.children || 0}, Familias: ${result.deleted_counts.families || 0}`,
                duration: 10000,
            });
            setIsResetOpen(false);
            setResetConfirmation("");
            setResetPassword("");
            setResetCountdown(0);
            await loadCenters();
        } catch (error: any) {
            const message = error?.response?.data?.error || "Error al resetear la licencia";
            toast.error(message);
        } finally {
            setIsResetting(false);
        }
    };

    const handleResetDialogClose = (open: boolean) => {
        if (!open) {
            setIsResetOpen(false);
            setResetConfirmation("");
            setResetPassword("");
            setResetCountdown(0);
            setShowPassword(false);
        }
    };

    const canExecuteReset = resetConfirmation === "RESETEAR" && resetPassword.length >= 4 && resetCountdown === 0 && !isResetting;

    if (isLoading && centers.length === 0) {
        return (
            <div className="flex h-[400px] flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Cargando centros...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Mis Centros</h1>
                    <p className="text-muted-foreground">Gestione los centros educativos de su licencia.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Centro
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {centers.map((center) => (
                    <Card key={center.id} className="relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${center.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-muted-foreground" />
                                        {center.name}
                                    </CardTitle>
                                    <CardDescription className="mt-1 flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {center.city}, {center.province}
                                    </CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setCenterToEdit(center)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => setCenterToDelete(center)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Capacidad:</span>
                                    <span className="font-medium">{center.max_capacity} niños</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Matrícula actual:</span>
                                    <Badge variant="secondary">{center.current_enrollment}</Badge>
                                </div>
                                <div className="w-full bg-secondary h-2 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all"
                                        style={{ width: `${(center.current_enrollment / center.max_capacity) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 p-3 text-xs text-muted-foreground flex justify-between">
                            <span>{center.email || "Sin email"}</span>
                            <span>{center.active_children || 0} activos</span>
                        </CardFooter>
                    </Card>
                ))}

                {centers.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                        <Building2 className="h-10 w-10 mb-4" />
                        <p className="text-lg font-medium">No hay centros creados</p>
                        <p className="text-sm">Empiece creando su primer centro educativo.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                            Crear Centro
                        </Button>
                    </div>
                )}
            </div>

            {/* Zone Reset - at the bottom */}
            <Separator className="my-8" />
            {/* SAFETY TOGGLE */}
            <div className="flex items-center space-x-2 mb-4 p-4 bg-muted/30 rounded-lg border border-muted">
                <Checkbox
                    id="enable-danger-zone"
                    checked={showDangerZone}
                    onCheckedChange={(checked) => setShowDangerZone(checked as boolean)}
                />
                <label
                    htmlFor="enable-danger-zone"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                >
                    Habilitar opciones de reseteo y zona de peligro
                </label>
            </div>

            {/* DANGER ZONE - Only visible if enabled */}
            {showDangerZone && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/10">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            <CardTitle>Zona de Peligro</CardTitle>
                        </div>
                        <CardDescription className="text-red-700/80 dark:text-red-400">
                            Acciones destructivas e irreversibles para su licencia.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border border-red-100 dark:border-red-900/20 shadow-sm">
                            <div className="space-y-1">
                                <h4 className="font-semibold text-red-700 dark:text-red-400">Resetear Licencia Completa</h4>
                                <p className="text-sm text-muted-foreground w-[90%] md:w-[600px]">
                                    Esta acción <strong>ELIMINARÁ PERMANENTEMENTE</strong>:
                                    <ul className="list-disc ml-5 mt-1 mb-1 space-y-0.5">
                                        <li>Todos los <strong>Centros (Tenants)</strong> creados.</li>
                                        <li>Todo el <strong>Historial de Conversaciones</strong> (WhatsApp, Telegram, Web).</li>
                                        <li>Todos los usuarios (excepto usted), niños, familias, reportes y datos operativos.</li>
                                    </ul>
                                    La licencia quedará vacía (0 centros), manteniendo solo su configuración base y canales.
                                </p>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={() => setIsResetOpen(true)}
                            >
                                Resetear Licencia
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Dialogs */}
            <CreateCenterDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={loadCenters}
            />

            <EditCenterDialog
                open={!!centerToEdit}
                onOpenChange={(open) => !open && setCenterToEdit(null)}
                center={centerToEdit}
                onSuccess={loadCenters}
            />

            {/* Delete Center Dialog */}
            <AlertDialog open={!!centerToDelete} onOpenChange={(open) => !open && setCenterToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el centro &quot;{centerToDelete?.name}&quot;.
                            Solo puede eliminarse si no tiene usuarios ni niños activos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reset License Dialog */}
            <Dialog open={isResetOpen} onOpenChange={handleResetDialogClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Resetear Licencia
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Esta acción es <strong className="text-destructive">IRREVERSIBLE</strong>. Se eliminarán permanentemente:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Warning list */}
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm space-y-1">
                            <p>• Todos los <strong>usuarios</strong> del sistema (excepto usted)</p>
                            <p>• Todos los <strong>niños</strong>, familias y representantes</p>
                            <p>• Registros de asistencia, salud, nutrición, vacunas</p>
                            <p>• Solicitudes de admisión y fichas de vulnerabilidad</p>
                            <p>• Documentos, reportes, notificaciones</p>
                            <p>• Tareas de mantenimiento e intervenciones</p>
                            <p>• Historial de conversaciones del agente IA</p>
                        </div>

                        <Separator />

                        {/* Confirmation word */}
                        <div className="space-y-2">
                            <Label htmlFor="reset-confirmation" className="text-sm font-medium">
                                Escriba <code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-bold">RESETEAR</code> para confirmar:
                            </Label>
                            <Input
                                id="reset-confirmation"
                                value={resetConfirmation}
                                onChange={(e) => setResetConfirmation(e.target.value)}
                                placeholder="Escriba aquí..."
                                className={resetConfirmation === "RESETEAR" ? "border-green-500 focus-visible:ring-green-500" : ""}
                                autoComplete="off"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="reset-password" className="text-sm font-medium">
                                Contraseña de su cuenta:
                            </Label>
                            <div className="relative">
                                <Input
                                    id="reset-password"
                                    type={showPassword ? "text" : "password"}
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    placeholder="Ingrese su contraseña"
                                    autoComplete="current-password"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => handleResetDialogClose(false)}
                            disabled={isResetting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReset}
                            disabled={!canExecuteReset}
                        >
                            {isResetting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Reseteando...
                                </>
                            ) : resetCountdown > 0 ? (
                                `Espere ${resetCountdown}s...`
                            ) : resetConfirmation !== "RESETEAR" || resetPassword.length < 4 ? (
                                "Complete los campos"
                            ) : (
                                <>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Confirmar Reset
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
