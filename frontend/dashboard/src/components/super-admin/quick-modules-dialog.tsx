"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { superAdminService, type License } from "@/services/super-admin.service";
import { ModuleSelector } from "./module-selector";

interface QuickModulesDialogProps {
    license: License;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function QuickModulesDialog({
    license,
    open,
    onOpenChange,
    onSuccess
}: QuickModulesDialogProps) {
    const [selectedModules, setSelectedModules] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedSuccess, setSavedSuccess] = useState(false);

    useEffect(() => {
        if (open) {
            const current = license.enabled_modules && license.enabled_modules.length > 0
                ? license.enabled_modules
                : ['kindicore', 'social', 'geo', 'channels', 'copilot'];
            setSelectedModules(current);
            setError(null);
            setSavedSuccess(false);
        }
    }, [open, license]);

    const handleSave = async () => {
        if (selectedModules.length === 0) {
            setError("Debe seleccionar al menos un módulo para la organización.");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await superAdminService.updateLicenseModules(license.id, selectedModules);
            setSavedSuccess(true);
            setTimeout(() => {
                onOpenChange(false);
                onSuccess?.();
            }, 500);
        } catch (err: any) {
            console.error("Error al actualizar módulos:", err);
            setError(err.response?.data?.error || "Error al actualizar los módulos de la organización");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b border-border/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shrink-0">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" />
                        Control de Módulos · AI GovCoreX OS
                    </div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Módulos para: {license.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Habilita o deshabilita los módulos específicos para esta ONG, empresa o institución.
                        Los usuarios asignados a esta licencia solo verán los módulos seleccionados.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {error && (
                        <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                            {error}
                        </div>
                    )}

                    {savedSuccess && (
                        <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Módulos actualizados con éxito.
                        </div>
                    )}

                    <ModuleSelector
                        selected={selectedModules}
                        onChange={setSelectedModules}
                        disabled={isSaving}
                    />
                </div>

                <DialogFooter className="p-4 border-t border-border/40 bg-muted/20 gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                        className="text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || selectedModules.length === 0}
                        className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Aplicar a la Organización
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
