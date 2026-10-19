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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { nutritionService, type NutritionalAssessment } from "@/services/nutrition.service";
import { childrenService } from "@/services/children.service";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Child } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface CreateAssessmentDialogProps {
  children?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateAssessmentDialog({
  children,
  onSuccess,
  open,
  onOpenChange,
}: CreateAssessmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const { toast } = useToast();

  // Form state
  const [childId, setChildId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [periodType, setPeriodType] = useState<string>("trimestral");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [cephalicPerimeter, setCephalicPerimeter] = useState<string>("");
  const [brachialPerimeter, setBrachialPerimeter] = useState<string>("");
  const [hemoglobin, setHemoglobin] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      loadChildren();
      resetForm();
    }
  }, [isOpen]);

  const loadChildren = async () => {
    try {
      setIsLoadingChildren(true);
      const data = await childrenService.getAll();
      setChildrenList(data || []);
    } catch (error) {
      console.error("Error loading children:", error);
    } finally {
      setIsLoadingChildren(false);
    }
  };

  const resetForm = () => {
    setChildId("");
    setDate(new Date().toISOString().split("T")[0]);
    setPeriodType("trimestral");
    setWeight("");
    setHeight("");
    setCephalicPerimeter("");
    setBrachialPerimeter("");
    setHemoglobin("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!childId) {
      toast({
        title: "Campo requerido",
        description: "Por favor seleccione un niño/a.",
        variant: "destructive",
      });
      return;
    }

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);

    if (isNaN(weightNum) || weightNum <= 0 || isNaN(heightNum) || heightNum <= 0) {
      toast({
        title: "Medidas requeridas",
        description: "El peso y la talla deben ser valores numéricos válidos mayores a cero.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await nutritionService.createAssessment({
        child_id: parseInt(childId, 10),
        assessment_date: date,
        period_type: periodType as any,
        weight_kg: weightNum,
        height_cm: heightNum,
        cephalic_perimeter_cm: cephalicPerimeter ? parseFloat(cephalicPerimeter) : undefined,
        brachial_perimeter_cm: brachialPerimeter ? parseFloat(brachialPerimeter) : undefined,
        hemoglobin_g_dl: hemoglobin ? parseFloat(hemoglobin) : undefined,
        notes: notes.trim(),
      });

      toast({
        title: "Evaluación registrada",
        description: "El análisis nutricional ha sido registrado y clasificado según el patrón OMS.",
      });

      setIsOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving assessment:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la evaluación nutricional.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const childOptions = childrenList.map((c) => ({
    value: String(c.id),
    label: `${c.full_name || `${c.first_name} ${c.last_name}`} ${c.cedula ? `(${c.cedula})` : ""}`,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children}
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-headline">
            Nueva Evaluación Nutricional / Antropométrica
          </DialogTitle>
          <DialogDescription>
            Registre las medidas antropométricas del infante para el cálculo de Z-Scores y clasificación nutricional OMS.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="child">Niño / Niña *</Label>
            {isLoadingChildren ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando lista de niños...
              </div>
            ) : (
              <SearchableSelect
                options={childOptions}
                value={childId}
                onValueChange={setChildId}
                placeholder="Buscar infante por nombre o cédula..."
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha de Evaluación *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Período de Evaluación</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger id="period">
                  <SelectValue placeholder="Seleccione período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inicial">Evaluación Inicial</SelectItem>
                  <SelectItem value="trimestral">Trimestral (Seguimiento)</SelectItem>
                  <SelectItem value="extraordinaria">Extraordinaria</SelectItem>
                  <SelectItem value="final">Evaluación Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border">
            <div className="space-y-2">
              <Label htmlFor="weight" className="font-semibold">Peso (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 12.50"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height" className="font-semibold">Talla / Longitud (cm) *</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                min="0"
                placeholder="Ej. 85.0"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cephalic" className="text-xs">P. Cefálico (cm)</Label>
              <Input
                id="cephalic"
                type="number"
                step="0.1"
                placeholder="Opcional"
                value={cephalicPerimeter}
                onChange={(e) => setCephalicPerimeter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brachial" className="text-xs">P. Braquial (cm)</Label>
              <Input
                id="brachial"
                type="number"
                step="0.1"
                placeholder="Opcional"
                value={brachialPerimeter}
                onChange={(e) => setBrachialPerimeter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hemo" className="text-xs">Hemoglobina (g/dL)</Label>
              <Input
                id="hemo"
                type="number"
                step="0.1"
                placeholder="Opcional"
                value={hemoglobin}
                onChange={(e) => setHemoglobin(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observaciones / Recomendaciones Nutricionales</Label>
            <Textarea
              id="notes"
              placeholder="Detalles sobre hábitos alimenticios, alertas o plan de nutrición recomendado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Evaluación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
