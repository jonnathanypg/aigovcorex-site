
"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, FileText, Globe, Building2 } from "lucide-react";
import { knowledgeService } from "@/services/knowledge.service";
import { licenseAdminService } from "@/services/license-admin.service";
import { useToast } from "@/hooks/use-toast";

interface UploadKnowledgeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    userRole: string;
}

export function UploadKnowledgeDialog({
    open,
    onOpenChange,
    onSuccess,
    userRole,
}: UploadKnowledgeDialogProps) {
    const [title, setTitle] = useState("");
    const [scope, setScope] = useState<"global" | "center">("global");
    const [tenantId, setTenantId] = useState("");
    const [contentText, setContentText] = useState("");
    const [inputMode, setInputMode] = useState<"file" | "text">("file");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [centers, setCenters] = useState<{ id: number; name: string }[]>([]);
    const { toast } = useToast();

    // Load centers for license admins
    useEffect(() => {
        if (open && userRole === "license_admin") {
            licenseAdminService
                .getCenters()
                .then(setCenters)
                .catch(console.error);
        }
    }, [open, userRole]);

    const resetForm = () => {
        setTitle("");
        setScope("global");
        setTenantId("");
        setContentText("");
        setSelectedFile(null);
        setInputMode("file");
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast({ title: "Error", description: "El título es obligatorio", variant: "destructive" });
            return;
        }

        if (inputMode === "file" && !selectedFile) {
            toast({ title: "Error", description: "Seleccione un archivo", variant: "destructive" });
            return;
        }

        if (inputMode === "text" && !contentText.trim()) {
            toast({ title: "Error", description: "Ingrese el contenido de texto", variant: "destructive" });
            return;
        }

        if (scope === "center" && userRole === "license_admin" && !tenantId) {
            toast({ title: "Error", description: "Seleccione un centro", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("title", title.trim());
            formData.append("scope", scope);

            if (scope === "center" && tenantId) {
                formData.append("tenant_id", tenantId);
            }

            if (inputMode === "file" && selectedFile) {
                formData.append("file", selectedFile);
            } else if (inputMode === "text") {
                formData.append("content", contentText.trim());
            }

            const res = await knowledgeService.upload(formData);
            toast({
                title: "¡Documento indexado!",
                description: `"${res.document.title}" se ha añadido a la base de conocimiento con ${res.document.chunk_count} fragmentos.`,
            });
            resetForm();
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            toast({
                title: "Error al subir",
                description: error?.response?.data?.error || "No se pudo procesar el documento",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Get extension (robust way)
            const parts = file.name.split(".");
            const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : "";

            if (!["pdf", "txt", "docx"].includes(ext || "")) {
                toast({
                    title: "Formato no soportado",
                    description: `Extensión detectada: .${ext}. Solo se permiten archivos .pdf, .docx y .txt`,
                    variant: "destructive",
                });
                return;
            }
            setSelectedFile(file);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) resetForm();
                onOpenChange(isOpen);
            }}
        >
            <DialogContent className="sm:max-w-[520px] bg-background/95 backdrop-blur-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Subir Documento
                    </DialogTitle>
                    <DialogDescription>
                        Añada documentos (PDF, Word, TXT) para que el asistente IA los utilice.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="doc-title">
                            Título <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="doc-title"
                            placeholder="Ej: Normativa MIES 2026"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Scope */}
                    <div className="space-y-2">
                        <Label>Alcance</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={scope === "global" ? "default" : "outline"}
                                onClick={() => setScope("global")}
                                className="flex-1 gap-2"
                                disabled={userRole === "center_coordinator"}
                            >
                                <Globe className="h-4 w-4" />
                                Global
                            </Button>
                            <Button
                                type="button"
                                variant={scope === "center" ? "default" : "outline"}
                                onClick={() => setScope("center")}
                                className="flex-1 gap-2"
                            >
                                <Building2 className="h-4 w-4" />
                                Centro
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {scope === "global"
                                ? "Visible para todos los centros de la licencia."
                                : "Visible solo para el centro seleccionado."}
                        </p>
                    </div>

                    {/* Center Selector (License Admin + Center scope) */}
                    {scope === "center" && userRole === "license_admin" && (
                        <div className="space-y-2 animate-in fade-in-0 duration-200">
                            <Label>
                                Centro destino <span className="text-destructive">*</span>
                            </Label>
                            <Select value={tenantId} onValueChange={setTenantId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un centro" />
                                </SelectTrigger>
                                <SelectContent>
                                    {centers.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Input Mode Toggle */}
                    <div className="space-y-2">
                        <Label>Fuente del contenido</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={inputMode === "file" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setInputMode("file")}
                                className="gap-1.5"
                            >
                                <FileText className="h-3.5 w-3.5" /> Archivo
                            </Button>
                            <Button
                                type="button"
                                variant={inputMode === "text" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setInputMode("text")}
                                className="gap-1.5"
                            >
                                <FileText className="h-3.5 w-3.5" /> Texto
                            </Button>
                        </div>
                    </div>

                    {/* File Input */}
                    {inputMode === "file" && (
                        <div className="space-y-2 animate-in fade-in-0 duration-200">
                            <Label htmlFor="doc-file">
                                Archivo <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="doc-file"
                                type="file"
                                accept=".pdf,.txt,.docx"
                                onChange={handleFileChange}
                                className="cursor-pointer"
                            />
                            {selectedFile && (
                                <p className="text-xs text-muted-foreground">
                                    📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                </p>
                            )}
                        </div>
                    )}

                    {/* Text Input */}
                    {inputMode === "text" && (
                        <div className="space-y-2 animate-in fade-in-0 duration-200">
                            <Label htmlFor="doc-content">
                                Contenido <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="doc-content"
                                placeholder="Pegue o escriba el contenido del documento aquí..."
                                value={contentText}
                                onChange={(e) => setContentText(e.target.value)}
                                rows={8}
                                className="resize-none"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isUploading}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isUploading} className="gap-2">
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                Subir e Indexar
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
