"use client";

import { useState, useEffect } from "react";
import { 
    Upload, 
    Search, 
    FileText, 
    Trash2, 
    Loader2, 
    ChevronDown,
    ChevronUp,
    Sparkles,
    File,
    X,
    CheckCircle2
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { socialKnowledgeService } from "@/services/social-rag.service";
import { cn } from "@/lib/utils";

export function SocialKnowledgeManager({ 
    programId, 
    className 
}: { 
    programId?: number; 
    className?: string; 
}) {
    const [documents, setDocuments] = useState<Array<{
        id: string;
        filename: string;
        chunks: number;
        uploaded_at: string;
        scope: 'global' | 'center';
    }>>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Array<{
        id: string;
        score: number;
        preview: string;
        metadata: Record<string, any>;
    }>>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const onDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        
        setUploading(true);
        try {
            for (const file of acceptedFiles) {
                const result = await socialKnowledgeService.uploadDocument(file, 'global');
                if (result.success) {
                    toast.success(`${file.name}: ${result.message} (${result.chunks} fragmentos)`);
                } else {
                    toast.error(`${file.name}: ${result.message}`);
                }
            }
            // Refresh document list (would need a list endpoint)
            toast.info("Documentos subidos. La lista se actualizará automáticamente.");
        } catch (error) {
            toast.error("Error al subir documentos");
        } finally {
            setUploading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt', '.md'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc'],
            'text/csv': ['.csv'],
            'application/json': ['.json'],
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        disabled: uploading,
    });

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim() || searchQuery.length < 2) return;
        
        setIsSearching(true);
        try {
            const results = await socialKnowledgeService.search(searchQuery, 10);
            setSearchResults(results);
            setShowResults(true);
        } catch (error) {
            toast.error("Error en la búsqueda");
        } finally {
            setIsSearching(false);
        }
    };

    const handleContextQuery = async () => {
        if (!searchQuery.trim()) return;
        
        setIsSearching(true);
        try {
            const result = await socialKnowledgeService.getContext(searchQuery, 2000);
            if (result.has_context) {
                toast.success("Contexto encontrado para inyección en prompt");
                navigator.clipboard.writeText(result.formatted);
                toast.info("Contexto copiado al portapapeles - listo para pegar en prompt de IA");
            } else {
                toast.info("No se encontró contexto relevante para esta consulta");
            }
        } catch (error) {
            toast.error("Error al obtener contexto");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className={cn("space-y-6", className)}>
            {/* Upload Zone */}
            <Card className="border-dashed border-border/30">
                <CardContent className="p-6">
                    <div 
                        {...getRootProps()} 
                        className={cn(
                            "relative rounded-xl p-8 text-center transition-colors cursor-pointer",
                            isDragActive 
                                ? "bg-sky-500/10 border-sky-500/50" 
                                : "border-border/20 hover:border-sky-500/30 hover:bg-accent/10"
                        )}
                    >
                        <input {...getInputProps()} />
                        <Upload className={cn("w-12 h-12 mx-auto mb-4 text-muted-foreground/50", isDragActive && "text-sky-500")} />
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                            {isDragActive ? "Suelta los archivos aquí" : "Arrastra y suelta documentos"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            PDF, TXT, MD, DOCX, DOC, CSV, JSON (máx. 10MB cada uno)
                        </p>
                        {uploading && (
                            <div className="flex items-center justify-center gap-2 text-sky-500">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Subiendo e indexando...</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                        <Badge variant="outline" className="gap-1"><FileText className="w-3 h-3" /> PDF</Badge>
                        <Badge variant="outline" className="gap-1"><File className="w-3 h-3" /> TXT/MD</Badge>
                        <Badge variant="outline" className="gap-1"><File className="w-3 h-3" /> DOCX/DOC</Badge>
                        <Badge variant="outline" className="gap-1"><File className="w-3 h-3" /> CSV/JSON</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Search & Query */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Search className="w-5 h-5 text-sky-400" />
                        Consultar Base de Conocimiento (RAG)
                    </CardTitle>
                    <CardDescription>
                        Busca en los documentos indexados y obtiene contexto listo para inyectar en prompts de IA
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Escribe tu consulta (mín. 2 caracteres)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                            />
                        </div>
                        <Button 
                            type="submit" 
                            disabled={isSearching || !searchQuery.trim() || searchQuery.length < 2}
                            className="gap-2"
                        >
                            {isSearching ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
                                </>
                            ) : (
                                <>
                                    <Search className="w-4 h-4" /> Buscar
                                </>
                            )}
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline"
                            onClick={handleContextQuery}
                            disabled={isSearching || !searchQuery.trim()}
                            className="gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white"
                        >
                            <Sparkles className="w-4 h-4" /> Contexto para IA
                        </Button>
                    </form>

                    {showResults && searchResults.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-border/20">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-foreground">Resultados ({searchResults.length})</h4>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => { setShowResults(false); setSearchResults([]); }}
                                    className="text-xs"
                                >
                                    <X className="w-3 h-3" /> Limpiar
                                </Button>
                            </div>
                            <ScrollArea className="max-h-96">
                                <div className="space-y-3">
                                    {searchResults.map((result, idx) => (
                                        <div 
                                            key={result.id} 
                                            className="p-3 rounded-lg bg-card/50 border border-border/20 hover:bg-accent/10 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                                                <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-400/30">
                                    {(result.score * 100).toFixed(0)}% match
                                </Badge>
                                            </div>
                                            <p className="text-sm text-foreground/80 line-clamp-3">{result.preview}</p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {Object.entries(result.metadata).slice(0, 4).map(([k, v]) => (
                                                    <Badge key={k} variant="outline" className="text-[10px]">
                                                        {k}: {String(v).slice(0, 20)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {/* Context for AI injection */}
                    <div className="pt-4 border-t border-border/20">
                        <p className="text-xs text-muted-foreground mb-2">
                            Usa <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Contexto para IA</kbd> 
                            para buscar y copiar automáticamente el contexto formateado al portapapeles.
                        </p>
                        <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs text-muted-foreground max-h-32 overflow-auto">
                            {searchQuery ? 
                                `CONTEXTO RELEVANTE DE DOCUMENTOS:\n[Resultados de búsqueda para: "${searchQuery}"]\n\n---\n\n` 
                                : "Escribe una consulta y presiona 'Contexto para IA' para generar el bloque de contexto listo para pegar en tu prompt de IA."
                            }
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Indexed Documents List (placeholder - needs list endpoint) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-400" />
                        Documentos Indexados
                    </CardTitle>
                    <CardDescription>
                        Documentos subidos e indexados en la base vectorial (requiere endpoint de listado en backend)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Endpoint de listado de documentos pendiente de implementar en backend</p>
                        <p className="text-xs mt-1">Los documentos subidos se indexan automáticamente en la base vectorial</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}