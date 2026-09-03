'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Map,
  Layers,
  AlertTriangle,
  Users,
  Building2,
  Scan,
  RefreshCw,
  Search,
  Filter,
  Radio,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { toast } from 'sonner';

interface GeoPointItem {
  id: number;
  name: string;
  point_type: string;
  latitude: number;
  longitude: number;
  color?: string;
  icon?: string;
  properties?: Record<string, any>;
  is_active: boolean;
}

interface GeoLayerItem {
  id: number;
  name: string;
  layer_type: string;
  default_color: string;
  is_visible: boolean;
}

interface GeoFenceItem {
  id: number;
  name: string;
  fence_type: string;
  color: string;
  geojson?: string;
  is_active: boolean;
}

export function InteractiveGeoMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  const [points, setPoints] = useState<GeoPointItem[]>([]);
  const [layers, setLayers] = useState<GeoLayerItem[]>([]);
  const [fences, setFences] = useState<GeoFenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPoint, setSelectedPoint] = useState<GeoPointItem | null>(null);
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark');

  // Fetch points and layers from backend
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [ptsRes, layersRes, fencesRes] = await Promise.allSettled([
        api.get('/api/geo/points'),
        api.get('/api/geo/layers'),
        api.get('/api/geo/fences')
      ]);

      if (ptsRes.status === 'fulfilled' && ptsRes.value.data.points) {
        setPoints(ptsRes.value.data.points);
      }
      if (layersRes.status === 'fulfilled' && layersRes.value.data.layers) {
        setLayers(layersRes.value.data.layers);
      }
      if (fencesRes.status === 'fulfilled' && fencesRes.value.data.fences) {
        setFences(fencesRes.value.data.fences);
      }
    } catch (err: any) {
      console.warn('Error cargando puntos geo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered points
  const filteredPoints = useMemo(() => {
    return points.filter((pt) => {
      if (selectedType !== 'all' && pt.point_type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          pt.name.toLowerCase().includes(q) ||
          pt.point_type.toLowerCase().includes(q) ||
          JSON.stringify(pt.properties || {}).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [points, selectedType, searchQuery]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function initLeaflet() {
      try {
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        const L = (await import('leaflet')).default;
        if (!mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, {
            center: [-2.1894, -79.8891], // Guayaquil Ecuador Default
            zoom: 12,
            minZoom: 4,
            maxZoom: 18,
            zoomControl: false
          });

          L.control.zoom({ position: 'topright' }).addTo(map);

          const tileUrl =
            mapTheme === 'dark'
              ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

          L.tileLayer(tileUrl, {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(map);

          mapInstanceRef.current = map;
          markersLayerRef.current = L.layerGroup().addTo(map);
        }

        // Update markers
        if (markersLayerRef.current && mapInstanceRef.current) {
          markersLayerRef.current.clearLayers();

          filteredPoints.forEach((pt) => {
            const isIncident = pt.point_type === 'incident';
            const isCenter = pt.point_type === 'center';
            const isTeam = pt.point_type === 'team';

            const pinColor = pt.color || (isIncident ? '#ef4444' : isCenter ? '#10b981' : isTeam ? '#0ea5e9' : '#8b5cf6');
            const iconSymbol = isIncident ? '⚠️' : isCenter ? '🏢' : isTeam ? '👥' : '📍';

            const customIcon = L.divIcon({
              className: 'custom-geo-pin',
              html: `
                <div class="relative flex items-center justify-center cursor-pointer group">
                  ${isIncident ? `<div class="absolute -inset-2 rounded-full opacity-75 animate-ping" style="background-color: ${pinColor}"></div>` : ''}
                  <div class="relative w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white dark:border-zinc-900 transition-transform duration-200 transform group-hover:scale-125" style="background-color: ${pinColor}">
                    <span class="text-xs">${iconSymbol}</span>
                  </div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -18]
            });

            const marker = L.marker([pt.latitude, pt.longitude], { icon: customIcon });

            const propList = Object.entries(pt.properties || {})
              .map(([k, v]) => `<div class="flex justify-between text-[11px] py-0.5 border-b border-white/5"><span class="text-white/50 capitalize">${k.replace('_', ' ')}:</span><span class="font-medium text-white">${v}</span></div>`)
              .join('');

            const popupHtml = `
              <div class="p-3 max-w-[280px] font-sans bg-zinc-900 text-white rounded-xl">
                <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                  <span class="font-bold text-xs text-emerald-400 truncate">${pt.name}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-mono font-bold" style="background: ${pinColor}30; color: ${pinColor}">${pt.point_type}</span>
                </div>
                <div class="space-y-1">
                  ${propList || '<p class="text-[10px] text-white/40">Sin propiedades adicionales</p>'}
                  <div class="pt-1 text-[9px] font-mono text-white/40">Lat: ${pt.latitude.toFixed(4)}, Lng: ${pt.longitude.toFixed(4)}</div>
                </div>
              </div>
            `;

            marker.bindPopup(popupHtml, {
              className: 'custom-leaflet-popup shadow-2xl rounded-xl',
              closeButton: false
            });

            marker.on('click', () => {
              setSelectedPoint(pt);
            });

            markersLayerRef.current.addLayer(marker);
          });
        }
      } catch (err) {
        console.warn('Leaflet map error:', err);
      }
    }

    initLeaflet();
  }, [filteredPoints, mapTheme]);

  return (
    <div className="space-y-4">
      {/* ── BARRA DE HERRAMIENTAS Y FILTROS ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            variant={selectedType === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('all')}
            className="text-xs h-8 rounded-lg"
          >
            Todos ({points.length})
          </Button>
          <Button
            variant={selectedType === 'center' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('center')}
            className="text-xs h-8 rounded-lg text-emerald-400 font-semibold"
          >
            🏢 Centros ({points.filter(p => p.point_type === 'center').length})
          </Button>
          <Button
            variant={selectedType === 'incident' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('incident')}
            className="text-xs h-8 rounded-lg text-red-400 font-semibold"
          >
            ⚠️ Alertas ({points.filter(p => p.point_type === 'incident').length})
          </Button>
          <Button
            variant={selectedType === 'team' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('team')}
            className="text-xs h-8 rounded-lg text-sky-400 font-semibold"
          >
            👥 Brigadas ({points.filter(p => p.point_type === 'team').length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <Input
              placeholder="Buscar puntos o alertas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8 bg-zinc-950/60 border-white/10 text-white rounded-lg"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            className="h-8 text-xs border-white/10 px-2.5 shrink-0"
          >
            {mapTheme === 'dark' ? '☀️ Claro' : '🌙 Satélite'}
          </Button>
          <Button
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 px-3 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── MAPA PRINCIPAL CON HUD OVERLAY ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden border border-emerald-500/20 shadow-2xl h-[520px] bg-zinc-950">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-zinc-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-xl text-xs space-y-1.5">
            <div className="font-bold text-[10px] uppercase tracking-wider text-white/50 mb-1">
              Capas Geoespaciales
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-white/80">Centros CDI / Puntos Operativos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/80">Alertas de Desnutrición / Incidencias</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              <span className="text-white/80">Brigadas y Equipos en Territorio</span>
            </div>
          </div>
        </div>

        {/* ── PANEL LATERAL DE DETALLE DE PUNTO SELECCIONADO ────────────── */}
        <div className="space-y-4">
          {selectedPoint ? (
            <Card className="bg-zinc-900/80 border-emerald-500/30 backdrop-blur-md text-white shadow-xl">
              <CardHeader className="p-4 pb-2 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge
                      className="text-[9px] font-bold uppercase mb-1.5"
                      style={{
                        background: `${selectedPoint.color || '#10b981'}25`,
                        color: selectedPoint.color || '#10b981',
                        border: `1px solid ${selectedPoint.color || '#10b981'}40`
                      }}
                    >
                      {selectedPoint.point_type}
                    </Badge>
                    <CardTitle className="text-base font-bold text-white leading-tight">
                      {selectedPoint.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPoint(null)}
                    className="h-6 w-6 p-0 text-white/40 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="bg-zinc-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                    Propiedades y Telemetría
                  </div>
                  {Object.entries(selectedPoint.properties || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                      <span className="text-white/50 capitalize">{k.replace('_', ' ')}:</span>
                      <span className="font-semibold text-white">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/40 font-mono px-1">
                  <span>Lat: {selectedPoint.latitude.toFixed(6)}</span>
                  <span>Lng: {selectedPoint.longitude.toFixed(6)}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900/60 border-white/10 backdrop-blur-md text-white">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Scan className="w-4 h-4 text-emerald-400" />
                  Inspección Territorial
                </CardTitle>
                <CardDescription className="text-xs text-white/50">
                  Selecciona cualquier marcador en el mapa para examinar su ficha, propiedades y alertas en tiempo real.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="p-4 rounded-xl bg-white/3 border border-white/5 text-center text-xs text-white/40">
                  Haz clic en un punto verde, rojo o azul en el mapa interactivo.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick summary stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-bold uppercase block">Puntos Activos</span>
              <span className="text-2xl font-black text-white">{points.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <span className="text-[10px] text-red-400 font-bold uppercase block">Alertas DCI</span>
              <span className="text-2xl font-black text-white">{points.filter(p => p.point_type === 'incident').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
