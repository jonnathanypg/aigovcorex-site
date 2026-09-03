"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload } from "lucide-react";
import { BulkUploadDialog } from "@/components/shared/bulk-upload-dialog";
import { useLicense } from "@/contexts/license-context";

export default function IngestionPage() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [defaultEntity, setDefaultEntity] = useState<string | undefined>();
    const { selectedCenterId } = useLicense();
    const tenantId = selectedCenterId === 'all' ? undefined : Number(selectedCenterId);

    const openWith = (entity: string) => {
        setDefaultEntity(entity);
        setDialogOpen(true);
    };

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
                                    Importe datos en lote utilizando archivos CSV. Descargue plantillas, llénelas y súbalas.
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
                {[
                    { key: 'usuarios', emoji: '👤', title: 'Usuarios', desc: 'Coordinadores, educadoras y personal' },
                    { key: 'ninos', emoji: '👶', title: 'Niños/as', desc: 'Con datos de familia y representante' },
                    { key: 'asistencia', emoji: '📋', title: 'Asistencia', desc: 'Registros diarios de asistencia' },
                    { key: 'nutricion', emoji: '🍽️', title: 'Nutrición', desc: 'Consumo diario de alimentos' },
                    { key: 'hitos', emoji: '🎯', title: 'Hitos', desc: 'Hitos de desarrollo infantil' },
                    { key: 'menu_semanal', emoji: '📅', title: 'Menú Semanal', desc: 'Planificación alimentaria' },
                    { key: 'salud', emoji: '💊', title: 'Salud', desc: 'Controles médicos y peso/talla' },
                ].map(item => (
                    <Card
                        key={item.key}
                        className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-accent/50 border-border/30"
                        onClick={() => openWith(item.key)}
                    >
                        <CardContent className="p-5">
                            <div className="text-3xl mb-2">{item.emoji}</div>
                            <h3 className="font-semibold font-headline">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
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
