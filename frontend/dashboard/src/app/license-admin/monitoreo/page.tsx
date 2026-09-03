"use client";

import React from "react";
import { MonitoringClient } from "@/components/monitoreo/monitoring-client";
import { MonitoringCharts } from "@/components/monitoreo/monitoring-charts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseMonitoringPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Monitoreo Global de Centros</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Supervise los indicadores clave de rendimiento (KPIs) de todos los centros asociados a su licencia.
                    </CardDescription>
                </CardHeader>
            </Card>
            {/* KPI Cards */}
            <MonitoringClient key={tenantId || 'all'} tenantId={tenantId} />
            {/* Analytics Charts */}
            <MonitoringCharts key={`charts-${tenantId || 'all'}`} tenantId={tenantId} isLicenseAdmin={true} />
        </div>
    );
}

