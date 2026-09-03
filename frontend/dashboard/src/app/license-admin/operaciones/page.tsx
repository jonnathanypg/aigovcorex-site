"use client";

import React from "react";
import { OperationsClient } from "@/components/operaciones/operations-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseOperationsPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Operaciones y Mantenimiento Global</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Gestione las tareas de mantenimiento y operaciones de todos sus centros desde un solo lugar.
                    </CardDescription>
                </CardHeader>
            </Card>
            <OperationsClient key={tenantId || 'all'} tenantId={tenantId} />
        </div>
    );
}
