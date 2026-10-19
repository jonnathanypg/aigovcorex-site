"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  nutritionService,
  type NutritionRecord,
  type NutritionalAssessment,
} from "@/services/nutrition.service";
import {
  Loader2,
  PlusCircle,
  Trash2,
  Calendar as CalendarIcon,
  Search,
  UserCheck,
  Activity,
  Utensils,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateEditNutritionDialog } from "./create-edit-nutrition-dialog";
import { CreateAssessmentDialog } from "./create-assessment-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";

interface NutritionClientProps {
  tenantId?: number;
  readOnly?: boolean;
}

export function NutritionClient({ tenantId, readOnly = false }: NutritionClientProps) {
  const { canDelete } = useRole();
  const { toast } = useToast();

  // Mode: "assessments" (Histórico de análisis nutricional) vs "daily" (Raciones de comida)
  const [activeMode, setActiveMode] = useState<"assessments" | "daily">("assessments");

  // Assessments state (Histórico)
  const [assessments, setAssessments] = useState<NutritionalAssessment[]>([]);
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(true);
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<number | null>(null);

  // Daily Rations state
  const [dailyRecords, setDailyRecords] = useState<NutritionRecord[]>([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [dailyFilter, setDailyFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [editingDailyRecord, setEditingDailyRecord] = useState<NutritionRecord | null>(null);
  const [dailyRecordToDelete, setDailyRecordToDelete] = useState<number | null>(null);

  // Fetch Nutritional Assessments (Histórico)
  const fetchAssessments = useCallback(
    async (query: string = "") => {
      try {
        setIsLoadingAssessments(true);
        const data = await nutritionService.getAssessments(200, tenantId, query.trim());
        setAssessments(data.records || []);
      } catch (error) {
        console.error("Error loading nutrition assessments:", error);
        setAssessments([]);
      } finally {
        setIsLoadingAssessments(false);
      }
    },
    [tenantId]
  );

  // Fetch Daily Rations
  const fetchDaily = useCallback(async () => {
    try {
      setIsLoadingDaily(true);
      const data = await nutritionService.getDailyRecords(selectedDate, tenantId);
      setDailyRecords(data || []);
    } catch (error) {
      console.error("Error loading daily rations:", error);
      setDailyRecords([]);
    } finally {
      setIsLoadingDaily(false);
    }
  }, [tenantId, selectedDate]);

  // Debounced search for assessments
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssessments(assessmentSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [assessmentSearch, fetchAssessments]);

  useEffect(() => {
    if (activeMode === "daily") {
      fetchDaily();
    }
  }, [activeMode, fetchDaily]);

  useAgentRefresh(() => {
    if (activeMode === "assessments") fetchAssessments(assessmentSearch);
    else fetchDaily();
  });

  // Extract unique professionals for filtering
  const professionalsList = useMemo(() => {
    const set = new Set<string>();
    assessments.forEach((a) => {
      if (a.professional && a.professional.trim() && a.professional !== "Sistema") {
        set.add(a.professional.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [assessments]);

  // Sorted and filtered assessments
  const sortedAssessments = useMemo(() => {
    let list = [...assessments];

    if (professionalFilter !== "all") {
      list = list.filter(
        (a) => (a.professional || "").toLowerCase().trim() === professionalFilter.toLowerCase().trim()
      );
    }

    if (sortBy === "name") {
      list.sort((a, b) => (a.child_name || "").localeCompare(b.child_name || ""));
    } else {
      list.sort((a, b) => new Date(b.date || b.assessment_date).getTime() - new Date(a.date || a.assessment_date).getTime());
    }
    return list;
  }, [assessments, professionalFilter, sortBy]);

  // Delete Assessment
  const confirmDeleteAssessment = async () => {
    if (!assessmentToDelete) return;
    try {
      await nutritionService.deleteAssessment(assessmentToDelete);
      toast({
        title: "Evaluación eliminada",
        description: "El análisis nutricional ha sido eliminado correctamente.",
      });
      setAssessments((prev) => prev.filter((a) => a.id !== assessmentToDelete));
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el registro",
        variant: "destructive",
      });
    } finally {
      setAssessmentToDelete(null);
    }
  };

  // Delete Daily Ration
  const confirmDeleteDaily = async () => {
    if (!dailyRecordToDelete) return;
    try {
      await nutritionService.deleteRecord(dailyRecordToDelete);
      toast({ title: "Registro eliminado", description: "El registro diario ha sido eliminado." });
      setDailyRecords((prev) => prev.filter((r) => r.id !== dailyRecordToDelete));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo eliminar el registro", variant: "destructive" });
    } finally {
      setDailyRecordToDelete(null);
    }
  };

  const getSemaphoreBadge = (sem: string, diagnosis: string) => {
    const s = (sem || "").toUpperCase();
    if (s === "ROJO" || diagnosis.includes("Severa") || diagnosis.includes("Obesidad")) {
      return (
        <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30">
          {diagnosis || "Alerta Roja"}
        </Badge>
      );
    }
    if (s === "NARANJA" || diagnosis.includes("Moderada") || diagnosis.includes("Sobrepeso")) {
      return (
        <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">
          {diagnosis || "Sobrepeso / Riesgo"}
        </Badge>
      );
    }
    if (s === "AMARILLO" || diagnosis.includes("Riesgo")) {
      return (
        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
          {diagnosis || "En Observación"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
        {diagnosis || "Adecuado / Normal"}
      </Badge>
    );
  };

  const getConsumptionColor = (level: string) => {
    switch (level) {
      case "todo":
        return "text-green-500 font-bold";
      case "la_mayoria":
        return "text-green-400";
      case "la_mitad":
        return "text-yellow-500";
      case "poco":
        return "text-orange-500";
      case "nada":
        return "text-red-500 font-bold";
      default:
        return "";
    }
  };

  const getConsumptionLabel = (level: string) => {
    const labels: Record<string, string> = {
      todo: "Todo",
      la_mayoria: "La Mayoría",
      la_mitad: "La Mitad",
      poco: "Poco",
      nada: "Nada",
    };
    return labels[level] || level;
  };

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardContent className="p-6">
        {/* Sub-navigation Switcher between Histórico and Raciones Diarias */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-border/40">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/30">
            <Button
              variant={activeMode === "assessments" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveMode("assessments")}
              className="text-xs h-8 px-3"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Análisis Nutricional (Histórico)
            </Button>
            <Button
              variant={activeMode === "daily" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveMode("daily")}
              className="text-xs h-8 px-3"
            >
              <Utensils className="h-3.5 w-3.5 mr-1.5" />
              Ingesta y Raciones Diarias
            </Button>
          </div>

          {!readOnly && (
            <div>
              {activeMode === "assessments" ? (
                <Button onClick={() => setIsAssessmentDialogOpen(true)} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Evaluación Nutricional
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditingDailyRecord(null);
                    setIsDailyDialogOpen(true);
                  }}
                  size="sm"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Ración Diaria
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* MODE 1: HISTÓRICO DE ANÁLISIS NUTRICIONAL                      */}
        {/* ============================================================== */}
        {activeMode === "assessments" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por infante o nutricionista..."
                    value={assessmentSearch}
                    onChange={(e) => setAssessmentSearch(e.target.value)}
                    className="pl-9 bg-background/50 border-border/50 text-sm"
                  />
                </div>

                {/* Selector de Profesional: SOLO se muestra si existen más de un profesional registrado */}
                {professionalsList.length > 1 && (
                  <div className="w-full sm:w-[220px]">
                    <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                      <SelectTrigger className="bg-background/50 border-border/50 text-xs h-9">
                        <UserCheck className="h-3.5 w-3.5 mr-1.5 text-primary shrink-0" />
                        <SelectValue placeholder="Todos los profesionales" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los profesionales</SelectItem>
                        {professionalsList.map((prof) => (
                          <SelectItem key={prof} value={prof}>
                            {prof}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Sorter by Date or Name */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="flex bg-muted/40 p-1 rounded-lg border border-border/30">
                  <Button
                    variant={sortBy === "date" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSortBy("date")}
                    className="h-7 text-xs px-2.5"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    Fecha
                  </Button>
                  <Button
                    variant={sortBy === "name" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSortBy("name")}
                    className="h-7 text-xs px-2.5"
                  >
                    Nombre
                  </Button>
                </div>
              </div>
            </div>

            {/* Assessments Table */}
            {isLoadingAssessments ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Niño/a</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Diagnóstico Nutricional</TableHead>
                      <TableHead>Mediciones Antropométricas</TableHead>
                      <TableHead>Nutricionista / Profesional</TableHead>
                      {!readOnly && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAssessments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron registros de análisis nutricional.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedAssessments.map((item) => (
                        <TableRow key={`${item.source || "rec"}-${item.id}`} className="hover:bg-white/5">
                          <TableCell className="font-medium">
                            <div>
                              <span>{item.child_name}</span>
                              {item.child_cedula && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {item.child_cedula}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.date || item.assessment_date || "—"}
                          </TableCell>
                          <TableCell>
                            {getSemaphoreBadge(item.semaphore, item.nutritional_diagnosis)}
                          </TableCell>
                          <TableCell className="text-xs space-y-0.5">
                            <div>
                              <strong className="text-foreground">Peso:</strong> {item.weight_kg ?? "N/A"} kg
                              {item.z_score_weight !== null && item.z_score_weight !== undefined && (
                                <span className="text-muted-foreground ml-1">
                                  (Z: {item.z_score_weight.toFixed(2)})
                                </span>
                              )}
                            </div>
                            <div>
                              <strong className="text-foreground">Talla:</strong> {item.height_cm ?? "N/A"} cm
                              {item.z_score_height !== null && item.z_score_height !== undefined && (
                                <span className="text-muted-foreground ml-1">
                                  (Z: {item.z_score_height.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-foreground">{item.professional || "Nutricionista"}</span>
                          </TableCell>
                          {!readOnly && (
                            <TableCell className="text-right">
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setAssessmentToDelete(item.id)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                  title="Eliminar evaluación"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 2: CONTROL DE INGESTA Y RACIONES DIARIAS                 */}
        {/* ============================================================== */}
        {activeMode === "daily" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[180px] bg-background/50 backdrop-blur-sm"
                />
              </div>
              <Input
                placeholder="Buscar por nombre, cédula o comida..."
                value={dailyFilter}
                onChange={(e) => setDailyFilter(e.target.value)}
                className="max-w-full md:max-w-sm bg-background/50 backdrop-blur-sm"
              />
            </div>

            {isLoadingDaily ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Niño/a</TableHead>
                      <TableHead>Comida</TableHead>
                      <TableHead>Consumo</TableHead>
                      <TableHead>Menú / Notas</TableHead>
                      {!readOnly && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filteredRecords = dailyRecords.filter((item) => {
                        if (!dailyFilter.trim()) return true;
                        const q = dailyFilter.toLowerCase();
                        return (
                          item.child_name?.toLowerCase().includes(q) ||
                          item.child_cedula?.toLowerCase().includes(q) ||
                          item.meal_type?.replace("_", " ").toLowerCase().includes(q)
                        );
                      });
                      return filteredRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay registros de ingesta para la fecha seleccionada ({selectedDate}).
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRecords.map((item) => (
                          <TableRow key={item.id} className="hover:bg-white/5">
                            <TableCell className="font-medium">{item.child_name}</TableCell>
                            <TableCell className="capitalize">{item.meal_type.replace("_", " ")}</TableCell>
                            <TableCell>
                              <span className={getConsumptionColor(item.consumption_level)}>
                                {getConsumptionLabel(item.consumption_level)} (
                                {item.consumption_percentage ?? item.quantity ?? ""}% )
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                {item.menu_description && (
                                  <span className="font-medium">{item.menu_description}</span>
                                )}
                                {item.notes && (
                                  <span className="text-sm text-muted-foreground">{item.notes}</span>
                                )}
                              </div>
                            </TableCell>
                            {!readOnly && (
                              <TableCell className="text-right">
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDailyRecordToDelete(item.id)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    title="Eliminar ración"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Dialog for New Assessment */}
        <CreateAssessmentDialog
          open={isAssessmentDialogOpen}
          onOpenChange={setIsAssessmentDialogOpen}
          onSuccess={() => fetchAssessments(assessmentSearch)}
        />

        {/* Dialog for Daily Ration */}
        <CreateEditNutritionDialog
          open={isDailyDialogOpen}
          onOpenChange={setIsDailyDialogOpen}
          recordToEdit={editingDailyRecord}
          onSuccess={fetchDaily}
        />

        {/* Confirmation Dialog for Deleting Assessment */}
        <AlertDialog
          open={!!assessmentToDelete}
          onOpenChange={(open) => !open && setAssessmentToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar evaluación nutricional?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará el registro antropométrico del niño/a.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteAssessment} className="bg-red-600 hover:bg-red-700">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmation Dialog for Deleting Daily Record */}
        <AlertDialog
          open={!!dailyRecordToDelete}
          onOpenChange={(open) => !open && setDailyRecordToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar registro de comida?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará el registro de ingesta diaria seleccionado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteDaily} className="bg-red-600 hover:bg-red-700">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
