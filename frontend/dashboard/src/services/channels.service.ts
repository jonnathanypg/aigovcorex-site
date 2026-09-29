/**
 * Channels Service (OS Layer)
 * Handles API calls for multi-tenant messaging channel configuration (WhatsApp/Telegram)
 * with inheritance, program-level isolation, and unified inbox.
 */
import api from '@/services/api';
import { AxiosError } from "axios";

export interface ChannelConfigItem {
    id: number;
    org_id?: number | null;
    program_id?: number | null;
    license_id?: number | null;
    channel_type: 'whatsapp' | 'telegram';
    channel_name?: string;
    phone_number?: string;
    session_id?: string;
    bot_token?: string;
    bot_username?: string;
    ownership_type: 'dedicated' | 'inherited' | 'shared';
    parent_channel_id?: number | null;
    status: 'connected' | 'disconnected' | 'pending_qr' | 'error';
    connected_at?: string | null;
    last_message_at?: string | null;
    message_count: number;
    access_level?: 'public' | 'program' | 'org' | 'private';
    allowed_programs?: number[];
    data_isolation_level?: 'strict' | 'partial' | 'open';
    agent_name?: string;
    agent_personality?: string;
    agent_voice?: string;
    welcome_message?: string;
    is_active: boolean;
    config_data?: Record<string, any>;
}

