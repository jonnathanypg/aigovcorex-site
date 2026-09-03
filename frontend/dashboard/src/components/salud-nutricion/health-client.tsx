"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { healthService, type HealthActivity } from "@/services/health.service";
import { Loader2, PlusCircle, MoreHorizontal, FileEdit, Trash2, ArrowDownAZ, Calendar as CalendarIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/use-role";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateHealthRecordDialog } from "./create-health-record-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface HealthClientProps {
  tenantId?: number;
  readOnly?: boolean;
}

export function HealthClient({ tenantId, readOnly = false }: HealthClientProps) {
  const { canDelete } = useRole();
  const { toast } = useToast();
  const [activities, setActivities] = useState<HealthActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

  const fetchData = useCallback(async (query: string = "") => {
    try {
      setIsLoading(true);
      const data = await healthService.getRecentActivity(100, tenantId, query.trim());
      setActivities(data || []);
    } catch (error) {
      console.error("Error loading health activity:", error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchData]);

  useAgentRefresh(() => fetchData(searchQuery));

  const handleEdit = (id: number) => {
    setEditingRecordId(id);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRecordId(null);
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await healthService.deleteHealthRecord(recordToDelete);
      toast({ title: "Registro eliminado", description: "El registro ha sido eliminado correctamente." });
      setActivities(prev => prev.filter(a => a.id !== recordToDelete));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo eliminar el registro", variant: "destructive" });
    } finally {
      setRecordToDelete(null);
    }
  };

  const sortedActivities = useMemo(() => {
    const list = [...activities];
    if (sortBy === "name") {
      list.sort((a, b) => (a.child_name || "").localeCompare(b.child_name || ""));
    } else {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return list;
  }, [activities, sortBy]);

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por infante o profesional..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 text-sm"
            />
          </div>

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
                <ArrowDownAZ className="h-3.5 w-3.5 mr-1" />
                Nombre
              </Button>
            </div>

            {!readOnly && (
              <Button onClick={handleCreate} size="sm" className="h-8 shadow-sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Registro
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs text-foreground">Infante</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Fecha</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Edad</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Tipo</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Detalle / Hallazgo</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Profesional</TableHead>
                  {!readOnly && <TableHead className="text-right text-xs font-semibold text-foreground">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {sortedActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No se encontraron registros coincidentes con la búsqueda." : "No hay registros de salud registrados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedActivities.map((item) => (
                    <TableRow key={item.id} className="hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        <div>
                          <span>{item.child_name}</span>
                          {item.child_cedula && (
                            <span className="block text-[11px] font-mono text-muted-foreground">
                              CI: {item.child_cedula}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.date}</TableCell>
                      <TableCell>{item.age_at_measurement || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs font-normal">
                          {item.type === "crecimiento" ? "📏 Crecimiento" : item.type === "incidente" ? "⚠️ Incidente" : item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[280px]">{item.result}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.professional}</TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(item.id)}>
                                <FileEdit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {canDelete && (
                                <DropdownMenuItem className="text-destructive" onClick={() => setRecordToDelete(item.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <CreateHealthRecordDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          recordIdToEdit={editingRecordId}
          onSuccess={() => fetchData(searchQuery)}
        />

        <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro de eliminar este registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El registro de salud será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
