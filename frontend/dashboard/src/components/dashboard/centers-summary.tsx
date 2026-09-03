"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { dashboardService } from "@/services/dashboard.service";
import type { DashboardStats, TenantSummary } from "@/types";
import { Loader2 } from "lucide-react";

export function CentersSummary() {
    const [summary, setSummary] = useState<TenantSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        dashboardService.getStats().then(data => {
            if (data.tenants_summary) {
                setSummary(data.tenants_summary);
            }
        }).catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
    if (summary.length === 0) return null;

    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Desempeño por Centro</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Centro</TableHead>
                            <TableHead>Matriculados</TableHead>
                            <TableHead>Capacidad</TableHead>
                            <TableHead>Ocupación</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summary.map((center) => {
                            const occupancy = Math.round((center.children_count / center.capacity) * 100);
                            return (
                                <TableRow key={center.id}>
                                    <TableCell className="font-medium">{center.name}</TableCell>
                                    <TableCell>{center.children_count}</TableCell>
                                    <TableCell>{center.capacity}</TableCell>
                                    <TableCell className="w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <Progress value={occupancy} className="h-2" />
                                            <span className="text-xs text-muted-foreground w-12 text-right">
                                                {occupancy}%
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
