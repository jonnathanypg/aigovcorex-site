'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { channelsService, ChannelsStatus } from '@/services/channels.service';
import { useAgentRefresh } from '@/hooks/use-agent-refresh';
import {
    MessageCircle,
    Send,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Loader2,
    QrCode,
    Unplug,
    Bot,
    Save
} from 'lucide-react';

interface MessagingChannelsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userRole?: string;
}

export function MessagingChannelsModal({ open, onOpenChange, userRole }: MessagingChannelsModalProps) {
    const [status, setStatus] = useState<ChannelsStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('telegram'); // Default to Telegram for non-admins if needed

    // WhatsApp states
    const [waConnecting, setWaConnecting] = useState(false);
    const [waQRCode, setWaQRCode] = useState<string | null>(null);
    const [waPolling, setWaPolling] = useState(false);

    // Admin Phone State
    const [adminPhone, setAdminPhone] = useState('');
    const [adminPhoneSaving, setAdminPhoneSaving] = useState(false);

    // User Personal WhatsApp State
    const [myWhatsAppPhone, setMyWhatsAppPhone] = useState('');
    const [myWhatsAppSaving, setMyWhatsAppSaving] = useState(false);

    // Telegram states
    const [tgBotToken, setTgBotToken] = useState('');
    const [tgConnecting, setTgConnecting] = useState(false);
    const [tgError, setTgError] = useState<string | null>(null);
    const [linkCode, setLinkCode] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            // Fetch channel status (now available to all users)
            const data = await channelsService.getStatus();
            setStatus(data);

            if (userRole === 'license_admin') {
                if (data.whatsapp.admin_phone) {
                    setAdminPhone(data.whatsapp.admin_phone);
                }
            } else {
                // Fetch user personal config
                const myData = await channelsService.getMyWhatsApp();
                if (myData.whatsapp_phone) {
                    setMyWhatsAppPhone(myData.whatsapp_phone);
                }
            }
        } catch (error) {
            console.error('Failed to fetch channels status:', error);
        } finally {
            setLoading(false);
        }
    }, [userRole]);

    const handleSaveAdminPhone = async () => {
        setAdminPhoneSaving(true);
        try {
            await channelsService.updateWhatsAppAdminPhone(adminPhone);
            await fetchStatus();
            // toast.success('Número de administrador actualizado'); // Add toast if available
        } catch (error) {
            console.error('Failed to update admin phone:', error);
            // toast.error('Error al guardar el número');
        } finally {
            setAdminPhoneSaving(false);
        }
    };

    const handleSaveMyWhatsApp = async () => {
        setMyWhatsAppSaving(true);
        try {
            await channelsService.updateMyWhatsApp(myWhatsAppPhone);
            // toast.success('Número de WhatsApp actualizado');
        } catch (error) {
            console.error('Failed to update my whatsapp:', error);
        } finally {
            setMyWhatsAppSaving(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchStatus();
            // If not admin, default to telegram linking view (since blocking whatsapp config)
            if (userRole !== 'license_admin') {
                setActiveTab('telegram');
            } else {
                setActiveTab('whatsapp');
            }
        }
    }, [open, fetchStatus, userRole]);

    useAgentRefresh(fetchStatus);

    // Poll for WhatsApp connection status when QR is showing
    useEffect(() => {
        if (!waPolling || !waQRCode) return;

        const interval = setInterval(async () => {
            try {
                const result = await channelsService.getWhatsAppStatus();
                if (result.connected) {
                    setWaQRCode(null);
                    setWaPolling(false);
                    fetchStatus();
                }
            } catch (error) {
                console.error('WhatsApp status poll error:', error);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [waPolling, waQRCode, fetchStatus]);

    const handleWhatsAppConnect = async () => {
        setWaConnecting(true);
        try {
            await channelsService.initWhatsApp();

            // Wait a bit then fetch QR
            setTimeout(async () => {
                try {
                    const qrResult = await channelsService.getWhatsAppQR();
                    if (qrResult.qr) {
                        setWaQRCode(qrResult.qr);
                        setWaPolling(true);
                    }
                } catch (error) {
                    console.error('Failed to get QR:', error);
                }
                setWaConnecting(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to init WhatsApp:', error);
            setWaConnecting(false);
        }
    };

    const handleWhatsAppDisconnect = async () => {
        try {
            await channelsService.disconnectWhatsApp();
            setWaQRCode(null);
            setWaPolling(false);
            fetchStatus();
        } catch (error) {
            console.error('Failed to disconnect WhatsApp:', error);
        }
    };

    const handleTelegramConnect = async () => {
        if (!tgBotToken.trim()) {
            setTgError('Por favor ingresa el token del bot');
            return;
        }

        setTgConnecting(true);
        setTgError(null);

        try {
            const result = await channelsService.connectTelegram(tgBotToken);
            if (result.success) {
                setTgBotToken('');
                fetchStatus();
            } else {
                setTgError(result.error || 'Error al conectar');
            }
        } catch (error: any) {
            setTgError(error?.response?.data?.error || 'Error de conexión');
        } finally {
            setTgConnecting(false);
        }
    };

    const handleTelegramDisconnect = async () => {
        try {
            await channelsService.disconnectTelegram();
            fetchStatus();
        } catch (error) {
            console.error('Failed to disconnect Telegram:', error);
        }
    };

    const handleGenerateLinkCode = async () => {
        try {
            const result = await channelsService.generateTelegramLinkCode();
            setLinkCode(result.link_code);
        } catch (error) {
            console.error('Failed to generate link code:', error);
            setTgError('Error al generar código');
        }
    };

    const isLicenseAdmin = userRole === 'license_admin';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        {isLicenseAdmin ? 'Canales de Mensajería' : 'Vincular Telegram'}
                    </DialogTitle>
                    <DialogDescription>
                        {isLicenseAdmin
                            ? 'Conecta WhatsApp y Telegram para comunicarte con padres y personal'
                            : 'Vincula tu cuenta personal para chatear con KindiCore AI'
                        }
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            {/* WhatsApp Tab - Admin Configuration or Personal Link */}
                            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" />
                                {isLicenseAdmin ? 'WhatsApp (Config)' : 'Mi WhatsApp'}
                                {status?.whatsapp.connected && (
                                    <Badge variant="outline" className="ml-1 bg-green-500/10 text-green-600 border-green-500/20">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                    </Badge>
                                )}
                            </TabsTrigger>

                            {/* Telegram Tab */}
                            <TabsTrigger value="telegram" className="flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                {isLicenseAdmin ? 'Telegram (Config)' : 'Mi Telegram'}
                                {status?.telegram.connected && (
                                    <Badge variant="outline" className="ml-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* WhatsApp Content */}
                        <TabsContent value="whatsapp" className="space-y-4 mt-4">
                            {isLicenseAdmin ? (
                                // --- ADMIN VIEW: License QR Config ---
                                <>
                                    {status?.whatsapp.connected ? (
                                        <div className="space-y-4">
                                            <Alert className="bg-green-500/10 border-green-500/20">
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                <AlertDescription className="text-green-700">
                                                    WhatsApp conectado: <strong>{status.whatsapp.phone}</strong>
                                                </AlertDescription>
                                            </Alert>

                                            <div className="bg-muted/50 p-4 rounded-lg space-y-3 border border-border">
                                                <Label htmlFor="admin-phone">Número de Administrador (Personal)</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Este número será reconocido automáticamente como administrador para interactuar con el agente.
                                                </p>
                                                <div className="flex gap-2">
                                                    <Input
                                                        id="admin-phone"
                                                        placeholder="Ej: 593982541659"
                                                        value={adminPhone}
                                                        onChange={(e) => setAdminPhone(e.target.value)}
                                                    />
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        onClick={handleSaveAdminPhone}
                                                        disabled={adminPhoneSaving}
                                                    >
                                                        {adminPhoneSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            <Button
                                                variant="destructive"
                                                onClick={handleWhatsAppDisconnect}
                                                className="w-full"
                                            >
                                                <Unplug className="h-4 w-4 mr-2" />
                                                Desconectar WhatsApp
                                            </Button>
                                        </div>
                                    ) : waQRCode ? (
                                        <div className="space-y-4">
                                            <div className="text-center">
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    Escanea este código QR con WhatsApp
                                                </p>
                                                <div className="bg-white p-4 rounded-lg inline-block">
                                                    <img
                                                        src={waQRCode?.startsWith('<svg')
                                                            ? `data:image/svg+xml;base64,${typeof window !== 'undefined' ? window.btoa(waQRCode) : ''}`
                                                            : waQRCode}
                                                        alt="WhatsApp QR Code"
                                                        className="w-48 h-48"
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
                                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                                    Esperando conexión...
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setWaQRCode(null);
                                                    setWaPolling(false);
                                                }}
                                                className="w-full"
                                            >
                                                Cancelar
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <Alert>
                                                <XCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                    WhatsApp no está conectado. Conecta un número para recibir mensajes.
                                                </AlertDescription>
                                            </Alert>
                                            <Button
                                                onClick={handleWhatsAppConnect}
                                                disabled={waConnecting}
                                                className="w-full bg-green-600 hover:bg-green-700"
                                            >
                                                {waConnecting ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <QrCode className="h-4 w-4 mr-2" />
                                                )}
                                                {waConnecting ? 'Generando QR...' : 'Conectar WhatsApp'}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // --- STAFF VIEW: Personal Phone Registration ---
                                <div className="space-y-4">
                                    <Alert className="bg-muted">
                                        <MessageCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Registra tu número de WhatsApp para que <strong>KindiCore AI</strong> pueda identificarte cuando escribas al número oficial del centro.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="grid gap-2">
                                        <Label htmlFor="personal-phone">Tu Número Personal (WhatsApp)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="personal-phone"
                                                placeholder="Ej: +593991234567"
                                                value={myWhatsAppPhone}
                                                onChange={(e) => setMyWhatsAppPhone(e.target.value)}
                                            />
                                            <Button
                                                onClick={handleSaveMyWhatsApp}
                                                disabled={myWhatsAppSaving}
                                            >
                                                {myWhatsAppSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Incluye el código de país (ej: +593). Evita espacios.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Telegram Tab */}
                        <TabsContent value="telegram" className="space-y-4 mt-4">
                            {/* Bot Config - Only for Admin */}
                            {isLicenseAdmin && (
                                <>
                                    {status?.telegram.connected ? (
                                        <div className="space-y-4">
                                            <Alert className="bg-blue-500/10 border-blue-500/20">
                                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                                <AlertDescription className="text-blue-700">
                                                    Bot conectado: <strong>@{status.telegram.bot_username}</strong>
                                                </AlertDescription>
                                            </Alert>
                                            <Button
                                                variant="destructive"
                                                onClick={handleTelegramDisconnect}
                                                className="w-full"
                                            >
                                                <Unplug className="h-4 w-4 mr-2" />
                                                Desconectar Telegram
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <Alert>
                                                <Bot className="h-4 w-4" />
                                                <AlertDescription>
                                                    Conecta un bot de Telegram para recibir mensajes.
                                                </AlertDescription>
                                            </Alert>

                                            <div className="space-y-2">
                                                <Label htmlFor="bot-token">Token del Bot</Label>
                                                <Input
                                                    id="bot-token"
                                                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                                    value={tgBotToken}
                                                    onChange={(e) => setTgBotToken(e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Obtén tu token de @BotFather en Telegram
                                                </p>
                                            </div>

                                            {tgError && (
                                                <Alert variant="destructive">
                                                    <XCircle className="h-4 w-4" />
                                                    <AlertDescription>{tgError}</AlertDescription>
                                                </Alert>
                                            )}

                                            <Button
                                                onClick={handleTelegramConnect}
                                                disabled={tgConnecting || !tgBotToken.trim()}
                                                className="w-full bg-blue-600 hover:bg-blue-700"
                                            >
                                                {tgConnecting ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Bot className="h-4 w-4 mr-2" />
                                                )}
                                                {tgConnecting ? 'Conectando...' : 'Conectar Bot'}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* User Linking Section (Visible for EVERYONE if bot connected) */}
                            {status?.telegram.connected && (
                                <div className={isLicenseAdmin ? "pt-4 border-t border-border mt-6" : ""}>
                                    <h4 className="text-sm font-medium mb-2">Vincular mi cuenta personal</h4>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        Para que el agente reconozca tu identidad, genera un código y envíalo al bot.
                                    </p>

                                    {linkCode ? (
                                        <div className="bg-muted p-4 rounded-md text-center">
                                            <p className="text-xs mb-2">Envía este código al bot:</p>
                                            <div className="text-2xl font-mono font-bold tracking-widest my-2 select-all">
                                                {linkCode}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Bot: @{status.telegram.bot_username}
                                            </p>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={handleGenerateLinkCode}
                                        >
                                            Generar Código de Vinculación
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Fallback msg if bot not connected and user is NOT admin */}
                            {!status?.telegram.connected && !isLicenseAdmin && (
                                <Alert variant="destructive">
                                    <XCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        El administrador aún no ha conectado el Bot de Telegram para este centro.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default MessagingChannelsModal;
