"use client";

import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ingestionService, type IngestionEntity, type IngestionResult } from "@/services/ingestion.service";
import {
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
} from "lucide-react";

interface BulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenantId?: number;
    onSuccess?: () => void;
    /** Pre-select an entity when opening */
    defaultEntity?: string;
}

export function BulkUploadDialog({
    open,
    onOpenChange,
    tenantId,
    onSuccess,
    defaultEntity,
}: BulkUploadDialogProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [entities, setEntities] = useState<IngestionEntity[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<string>(defaultEntity || "");
    const [isLoadingEntities, setIsLoadingEntities] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<IngestionResult | null>(null);

    useEffect(() => {
        if (open) {
            loadEntities();
            setResult(null);
            setSelectedFile(null);
            if (defaultEntity) setSelectedEntity(defaultEntity);
        }
    }, [open, defaultEntity]);

    const loadEntities = async () => {
        setIsLoadingEntities(true);
        try {
            const data = await ingestionService.getEntities();
            setEntities(data);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "No se pudieron cargar las entidades.", variant: "destructive" });
        } finally {
            setIsLoadingEntities(false);
        }
    };

    const handleDownloadTemplate = async () => {
        if (!selectedEntity) return;
        try {
            await ingestionService.downloadTemplate(selectedEntity);
            toast({ title: "✅ Plantilla descargada", description: "Llene los datos y suba el archivo." });
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "No se pudo descargar la plantilla.", variant: "destructive" });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedEntity || !selectedFile) return;
        setIsUploading(true);
        setResult(null);
        try {
            const res = await ingestionService.uploadCsv(selectedEntity, selectedFile, tenantId);
            setResult(res);
            if (res.success > 0 && res.errors.length === 0) {
                toast({ title: "✅ Carga completa", description: `${res.success} registros creados exitosamente.` });
                onSuccess?.();
            } else if (res.success > 0) {
                toast({ title: "⚠️ Carga parcial", description: `${res.success} exitosos, ${res.errors.length} errores.`, variant: "destructive" });
            } else {
                toast({ title: "❌ Error en carga", description: `${res.errors.length} errores encontrados. Revise el detalle.`, variant: "destructive" });
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error || "Error inesperado al procesar el archivo.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const selectedEntityDef = entities.find(e => e.key === selectedEntity);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-headline flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Carga Masiva de Datos (CSV)
                    </DialogTitle>
                    <DialogDescription>
                        Descargue una plantilla, llénela con sus datos, y súbala para procesarla en lote.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Step 1: Select Entity */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">1. Seleccione el tipo de datos</label>
                        <Select value={selectedEntity} onValueChange={(v) => { setSelectedEntity(v); setResult(null); setSelectedFile(null); }}>
                            <SelectTrigger>
                                <SelectValue placeholder={isLoadingEntities ? "Cargando..." : "Seleccionar entidad"} />
                            </SelectTrigger>
                            <SelectContent>
                                {entities.map(e => (
                                    <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Show columns info */}
                    {selectedEntityDef && (
                        <Card className="bg-muted/30 border-border/30">
                            <CardContent className="p-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Columnas del CSV:</p>
                                <div className="flex flex-wrap gap-1">
                                    {selectedEntityDef.columns.map(col => (
                                        <Badge key={col.name} variant={col.required ? "default" : "outline"} className="text-xs">
                                            {col.name}{col.required ? " *" : ""}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 2: Download Template */}
                    {selectedEntity && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">2. Descargue la plantilla</label>
                            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
                                <Download className="mr-2 h-4 w-4" />
                                Descargar Plantilla CSV
                            </Button>
                        </div>
                    )}

                    {/* Step 3: Upload File */}
                    {selectedEntity && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">3. Suba el archivo CSV con datos</label>
                            <div
                                className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                                {selectedFile ? (
                                    <p className="text-sm font-medium text-foreground">
                                        📄 {selectedFile.name} <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Haga clic para seleccionar un archivo CSV</p>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <Card className={`border ${result.errors.length === 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    {result.errors.length === 0 ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                    )}
                                    <span className="font-medium">
                                        {result.success} exitosos{result.errors.length > 0 ? `, ${result.errors.length} errores` : ''}
                                        {result.total_rows ? ` de ${result.total_rows} filas` : ''}
                                    </span>
                                </div>

                                {result.errors.length > 0 && (
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {result.errors.map((err, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs">
                                                <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="font-medium">Fila {err.row}</span>
                                                    {err.field && <span className="text-muted-foreground"> ({err.field})</span>}
                                                    : {err.message}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!selectedEntity || !selectedFile || isUploading}
                    >
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Procesar CSV
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
