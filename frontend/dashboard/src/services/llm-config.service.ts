import api from './api';

export type LLMProviderId = 'openai' | 'anthropic' | 'google' | 'grok' | 'nvidia' | 'openrouter' | 'groq';

export interface LLMProviderInfo {
  label: string;
  base_url: string | null;
  models: string[];
}

export interface LLMConfig {
  id: number;
  license_id: number;
  provider: string;
  model: string | null;
  base_url: string | null;
  is_active: boolean;
  has_key: boolean;
  key_masked: string | null;
  last_validated_at: string | null;
  last_error: string | null;
}

export interface LLMStatus {
  config: LLMConfig | null;
  allow_custom_llm: boolean;
  using_platform_default: boolean;
  credits: { balance: number; enabled: boolean };
  lem: { balance: number; enabled: boolean };
  recent_ledger: { id: number; amount: number; reason: string; ref: string | null; created_at: string }[];
}

export const llmConfigService = {
  getProviders: async () => {
    const { data } = await api.get<{ providers: Record<string, LLMProviderInfo> }>('/api/license-admin/llm-providers');
    return data.providers;
  },
  getStatus: async () => {
    const { data } = await api.get<LLMStatus>('/api/license-admin/llm-config');
    return data;
  },
  save: async (payload: { provider: string; model?: string; base_url?: string; api_key: string }) => {
    const { data } = await api.put<{ config: LLMConfig }>('/api/license-admin/llm-config', payload);
    return data.config;
  },
  test: async (payload: { provider: string; model?: string; base_url?: string; api_key?: string }) => {
    const { data } = await api.post<{ ok: boolean; reply?: string; latency_ms?: number; error?: string }>(
      '/api/license-admin/llm-config/test',
      payload,
    );
    return data;
  },
  remove: async () => {
    const { data } = await api.delete('/api/license-admin/llm-config');
    return data;
  },
};
