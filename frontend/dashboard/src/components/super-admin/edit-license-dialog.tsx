"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Building2, Sliders, Layers, Sparkles } from "lucide-react";
import { superAdminService, type License, type CreateLicenseData } from "@/services/super-admin.service";
import { ModuleSelector } from "./module-selector";
import { cn } from "@/lib/utils";

interface EditLicenseDialogProps {
    license: License;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditLicenseDialog({ license, open, onOpenChange, onSuccess }: EditLicenseDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'org' | 'capacity' | 'modules'>('org');

    // Form state
    const [name, setName] = useState(license.name);
    const [description, setDescription] = useState(license.description || "");
    const [legalName, setLegalName] = useState(license.legal_name || "");
    const [ruc, setRuc] = useState(license.ruc || "");
    const [publicOrgSlug, setPublicOrgSlug] = useState(license.public_org_slug || "");
    const [maxCenters, setMaxCenters] = useState(String(license.max_centers));
    const [maxUsers, setMaxUsers] = useState(String(license.max_users || 50));
    const [storageQuotaMb, setStorageQuotaMb] = useState(String(license.storage_quota_mb || 1024));
    const [startDate, setStartDate] = useState(license.start_date);
    const [endDate, setEndDate] = useState(license.end_date);
    const [annualCost, setAnnualCost] = useState(license.annual_cost ? String(license.annual_cost) : "");
    const [status, setStatus] = useState(license.status || 'active');

    // Channels
    const [allowPublicChatbot, setAllowPublicChatbot] = useState(license.allow_public_chatbot ?? true);
    const [allowWhatsappPublic, setAllowWhatsappPublic] = useState(license.allow_whatsapp_public ?? true);
    const [allowTelegramPublic, setAllowTelegramPublic] = useState(license.allow_telegram_public ?? true);

    // Enabled Modules
    const [enabledModules, setEnabledModules] = useState<string[]>(
        license.enabled_modules && license.enabled_modules.length > 0
            ? license.enabled_modules
            : ['kindicore', 'social', 'geo', 'channels', 'copilot']
    );

    // Reset form when license changes
    useEffect(() => {
        setName(license.name);
        setDescription(license.description || "");
        setLegalName(license.legal_name || "");
        setRuc(license.ruc || "");
        setPublicOrgSlug(license.public_org_slug || "");
        setMaxCenters(String(license.max_centers));
        setMaxUsers(String(license.max_users || 50));
        setStorageQuotaMb(String(license.storage_quota_mb || 1024));
        setStartDate(license.start_date);
        setEndDate(license.end_date);
        setAnnualCost(license.annual_cost ? String(license.annual_cost) : "");
        setStatus(license.status || 'active');
        setAllowPublicChatbot(license.allow_public_chatbot ?? true);
        setAllowWhatsappPublic(license.allow_whatsapp_public ?? true);
        setAllowTelegramPublic(license.allow_telegram_public ?? true);
        setEnabledModules(
            license.enabled_modules && license.enabled_modules.length > 0
                ? license.enabled_modules
                : ['kindicore', 'social', 'geo', 'channels', 'copilot']
        );
        setError(null);
    }, [license, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !maxCenters || !startDate || !endDate) {
            setError("Complete los campos obligatorios (*)");
            return;
        }

        if (enabledModules.length === 0) {
            setError("Debe haber al menos un módulo habilitado");
            setActiveTab('modules');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data: Partial<CreateLicenseData> & { status?: string } = {
                name,
                description: description || undefined,
                max_centers: parseInt(maxCenters),
                max_users: parseInt(maxUsers) || 50,
                storage_quota_mb: parseInt(storageQuotaMb) || 1024,
                start_date: startDate,
                end_date: endDate,
                annual_cost: annualCost ? parseFloat(annualCost) : undefined,
                legal_name: legalName || undefined,
                ruc: ruc || undefined,
                public_org_slug: publicOrgSlug || undefined,
                allow_public_chatbot: allowPublicChatbot,
                allow_whatsapp_public: allowWhatsappPublic,
                allow_telegram_public: allowTelegramPublic,
                enabled_modules: enabledModules,
                status,
            };

            await superAdminService.updateLicenseFull(license.id, data);
            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            console.error("Error updating license:", err);
            setError(err.response?.data?.error || "Error al actualizar la licencia");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[92vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b border-border/40 bg-gradient-to-r from-primary/5 via-muted/20 to-transparent shrink-0">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI GovCoreX OS · Configuración de Licencia #{license.id}
                    </div>
                    <DialogTitle className="text-xl font-black">Editar Organización & Módulos</DialogTitle>
                    <DialogDescription className="text-xs">
                        Modifica límites operativos, canales de contacto y activa o desactiva módulos agénticos en tiempo real.
                    </DialogDescription>

                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 pt-3">
                        <button
                            type="button"
                            onClick={() => setActiveTab('org')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                activeTab === 'org'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/60"
                            )}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            1. Organización
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('capacity')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                activeTab === 'capacity'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/60"
                            )}
                        >
                            <Sliders className="w-3.5 h-3.5" />
                            2. Capacidad & Estado
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('modules')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                activeTab === 'modules'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/60"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            3. Módulos ({enabledModules.length})
                        </button>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    {error && (
                        <div className="p-3 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Tab 1: Organization */}
                    {activeTab === 'org' && (
                        <div className="space-y-3.5 animate-fadeIn">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-name" className="text-xs font-semibold">Nombre de la Licencia / Proyecto *</Label>
                                <Input
                                    id="edit-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-legalName" className="text-xs font-semibold">Razón Social</Label>
                                    <Input
                                        id="edit-legalName"
                                        value={legalName}
                                        onChange={(e) => setLegalName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-ruc" className="text-xs font-semibold">RUC</Label>
                                    <Input
                                        id="edit-ruc"
                                        maxLength={13}
                                        value={ruc}
                                        onChange={(e) => setRuc(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit-publicOrgSlug" className="text-xs font-semibold">
                                    Slug Web Widget (Chatbot Público)
                                </Label>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-2 rounded-lg border border-border/40">
                                        /api/public/chat/
                                    </span>
                                    <Input
                                        id="edit-publicOrgSlug"
                                        placeholder="mies-guayas"
                                        value={publicOrgSlug}
                                        onChange={(e) => setPublicOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        className="font-mono text-xs"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit-description" className="text-xs font-semibold">Descripción</Label>
                                <Textarea
                                    id="edit-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Capacity & Channels */}
                    {activeTab === 'capacity' && (
                        <div className="space-y-3.5 animate-fadeIn">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-maxCenters" className="text-xs font-semibold">Máx. Centros *</Label>
                                    <Input
                                        id="edit-maxCenters"
                                        type="number"
                                        min={license.active_centers}
                                        value={maxCenters}
                                        onChange={(e) => setMaxCenters(e.target.value)}
                                        required
                                    />
                                    <span className="text-[10px] text-muted-foreground">Activos: {license.active_centers}</span>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-maxUsers" className="text-xs font-semibold">Límite Usuarios</Label>
                                    <Input
                                        id="edit-maxUsers"
                                        type="number"
                                        min="1"
                                        value={maxUsers}
                                        onChange={(e) => setMaxUsers(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-annualCost" className="text-xs font-semibold">Costo Anual (USD)</Label>
                                    <Input
                                        id="edit-annualCost"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={annualCost}
                                        onChange={(e) => setAnnualCost(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-startDate" className="text-xs font-semibold">Fecha Inicio *</Label>
                                    <Input
                                        id="edit-startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-endDate" className="text-xs font-semibold">Fecha Fin *</Label>
                                    <Input
                                        id="edit-endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-status" className="text-xs font-semibold">Estado</Label>
                                    <select
                                        id="edit-status"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    >
                                        <option value="active">Activa</option>
                                        <option value="suspended">Suspendida</option>
                                        <option value="expired">Expirada</option>
                                    </select>
                                </div>
                            </div>

                            {/* Public channels */}
                            <div className="p-3.5 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                                <span className="text-xs font-bold text-foreground">Canales Públicos Habilitados</span>
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={allowPublicChatbot}
                                            onChange={(e) => setAllowPublicChatbot(e.target.checked)}
                                            className="rounded accent-primary"
                                        />
                                        <span>Widget Web</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={allowWhatsappPublic}
                                            onChange={(e) => setAllowWhatsappPublic(e.target.checked)}
                                            className="rounded accent-primary"
                                        />
                                        <span>WhatsApp Bot</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={allowTelegramPublic}
                                            onChange={(e) => setAllowTelegramPublic(e.target.checked)}
                                            className="rounded accent-primary"
                                        />
                                        <span>Telegram Bot</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Modules */}
                    {activeTab === 'modules' && (
                        <div className="animate-fadeIn">
                            <ModuleSelector
                                selected={enabledModules}
                                onChange={setEnabledModules}
                            />
                        </div>
                    )}
                </form>

                <DialogFooter className="p-4 border-t border-border/40 bg-muted/10 shrink-0 flex items-center justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>

                    <div className="flex items-center gap-2">
                        {activeTab !== 'org' && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab(activeTab === 'modules' ? 'capacity' : 'org')}
                            >
                                Anterior
                            </Button>
                        )}

                        {activeTab !== 'modules' ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setActiveTab(activeTab === 'org' ? 'capacity' : 'modules')}
                            >
                                Siguiente
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                disabled={isLoading}
                                onClick={handleSubmit}
                                className="bg-primary text-primary-foreground font-bold shadow-md"
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando Cambios...</>
                                ) : (
                                    "Guardar y Aplicar Módulos"
                                )}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
