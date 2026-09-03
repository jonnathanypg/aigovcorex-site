"use client";

import React from "react";
import { FamilyInterventionClient } from "@/components/intervencion-familiar/family-intervention-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseInterventionsPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Intervenciones Familiares Globales</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Supervise y gestione las intervenciones familiares registradas en todos los centros de la licencia.
                    </CardDescription>
                </CardHeader>
            </Card>
            <FamilyInterventionClient key={tenantId || 'all'} tenantId={tenantId} />
        </div>
    );
}
