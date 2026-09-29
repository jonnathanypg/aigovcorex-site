"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  MessageSquare,
  Send,
  Plus,
  CheckCircle2,
  RefreshCw,
  Layers,
  Loader2,
  Trash2,
  QrCode,
  Key,
  Link2,
  Building2,
  GitBranch,
  Edit,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  channelsService,
  ChannelConfigItem,
} from "@/services/channels.service";
import { socialService, SocialProgram } from "@/services/social.service";
import { toast } from "sonner";

interface RootChannel {
  id: string;
  type: string;
  source_id: number;
  source_name: string;
  source_type: "license" | "organization";
  channel_type: "whatsapp" | "telegram";
  phone_number?: string;
  bot_username?: string;
  session_id?: string;
  agent_name?: string;
  status: "connected" | "disconnected";
  can_inherit: boolean;
  description: string;
}

export default function ConexionesPage() {
  const [channels, setChannels] = useState<ChannelConfigItem[]>([]);
  const [rootChannels, setRootChannels] = useState<RootChannel[]>([]);
  const [programs, setPrograms] = useState<SocialProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingChannel, setEditingChannel] =
    useState<ChannelConfigItem | null>(null);
  const [channelType, setChannelType] = useState<"whatsapp" | "telegram">(
    "whatsapp",
  );
  const [channelName, setChannelName] = useState("");
  const [ownershipType, setOwnershipType] = useState<
    "dedicated" | "inherited" | "shared"
  >("dedicated");
  const [programId, setProgramId] = useState<string>("");
  const [parentChannelId, setParentChannelId] = useState<string>("");
  const [accessLevel, setAccessLevel] = useState<"program" | "org" | "public">(
    "program",
  );
  const [agentName, setAgentName] = useState("GovCore AI");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [linkingChannel, setLinkingChannel] =
    useState<ChannelConfigItem | null>(null);
  const [linkQr, setLinkQr] = useState<string | null>(null);
  const [linkQrLoading, setLinkQrLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const chList = await channelsService.listOSChannels();
      const prList = await socialService.getPrograms().catch(() => []);
      let rcList: RootChannel[] = [];
      try {
        rcList = await channelsService.getRootChannels();
      } catch (e) {
        console.error("Error loading root channels:", e);
      }
      setChannels(chList);
      setPrograms(prList);
      setRootChannels(rcList);
    } catch (e) {
      console.error("Error loading connections:", e);
      toast.error("Error al cargar conexiones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateDialog = () => {
    setEditingChannel(null);
    setChannelName("");
    setOwnershipType("dedicated");
    setParentChannelId("");
    setProgramId("");
    setAccessLevel("program");
    setAgentName("GovCore AI");
    setChannelType("whatsapp");
    setIsDialogOpen(true);
  };

  const openEditDialog = (ch: ChannelConfigItem) => {
    setEditingChannel(ch);
    setChannelName(ch.channel_name || "");
    setAgentName(ch.agent_name || "");
    setAccessLevel(
      (ch.access_level as "program" | "org" | "public") || "program",
    );
    setProgramId(ch.program_id ? String(ch.program_id) : "");
    setChannelType(ch.channel_type);
    setOwnershipType(ch.ownership_type);
    setParentChannelId(
      ch.parent_channel_id ? String(ch.parent_channel_id) : "",
    );
    setIsDialogOpen(true);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) {
      toast.error("Por favor indique un nombre para la conexión");
      return;
    }
    try {
      setCreating(true);
      await channelsService.createOSChannel({
        channel_type: channelType,
        channel_name: channelName,
        ownership_type: ownershipType,
        program_id: programId ? parseInt(programId) : undefined,
        parent_channel_id: parentChannelId
          ? parseInt(parentChannelId)
          : undefined,
        access_level: accessLevel,
        agent_name: agentName,
        status: ownershipType === "inherited" ? "connected" : "disconnected",
      });
      toast.success("Conexión de canal registrada con éxito");
      setIsDialogOpen(false);
      setChannelName("");
      loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Error al crear conexión";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel || !channelName.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    try {
      setCreating(true);
      await channelsService.updateOSChannel(editingChannel.id, {
        channel_name: channelName,
        agent_name: agentName || undefined,
        access_level: accessLevel,
        program_id: programId ? parseInt(programId) : undefined,
      });
      toast.success("Canal actualizado");
      setEditingChannel(null);
      setIsDialogOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Error al actualizar";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteChannel = async (ch: ChannelConfigItem) => {
    const label =
      ch.channel_name || ch.channel_type.toUpperCase() + " #" + ch.id;
    if (
      !window.confirm(
        '¿Eliminar la conexión "' +
          label +
          '"? Esta acción la desactiva para todos los programas vinculados.',
      )
    ) {
      return;
    }
    try {
      setDeletingId(ch.id);
      await channelsService.deleteOSChannel(ch.id);
      toast.success("Conexión eliminada");
      if (linkingChannel && linkingChannel.id === ch.id) {
        setLinkingChannel(null);
        setLinkQr(null);
      }
      await loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Error al eliminar la conexión";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const openLinkFlow = async (ch: ChannelConfigItem) => {
    setLinkingChannel(ch);
    setLinkQr(null);
    setLinkStatus(null);
    setTelegramToken("");
    if (ch.channel_type === "whatsapp") {
      setLinkQrLoading(true);
      try {
        await channelsService.initOSWhatsApp(ch.id).catch(() => null);
      } finally {
        await refreshLinkStatus(ch, true, true);
        setLinkQrLoading(false);
      }
    } else {
      await refreshTelegramLinkStatus(ch);
    }
  };

  const closeLinkFlow = () => {
    setLinkingChannel(null);
    setLinkQr(null);
    setLinkStatus(null);
    setTelegramToken("");
  };

  const getPollingInterval = (status?: string) =>
    status === "pending_qr" ? 2000 : 4000;

  const refreshLinkStatusRef = React.useRef<
    | ((
        ch: ChannelConfigItem,
        withQr?: boolean,
        quiet?: boolean,
      ) => Promise<void>)
    | null
  >(null);

  useEffect(() => {
    if (
      !linkingChannel ||
      linkingChannel.channel_type !== "whatsapp" ||
      linkStatus === "CONNECTED"
    )
      return;
    let interval: ReturnType<typeof setInterval>;
    const schedule = () => {
      const current = linkingChannel;
      const ms = getPollingInterval(current?.status);
      interval = setInterval(() => {
        if (refreshLinkStatusRef.current && current) {
          refreshLinkStatusRef.current(current, true, true);
        }
      }, ms);
    };
    schedule();
    return () => clearInterval(interval);
  }, [linkingChannel, linkStatus]);

  const refreshLinkStatus = async (
    ch: ChannelConfigItem,
    withQr = false,
    quiet = false,
  ) => {
    try {
      if (!quiet) setLinkQrLoading(withQr);
      const st = await channelsService.getOSWhatsAppStatus(ch.id);
      const normalized = st.connected ? "CONNECTED" : "DISCONNECTED";
      setLinkStatus(st.status ? String(st.status).toUpperCase() : normalized);
      if (withQr && !st.connected) {
        const qrRes = await channelsService
          .getOSWhatsAppQR(ch.id, true)
          .catch(() => null);
        if (qrRes && qrRes.qr) {
          setLinkQr(qrRes.qr);
        }
      }
      if (st.connected) {
        toast.success("Canal WhatsApp CONECTADO");
        await loadData();
      }
    } catch (e) {
      console.error("Error refreshing link status:", e);
    } finally {
      if (!quiet) setLinkQrLoading(false);
    }
  };
  refreshLinkStatusRef.current = refreshLinkStatus;

  const handleRetryQr = async () => {
    if (!linkingChannel) return;
    try {
      setLinkBusy(true);
      await channelsService.initOSWhatsApp(linkingChannel.id);
      toast.info("Sesión reiniciada. Regenerando QR…");
      await refreshLinkStatus(linkingChannel, true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "No se pudo reiniciar la sesión";
      toast.error(msg);
    } finally {
      setLinkBusy(false);
    }
  };

  const refreshTelegramLinkStatus = async (ch: ChannelConfigItem) => {
    try {
      const detail = await channelsService.getOSChannel(ch.id);
      setLinkStatus(
        detail.status ? String(detail.status).toUpperCase() : "DISCONNECTED",
      );
      setLinkingChannel(detail);
    } catch (e) {
      console.error("Error loading telegram channel:", e);
    }
  };

  const handleSaveTelegramToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingChannel) return;
    if (!telegramToken.trim()) {
      toast.error("Pega el bot token de Telegram (BotFather)");
      return;
    }
    try {
      setLinkBusy(true);
      const res = await channelsService.connectOSTelegram(
        linkingChannel.id,
        telegramToken.trim(),
      );
      if (res.success) {
        const username =
          (res as { bot_username?: string }).bot_username || "Telegram";
        toast.success("Bot @" + username + " validado y guardado");
        setTelegramToken("");
        await refreshTelegramLinkStatus(linkingChannel);
        await loadData();
      } else {
        toast.error("Token inválido");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Token de Telegram inválido";
      toast.error(msg);
    } finally {
      setLinkBusy(false);
    }
  };

  const openRootLinkFlow = async (rootChannel: RootChannel) => {
    if (!rootChannel.can_inherit) return;
    const suggested =
      (rootChannel.channel_type === "whatsapp" ? "WhatsApp" : "Telegram") +
      " - " +
      rootChannel.source_name +
      " - Herencia";
    const name = window.prompt(
      "Nombre para la herencia de " +
        rootChannel.source_name +
        " (" +
        rootChannel.channel_type +
        "):",
      suggested,
    );
    if (!name || !name.trim()) return;
    try {
      const newChannel = await channelsService.createOSChannel({
        channel_type: rootChannel.channel_type,
        channel_name: name.trim(),
        ownership_type: "inherited",
        program_id: undefined,
        parent_channel_id: undefined,
        agent_name: rootChannel.agent_name || "GovCore AI",
        access_level: "program",
        data_isolation_level: "strict",
        status:
          rootChannel.status === "connected" ? "connected" : "disconnected",
        config_data: {
          root_channel_source: rootChannel.type,
          root_channel_source_id: rootChannel.source_id,
          root_channel_source_name: rootChannel.source_name,
          root_channel_phone: rootChannel.phone_number,
          root_channel_bot_username: rootChannel.bot_username,
          root_channel_session_id: rootChannel.session_id,
          inherits_credentials: true,
        },
      });
      toast.success("Canal heredado creado desde " + rootChannel.source_name);
      setLinkingChannel(newChannel);
      setLinkQr(null);
      setLinkStatus(null);
      setTelegramToken("");
      if (newChannel.channel_type === "whatsapp") {
        setLinkQrLoading(true);
        try {
          await channelsService.initOSWhatsApp(newChannel.id).catch(() => null);
        } finally {
          await refreshLinkStatus(newChannel, true, true);
          setLinkQrLoading(false);
        }
      }
      loadData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Error al crear herencia y vincular";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Network className="w-6 h-6" />
            </div>
            Conexiones de Canal por Programa y Entidad
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Mapeo de instancias de WhatsApp y Telegram vinculadas a programas
            sociales o heredadas de la matriz. Una organización puede tener
            varios números de WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            <RefreshCw
              className={"w-4 h-4 mr-2 " + (loading ? "animate-spin" : "")}
            />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openCreateDialog}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Conexión
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white text-lg">
                  {editingChannel
                    ? "Editar Conexión"
                    : "Nueva Conexión de Canal"}
                </DialogTitle>
                <DialogDescription className="text-white/50 text-xs">
                  {editingChannel
                    ? "Modifica el nombre, programa, agente y nivel de acceso."
                    : "Selecciona WhatsApp o Telegram, ponle nombre, escanea el QR y vincúlalo a un programa."}
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={
                  editingChannel ? handleUpdateChannel : handleCreateChannel
                }
                className="space-y-4 mt-2"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">
                      Tipo de Canal
                    </Label>
                    <select
                      value={channelType}
                      onChange={(e) =>
                        setChannelType(
                          e.target.value as "whatsapp" | "telegram",
                        )
                      }
                      disabled={!!editingChannel}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="whatsapp" className="bg-zinc-900">
                        WhatsApp
                      </option>
                      <option value="telegram" className="bg-zinc-900">
                        Telegram
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">Modalidad</Label>
                    <select
                      value={ownershipType}
                      onChange={(e) =>
                        setOwnershipType(
                          e.target.value as
                            "dedicated" | "inherited" | "shared",
                        )
                      }
                      disabled={!!editingChannel}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="dedicated" className="bg-zinc-900">
                        Dedicado (Propio)
                      </option>
                      <option value="inherited" className="bg-zinc-900">
                        Heredado (De Matriz)
                      </option>
                      <option value="shared" className="bg-zinc-900">
                        Compartido
                      </option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">
                    Nombre Identificador
                  </Label>
                  <Input
                    placeholder="Ej: WhatsApp Ventas 0987654321 o WhatsApp Programa BDH"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">
                    Asignar a Programa Social (Opcional)
                  </Label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="" className="bg-zinc-900">
                      Sin asignar (Canal Institucional Matriz)
                    </option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        {p.name} ({p.short_code})
                      </option>
                    ))}
                  </select>
                </div>
                {ownershipType === "inherited" && !editingChannel && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/70">
                      Heredar de Canal Matriz
                    </Label>
                    <select
                      value={parentChannelId}
                      onChange={(e) => setParentChannelId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="" className="bg-zinc-900">
                        Seleccionar canal padre...
                      </option>
                      {channels
                        .filter((c) => c.ownership_type === "dedicated")
                        .map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                            className="bg-zinc-900"
                          >
                            {c.channel_name ||
                              c.channel_type.toUpperCase() + " #" + c.id}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">
                    Nombre del Agente IA que Atenderá
                  </Label>
                  <Input
                    placeholder="Ej: Asistente Kindi o Agente BDH"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/70">
                    Nivel de Acceso
                  </Label>
                  <select
                    value={accessLevel}
                    onChange={(e) =>
                      setAccessLevel(
                        e.target.value as "program" | "org" | "public",
                      )
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="program" className="bg-zinc-900">
                      Programa
                    </option>
                    <option value="org" className="bg-zinc-900">
                      Organización
                    </option>
                    <option value="public" className="bg-zinc-900">
                      Público
                    </option>
                  </select>
                </div>
                <div className="pt-3">
                  <Button
                    type="submit"
                    disabled={creating}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    {editingChannel ? "Guardar Cambios" : "Registrar Conexión"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-violet-400" />
          Canales Principales (Licencia / Organización)
        </h3>
        <p className="text-xs text-white/50">
          Canales configurados desde el menú de perfil (Canales de Mensajería).
          Crea herencias hacia programas sin comprar nuevos números.
        </p>
        {rootChannels.length === 0 ? (
          <Card className="border border-white/10 bg-white/[0.02]">
            <CardContent className="p-8 text-center text-white/40 text-sm">
              <Building2 className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p>No hay canales principales configurados.</p>
              <p className="text-xs text-white/30 mt-1">
                Configura WhatsApp o Telegram desde el menú de perfil para que
                aparezcan aquí.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rootChannels.map((rc) => (
              <Card
                key={rc.id}
                className="border border-violet-500/30 bg-violet-500/[0.02] hover:bg-violet-500/[0.04] transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={
                          "p-2 rounded-xl " +
                          (rc.channel_type === "whatsapp"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-sky-500/20 text-sky-400 border border-sky-500/30")
                        }
                      >
                        {rc.channel_type === "whatsapp" ? (
                          <MessageSquare className="w-5 h-5" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-white text-sm font-semibold">
                          {rc.source_name}
                        </CardTitle>
                        <p className="text-[11px] text-white/40 uppercase tracking-wider">
                          {rc.channel_type} -{" "}
                          {rc.source_type === "license"
                            ? "Licencia"
                            : "Organización"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs text-violet-300 border-violet-500/40 bg-violet-500/10"
                      >
                        CANAL PRINCIPAL
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          "text-[10px] " +
                          (rc.status === "connected"
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                            : "border-zinc-500/40 text-zinc-400")
                        }
                      >
                        {rc.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {rc.phone_number ? (
                    <div className="flex items-center justify-between text-white/60">
                      <span>Teléfono:</span>
                      <span className="text-white font-medium font-mono text-xs">
                        {rc.phone_number}
                      </span>
                    </div>
                  ) : null}
                  {rc.bot_username ? (
                    <div className="flex items-center justify-between text-white/60">
                      <span>Bot:</span>
                      <span className="text-white font-medium font-mono text-xs">
                        @{rc.bot_username}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRootLinkFlow(rc)}
                      className="flex-1 border-violet-500/40 text-violet-300 hover:bg-violet-500/20 text-xs"
                    >
                      <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                      Crear Herencia
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-400" />
            Conexiones por Programa (múltiples números)
          </h3>
          <Badge
            variant="outline"
            className="text-xs text-violet-300 border-violet-500/40 bg-violet-500/10"
          >
            {channels.length} configuradas
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.length === 0 ? (
            <div className="col-span-full py-12 text-center border border-white/10 rounded-2xl bg-white/[0.02]">
              <Network className="w-10 h-10 text-white/30 mx-auto mb-2" />
              <p className="text-sm text-white/60">
                No se encontraron conexiones registradas.
              </p>
              <p className="text-xs text-white/40 mt-1">
                Usa Nueva Conexión o crea herencias desde los Canales
                Principales.
              </p>
            </div>
          ) : (
            channels.map((ch) => (
              <Card
                key={ch.id}
                className="border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={
                          "p-2 rounded-xl " +
                          (ch.channel_type === "whatsapp"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-sky-500/10 text-sky-400")
                        }
                      >
                        {ch.channel_type === "whatsapp" ? (
                          <MessageSquare className="w-5 h-5" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-white text-sm font-semibold">
                          {ch.channel_name || "Canal sin nombre"}
                        </CardTitle>
                        <p className="text-[11px] text-white/40 uppercase tracking-wider">
                          {ch.channel_type}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        "text-[10px] " +
                        (ch.status === "connected"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : "border-zinc-500/40 text-zinc-400")
                      }
                    >
                      {ch.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-white/60 border-t border-white/5 pt-2">
                    <span>Modalidad:</span>
                    <Badge className="bg-white/10 text-white text-[10px] uppercase">
                      {ch.ownership_type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Agente IA:</span>
                    <span className="text-white font-medium">
                      {ch.agent_name || "Predeterminado"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Mensajes:</span>
                    <span className="text-white font-medium">
                      {ch.message_count || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(ch)}
                      className="flex-1 border-sky-500/40 text-sky-300 hover:bg-sky-500/20 text-xs"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLinkFlow(ch)}
                      className="flex-1 border-violet-500/40 text-violet-300 hover:bg-violet-500/20 text-xs"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />
                      Vincular
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {ch.status !== "connected" &&
                    ch.channel_type === "whatsapp" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLinkFlow(ch)}
                        className="flex-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Reconectar
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteChannel(ch)}
                      disabled={deletingId === ch.id}
                      className="flex-1 border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs"
                    >
                      {deletingId === ch.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={!!linkingChannel}
        onOpenChange={(open) => {
          if (!open) closeLinkFlow();
        }}
      >
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              Vincular{" "}
              {linkingChannel && linkingChannel.channel_type === "whatsapp"
                ? "WhatsApp"
                : "Telegram"}{" "}
              -{" "}
              {linkingChannel
                ? linkingChannel.channel_name || "#" + linkingChannel.id
                : ""}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              {linkingChannel && linkingChannel.channel_type === "whatsapp"
                ? "Escanea el QR para conectar esta cuenta. Estado en vivo con reintento."
                : "Pega el bot token de BotFather para validar y guardar en este canal."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50">Estado:</span>
            <Badge
              variant="outline"
              className={
                "text-[10px] " +
                (linkStatus === "CONNECTED"
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : "border-zinc-500/40 text-zinc-300")
              }
            >
              {linkStatus || "…"}
            </Badge>
          </div>
          {linkingChannel && linkingChannel.channel_type === "whatsapp" ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                {linkQrLoading ? (
                  <div className="flex flex-col items-center py-8 text-white/50 text-xs">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
                    Generando QR…
                  </div>
                ) : null}
                {!linkQrLoading && linkQr ? (
                  <div className="p-3 bg-white rounded-xl">
                    {linkQr.trim().startsWith("<svg") ? (
                      <div dangerouslySetInnerHTML={{ __html: linkQr }} />
                    ) : (
                      <img
                        src={
                          linkQr.startsWith("data:image")
                            ? linkQr
                            : "data:image/png;base64," + linkQr
                        }
                        alt="QR WhatsApp"
                        className="w-56 h-56 object-contain"
                      />
                    )}
                  </div>
                ) : null}
                {!linkQrLoading && !linkQr ? (
                  <p className="text-xs text-white/40 py-6 text-center">
                    Generando QR… se actualiza solo cada 2-4 segundos.
                    <br />
                    Si tarda más de 30s, usa Reintentar QR.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    linkingChannel && refreshLinkStatus(linkingChannel, true)
                  }
                  disabled={linkQrLoading || linkBusy}
                  className="flex-1 border-white/10 text-white text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Actualizar estado
                </Button>
                <Button
                  size="sm"
                  onClick={handleRetryQr}
                  disabled={linkBusy || linkQrLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                >
                  {linkBusy ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Reintentar QR
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveTelegramToken} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">
                  Bot Token (BotFather)
                </Label>
                <Input
                  type="password"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ…"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={linkBusy}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs"
              >
                {linkBusy ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5 mr-1.5" />
                )}
                Guardar y validar token
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
