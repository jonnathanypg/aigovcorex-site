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
import { licenseAdminService, type CreateCenterData, type Center } from "@/services/license-admin.service";
import { toast } from "sonner";

interface EditCenterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    center: Center | null;
    onSuccess: () => void;
}

export function EditCenterDialog({ open, onOpenChange, center, onSuccess }: EditCenterDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

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

    useEffect(() => {
        if (open && center) {
            setFormData({
                name: center.name,
                legal_name: center.legal_name,
                city: center.city,
                province: center.province,
                address: center.address || "",
                phone: center.phone || "",
                email: center.email || "",
                max_capacity: center.max_capacity,
                max_children_per_educator: center.max_children_per_educator ?? 10,
                ruc: "" // Temporarily empty, will be filled by getOrganization
            });

            // Fetch organization data to ensure RUC and Legal Name are accurate and inherited
            licenseAdminService.getOrganization().then((org) => {
                setFormData(prev => ({
                    ...prev,
                    legal_name: org.legal_name || center.legal_name || "",
                    ruc: org.ruc || ""
                }));
            }).catch(() => { });
        }
    }, [open, center]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!center) return;

        setIsLoading(true);

        try {
            await licenseAdminService.updateCenter(center.id, formData);
            toast.success("Centro actualizado exitosamente");
            onOpenChange(false);
            onSuccess();
        } catch (err: any) {
            console.error("Error updating center:", err);
            toast.error(err.response?.data?.error || "Error al actualizar el centro");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Editar Centro</DialogTitle>
                    <DialogDescription>
                        Modifique los datos del centro educativo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nombre Comercial *</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-legal_name">Razón Social</Label>
                            <Input
                                id="edit-legal_name"
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
                            <Label htmlFor="edit-ruc">RUC</Label>
                            <Input
                                id="edit-ruc"
                                name="ruc"
                                value={formData.ruc}
                                disabled
                                className="opacity-70"
                                title="Heredado de la licencia"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-max_capacity">Capacidad Máxima *</Label>
                            <Input
                                id="edit-max_capacity"
                                name="max_capacity"
                                type="number"
                                min="1"
                                value={formData.max_capacity}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-max_children_per_educator">Niños máx. por educadora</Label>
                            <Input
                                id="edit-max_children_per_educator"
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
                            <Label htmlFor="edit-province">Provincia *</Label>
                            <Input
                                id="edit-province"
                                name="province"
                                value={formData.province}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-city">Ciudad *</Label>
                            <Input
                                id="edit-city"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-address">Dirección</Label>
                        <Input
                            id="edit-address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-phone">Teléfono</Label>
                            <Input
                                id="edit-phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email de Contacto</Label>
                            <Input
                                id="edit-email"
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
