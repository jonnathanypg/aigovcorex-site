"use client";
/** Panel de perfil del contacto (port de aikrofy ContactProfileSidebar)
 *  Info contacto, programa/centro, scores, tags, IA, botón CRM
 */
import React from "react";
import { Users, MessageSquare, Brain, Heart, Tag, Target, ArrowUpRight, ExternalLink } from "lucide-react";
import { ChannelBadge } from "./ChannelBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ConversationData {
  id: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  channel_type?: string;
  conversation_type?: string;
  current_step?: string;
  program_id?: number;
  beneficiary_id?: number;
  handover_status?: string;
  is_ai_active?: boolean;
  tags?: string[];
  sentiment_score?: number;
  lead_score?: number;
  started_at?: string;
  last_message_at?: string;
  form_data_collected?: Record<string, unknown>;
}

interface Props {
  conversation: ConversationData | null;
  onOpenCRM?: (customerId: number) => void;
}

export function ContactProfileSidebar({ conversation, onOpenCRM }: Props) {
  if (!conversation) {
    return (
      <div className="flex flex-col h-full bg-muted/30 items-center justify-center text-muted-foreground p-4 text-center">
        <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
        <p>Selecciona una conversación</p>
      </div>
    );
  }

  const sentimentLabel = (score?: number) => {
    if (score === undefined) return "—";
    if (score >= 0.2) return <span className="flex items-center gap-1 text-green-400"><Heart className="w-3 h-3" fill="currentColor" /> Positivo ({score.toFixed(2)})</span>;
    if (score <= -0.2) return <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" fill="currentColor" /> Negativo ({score.toFixed(2)})</span>;
    return <span className="flex items-center gap-1 text-amber-400"><Heart className="w-3 h-3" /> Neutral ({score.toFixed(2)})</span>;
  };

  const aiStatus = () => {
    if (conversation.is_ai_active === false) return <Badge variant="destructive" className="text-[10px]"><Brain className="w-2.5 h-2.5 mr-1" />IA Pausada</Badge>;
    if (conversation.handover_status === "human_taken") return <Badge variant="default" className="text-[10px]"><Users className="w-2.5 h-2.5 mr-1" />Humano</Badge>;
    if (conversation.handover_status === "human_listening") return <Badge variant="secondary" className="text-[10px]"><MessageSquare className="w-2.5 h-2.5 mr-1" />Escuchando</Badge>;
    return <Badge variant="outline" className="text-[10px]"><Brain className="w-2.5 h-2.5 mr-1" />IA Activa</Badge>;
  };

  const fmt = (iso?: string) => iso ? format(new Date(iso), "dd MMM yyyy HH:mm", { locale: es }) : "—";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-l p-3 overflow-y-auto">
      <div className="space-y-4">
        {/* Header contacto */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ChannelBadge type={conversation.channel_type as any} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{conversation.contact_name ?? conversation.contact_phone ?? `Conv. ${conversation.id}`}</h3>
            <p className="text-xs text-muted-foreground truncate">{conversation.contact_phone ?? "Sin teléfono"}</p>
            {conversation.contact_email && <p className="text-xs text-muted-foreground truncate">{conversation.contact_email}</p>}
          </div>
        </div>

        {/* Canal y tipo */}
        <div className="flex items-center gap-2 flex-wrap">
          <ChannelBadge type={conversation.channel_type as any} />
          {conversation.conversation_type && <Badge variant="secondary" className="text-[10px]">{conversation.conversation_type}</Badge>}
          {conversation.current_step && <Badge variant="secondary" className="text-[10px]">{conversation.current_step}</Badge>}
        </div>

        {/* Estado IA / Handover */}
        <div className="pt-2 border-t">
          <div className="text-[11px] text-muted-foreground mb-1">Estado del asistente</div>
          <div className="flex flex-wrap gap-1">{aiStatus()}</div>
        </div>

        {/* Scores */}
        {(conversation.sentiment_score !== undefined || conversation.lead_score !== undefined) && (
          <div className="pt-2 border-t space-y-2">
            <div className="text-[11px] text-muted-foreground">Métricas</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/50 rounded text-center">
                <div className="text-[10px] text-muted-foreground">Sentimiento</div>
                <div className="text-sm font-medium">{sentimentLabel(conversation.sentiment_score)}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded text-center">
                <div className="text-[10px] text-muted-foreground">Lead Score</div>
                <div className="text-sm font-medium">{conversation.lead_score ?? "—"}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        {(conversation.tags && conversation.tags.length > 0) && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
              <Tag className="w-3 h-3" /> Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {conversation.tags.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[9px]">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Iniciada</span><span>{fmt(conversation.started_at)}</span></div>
          <div className="flex justify-between"><span>Último mensaje</span><span>{fmt(conversation.last_message_at)}</span></div>
        </div>

        {/* Datos formulario recolectados */}
        {(conversation.form_data_collected && Object.keys(conversation.form_data_collected).length > 0) && (
          <div className="pt-2 border-t">
            <div className="text-[11px] text-muted-foreground mb-1">Datos recolectados</div>
            <div className="text-[10px] font-mono bg-muted/50 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(conversation.form_data_collected, null, 2)}
            </div>
          </div>
        )}

        {/* CRM Button */}
        {onOpenCRM && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => onOpenCRM(conversation.beneficiary_id ?? conversation.id)}
            >
              <ExternalLink className="w-4 h-4" /> Ver en CRM / Ficha
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}