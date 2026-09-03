"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Building2, Sliders, Layers, Sparkles } from "lucide-react";
import { superAdminService, type CreateLicenseData } from "@/services/super-admin.service";
import { ModuleSelector } from "./module-selector";
import { cn } from "@/lib/utils";

interface CreateLicenseDialogProps {
    children: React.ReactNode;
    onSuccess?: () => void;
}

export function CreateLicenseDialog({ children, onSuccess }: CreateLicenseDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'org' | 'capacity' | 'modules'>('org');

    // Organization data
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [legalName, setLegalName] = useState("");
    const [ruc, setRuc] = useState("");
    const [publicOrgSlug, setPublicOrgSlug] = useState("");

    // Limits and operations
    const [maxCenters, setMaxCenters] = useState("5");
    const [maxUsers, setMaxUsers] = useState("50");
    const [storageQuotaMb, setStorageQuotaMb] = useState("1024");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [annualCost, setAnnualCost] = useState("");

    // Channels
    const [allowPublicChatbot, setAllowPublicChatbot] = useState(true);
    const [allowWhatsappPublic, setAllowWhatsappPublic] = useState(true);
    const [allowTelegramPublic, setAllowTelegramPublic] = useState(true);

    // Enabled modules
    const [enabledModules, setEnabledModules] = useState<string[]>([
        'kindicore', 'social', 'geo', 'channels', 'copilot'
    ]);

    const resetForm = () => {
        setName("");
        setDescription("");
        setLegalName("");
        setRuc("");
        setPublicOrgSlug("");
        setMaxCenters("5");
        setMaxUsers("50");
        setStorageQuotaMb("1024");
        setStartDate("");
        setEndDate("");
        setAnnualCost("");
        setAllowPublicChatbot(true);
        setAllowWhatsappPublic(true);
        setAllowTelegramPublic(true);
        setEnabledModules(['kindicore', 'social', 'geo', 'channels', 'copilot']);
        setActiveTab('org');
        setError(null);
    };

    const handleAutoSlug = (text: string) => {
        setName(text);
        if (!publicOrgSlug || publicOrgSlug.startsWith('org-')) {
            const cleanSlug = text
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            setPublicOrgSlug(cleanSlug);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !maxCenters || !startDate || !endDate) {
            setError("Complete los campos obligatorios (*)");
            return;
        }

        if (enabledModules.length === 0) {
            setError("Debe habilitar al menos un módulo para la licencia");
            setActiveTab('modules');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data: CreateLicenseData = {
                name,
                description: description || undefined,
                max_centers: parseInt(maxCenters) || 1,
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
            };

            await superAdminService.createLicense(data);
            setIsOpen(false);
            resetForm();
            onSuccess?.();
        } catch (err: any) {
            console.error("Error creating license:", err);
            setError(err.response?.data?.error || "Error al crear la licencia");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[650px] max-h-[92vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3 border-b border-border/40 bg-gradient-to-r from-primary/5 via-muted/20 to-transparent shrink-0">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI GovCoreX OS · Multi-Tenant Root
                    </div>
                    <DialogTitle className="text-xl font-black">Crear Nueva Licencia Institucional</DialogTitle>
                    <DialogDescription className="text-xs">
                        Configura la organización matriz, asigna límites operativos y selecciona los módulos agénticos activos.
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
                            2. Capacidad & Canales
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
                            3. Módulos Habilitados ({enabledModules.length})
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
                                <Label htmlFor="name" className="text-xs font-semibold">Nombre del Proyecto / Organización *</Label>
                                <Input
                                    id="name"
                                    placeholder="Ej: Ministerio MIES — Coordinación Zonal 8"
                                    value={name}
                                    onChange={(e) => handleAutoSlug(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="legalName" className="text-xs font-semibold">Razón Social / Entidad Pública</Label>
                                    <Input
                                        id="legalName"
                                        placeholder="Ej: Min. Inclusión Económica"
                                        value={legalName}
                                        onChange={(e) => setLegalName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ruc" className="text-xs font-semibold">RUC / Identificación Fiscal</Label>
                                    <Input
                                        id="ruc"
                                        placeholder="Ej: 1768153420001"
                                        maxLength={13}
                                        value={ruc}
                                        onChange={(e) => setRuc(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="publicOrgSlug" className="text-xs font-semibold">
                                    Slug Web Widget (Chatbot Público)
                                </Label>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-2 rounded-lg border border-border/40">
                                        /api/public/chat/
                                    </span>
                                    <Input
                                        id="publicOrgSlug"
                                        placeholder="mies-zona-8"
                                        value={publicOrgSlug}
                                        onChange={(e) => setPublicOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        className="font-mono text-xs"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Permite que la organización inserte un widget de chat en su sitio web institucional para atender ciudadanos 24/7.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="description" className="text-xs font-semibold">Descripción y Alcance</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Detalles de la cobertura, territorio, objetivos o convenios de cofinanciamiento..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Capacity & Dates */}
                    {activeTab === 'capacity' && (
                        <div className="space-y-3.5 animate-fadeIn">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="maxCenters" className="text-xs font-semibold">Máx. Centros / Sedes *</Label>
                                    <Input
                                        id="maxCenters"
                                        type="number"
                                        min="1"
                                        max="999"
                                        value={maxCenters}
                                        onChange={(e) => setMaxCenters(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="maxUsers" className="text-xs font-semibold">Límite Usuarios</Label>
                                    <Input
                                        id="maxUsers"
                                        type="number"
                                        min="1"
                                        value={maxUsers}
                                        onChange={(e) => setMaxUsers(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="annualCost" className="text-xs font-semibold">Costo Anual (USD)</Label>
                                    <Input
                                        id="annualCost"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={annualCost}
                                        onChange={(e) => setAnnualCost(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="startDate" className="text-xs font-semibold">Fecha Inicio Vigencia *</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="endDate" className="text-xs font-semibold">Fecha Fin Vigencia *</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Public channels toggles */}
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
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Paso {activeTab === 'org' ? '1' : activeTab === 'capacity' ? '2' : '3'} de 3</span>
                    </div>

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
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando Licencia...</>
                                ) : (
                                    "Confirmar y Habilitar Licencia"
                                )}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
