"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardService } from "@/services/dashboard.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";
import type { RecentApplication } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

const statusVariantMap: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
  approved: "default",
  pending: "outline",
  waitlist: "secondary",
  rejected: "destructive",
};

const statusLabelMap: { [key: string]: string } = {
  approved: "APROBADO",
  pending: "PENDIENTE",
  waitlist: "LISTA ESPERA",
  rejected: "RECHAZADO",
};

export function RecentAdmissions({ tenantId }: { tenantId?: number }) {
  const [applications, setApplications] = useState<RecentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      const data = await dashboardService.getRecentApplications(6, tenantId);
      setApplications(data);
    } catch (err) {
      console.error("Error fetching recent applications:", err);
      setError("Error al cargar postulaciones");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useAgentRefresh(fetchApplications);

  if (isLoading) {
    return (
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle>Postulaciones Recientes</CardTitle>
          <CardDescription>Cargando...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle>Postulaciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>Postulaciones Recientes</CardTitle>
        <CardDescription>
          Seguimiento del estado de las últimas postulaciones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niño/a</TableHead>
                <TableHead className="hidden sm:table-cell">Centro</TableHead>
                <TableHead className="hidden sm:table-cell">Estado</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay postulaciones recientes
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="font-medium">{app.child_name}</div>
                      <div className="text-sm text-muted-foreground sm:hidden">
                        {app.center} -{" "}
                        <Badge
                          variant={statusVariantMap[app.status] || "secondary"}
                          className="text-xs"
                        >
                          {statusLabelMap[app.status] || app.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{app.center}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={statusVariantMap[app.status] || "secondary"}>
                        {statusLabelMap[app.status] || app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {app.submission_date || "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}