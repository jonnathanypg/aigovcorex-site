import { ReportsClient } from "@/components/reportes/reports-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportesPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Generación de Reportes</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Genere reportes personalizados sobre asistencia, desarrollo, nutrición y más.
                    </CardDescription>
                </CardHeader>
            </Card>
            <ReportsClient />
        </div>
    );
}
