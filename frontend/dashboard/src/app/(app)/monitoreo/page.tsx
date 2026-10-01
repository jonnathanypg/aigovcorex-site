"use client";

import { useState } from "react";
import { MonitoringClient } from "@/components/monitoreo/monitoring-client";
import { MonitoringCharts } from "@/components/monitoreo/monitoring-charts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter, type DateRange } from "@/components/dashboard/date-range-filter";
import { useLicense } from "@/contexts/license-context";

export default function MonitoreoPage() {
    const { isLicenseAdmin, selectedCenterId } = useLicense();
    const tenantId = (isLicenseAdmin && selectedCenterId !== 'all') ? Number(selectedCenterId) : undefined;
    const [range, setRange] = useState<DateRange>({ preset: "month" });

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Monitoreo de Centros</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Supervise los indicadores clave de rendimiento (KPIs) de los centros en tiempo real. Filtre por fechas específicas o periodos personalizados.
                    </CardDescription>
                </CardHeader>
            </Card>
            <DateRangeFilter value={range} onChange={setRange} />
            {/* KPI Cards */}
            <MonitoringClient key={`${tenantId || 'all'}-${range.from}-${range.to}`} tenantId={tenantId} from={range.from} to={range.to} />
            {/* Analytics Charts */}
            <MonitoringCharts key={`charts-${tenantId || 'all'}-${range.from}-${range.to}`} tenantId={tenantId} isLicenseAdmin={isLicenseAdmin} from={range.from} to={range.to} />
        </div>
    );
}
