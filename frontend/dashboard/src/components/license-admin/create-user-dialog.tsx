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
import { licenseAdminService, type Center } from "@/services/license-admin.service";

interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const ROLES = [
    { value: "coordinator", label: "Coordinador de Centro" },
    { value: "educator", label: "Educadora" },
    { value: "supervisor", label: "Supervisor" },
    { value: "psychologist", label: "Psicólogo" },
    { value: "nutritionist", label: "Nutricionista" },
    { value: "social_worker", label: "Trabajador Social" },
    { value: "doctor", label: "Médico" },
    { value: "administrative", label: "Administrativo" },
];

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [centers, setCenters] = useState<Center[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        role: "",
        center_id: "",
        phone: ""
    });

    useEffect(() => {
        if (open) {
            loadCenters();
        }
    }, [open]);

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
        setIsLoading(true);
        setError(null);

        try {
            // Prepare payload - handle unassigned
            const payload = { ...formData };
            if (payload.center_id === 'unassigned' || payload.center_id === '') {
                // @ts-ignore
                payload.center_id = null;
            }

            await licenseAdminService.createUser(payload);
            onOpenChange(false);
            onSuccess();
            // Reset form
            setFormData({
                first_name: "",
                last_name: "",
                email: "",
                password: "",
                role: "",
                center_id: "",
                phone: ""
            });
        } catch (err: any) {
            setError(err.response?.data?.error || "Error al crear usuario");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                    <DialogDescription>
                        Registre un nuevo colaborador y asígnele un rol y centro.
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
                            <Label htmlFor="first_name">Nombres *</Label>
                            <Input
                                id="first_name"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last_name">Apellidos *</Label>
                            <Input
                                id="last_name"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico *</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                        <Input
                            id="phone"
                            name="phone"
                            placeholder="+593..."
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña Temporal *</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={6}
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
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
                            ) : (
                                "Crear Usuario"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
