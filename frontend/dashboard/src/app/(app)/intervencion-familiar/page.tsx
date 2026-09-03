import { FamilyInterventionClient } from "@/components/intervencion-familiar/family-intervention-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntervencionFamiliarPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Intervención Familiar</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Planifique, registre y dé seguimiento a las intervenciones realizadas con las familias.
                    </CardDescription>
                </CardHeader>
            </Card>
            <FamilyInterventionClient />
        </div>
    );
}
