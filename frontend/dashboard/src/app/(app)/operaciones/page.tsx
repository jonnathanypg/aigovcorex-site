import { OperationsClient } from "@/components/operaciones/operations-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperacionesPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Gestión de Operaciones</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Administre recursos, personal y la logística general de los centros.
                    </CardDescription>
                </CardHeader>
            </Card>
            <OperationsClient />
        </div>
    );
}
