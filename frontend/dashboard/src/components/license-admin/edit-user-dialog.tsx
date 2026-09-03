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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { licenseAdminService, type Center, type LicenseUser } from "@/services/license-admin.service";
import { toast } from "sonner";

interface EditUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: LicenseUser | null;
    onSuccess: () => void;
}

const ROLES = [
    { value: "center_coordinator", label: "Coordinador de Centro" },
    { value: "educadora", label: "Educadora" },
    { value: "psicologo", label: "Psicólogo" },
    { value: "nutricionista", label: "Nutricionista" },
    { value: "trabajador_social", label: "Trabajador Social" },
    { value: "medico", label: "Médico" },
    { value: "administrativo", label: "Administrativo" },
];

export function EditUserDialog({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [centers, setCenters] = useState<Center[]>([]);

    // Only basic fields can be edited here. Password change usually requires separate flow.
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        role: "",
        center_id: "",
        phone: ""
    });

    useEffect(() => {
        if (open) {
            loadCenters();
            if (user) {
                setFormData({
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    role: user.role,
                    center_id: user.tenant_id ? user.tenant_id.toString() : "unassigned",
                    phone: user.phone || ""
                });
            }
        }
    }, [open, user]);

    const loadCenters = async () => {
        try {
            const data = await licenseAdminService.getCenters();
            setCenters(data.filter(c => c.is_active));
        } catch (err) {
            console.error("Error loading centers:", err);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsLoading(true);

        try {
            // Prepare payload
            const payload = { ...formData };
            if (payload.center_id === 'unassigned' || payload.center_id === '') {
                // @ts-ignore
                payload.center_id = null;
            }

            await licenseAdminService.updateUser(user.id, payload);
            toast.success("Usuario actualizado correctamente");
            onOpenChange(false);
            onSuccess();
        } catch (err: any) {
            console.error("Error updating user:", err);
            toast.error(err.response?.data?.error || "Error al actualizar usuario");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Usuario</DialogTitle>
                    <DialogDescription>
                        Modifique los datos, rol o asignación del usuario.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-first_name">Nombres *</Label>
                            <Input
                                id="edit-first_name"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-last_name">Apellidos *</Label>
                            <Input
                                id="edit-last_name"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-email">Correo Electrónico *</Label>
                        <Input
                            id="edit-email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-phone">Teléfono / WhatsApp</Label>
                        <Input
                            id="edit-phone"
                            name="phone"
                            placeholder="+593..."
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Centro Asignado</Label>
                            <Select
                                value={formData.center_id}
                                onValueChange={(val) => handleSelectChange('center_id', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">
                                        ⚠️ Sin Asignar (Pendiente)
                                    </SelectItem>
                                    {centers.map(center => (
                                        <SelectItem key={center.id} value={center.id.toString()}>
                                            {center.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Rol *</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(val) => handleSelectChange('role', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map(role => (
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                "Guardar Cambios"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
