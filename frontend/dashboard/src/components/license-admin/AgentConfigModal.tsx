import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Bot, Upload, Globe } from 'lucide-react';
import { licenseAdminService, type SponsorLogo } from '@/services/license-admin.service';
import { useAgentRefresh } from '@/hooks/use-agent-refresh';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AgentConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TIMEZONES = [
    { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil)' },
    { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
    { value: 'America/Lima', label: 'Perú (Lima)' },
    { value: 'America/Mexico_City', label: 'México (CDMX)' },
    { value: 'America/Santiago', label: 'Chile (Santiago)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
    { value: 'America/New_York', label: 'USA (New York)' },
    { value: 'Europe/Madrid', label: 'España (Madrid)' },
];

export function AgentConfigModal({ isOpen, onClose }: AgentConfigModalProps) {
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Agent Config State
    const [agentName, setAgentName] = useState('');
    const [agentPersonality, setAgentPersonality] = useState('');
    const [agentVoice, setAgentVoice] = useState('es-EC-LuisNeural');
    const [agentIcon, setAgentIcon] = useState<string | null>(null);
    const [agentIconFile, setAgentIconFile] = useState<File | null>(null); // For upload

    const [availableVoices, setAvailableVoices] = useState<any[]>([]);

    // Global Config
    const [timezone, setTimezone] = useState('America/Guayaquil');

    // Sponsor Logos State
    const [logos, setLogos] = useState<SponsorLogo[]>([]);

    // API URL Base for image display (assuming backend serves static files)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5010';

    const getImageUrl = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${API_URL}${path}`;
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load License Data (Agent Config)
            const dashboardData = await licenseAdminService.getDashboard();
            if (dashboardData.license) {
                setAgentName(dashboardData.license.agent_name || 'KindiCore AI');
                setAgentPersonality(dashboardData.license.agent_personality || 'Eres un asistente útil y amable.');
                setAgentIcon(dashboardData.license.agent_icon_path || null);
                setAgentVoice(dashboardData.license.agent_voice || 'es-EC-LuisNeural');
                setTimezone(dashboardData.license.timezone || 'America/Guayaquil');
            }

            // Load Sponsor Logos
            const logosData = await licenseAdminService.getSponsorLogos();
            setLogos(logosData || []);

            // Load Available Voices
            const { chatService } = await import('@/services/chat.service');
            const voicesData = await chatService.getVoices();
            setAvailableVoices(voicesData.voices || []);
        } catch (error) {
            console.error('Error loading config:', error);
            toast.error('Error al cargar la configuración');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, loadData]);

    useAgentRefresh(loadData);

    const handleSaveAgent = async () => {
        setIsSaving(true);
        try {
            await licenseAdminService.updateCustomization({
                agent_name: agentName,
                agent_personality: agentPersonality,
                agent_icon: agentIconFile, // Send file if selected
                agent_voice: agentVoice,
                timezone: timezone
            });
            toast.success('Configuración actualizada');
            onClose();
        } catch (error) {
            console.error('Error saving config:', error);
            toast.error('Error al guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAgentIconFile(file);
            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setAgentIcon(previewUrl);
        }
    };

    const handleAddLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];
        try {
            await licenseAdminService.addSponsorLogo(file);
            toast.success('Logo agregado');

            // Reload local state AND invalidate global query
            const logosData = await licenseAdminService.getSponsorLogos();
            setLogos(logosData || []);
            queryClient.invalidateQueries({ queryKey: ['sponsorLogos'] });

        } catch (error) {
            console.error('Error adding logo:', error);
            toast.error('Error al agregar logo');
        } finally {
            // Reset input
            e.target.value = '';
        }
    };

    const handleDeleteLogo = async (id: number) => {
        try {
            await licenseAdminService.deleteSponsorLogo(id);
            setLogos(prev => prev.filter(l => l.id !== id));
            queryClient.invalidateQueries({ queryKey: ['sponsorLogos'] });
            toast.success('Logo eliminado');
        } catch (error) {
            console.error('Error deleting logo:', error);
            toast.error('Error al eliminar logo');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Configuración de Licencia</DialogTitle>
                    <DialogDescription>
                        Personalice la identidad del agente, zona horaria y patrocinadores.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="general">🌍 General</TabsTrigger>
                            <TabsTrigger value="agent">🤖 Agente IA</TabsTrigger>
                            <TabsTrigger value="sponsors">🤝 Sponsors</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Zona Horaria del Proyecto</Label>
                                <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione zona horaria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz.value} value={tz.value}>
                                                {tz.label} ({tz.value})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Define la hora para reportes, asistencia y notificaciones de todos sus centros.
                                </p>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button onClick={handleSaveAgent} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Configuración
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        <TabsContent value="agent" className="space-y-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="relative h-20 w-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                                    {agentIcon ? (
                                        <img
                                            src={agentIcon.startsWith('blob:') ? agentIcon : getImageUrl(agentIcon) || ''}
                                            alt="Icon Preview"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Bot className="h-8 w-8 text-gray-400" />
                                    )}
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleIconSelect}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label>Icono del Agente</Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Haz clic en el círculo para subir una imagen (PNG, JPG, SVG).
                                        Se usará en el chat y las respuestas.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Agente</Label>
                                <Input
                                    id="name"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                    placeholder="Ej: KindiBot"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="voice">Voz del Agente (Edge TTS Neuronal)</Label>
                                <Select value={agentVoice} onValueChange={setAgentVoice}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione una voz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableVoices.map((v) => (
                                            <SelectItem key={v.ShortName} value={v.ShortName}>
                                                {v.FriendlyName} ({v.Gender})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Esta voz se usará para responder mensajes de voz en la web, WhatsApp y Telegram.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="personality">Personalidad / Prompt del Sistema</Label>
                                <Textarea
                                    id="personality"
                                    value={agentPersonality}
                                    onChange={(e) => setAgentPersonality(e.target.value)}
                                    placeholder="Instrucciones base para la personalidad del agente..."
                                    className="min-h-[100px]"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Define el tono, estilo y reglas de comportamiento del agente.
                                </p>
                            </div>

                            <DialogFooter>
                                <Button onClick={handleSaveAgent} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Agente
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        <TabsContent value="sponsors" className="space-y-4 py-4">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer relative">
                                <Upload className="h-8 w-8 text-gray-400" />
                                <span className="text-sm font-medium text-gray-600">
                                    Clic para subir logo de patrocinador
                                </span>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleAddLogo}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-4">
                                {logos.map((logo) => (
                                    <div key={logo.id} className="relative group border rounded-lg p-2 flex items-center justify-center bg-white aspect-square shadow-sm">
                                        <img
                                            src={getImageUrl(logo.logo_path) || ''}
                                            alt="Sponsor Logo"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                        <button
                                            onClick={() => handleDeleteLogo(logo.id)}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {logos.length === 0 && (
                                    <div className="col-span-3 text-center text-muted-foreground py-8 text-sm">
                                        No hay logos registrados.
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
