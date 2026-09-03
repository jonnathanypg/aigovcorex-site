"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, CheckCircle2, XCircle } from "lucide-react";
import { licenseAdminService } from "@/services/license-admin.service";

interface OrganizationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OrganizationDialog({ open, onOpenChange }: OrganizationDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [legalName, setLegalName] = useState("");
    const [ruc, setRuc] = useState("");
    const [description, setDescription] = useState("");
    const [licenseName, setLicenseName] = useState("");

    // SMTP Fields
    const [smtpHost, setSmtpHost] = useState("");
    const [smtpPort, setSmtpPort] = useState("587");
    const [smtpUser, setSmtpUser] = useState("");
    const [smtpPassword, setSmtpPassword] = useState("");
    const [smtpConfigured, setSmtpConfigured] = useState(false);

    useEffect(() => {
        if (open) {
            setIsFetching(true);
            setError(null);
            setSuccess(null);
            setSmtpPassword(""); // Always clear password on open
            licenseAdminService.getOrganization().then((org: any) => {
                setLegalName(org.legal_name || "");
                setRuc(org.ruc || "");
                setDescription(org.description || "");
                setLicenseName(org.license_name || "");
                setSmtpHost(org.smtp_host || "");
                setSmtpPort(String(org.smtp_port || 587));
                setSmtpUser(org.smtp_user || "");
                setSmtpConfigured(org.smtp_configured || false);
            }).catch(() => {
                setError("Error al cargar datos de organización");
            }).finally(() => {
                setIsFetching(false);
            });
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const payload: any = {
                legal_name: legalName,
                ruc: ruc,
                description: description,
                smtp_host: smtpHost,
                smtp_port: parseInt(smtpPort) || 587,
                smtp_user: smtpUser,
            };
            // Only send password if user typed something new
            if (smtpPassword) {
                payload.smtp_password = smtpPassword;
            }

            await licenseAdminService.updateOrganization(payload);
            setSuccess("Datos de organización actualizados correctamente");
            setSmtpConfigured(Boolean(smtpHost && smtpUser && (smtpPassword || smtpConfigured)));
        } catch (err: any) {
            setError(err.response?.data?.error || "Error al actualizar");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Datos de Organización</DialogTitle>
                    <DialogDescription>
                        Información formal de la empresa/organización asociada a la licencia <strong>{licenseName}</strong>. Estos datos se heredan automáticamente a todos los centros.
                    </DialogDescription>
                </DialogHeader>

                {isFetching ? (
                    <div className="flex justify-center p-6">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-3 text-sm text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded-md">
                                {success}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="org-legal-name">Razón Social</Label>
                            <Input
                                id="org-legal-name"
                                placeholder="Ej: Fundación GASIBA"
                                value={legalName}
                                onChange={(e) => setLegalName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-ruc">RUC</Label>
                            <Input
                                id="org-ruc"
                                placeholder="Ej: 0993366944001"
                                maxLength={13}
                                value={ruc}
                                onChange={(e) => setRuc(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="org-description">Información Adicional</Label>
                            <Textarea
                                id="org-description"
                                placeholder="Notas adicionales, dirección fiscal, etc."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {/* ── SMTP Email Configuration ── */}
                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-amber-600" />
                                <Label className="text-base font-semibold">Servidor de Correos (SMTP)</Label>
                                {smtpConfigured ? (
                                    <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Configurado
                                    </span>
                                ) : (
                                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                        <XCircle className="h-3.5 w-3.5" /> No configurado
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Configura el servidor SMTP para enviar correos automáticos (bienvenida, asignaciones, notificaciones).
                            </p>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2 space-y-1">
                                    <Label htmlFor="smtp-host">Servidor</Label>
                                    <Input
                                        id="smtp-host"
                                        placeholder="smtp.gmail.com"
                                        value={smtpHost}
                                        onChange={(e) => setSmtpHost(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="smtp-port">Puerto</Label>
                                    <Input
                                        id="smtp-port"
                                        placeholder="587"
                                        type="number"
                                        value={smtpPort}
                                        onChange={(e) => setSmtpPort(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="smtp-user">Correo (remitente)</Label>
                                <Input
                                    id="smtp-user"
                                    placeholder="notificaciones@miorganizacion.com"
                                    type="email"
                                    value={smtpUser}
                                    onChange={(e) => setSmtpUser(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="smtp-password">Contraseña</Label>
                                <Input
                                    id="smtp-password"
                                    type="password"
                                    placeholder={smtpConfigured ? "••••••••  (dejar vacío para no cambiar)" : "Contraseña del correo SMTP"}
                                    value={smtpPassword}
                                    onChange={(e) => setSmtpPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                ) : (
                                    "Guardar"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
