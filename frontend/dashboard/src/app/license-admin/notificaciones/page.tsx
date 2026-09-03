"use client";

import React from "react";
import { NotificationClient } from "@/components/notificaciones/notification-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicense } from "@/contexts/license-context";

export default function LicenseNotificationsPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Centro de Notificaciones Global</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Centro de alertas y avisos consolidados de todos los centros operativos.
                    </CardDescription>
                </CardHeader>
            </Card>
            <NotificationClient key={tenantId || 'all'} tenantId={tenantId} />
        </div>
    );
}
