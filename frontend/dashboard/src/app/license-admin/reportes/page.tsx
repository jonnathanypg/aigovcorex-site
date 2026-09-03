"use client";

import React from "react";
import { ReportsClient } from "@/components/reportes/reports-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseReportsPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Generación de Reportes Globales</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Genere reportes consolidados o específicos por centro sobre asistencia, desarrollo y salud.
                    </CardDescription>
                </CardHeader>
            </Card>
            <ReportsClient key={tenantId || 'all'} tenantId={tenantId} />
        </div>
    );
}
