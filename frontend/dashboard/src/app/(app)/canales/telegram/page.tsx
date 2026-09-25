'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Unplug, 
  Key, 
  ShieldCheck, 
  HelpCircle,
  Copy,
  ExternalLink,
  Loader2,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { channelsService, ChannelsStatus } from '@/services/channels.service';
import { toast } from 'sonner';

export default function TelegramChannelPage() {
  const [status, setStatus] = useState<ChannelsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [botToken, setBotToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await channelsService.getStatus();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
      toast.error('No se pudo cargar el estado de Telegram');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim()) {
      toast.error('Por favor ingresa un Bot Token de Telegram');
      return;
    }

    try {
      setConnecting(true);
      const res = await channelsService.connectTelegram(botToken);
      if (res.success) {
        toast.success(`¡Bot @${res.bot_username || 'Telegram'} conectado y webhook configurado!`);
        setBotToken('');
        await fetchStatus();
      } else {
        toast.error(res.error || 'Error al conectar el bot de Telegram');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Token de Telegram inválido o error en webhook');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await channelsService.disconnectTelegram();
      toast.success('Bot de Telegram desvinculado');
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al desconectar Telegram');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLinkCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await channelsService.generateTelegramLinkCode();
      setLinkCode(res.link_code);
      toast.success('Código de vinculación personal generado');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al generar código de enlace');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const isConnected = status?.telegram?.connected;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Send className="w-6 h-6" />
            </div>
            Telegram Institucional
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Conexión de bots oficiales vía Telegram Bot API con soporte para comandos, encuestas y agentes
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
              <div className={`p-3 rounded-2xl ${isConnected ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
                {isConnected ? <CheckCircle2 className="w-8 h-8" /> : <Bot className="w-8 h-8" />}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">
                    {isConnected ? `Bot Conectado: @${status?.telegram?.bot_username || 'bot'}` : 'Bot de Telegram Desconectado'}
                  </h3>
                  <Badge variant={isConnected ? 'default' : 'secondary'} className={isConnected ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-white/10 text-white/50 border-white/10'}>
                    {isConnected ? 'ONLINE' : 'SIN CONFIGURAR'}
                  </Badge>
                </div>
                <p className="text-sm text-white/50 mt-1">
                  {isConnected 
                    ? 'Los webhooks automáticos están redirigiendo los mensajes de los ciudadanos a los agentes agénticos.'
                    : 'Configura el Bot Token proporcionado por @BotFather para activar la interacción agéntica por Telegram.'}
                </p>
              </div>
            </div>

            <div>
              {isConnected && (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                >
                  <Unplug className="w-4 h-4 mr-2" />
                  Desconectar Bot
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot Connection Form or Account Link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token config */}
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-sky-400" />
              {isConnected ? 'Actualizar Bot Token' : 'Vincular Bot de Telegram'}
            </CardTitle>
            <CardDescription className="text-white/50">
              Obtén tu token hablando con <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline inline-flex items-center gap-1">@BotFather <ExternalLink className="w-3 h-3" /></a> en Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="botToken" className="text-white/70">Telegram Bot Token</Label>
                <Input
                  id="botToken"
                  type="password"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Button 
                type="submit" 
                disabled={connecting}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium"
              >
                {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isConnected ? 'Reconfigurar Webhook' : 'Conectar Bot Oficial'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Telegram Personal Linking (for Coordinators/Staff) */}
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              Vinculación de Operador / Staff
            </CardTitle>
            <CardDescription className="text-white/50">
              Enlaza tu cuenta de Telegram para recibir alertas directas del sistema y consultar métricas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-white/50">
              Genera un código temporal y envíaselo al bot institucional para autenticarte como personal oficial.
            </p>
            {linkCode ? (
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between">
                <div>
                  <p className="text-xs text-sky-400 font-medium">Envía este comando al bot:</p>
                  <p className="text-lg font-mono font-bold text-white mt-1">/link {linkCode}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => copyToClipboard(`/link ${linkCode}`)}
                  className="border-sky-500/40 text-sky-300 hover:bg-sky-500/20"
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copiar
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleGenerateLinkCode}
                disabled={generatingCode || !isConnected}
                variant="outline"
                className="w-full border-white/10 hover:bg-white/5 text-white"
              >
                {generatingCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                Generar Código de Enlace
              </Button>
            )}

            <div className="pt-2 text-xs text-white/40 space-y-1.5">
              <p>• El bot responderá reconociendo tu rol institucional.</p>
              <p>• Recibirás avisos de nuevos postulantes y reportes automáticos.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
