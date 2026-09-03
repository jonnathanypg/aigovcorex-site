"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Plus, Pencil, ChevronLeft, ChevronRight, UtensilsCrossed, Sparkles } from "lucide-react";
import { menuService, type WeeklyMenuResponse } from "@/services/menu.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { authService } from "@/services/auth.service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const MEAL_TYPES = [
    { id: 'desayuno', name: 'Desayuno', emoji: '🌅' },
    { id: 'refrigerio_am', name: 'Media Mañana', emoji: '🍎' },
    { id: 'almuerzo', name: 'Almuerzo', emoji: '🍽️' },
    { id: 'refrigerio_pm', name: 'Media Tarde', emoji: '🥤' }
] as const;

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export function MenuClient() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [menuData, setMenuData] = useState<WeeklyMenuResponse | null>(null);
    const [weekStart, setWeekStart] = useState<string>(
        format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    );
    const { toast } = useToast();

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ day: number; mealType: string; mealName: string } | null>(null);
    const [description, setDescription] = useState("");
    const [ingredients, setIngredients] = useState("");
    const [canEdit, setCanEdit] = useState(false);

    useEffect(() => {
        const user = authService.getStoredUser();
        if (user) {
            const roleName = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
            setCanEdit(['license_admin', 'coordinator', 'center_coordinator', 'super_admin'].includes(roleName));
        }
    }, []);

    const loadMenu = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await menuService.getCurrentMenu(weekStart);
            setMenuData(data);
        } catch (error) {
            console.error("Error loading menu:", error);
            toast({ title: "Error", description: "No se pudo cargar el menú semanal.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [weekStart, toast]);

    useEffect(() => {
        loadMenu();
    }, [loadMenu]);

    useAgentRefresh(loadMenu);

    const handleEditClick = (day: number, mealType: string, mealName: string, currentDesc: string = "", currentIngredients: string[] = []) => {
        setEditingSlot({ day, mealType, mealName });
        setDescription(currentDesc);
        setIngredients(currentIngredients.join(', '));
        setIsDialogOpen(true);
    };

    const handleSaveMenu = async () => {
        if (!editingSlot || !description.trim()) return;
        setIsSaving(true);

        try {
            const ingredientsList = ingredients
                .split(',')
                .map(i => i.trim())
                .filter(Boolean);

            await menuService.saveMenu({
                week_start_date: weekStart,
                day_of_week: editingSlot.day,
                meal_type: editingSlot.mealType as any,
                description: description.trim(),
                ingredients: ingredientsList,
            });
            toast({ title: "✅ Menú guardado", description: `${editingSlot.mealName} actualizado correctamente.` });
            setIsDialogOpen(false);
            loadMenu();
        } catch (error: any) {
            console.error(error);
            const msg = error?.response?.data?.error || "No se pudo guardar el menú.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const navigateWeek = (direction: number) => {
        const d = parseISO(weekStart);
        d.setDate(d.getDate() + (7 * direction));
        setWeekStart(format(d, 'yyyy-MM-dd'));
    };

    // Count how many slots are filled
    const filledSlots = menuData?.menus?.length || 0;
    const totalSlots = 20; // 5 days × 4 meals

    return (
        <div className="space-y-6">
            {/* Header Card - matching platform pattern */}
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <UtensilsCrossed className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl font-bold tracking-tight font-headline">
                                    Menú Nutricional Semanal
                                </CardTitle>
                                <CardDescription className="text-lg text-foreground/80">
                                    {canEdit 
                                        ? "Consulta y gestiona el menú nutricional semanal." 
                                        : "Consulte el menú nutricional programado para la semana."}
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-sm px-3 py-1">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {filledSlots}/{totalSlots} completado
                        </Badge>
                    </div>
                </CardHeader>
            </Card>

            {/* Week Navigator */}
            <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Card className="bg-card/50 backdrop-blur-sm border-border/30 px-6 py-2">
                    <span className="text-sm text-muted-foreground">Semana del</span>
                    <p className="font-semibold text-lg font-headline text-primary">
                        {format(parseISO(weekStart), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                </Card>
                <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Menu Grid */}
            {isLoading && !menuData ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((dayNum, idx) => {
                        const dayData = menuData?.menu_by_day?.[dayNum];
                        const dateOfThisDay = addDays(parseISO(weekStart), dayNum - 1);

                        return (
                            <div key={dayNum} className="space-y-3">
                                {/* Day Header */}
                                <Card className="bg-primary/5 border-primary/20">
                                    <CardHeader className="p-3 text-center">
                                        <CardTitle className="text-base font-bold font-headline">
                                            {DAY_NAMES[idx]}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            {format(dateOfThisDay, "d 'de' MMMM", { locale: es })}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>

                                {/* Meal Cards */}
                                {MEAL_TYPES.map(meal => {
                                    const mealRecord = dayData?.meals?.[meal.id];
                                    const hasMeal = !!mealRecord?.description;

                                    return (
                                        <Card
                                            key={meal.id}
                                            className={`group transition-all duration-200 hover:shadow-md cursor-pointer border-border/30 ${hasMeal
                                                ? 'bg-card hover:bg-accent/50'
                                                : 'bg-muted/30 hover:bg-muted/50 border-dashed'
                                                }`}
                                            onClick={() => handleEditClick(
                                                dayNum,
                                                meal.id,
                                                meal.name,
                                                mealRecord?.description,
                                                mealRecord?.ingredients
                                            )}
                                        >
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                        <span>{meal.emoji}</span> {meal.name}
                                                    </span>
                                                    {canEdit && <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-all" />}
                                                </div>
                                                {hasMeal ? (
                                                    <p className="text-sm font-medium line-clamp-2 text-foreground/90" title={mealRecord.description}>
                                                        {mealRecord.description}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground/50 italic flex items-center gap-1">
                                                        {canEdit ? (
                                                            <>
                                                                <Plus className="h-3 w-3" /> Agregar
                                                            </>
                                                        ) : (
                                                            "Sin programar"
                                                        )}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="font-headline flex items-center gap-2">
                            <UtensilsCrossed className="h-5 w-5 text-primary" />
                            {editingSlot ? `${DAY_NAMES[(editingSlot.day) - 1]} — ${editingSlot.mealName}` : 'Editar Menú'}
                        </DialogTitle>
                        <DialogDescription>
                            {canEdit 
                                ? "Modifique los alimentos programados para esta fecha." 
                                : "Detalle de los alimentos programados para esta fecha."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="menu-description">Descripción del alimento *</Label>
                            <Textarea
                                id="menu-description"
                                placeholder="Ej: Sopa de verduras con pollo, arroz integral y ensalada fresca"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                autoFocus
                                disabled={!canEdit}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="menu-ingredients">Ingredientes (separados por coma)</Label>
                            <Input
                                id="menu-ingredients"
                                placeholder="Ej: pollo, arroz, zanahoria, brócoli"
                                value={ingredients}
                                onChange={(e) => setIngredients(e.target.value)}
                                disabled={!canEdit}
                            />
                            <p className="text-xs text-muted-foreground">
                                Opcional. Ayuda a las educadoras a entender el contenido del plato.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            {canEdit ? "Cancelar" : "Cerrar"}
                        </Button>
                        {canEdit && (
                            <Button onClick={handleSaveMenu} disabled={isSaving || !description.trim()}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Guardar Menú
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
