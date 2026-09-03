import { SecurityClient } from "@/components/seguridad/security-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SeguridadPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Seguridad y Perfiles</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Gestione usuarios, roles y permisos de acceso al sistema.
                    </CardDescription>
                </CardHeader>
            </Card>
            <SecurityClient />
        </div>
    );
}
