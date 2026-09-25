/**
 * Channels Service
 * Handles API calls for messaging channel configuration (WhatsApp/Telegram)
 */
import api from '@/services/api';

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

export interface TelegramConnectRequest {
    bot_token: string;
}

export interface ChannelActionResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export const channelsService = {
    /**
     * Get status of all messaging channels
     */
    async getStatus(): Promise<ChannelsStatus> {
        const response = await api.get<ChannelsStatus>('/api/channels/status');
        return response.data;
    },

    // ===============================
    // WHATSAPP
    // ===============================

    /**
     * Initialize WhatsApp session (triggers QR generation)
     */
    async initWhatsApp(): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/whatsapp/init');
        return response.data;
    },

    /**
     * Get WhatsApp QR code for scanning
     */
    async getWhatsAppQR(): Promise<WhatsAppQRResponse> {
        const response = await api.get<WhatsAppQRResponse>('/api/channels/whatsapp/qr');
        return response.data;
    },

    /**
     * Get WhatsApp connection status
     */
    async getWhatsAppStatus(): Promise<{ connected: boolean; phone?: string; status: string }> {
        const response = await api.get('/api/channels/whatsapp/status');
        return response.data;
    },

    /**
     * Update Admin WhatsApp number
     */
    async updateWhatsAppAdminPhone(phone: string): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/whatsapp/admin-phone', { phone });
        return response.data;
    },

    /**
     * Update Current User's Personal WhatsApp number
     */
    async updateMyWhatsApp(phone: string): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/my-whatsapp', { phone });
        return response.data;
    },

    /**
     * Get Current User's Personal WhatsApp number
     */
    async getMyWhatsApp(): Promise<{ whatsapp_phone: string | null }> {
        const response = await api.get<{ whatsapp_phone: string | null }>('/api/channels/my-whatsapp');
        return response.data;
    },

    /**
     * Disconnect WhatsApp session
     */
    async disconnectWhatsApp(): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/whatsapp/disconnect');
        return response.data;
    },

    // ===============================
    // TELEGRAM
    // ===============================

    /**
     * Connect Telegram bot with token
     */
    async connectTelegram(botToken: string): Promise<ChannelActionResponse & { bot_username?: string }> {
        const response = await api.post('/api/channels/telegram/connect', {
            bot_token: botToken
        });
        return response.data;
    },

    /**
     * Get Telegram bot status
     */
    async getTelegramStatus(): Promise<{ connected: boolean; bot_username?: string }> {
        const response = await api.get('/api/channels/telegram/status');
        return response.data;
    },

    /**
     * Disconnect Telegram bot
     */
    async disconnectTelegram(): Promise<ChannelActionResponse> {
        const response = await api.post<ChannelActionResponse>('/api/channels/telegram/disconnect');
        return response.data;
    },

    /**
     * Generate Telegram link code for current user
     */
    async generateTelegramLinkCode(): Promise<{ link_code: string; instructions: string }> {
        const response = await api.post('/api/channels/telegram/link-code');
        return response.data;
    },

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
     * List conversations for an OS channel
     */
    async listOSConversations(channelId: number, status?: string): Promise<ChannelConversationItem[]> {
        const response = await api.get(`/api/channels-os/${channelId}/conversations`, { params: { status } });
        return response.data?.data || [];
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
    }
};

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

export interface ChannelConversationItem {
    id: number;
    channel_id: number;
    program_id?: number | null;
    beneficiary_id?: number | null;
    external_id?: string;
    contact_name?: string;
    contact_phone?: string;
    conversation_type: string;
    status: 'open' | 'active' | 'completed' | 'archived';
    current_step?: string;
    form_data_collected?: Record<string, any>;
    last_message_at?: string;
    created_at?: string;
}

export default channelsService;
