"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { superAdminService, type AssignAdminData } from "@/services/super-admin.service";

interface AssignAdminDialogProps {
    licenseId: number;
    licenseName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function AssignAdminDialog({
    licenseId,
    licenseName,
    open,
    onOpenChange,
    onSuccess
}: AssignAdminDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [canCreateCenters, setCanCreateCenters] = useState(true);
    const [canDeleteCenters, setCanDeleteCenters] = useState(false);
    const [canManageUsers, setCanManageUsers] = useState(true);

    const resetForm = () => {
        setEmail("");
        setFirstName("");
        setLastName("");
        setPassword("");
        setCanCreateCenters(true);
        setCanDeleteCenters(false);
        setCanManageUsers(true);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !firstName || !lastName || !password) {
            setError("Complete todos los campos obligatorios");
            return;
        }

        if (password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await superAdminService.createLicenseAdminUser({
                license_id: licenseId,
                email,
                first_name: firstName,
                last_name: lastName,
                password,
                can_create_centers: canCreateCenters,
                can_delete_centers: canDeleteCenters,
                can_manage_users: canManageUsers,
            });

            onOpenChange(false);
            resetForm();
            onSuccess?.();
        } catch (err: any) {
            console.error("Error assigning admin:", err);
            setError(err.response?.data?.error || "Error al asignar administrador");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            onOpenChange(isOpen);
            if (!isOpen) resetForm();
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Asignar Administrador</DialogTitle>
                    <DialogDescription>
                        Crear un nuevo coordinador para la licencia <strong>{licenseName}</strong>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">Nombres *</Label>
                            <Input
                                id="firstName"
                                placeholder="Juan"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Apellidos *</Label>
                            <Input
                                id="lastName"
                                placeholder="Pérez"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico *</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="coordinador@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña *</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Mínimo 8 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Permisos</Label>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="canCreateCenters"
                                    checked={canCreateCenters}
                                    onCheckedChange={(checked) => setCanCreateCenters(checked as boolean)}
                                />
                                <label htmlFor="canCreateCenters" className="text-sm">
                                    Puede crear centros
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="canDeleteCenters"
                                    checked={canDeleteCenters}
                                    onCheckedChange={(checked) => setCanDeleteCenters(checked as boolean)}
                                />
                                <label htmlFor="canDeleteCenters" className="text-sm">
                                    Puede eliminar centros
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="canManageUsers"
                                    checked={canManageUsers}
                                    onCheckedChange={(checked) => setCanManageUsers(checked as boolean)}
                                />
                                <label htmlFor="canManageUsers" className="text-sm">
                                    Puede gestionar usuarios
                                </label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
                            ) : (
                                "Crear Administrador"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
