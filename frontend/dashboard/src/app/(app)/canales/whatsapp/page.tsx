'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  QrCode, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Unplug, 
  Phone, 
  ShieldCheck, 
  AlertCircle,
  Smartphone,
  Save,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { channelsService, ChannelsStatus } from '@/services/channels.service';
import { toast } from 'sonner';

export default function WhatsAppChannelPage() {
  const [status, setStatus] = useState<ChannelsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [adminPhone, setAdminPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await channelsService.getStatus();
      setStatus(data);
      if (data.whatsapp?.admin_phone) {
        setAdminPhone(data.whatsapp.admin_phone);
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
      toast.error('No se pudo cargar el estado de WhatsApp');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling for QR code when connecting
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connecting) {
      interval = setInterval(async () => {
        try {
          const qrRes = await channelsService.getWhatsAppQR();
          if (qrRes.qr) {
            setQrCode(qrRes.qr);
          }
          const currentStatus = await channelsService.getWhatsAppStatus();
          if (currentStatus.connected) {
            setConnecting(false);
            setQrCode(null);
            toast.success('¡WhatsApp conectado con éxito!');
            fetchStatus();
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connecting, fetchStatus]);

  const handleInitSession = async () => {
    try {
      setConnecting(true);
      setQrCode(null);
      await channelsService.initWhatsApp();
      toast.info('Generando código QR... Escanea con tu aplicación de WhatsApp');
    } catch (err: any) {
      setConnecting(false);
      toast.error(err.response?.data?.error || 'Error al iniciar sesión de WhatsApp');
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await channelsService.disconnectWhatsApp();
      toast.success('Sesión de WhatsApp desconectada');
      setQrCode(null);
      setConnecting(false);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al desconectar WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdminPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPhone.trim()) {
      toast.error('Ingrese un número de teléfono válido');
      return;
    }
    try {
      setSavingPhone(true);
      await channelsService.updateWhatsAppAdminPhone(adminPhone);
      toast.success('Número de administrador actualizado');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar el número de admin');
    } finally {
      setSavingPhone(false);
    }
  };

  const isConnected = status?.whatsapp?.connected;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-6 h-6" />
            </div>
            WhatsApp Institucional
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Gestión y enlace de WhatsApp con Baileys, agentes IA y notificaciones oficiales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Status banner */}
      <Card className="border border-white/10 bg-white/[0.02] backdrop-blur-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                {isConnected ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">
                    {isConnected ? 'Canal Conectado y Operativo' : 'Canal Desconectado'}
                  </h3>
                  <Badge variant={isConnected ? 'default' : 'secondary'} className={isConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>
                <p className="text-sm text-white/50 mt-1">
                  {isConnected 
                    ? `Sesión activa vinculada al número ${status?.whatsapp?.phone || 'Registrado'}. Agentes y notificaciones listas.`
                    : 'Para habilitar la mensajería automática y el asistente agéntico de WhatsApp, escanea el código QR.'}
                </p>
              </div>
            </div>

            <div>
              {isConnected ? (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                >
                  <Unplug className="w-4 h-4 mr-2" />
                  Desconectar Sesión
                </Button>
              ) : (
                <Button
                  onClick={handleInitSession}
                  disabled={connecting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-600/20"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Esperando Escaneo...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 mr-2" />
                      Vincular por Código QR
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Section when Connecting */}
      {connecting && !isConnected && (
        <Card className="border border-emerald-500/30 bg-emerald-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-400" />
              Escanear Código QR
            </CardTitle>
            <CardDescription className="text-white/60">
              Abre WhatsApp en tu teléfono, ve a Dispositivos Vinculados y apunta tu cámara a la pantalla.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            {qrCode ? (
              <div className="p-4 bg-white rounded-2xl shadow-2xl">
                <img 
                  src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`} 
                  alt="WhatsApp QR Code" 
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-white/50">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
                <p>Generando código QR con el microservicio WhatsApp Baileys...</p>
              </div>
            )}
            <p className="text-xs text-white/40 mt-4 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              Sincronizando automáticamente en tiempo real
            </p>
          </CardContent>
        </Card>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Admin Emergency Phone */}
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-400" />
              Teléfono Administrador de Alertas
            </CardTitle>
            <CardDescription className="text-white/50">
              Número prioritario para recibir reportes diarios, caídas críticas o alertas de emergencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveAdminPhone} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminPhone" className="text-white/70">Número Internacional (ej: +593987654321)</Label>
                <Input
                  id="adminPhone"
                  placeholder="+593 9..."
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Button 
                type="submit" 
                disabled={savingPhone}
                className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10"
              >
                {savingPhone ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar Configuración
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Channel Info & Features */}
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Capacidades Habilitadas
            </CardTitle>
            <CardDescription className="text-white/50">
              Funciones activadas por defecto para este canal en la organización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Asistente IA Autónomo 24/7', desc: 'Responde inquietudes ciudadanas y guía en postulaciones.' },
              { label: 'Notificaciones Proactivas', desc: 'Envío de alertas de salud, citas y recordatorios de programas.' },
              { label: 'Herencia a Subprogramas', desc: 'Los programas dependientes pueden reutilizar este número.' },
              { label: 'Cifrado de Extremo a Extremo', desc: 'Conexión directa vía protocolo Baileys WebSocket.' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-xs text-white/40">{f.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
