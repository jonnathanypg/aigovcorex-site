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
import { Loader2 } from "lucide-react";
import { licenseAdminService, type CreateCenterData } from "@/services/license-admin.service";

interface CreateCenterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateCenterDialog({ open, onOpenChange, onSuccess }: CreateCenterDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreateCenterData>({
        name: "",
        legal_name: "",
        city: "",
        province: "",
        address: "",
        phone: "",
        email: "",
        max_capacity: 50,
        max_children_per_educator: 10,
        ruc: ""
    });

    // Cargar datos de organización heredados de la licencia
    useEffect(() => {
        if (open) {
            licenseAdminService.getOrganization().then((org) => {
                setFormData(prev => ({
                    ...prev,
                    legal_name: org.legal_name || "",
                    ruc: org.ruc || ""
                }));
            }).catch(() => { });
        }
    }, [open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await licenseAdminService.createCenter(formData);
            onOpenChange(false);
            onSuccess();
            // Reset form
            setFormData({
                name: "",
                legal_name: "",
                city: "",
                province: "",
                address: "",
                phone: "",
                email: "",
                max_capacity: 50,
                max_children_per_educator: 10,
                ruc: ""
            });
        } catch (err: any) {
            setError(err.response?.data?.error || "Error al crear el centro");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Centro</DialogTitle>
                    <DialogDescription>
                        Ingrese los datos del nuevo centro educativo.
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
                            <Label htmlFor="name">Nombre Comercial *</Label>
                            <Input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Ej: CDI Los Pitufos"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="legal_name">Razón Social</Label>
                            <Input
                                id="legal_name"
                                name="legal_name"
                                value={formData.legal_name}
                                disabled
                                className="opacity-70"
                                title="Heredado de la licencia"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ruc">RUC</Label>
                            <Input
                                id="ruc"
                                name="ruc"
                                value={formData.ruc}
                                disabled
                                className="opacity-70"
                                title="Heredado de la licencia"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max_capacity">Capacidad Máxima *</Label>
                            <Input
                                id="max_capacity"
                                name="max_capacity"
                                type="number"
                                min="1"
                                value={formData.max_capacity}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max_children_per_educator">Niños máx. por educadora</Label>
                            <Input
                                id="max_children_per_educator"
                                name="max_children_per_educator"
                                type="number"
                                min="1"
                                value={formData.max_children_per_educator ?? 10}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="province">Provincia *</Label>
                            <Input
                                id="province"
                                name="province"
                                value={formData.province}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="city">Ciudad *</Label>
                            <Input
                                id="city"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Dirección</Label>
                        <Input
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email de Contacto</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                            />
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
                                "Crear Centro"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
