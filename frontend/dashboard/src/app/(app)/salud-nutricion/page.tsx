import { HealthClient } from "@/components/salud-nutricion/health-client";
import { NutritionClient } from "@/components/salud-nutricion/nutrition-client";
import { MenuClient } from "@/components/salud-nutricion/menu-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SaludNutricionPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Salud y Nutrición</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Registre y monitoree el estado de salud y nutrición de los niños.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Tabs defaultValue="health" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="health">Control de Salud</TabsTrigger>
                    <TabsTrigger value="nutrition">Nutrición Diaria</TabsTrigger>
                    <TabsTrigger value="menu">Menú Semanal</TabsTrigger>
                </TabsList>
                <TabsContent value="health" className="mt-4">
                    <HealthClient />
                </TabsContent>
                <TabsContent value="nutrition" className="mt-4">
                    <NutritionClient />
                </TabsContent>
                <TabsContent value="menu" className="mt-4">
                    <MenuClient />
                </TabsContent>
            </Tabs>
        </div>
    );
}
