"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Bot, Save } from 'lucide-react';
import { licenseAdminService } from '@/services/license-admin.service';
import { useToast } from '@/hooks/use-toast';

/**
 * Inline view for license-level customization (agent name, personality, etc.).
 * Rendered inside a Dialog managed by LicenseCustomizationClient.
 */
export function LicenseCustomizationView() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [agentName, setAgentName] = useState('');
    const [agentPersonality, setAgentPersonality] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await licenseAdminService.getLicenseCustomization();
                setAgentName(data.agent_name || '');
                setAgentPersonality(data.agent_personality || '');
            } catch (err) {
                console.error('Error cargando personalización:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await licenseAdminService.updateCustomization({
                agent_name: agentName,
                agent_personality: agentPersonality,
            });
            toast({ title: 'Guardado', description: 'Personalización actualizada correctamente.' });
        } catch (err) {
            console.error('Error guardando personalización:', err);
            toast({ title: 'Error', description: 'No se pudo guardar la personalización.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2">
            <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Personalización del Sistema</h2>
            </div>

            <Separator />

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="agent-name">Nombre del Asistente</Label>
                    <Input
                        id="agent-name"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="Ej: KindiBot, Asistente MIES..."
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="agent-personality">Personalidad / Descripción</Label>
                    <Textarea
                        id="agent-personality"
                        value={agentPersonality}
                        onChange={(e) => setAgentPersonality(e.target.value)}
                        placeholder="Describe el comportamiento o tono del asistente..."
                        rows={4}
                    />
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar cambios
                </Button>
            </div>
        </div>
    );
}
