import { AttendanceClient } from "@/components/asistencia/attendance-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AsistenciaPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Control de Asistencia</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Registre y monitoree la asistencia diaria de los niños en los diferentes centros.
                    </CardDescription>
                </CardHeader>
            </Card>
            <AttendanceClient />
        </div>
    );
}
