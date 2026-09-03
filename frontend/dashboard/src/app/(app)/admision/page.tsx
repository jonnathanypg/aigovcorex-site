import { AdmissionClient } from "@/components/admision/admission-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdmisionPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Admisión de Postulantes</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Gestione las postulaciones de nuevos ingresos, revise el estado y apruebe o rechace las solicitudes.
                    </CardDescription>
                </CardHeader>
            </Card>
            <AdmissionClient />
        </div>
    );
}
