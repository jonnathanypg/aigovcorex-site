"use client";

import React from "react";
import { AttendanceClient } from "@/components/asistencia/attendance-client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseAttendancePage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Monitor de Asistencia Global</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Gestione el estado de asistencia en todos los centros asociados a su licencia.
                    </CardDescription>
                </CardHeader>
            </Card>
            {/* Force component remount when tenantId changes to ensure clean state */}
            <AttendanceClient key={tenantId || 'all'} tenantId={tenantId} />
        </div>
    );
}
