"use client"

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "../ui/button";
import { PlusCircle, Loader2, MoreHorizontal, FileEdit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/use-role";
import { interventionsService, type FamilyIntervention } from "@/services/interventions.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import { CreateInterventionDialog } from "./create-intervention-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface FamilyInterventionClientProps {
  tenantId?: number;
}

export function FamilyInterventionClient({ tenantId }: FamilyInterventionClientProps) {
  const { role, center, canDelete } = useRole();
  const { toast } = useToast();
  const [interventions, setInterventions] = useState<FamilyIntervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchInterventions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await interventionsService.getAll(tenantId);
      setInterventions(data);
    } catch (error) {
      console.error("Error fetching interventions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchInterventions();
  }, [fetchInterventions]);
  useAgentRefresh(fetchInterventions);

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta intervención?")) return;
    try {
      await interventionsService.delete(id);
      toast({ title: "Intervención eliminada", description: "El registro ha sido eliminado correctamente." });
      fetchInterventions();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo eliminar el registro", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
          <Input
            placeholder="Buscar por familia, tipo, motivo o profesional..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-full md:max-w-sm bg-background/50"
          />
          <Button onClick={handleCreate} className="w-full md:w-auto"><PlusCircle className="mr-2" /> Nueva Intervención</Button>
        </div>
        <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
          <Table>
            <TableHeader>
              <TableRow className="hidden md:table-row hover:bg-transparent">
                <TableHead>Familia</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const filteredInterventions = interventions.filter(item => {
                  if (!filter.trim()) return true;
                  const q = filter.toLowerCase();
                  return item.family_name?.toLowerCase().includes(q) ||
                         item.type?.toLowerCase().includes(q) ||
                         item.reason?.toLowerCase().includes(q) ||
                         item.professional?.toLowerCase().includes(q);
                });
                return filteredInterventions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">No hay intervenciones que coincidan</TableCell>
                </TableRow>
              ) : (
                filteredInterventions.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow className="md:hidden flex flex-col p-4 space-y-2 border-b border-border/10">
                      <TableCell className="font-medium text-base">{item.family_name}</TableCell>
                      <TableCell><span className="font-semibold md:hidden mr-2">Centro:</span>{center}</TableCell>
                      <TableCell><span className="font-semibold md:hidden mr-2">Fecha:</span>{item.date}</TableCell>
                      <TableCell><span className="font-semibold md:hidden mr-2">Tipo:</span>{item.type}</TableCell>
                      <TableCell><span className="font-semibold md:hidden mr-2">Motivo:</span>{item.reason}</TableCell>
                      <TableCell><span className="font-semibold md:hidden mr-2">Profesional:</span>{item.professional}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(item.id)}>Editar</Button>
                        {canDelete && <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>Eliminar</Button>}
                      </TableCell>
                    </TableRow>
                    <TableRow className="hidden md:table-row hover:bg-white/5">
                      <TableCell className="font-medium">{item.family_name}</TableCell>
                      <TableCell>{center}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                      <TableCell>{item.professional}</TableCell>
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
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )));
              })()}            </TableBody>
          </Table>
        </div>

        <CreateInterventionDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={fetchInterventions}
          interventionIdToEdit={editingId}
        />
      </CardContent>
    </Card>
  );
}