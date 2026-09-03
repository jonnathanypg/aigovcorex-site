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
    }
};

export default channelsService;
