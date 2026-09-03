"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload, Loader2 } from "lucide-react";
import { BulkUploadDialog } from "@/components/shared/bulk-upload-dialog";
import { authService } from "@/services/auth.service";
import { ingestionService, type IngestionEntity } from "@/services/ingestion.service";

// Emoji mapping for entity cards
const ENTITY_EMOJIS: Record<string, string> = {
    'usuarios': '👤',
    'ninos': '👶',
    'asistencia': '📋',
    'nutricion': '🍽️',
    'hitos': '🎯',
    'menu_semanal': '📅',
    'salud': '💊',
};

// Description mapping for entity cards
const ENTITY_DESCRIPTIONS: Record<string, string> = {
    'usuarios': 'Coordinadores, educadoras y personal',
    'ninos': 'Con datos de familia y representante',
    'asistencia': 'Registros diarios de asistencia',
    'nutricion': 'Consumo diario de alimentos',
    'hitos': 'Hitos de desarrollo infantil',
    'menu_semanal': 'Planificación alimentaria',
    'salud': 'Controles médicos y peso/talla',
};

export default function GeneralIngestionPage() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [defaultEntity, setDefaultEntity] = useState<string | undefined>();
    const [availableEntities, setAvailableEntities] = useState<IngestionEntity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const user = authService.getStoredUser();
    const tenantId = user?.tenant_id ? Number(user.tenant_id) : undefined;

    useEffect(() => {
        loadAvailableEntities();
    }, []);

    const loadAvailableEntities = async () => {
        setIsLoading(true);
        try {
            const entities = await ingestionService.getEntities();
            setAvailableEntities(entities);
        } catch (e) {
            console.error("Error loading entities:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const openWith = (entity: string) => {
        setDefaultEntity(entity);
        setDialogOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (availableEntities.length === 0) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
                <h2 className="text-2xl font-bold font-headline text-foreground">Sin acceso</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    No tiene permisos para realizar cargas masivas de datos en ninguna entidad del sistema. Contacte a su administrador.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-card/10 backdrop-blur-lg border-border/20">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <FileSpreadsheet className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl font-bold tracking-tight font-headline">
                                    Carga Masiva de Datos
                                </CardTitle>
                                <CardDescription className="text-lg text-foreground/80">
                                    Importe datos en lote utilizando archivos CSV. Acceso filtrado según su rol.
                                </CardDescription>
                            </div>
                        </div>
                        <Button size="lg" onClick={() => { setDefaultEntity(undefined); setDialogOpen(true); }}>
                            <Upload className="mr-2 h-4 w-4" />
                            Nueva Carga
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableEntities.map((entity) => (
                    <Card
                        key={entity.key}
                        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-accent/50 border-border/30"
                        onClick={() => openWith(entity.key)}
                    >
                        <CardContent className="p-5">
                            <div className="text-3xl mb-2">{ENTITY_EMOJIS[entity.key] || '📄'}</div>
                            <h3 className="font-semibold font-headline">{entity.label}</h3>
                            <p className="text-sm text-muted-foreground">
                                {ENTITY_DESCRIPTIONS[entity.key] || 'Datos del sistema'}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <BulkUploadDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                tenantId={tenantId}
                defaultEntity={defaultEntity}
            />
        </div>
    );
}
