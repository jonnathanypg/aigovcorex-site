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
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { nutritionService, type NutritionRecord } from "@/services/nutrition.service";
import { childrenService } from "@/services/children.service";
import { menuService } from "@/services/menu.service";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CreateEditNutritionDialogProps {
    children?: React.ReactNode;
    onSuccess?: () => void;
    recordToEdit?: NutritionRecord | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CreateEditNutritionDialog({ children, onSuccess, recordToEdit, open, onOpenChange }: CreateEditNutritionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [childrenList, setChildrenList] = useState<Child[]>([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(true);
    const { toast } = useToast();

    // Form state
    const [childId, setChildId] = useState<string>("");
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [mealType, setMealType] = useState<string>("almuerzo");
    const [quantity, setQuantity] = useState<number>(100);
    const [menuDescription, setMenuDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [isAutoFilling, setIsAutoFilling] = useState(false);

    useEffect(() => {
        if (!isOpen || recordToEdit) return;

        const fetchMenuForDate = async () => {
            setIsAutoFilling(true);
            try {
                const response = await menuService.getTodayMenu(date);
                const mealMenu = response.meals?.[mealType];
                if (mealMenu && mealMenu.description) {
                    setMenuDescription(mealMenu.description);
                } else {
                    setMenuDescription("");
                }
            } catch (error) {
                console.error("Error auto-filling menu:", error);
            } finally {
                setIsAutoFilling(false);
            }
        };

        const debounceId = setTimeout(() => {
            fetchMenuForDate();
        }, 100);
        return () => clearTimeout(debounceId);
    }, [date, mealType, isOpen, recordToEdit]);

    useEffect(() => {
        if (isOpen) {
            loadChildren();
            if (recordToEdit) {
                setChildId(String(recordToEdit.child_id));
                setDate(recordToEdit.date.split('T')[0]);
                setMealType(recordToEdit.meal_type);
                setQuantity(recordToEdit.quantity || 100);
                setMenuDescription(recordToEdit.menu_description || "");
                setNotes(recordToEdit.notes || "");
            } else {
                resetForm();
            }
        }
    }, [isOpen, recordToEdit]);

    const loadChildren = async () => {
        try {
            setIsLoadingChildren(true);
            const data = await childrenService.getAll({ status: 'activo' });
            setChildrenList(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingChildren(false);
        }
    };

    const resetForm = () => {
        setChildId("");
        setDate(new Date().toISOString().split('T')[0]);
        setMealType("almuerzo");
        setQuantity(100);
        setMenuDescription("");
        setNotes("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!childId) return;

        setIsLoading(true);
        try {
            const data: any = {
                child_id: parseInt(childId),
                date,
                meal_type: mealType,
                quantity,
                menu_description: menuDescription,
                notes,
            };

            // Backend auto-calculates consumption_level based on quantity if not sent, 
            // or we can just send quantity. The Service interface says record is Partial<NutritionRecord>.

            if (recordToEdit) {
                await nutritionService.updateRecord(recordToEdit.id, data);
                toast({ title: "Actualizado", description: "Registro de nutrición actualizado" });
            } else {
                await nutritionService.createRecord(data);
                toast({ title: "Creado", description: "Registro de nutrición creado" });
            }

            setIsOpen(false);
            resetForm();
            onSuccess?.();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo guardar el registro", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // Derived consumption level for display
    const getConsumptionLevel = (qty: number) => {
        if (qty >= 90) return 'Todo (100-90%)';
        if (qty >= 65) return 'La Mayoría (90-65%)';
        if (qty >= 40) return 'La Mitad (65-40%)';
        if (qty > 0) return 'Poco (<40%)';
        return 'Nada (0%)';
    };

    const childOptions = childrenList.map(child => ({
        value: String(child.id),
        label: child.full_name || `${child.first_name} ${child.last_name}`
    }));

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle>{recordToEdit ? 'Editar Registro de Nutrición' : 'Nuevo Registro de Nutrición'}</DialogTitle>
                    <DialogDescription>
                        Registre el consumo de alimentos del niño/a.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Niño/a *</Label>
                        <SearchableSelect
                            options={childOptions}
                            value={childId}
                            onValueChange={setChildId}
                            placeholder="Seleccionar..."
                            disabled={!!recordToEdit}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha *</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de Comida *</Label>
                            <Select value={mealType} onValueChange={setMealType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desayuno">Desayuno</SelectItem>
                                    <SelectItem value="refrigerio_am">Refrigerio AM</SelectItem>
                                    <SelectItem value="almuerzo">Almuerzo</SelectItem>
                                    <SelectItem value="refrigerio_pm">Refrigerio PM</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4 border p-4 rounded-md">
                        <div className="flex justify-between items-center">
                            <Label>Cantidad Consumida: {quantity}%</Label>
                            <span className="text-xs font-semibold text-primary">{getConsumptionLevel(quantity)}</span>
                        </div>
                        <Slider
                            value={[quantity]}
                            onValueChange={(vals) => setQuantity(vals[0])}
                            max={100}
                            step={5}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Menú / Descripción {isAutoFilling && <Loader2 className="inline h-3 w-3 animate-spin ml-2 text-muted-foreground" />}</Label>
                        <Input
                            placeholder="Ej: Sopa de pollo con arroz"
                            value={menuDescription}
                            onChange={e => setMenuDescription(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Observaciones</Label>
                        <Textarea
                            placeholder="Comentarios adicionales..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading || !childId}>
                            {isLoading ? <Loader2 className="animate-spin" /> : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
