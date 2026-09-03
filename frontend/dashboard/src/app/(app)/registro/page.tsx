import { RegisterClient } from "@/components/registro/register-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegistroPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Registro y Padrón Nominal</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Busque, visualice y gestione la información de los niños y niñas registrados en los centros.
                    </CardDescription>
                </CardHeader>
            </Card>
            <RegisterClient />
        </div>
    );
}
