"use client";
import { MessageSquare, Bot, Mail } from "lucide-react";

type ChannelType = 'whatsapp' | 'telegram' | 'email' | 'webchat' | 'admin_chat' | 'playground';

export function ChannelBadge({ type }: { type: ChannelType }) {
  const config: Record<ChannelType, { label: string; icon: React.ReactNode; color: string }> = {
    whatsapp: { label: "WhatsApp", icon: <MessageSquare className="w-3 h-3" />, color: "bg-green-500/15 text-green-400 border-green-500/30" },
    telegram: { label: "Telegram", icon: <MessageSquare className="w-3 h-3" />, color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    email: { label: "Email", icon: <Mail className="w-3 h-3" />, color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    webchat: { label: "Web Chat", icon: <Bot className="w-3 h-3" />, color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
    admin_chat: { label: "Admin", icon: <Bot className="w-3 h-3" />, color: "bg-red-500/15 text-red-400 border-red-500/30" },
    playground: { label: "Playground", icon: <Bot className="w-3 h-3" />, color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  };
  const c = config[type] ?? config.webchat;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}