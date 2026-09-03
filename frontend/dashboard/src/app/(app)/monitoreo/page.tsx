"use client";

import { MonitoringClient } from "@/components/monitoreo/monitoring-client";
import { MonitoringCharts } from "@/components/monitoreo/monitoring-charts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MonitoreoPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Monitoreo de Centros</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Supervise los indicadores clave de rendimiento (KPIs) de los centros en tiempo real.
                    </CardDescription>
                </CardHeader>
            </Card>
            {/* KPI Cards */}
            <MonitoringClient />
            {/* Analytics Charts */}
            <MonitoringCharts />
        </div>
    );
}