export interface ChannelTemplateItem {
    id: number;
    license_id?: number | null;
    org_id?: number | null;
    name: string;
    description?: string;
    trigger?: string;
    channel: string;
    content: string;
    variables: string[];
    is_active: boolean;
    is_system: boolean;
    created_by?: number;
    usage_count: number;
    last_used_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ChannelConversationItem {
  id: number;
  channel_id: number;
  program_id?: number;
  beneficiary_id?: number;
  external_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  conversation_type: string;
  status: string;
  current_step?: string;
  form_data_collected?: Record<string, unknown>;
  handover_status?: string;
  is_ai_active?: boolean;
  assigned_user_id?: number;
  tags?: string[];
  sentiment_score?: number;
  lead_score?: number;
  last_message_at?: string;
  completed_at?: string;
  resolved_at?: string;
  messages_count?: number;
  messages?: Array<{
    id: number;
    role: "user" | "assistant" | "system";
    content: string;
    channel?: string;
    media_url?: string;
    media_type?: string;
    created_at?: string;
  }>;
}

export const channelsService = {
    // ===============================
    // CHANNELS OS (MULTI-TENANT & INHERITANCE)
    // ===============================

    /**
     * List all OS channels with optional filters (org_id, program_id, channel_type)
     */
    async listOSChannels(params?: { org_id?: number; program_id?: number; channel_type?: string }): Promise<ChannelConfigItem[]> {
        const response = await api.get('/api/channels-os/', { params });
        return response.data?.data || [];
    },

    /**
     * Create an OS channel configuration
     */
    async createOSChannel(data: Partial<ChannelConfigItem>): Promise<ChannelConfigItem> {
        const response = await api.post('/api/channels-os/', data);
        return response.data?.data;
    },

    /**
     * Get details of an OS channel
     */
    async getOSChannel(channelId: number): Promise<ChannelConfigItem> {
        const response = await api.get(`/api/channels-os/${channelId}`);
        return response.data?.data;
    },

    /**
     * Update an OS channel
     */
    async updateOSChannel(channelId: number, data: Partial<ChannelConfigItem>): Promise<ChannelConfigItem> {
        const response = await api.put(`/api/channels-os/${channelId}`, data);
        return response.data?.data;
    },

    /**
     * Delete (soft-delete) an OS channel connection
     */
    async deleteOSChannel(channelId: number): Promise<{ success: boolean; message?: string }> {
        const response = await api.delete(`/api/channels-os/${channelId}`);
        return response.data;
    },

    /**
     * Initialize per-channel WhatsApp session (QR flow)
     */
    async initOSWhatsApp(channelId: number): Promise<{ success: boolean; company_id?: string }> {
        const response = await api.post(`/api/channels-os/${channelId}/whatsapp/init`);
        return response.data;
    },

    /**
     * Get per-channel WhatsApp QR (proxied from whatsapp-voice via backend).
     * Con noInit=true solo sondea (para polling): no dispara init y evita
     * reiniciar la sesión en bucle. El init se hace una sola vez al abrir.
     */
    async getOSWhatsAppQR(channelId: number, noInit = false): Promise<{ success: boolean; qr?: string; status?: string; retry?: boolean }> {
        const response = await api.get(`/api/channels-os/${channelId}/whatsapp/qr`, {
            params: noInit ? { no_init: 1 } : {},
        });
        return response.data;
    },

    /**
     * Get per-channel WhatsApp status (CONNECTED/DISCONNECTED)
     */
    async getOSWhatsAppStatus(channelId: number): Promise<{ success: boolean; connected: boolean; status: string; phone?: string }> {
        const response = await api.get(`/api/channels-os/${channelId}/whatsapp/status`);
        return response.data;
    },

    /**
     * Save/validate per-channel Telegram bot token
     */
    async connectOSTelegram(channelId: number, botToken: string): Promise<{ success: boolean; bot_username?: string }> {
        const response = await api.post(`/api/channels-os/${channelId}/telegram/connect`, { bot_token: botToken });
        return response.data;
    },

    /**
     * Disconnect per-channel Telegram bot
     */
    async disconnectOSTelegram(channelId: number): Promise<{ success: boolean }> {
        const response = await api.post(`/api/channels-os/${channelId}/telegram/disconnect`);
        return response.data;
    },

    /**
     * List ALL conversations across channels (unified inbox)
     * GET /api/channels-os/conversations
     */
    async listAllConversations(params?: {
        program_id?: number;
        channel_id?: number;
        channel_type?: string;
        status?: string;
        search?: string;
        page?: number;
        per_page?: number;
    }): Promise<ChannelConversationItem[]> {
        const response = await api.get("/api/channels-os/conversations", { params });
        return response.data?.data || [];
    },

    /**
     * Get single conversation with messages (unified inbox)
     * GET /api/channels-os/conversations/:id
     */
    async getOSConversation(convId: number): Promise<ChannelConversationItem | null> {
        try {
            const response = await api.get(`/api/channels-os/conversations/${convId}`);
            return response.data?.data || null;
        } catch (e) {
            const err = e as AxiosError;
            if (err.response?.status === 404) return null;
            throw e;
        }
    },

    /**
     * Reply to a conversation (dispatch WhatsApp/Telegram)
     * POST /api/channels-os/conversations/:id/reply
     */
    async replyConversation(convId: number, content: string, pauseAI = true): Promise<{ success: boolean; dispatched: boolean }> {
        const response = await api.post(`/api/channels-os/conversations/${convId}/reply`, { content, pause_ai: pauseAI });
        return response.data;
    },

    /**
     * Update conversation status (resolve, reopen, pause AI, assign, tags)
     * PATCH /api/channels-os/conversations/:id/status
     */
    async updateConversationStatus(convId: number, payload: {
        is_resolved?: boolean;
        is_ai_active?: boolean;
        handover_status?: string;
        assigned_user_id?: number | null;
        tags?: string[];
        sentiment_score?: number;
        lead_score?: number;
    }): Promise<{ success: boolean }> {
        const response = await api.patch(`/api/channels-os/conversations/${convId}/status`, payload);
        return response.data;
    },

    /**
     * Get overall statistics for OS channels
     */
    async getOSStats(): Promise<{
        channels: { total: number; whatsapp: number; telegram: number; connected: number };
        conversations: { total: number; open: number; completed: number };
    }> {
        const response = await api.get('/api/channels-os/stats');
        return response.data?.data;
    },

    /**
     * Get root channels (License + Organization) that can be inherited
     */
    async getRootChannels(): Promise<Array<{
        id: string;
        type: string;
        source_id: number;
        source_name: string;
        source_type: 'license' | 'organization';
        channel_type: 'whatsapp' | 'telegram';
        phone_number?: string;
        bot_username?: string;
        session_id?: string;
        agent_name?: string;
        status: 'connected' | 'disconnected';
        can_inherit: boolean;
        description: string;
    }>> {
        const response = await api.get('/api/channels-os/root-channels');
        return response.data?.data || [];
    },

    // ===============================
    // TEMPLATES (OS)
    // ===============================

    /**
     * List all templates with optional filters
     */
    async listTemplates(params?: { channel?: string; trigger?: string; is_active?: boolean; include_system?: boolean }): Promise<ChannelTemplateItem[]> {
        const response = await api.get('/api/channels-os/templates/', { params });
        return response.data?.data || [];
    },

    /**
     * Create a new template
     */
    async createTemplate(data: Partial<ChannelTemplateItem>): Promise<ChannelTemplateItem> {
        const response = await api.post('/api/channels-os/templates/', data);
        return response.data?.data;
    },

    /**
     * Get a single template
     */
    async getTemplate(templateId: number): Promise<ChannelTemplateItem> {
        const response = await api.get(`/api/channels-os/templates/${templateId}`);
        return response.data?.data;
    },

    /**
     * Update a template
     */
    async updateTemplate(templateId: number, data: Partial<ChannelTemplateItem>): Promise<ChannelTemplateItem> {
        const response = await api.put(`/api/channels-os/templates/${templateId}`, data);
        return response.data?.data;
    },

    /**
     * Delete a template
     */
    async deleteTemplate(templateId: number): Promise<{ success: boolean; message?: string }> {
        const response = await api.delete(`/api/channels-os/templates/${templateId}`);
        return response.data;
    },

    /**
     * Render a template with context variables
     */
    async renderTemplate(templateId: number, context: Record<string, any>): Promise<{ rendered: string; template: ChannelTemplateItem }> {
        const response = await api.post(`/api/channels-os/templates/${templateId}/render`, { context });
        return response.data?.data;
    },

    /**
     * Seed default system templates for current license
     */
    async seedDefaultTemplates(): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/api/channels-os/templates/seed-defaults');
        return response.data;
    },

