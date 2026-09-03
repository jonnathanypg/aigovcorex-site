"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    BookOpen,
    Upload,
    Trash2,
    Search,
    FileText,
    Globe,
    Building2,
    Loader2,
    Brain,
    FileUp,
} from "lucide-react";
import { knowledgeService } from "@/services/knowledge.service";
import type { KnowledgeDocument } from "@/types/knowledge";
import { UploadKnowledgeDialog } from "./upload-knowledge-dialog";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/auth.service";

export function KnowledgeClient() {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "center">("all");
    const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [userRole, setUserRole] = useState<string>("");
    const { toast } = useToast();

    const loadDocuments = useCallback(async () => {
        try {
            setIsLoading(true);
            const scope = scopeFilter === "all" ? undefined : scopeFilter;
            const res = await knowledgeService.list(scope);
            setDocuments(res.documents);
            setUserRole(res.role);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.response?.data?.error || "No se pudieron cargar los documentos",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [scopeFilter, toast]);

    useEffect(() => {
        // Check role access on mount
        const user = authService.getStoredUser();
        if (user) {
            const role = typeof user.role === 'string' ? user.role : (user.role as any)?.name;
            if (role !== 'license_admin' && role !== 'center_coordinator') {
                // Redirect unauthorized users
                window.location.href = '/dashboard';
                return;
            }
        }
        loadDocuments();
    }, [loadDocuments]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await knowledgeService.remove(deleteTarget.id);
            toast({
                title: "Eliminado",
                description: `"${deleteTarget.title}" ha sido eliminado exitosamente.`,
            });
            setDeleteTarget(null);
            loadDocuments();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.response?.data?.error || "No se pudo eliminar el documento",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredDocs = documents.filter((doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const canDelete = (doc: KnowledgeDocument) => {
        if (userRole === "license_admin") return true;
        if (userRole === "center_coordinator" && doc.tenant_id !== null) return true;
        return false;
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Base de Conocimiento</h1>
                        <p className="text-muted-foreground text-sm">
                            Gestiona los documentos que alimentan la memoria del asistente IA.
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar documentos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {/* Scope Filter Buttons */}
                    <div className="flex gap-1 border rounded-lg p-0.5">
                        {(["all", "global", "center"] as const).map((s) => (
                            <Button
                                key={s}
                                variant={scopeFilter === s ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setScopeFilter(s)}
                                className="text-xs px-3"
                            >
                                {s === "all" ? "Todos" : s === "global" ? "Global" : "Centro"}
                            </Button>
                        ))}
                    </div>
                </div>
                <Button onClick={() => setUploadOpen(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Subir Documento
                </Button>
            </div>

            {/* Content */}
            <div className="border rounded-lg">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-3" />
                        <p>Cargando documentos...</p>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <FileUp className="h-12 w-12 mb-4 opacity-40" />
                        <p className="font-medium">No hay documentos</p>
                        <p className="text-sm mt-1">
                            Suba archivos PDF o textos para que el asistente IA los use como referencia.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4 gap-2"
                            onClick={() => setUploadOpen(true)}
                        >
                            <Upload className="h-4 w-4" /> Subir primer documento
                        </Button>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Documento</TableHead>
                                <TableHead>Alcance</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Fragmentos</TableHead>
                                <TableHead>Subido por</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDocs.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{doc.title}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={doc.scope === "global" ? "default" : "secondary"}
                                            className="gap-1"
                                        >
                                            {doc.scope === "global" ? (
                                                <>
                                                    <Globe className="h-3 w-3" />
                                                    Global
                                                </>
                                            ) : (
                                                <>
                                                    <Building2 className="h-3 w-3" />
                                                    {doc.tenant_name || "Centro"}
                                                </>
                                            )}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs uppercase text-muted-foreground font-medium">
                                            {doc.source_type}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{doc.chunk_count}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {doc.uploaded_by || "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {doc.created_at
                                                ? new Date(doc.created_at).toLocaleDateString("es-EC", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })
                                                : "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {canDelete(doc) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => setDeleteTarget(doc)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Upload Dialog */}
            <UploadKnowledgeDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onSuccess={loadDocuments}
                userRole={userRole}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente &quot;{deleteTarget?.title}&quot; de la base de
                            conocimiento. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...
                                </>
                            ) : (
                                "Eliminar"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
