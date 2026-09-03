"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Heart, Activity, Apple, Loader2 } from "lucide-react";
import { monitoringService, type MonitoringKPI } from "@/services/monitoring.service";
import { useAgentRefresh } from "@/hooks/use-agent-refresh";

const statusColorMap = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  danger: "bg-red-500",
};

const iconMap: { [key: string]: React.ElementType } = {
  Users,
  Heart,
  Activity,
  Apple
};

interface MonitoringClientProps {
  tenantId?: number;
}

export function MonitoringClient({ tenantId }: MonitoringClientProps) {
  const [kpis, setKpis] = useState<MonitoringKPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKpis = useCallback(async () => {
    try {
      const data = await monitoringService.getKpis(tenantId);
      setKpis(data);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);
  useAgentRefresh(fetchKpis);

  if (isLoading) {
    return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.icon] || Activity;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">
                Objetivo: {kpi.target}
              </p>
              <Progress
                value={parseInt(kpi.value.replace('%', '')) || 0}
                className="mt-4 h-2"
                indicatorClassName={statusColorMap[kpi.status]}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// This is a temporary fix for the progress indicator color, will be removed later.
declare module "@/components/ui/progress" {
  interface ProgressProps {
    indicatorClassName?: string;
  }
}
