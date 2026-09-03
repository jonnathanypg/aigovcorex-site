"use client";

import React from "react";
import { HealthClient } from "@/components/salud-nutricion/health-client";
import { NutritionClient } from "@/components/salud-nutricion/nutrition-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLicense } from "@/contexts/license-context";

export default function LicenseHealthPage() {
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Salud y Nutrición Global</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Gestione el estado de salud y nutrición de los niños en todos los centros.
                    </CardDescription>
                </CardHeader>
            </Card>
            <Tabs defaultValue="salud" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="salud">Control de Salud</TabsTrigger>
                    <TabsTrigger value="nutricion">Nutrición Diaria</TabsTrigger>
                </TabsList>
                <TabsContent value="salud">
                    <HealthClient key={tenantId || 'all'} tenantId={tenantId} />
                </TabsContent>
                <TabsContent value="nutricion">
                    <NutritionClient key={tenantId || 'all'} tenantId={tenantId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
