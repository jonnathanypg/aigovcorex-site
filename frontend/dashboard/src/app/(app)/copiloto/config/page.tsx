'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sliders, Save, Bot, ShieldCheck, KeyRound, FlaskConical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { llmConfigService, LLMStatus } from '@/services/llm-config.service';
import { useToast } from '@/hooks/use-toast';

export default function ConfigIaPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<LLMStatus | null>(null);
  const [providers, setProviders] = useState<Record<string, { label: string; base_url: string | null; models: string[] }>>({});
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [prov, st] = await Promise.all([llmConfigService.getProviders(), llmConfigService.getStatus()]);
      setProviders(prov);
      setStatus(st);
      if (st.config) {
        setProvider(st.config.provider);
        setModel(st.config.model || '');
        setBaseUrl(st.config.base_url || '');
      } else if (prov.openai) {
        setModel(prov.openai.models[0] || '');
      }
    } catch (e: any) {
      toast({ title: 'Error cargando LLM', description: e?.response?.data?.error || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const modelsFor = useMemo(() => providers[provider]?.models || [], [providers, provider]);

  useEffect(() => {
    if (!model && modelsFor.length) setModel(modelsFor[0]);
    if (!baseUrl) setBaseUrl(providers[provider]?.base_url || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const onSave = async () => {
    if (!apiKey.trim()) {
      toast({ title: 'Falta token', description: 'Pegue el API key propio de la empresa (BYOT).', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const cfg = await llmConfigService.save({ provider, model, base_url: baseUrl || undefined, api_key: apiKey.trim() });
      setStatus((s) => (s ? { ...s, config: cfg } : s));
      setApiKey('');
      toast({ title: 'Guardado', description: `Proveedor ${provider} activo. Tokens los paga la empresa; LEM-V4 cobra solo validación.` });
    } catch (e: any) {
      toast({ title: 'No se guardó', description: e?.response?.data?.error || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await llmConfigService.test({ provider, model, base_url: baseUrl || undefined, api_key: apiKey.trim() || undefined });
      if (res.ok) toast({ title: `Conexión OK (${res.latency_ms}ms)`, description: res.reply || 'ok' });
      else toast({ title: 'Falló conexión', description: res.error, variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Falló conexión', description: e?.response?.data?.error || e?.response?.data?.error || String(e), variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const onRemove = async () => {
    if (!confirm('Desactivar BYOT y volver a key global?')) return;
    await llmConfigService.remove();
    setStatus((s) => (s ? { ...s, config: null } : s));
    toast({ title: 'BYOT desactivado' });
  };

  if (loading) return <div className="text-white/60 text-sm p-6">Cargando configuración LLM…</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Sliders className="w-6 h-6" />
          </div>
          Configuración de Inteligencia Artificial y Modelos
        </h1>
        <p className="text-white/50 text-sm mt-1">
          {status?.allow_custom_llm
            ? 'Puedes conectar las llaves de tu proveedor preferido o mantener la inferencia gestionada por la plataforma.'
            : 'Tu cuenta utiliza el modelo de IA predeterminado y gestionado por la plataforma con consumo de créditos unificado.'}
        </p>
      </div>

      {!status?.allow_custom_llm ? (
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-400" /> Modo Inferencia Gestionada (Plataforma)
            </CardTitle>
            <CardDescription className="text-white/50 text-xs">
              Tu organización opera con los modelos de IA optimizados por defecto. El consumo se deduce automáticamente de los créditos de la cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-white/70">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              ✓ Inferencia activa y validada con protocolos de seguridad y protección de datos.
            </div>
            <p className="text-white/40">
              Para habilitar la conexión de tokens y proveedores propios (OpenAI, Anthropic, Gemini, etc.), solicita la activación a tu administrador o Super Admin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-white/10 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2"><Bot className="w-4 h-4" /> Proveedor de Inferencia</CardTitle>
            <CardDescription className="text-white/50 text-xs">
              Estado: {status?.config ? `${status.config.provider} / ${status.config.model || '-'} (${status.config.key_masked || 'sin key'})` : 'Usando modelo por defecto de la plataforma'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Proveedor</Label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white">
                {Object.entries(providers).map(([id, p]) => (
                  <option key={id} className="bg-zinc-900" value={id}>{p.label} ({id})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Modelo</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} list="llm-models" placeholder={modelsFor[0] || 'gpt-4o-mini'} className="bg-white/5 border-white/10 text-white text-xs" />
                <datalist id="llm-models">{modelsFor.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Base URL (opcional)</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={providers[provider]?.base_url || '(nativo)'} className="bg-white/5 border-white/10 text-white text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70 flex items-center gap-1"><KeyRound className="w-3 h-3" /> Clave de API propia (cifrada en servidor)</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-... / xai-... / ..." className="bg-white/5 border-white/10 text-white text-xs" />
            </div>
            <div className="flex gap-2">
              <Button onClick={onSave} disabled={saving} className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-medium">
                <Save className="w-4 h-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar y Activar Proveedor'}
              </Button>
              <Button onClick={onTest} disabled={testing} variant="outline" className="border-white/15 text-white">
                <FlaskConical className="w-4 h-4 mr-2" /> {testing ? 'Probando…' : 'Probar Conexión'}
              </Button>
              {status?.config && (
                <Button onClick={onRemove} variant="outline" className="border-red-500/40 text-red-300">
                  <Trash2 className="w-4 h-4 mr-2" /> Restablecer a Plataforma
                </Button>
              )}
            </div>
            {status?.config?.last_error && <p className="text-red-300/80 text-xs">Último error: {status.config.last_error}</p>}
          </CardContent>
        </Card>
      )}

      <Card className="border border-emerald-500/20 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Saldo de Créditos de Inferencia & Seguridad</CardTitle>
          <CardDescription className="text-white/50 text-xs">Protección continua frente a alucinaciones, fuga de datos y validación de respuestas omnicanal.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-white/70 space-y-1">
          <p>Saldo disponible: <b className="text-white text-sm">{(status?.credits?.balance ?? status?.lem?.balance) ?? 0}</b> créditos</p>
          <p className="text-white/50">El saldo se actualiza con cada interacción validada en web, WhatsApp o Telegram.</p>
          {status?.recent_ledger?.length ? (
            <ul className="pt-2 space-y-1 border-t border-white/5 mt-3">
              {status.recent_ledger.map((l) => <li key={l.id} className="text-white/60">#{l.id} · {l.amount} créditos · {l.reason} · {new Date(l.created_at).toLocaleString()}</li>)}
            </ul>
          ) : <p className="text-white/40 pt-1">Sin movimientos recientes.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
