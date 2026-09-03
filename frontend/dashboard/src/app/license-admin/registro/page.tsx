"use client";

import React from "react";
import { RegisterClient } from "@/components/registro/register-client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseRegistryPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Registros de Niños (Global)</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Gestione el padrón de niños inscritos en todos los centros de su licencia.
                    </CardDescription>
                </CardHeader>
            </Card>
            {/* Force remount to ensure clean state on center change */}
            <RegisterClient key={tenantId || 'all'} tenantId={tenantId} />
        </div>
    );
}
