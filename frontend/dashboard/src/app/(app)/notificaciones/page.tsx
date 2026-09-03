import { NotificationClient } from "@/components/notificaciones/notification-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotificacionesPage() {
    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold tracking-tight font-headline">Centro de Notificaciones</CardTitle>
                    <CardDescription className="text-lg text-foreground/80">
                        Revise las últimas alertas, avisos y reportes generados por el sistema.
                    </CardDescription>
                </CardHeader>
            </Card>
            <NotificationClient />
        </div>
    );
}
