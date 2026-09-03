import { AnalysisClient } from "@/components/analysis/analysis-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalysisPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Análisis de Datos con IA</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Realice preguntas en lenguaje natural para obtener información y visualizaciones sobre los datos del sistema.
                        El Agente Analista consultará la base de datos para darle una respuesta.
                    </CardDescription>
                </CardHeader>
            </Card>
            <AnalysisClient />
        </div>
    );
}
