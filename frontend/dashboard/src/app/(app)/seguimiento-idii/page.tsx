import { IdiiTrackingClient } from "@/components/seguimiento-idii/idii-tracking-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SeguimientoIdiiPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Seguimiento IDII</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Registre y evalúe los resultados del Instrumento de Desarrollo Infantil Integral (IDII).
                    </CardDescription>
                </CardHeader>
            </Card>
            <IdiiTrackingClient />
        </div>
    );
}