    // ===============================
    // LEGACY CHANNELS (LICENSE-BASED)
    // Used by MessagingChannelsModal in user profile menu
    // ===============================

    /**
     * Get status of all messaging channels (legacy)
     */
    async getStatus(): Promise<ChannelsStatus> {
        const response = await api.get<ChannelsStatus>('/api/channels/status');
        return response.data;
    },

    // WHATSAPP LEGACY
    async initWhatsApp(): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/whatsapp/init');
        return response.data;
    },

    async getWhatsAppQR(): Promise<WhatsAppQRResponse> {
        const response = await api.get<WhatsAppQRResponse>('/api/channels/whatsapp/qr');
        return response.data;
    },

    async getWhatsAppStatus(): Promise<{ connected: boolean; phone?: string; status: string }> {
        const response = await api.get('/api/channels/whatsapp/status');
        return response.data;
    },

    async updateWhatsAppAdminPhone(phone: string): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/whatsapp/admin-phone', { phone });
        return response.data;
    },

    async updateMyWhatsApp(phone: string): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/my-whatsapp', { phone });
        return response.data;
    },

    async getMyWhatsApp(): Promise<{ whatsapp_phone: string | null }> {
        const response = await api.get<{ whatsapp_phone: string | null }>('/api/channels/my-whatsapp');
        return response.data;
    },

    async disconnectWhatsApp(): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/whatsapp/disconnect');
        return response.data;
    },

    // TELEGRAM LEGACY
    async connectTelegram(botToken: string): Promise<ChannelActionResponse & { bot_username?: string }> {
        const response = await api.post('/api/channels/telegram/connect', {
            bot_token: botToken
        });
        return response.data;
    },

    async getTelegramStatus(): Promise<{ connected: boolean; bot_username?: string }> {
        const response = await api.get('/api/channels/telegram/status');
        return response.data;
    },

    async disconnectTelegram(): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/telegram/disconnect');
        return response.data;
    },

    async generateTelegramLinkCode(): Promise<{ link_code: string; instructions: string }> {
        const response = await api.post('/api/channels/telegram/link-code');
        return response.data;
    }
};

// Legacy interfaces
export interface ChannelsStatus {
    whatsapp: {
        connected: boolean;
        phone: string | null;
        admin_phone?: string | null;
    };
    telegram: {
        connected: boolean;
        bot_username: string | null;
    };
}

export interface WhatsAppQRResponse {
    qr?: string;
    error?: string;
}

export interface ChannelActionResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export default channelsService;
