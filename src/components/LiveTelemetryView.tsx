import React, { useState, useMemo, useEffect } from 'react';
import {
  CulinaryNode,
  RouteWaypoint,
  TelemetryState,
  LanguageCode,
  CloudSyncReceipt,
  generateRouteGeoJson,
  generateGpxTelemetry,
  generateRawSensorJson,
} from '../data/vibePathData';
import { SchemaValidator, RenderPayload, FoodPOI } from '../utils/schema-validator';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { MapboxGlobePlayer } from './MapboxGlobePlayer';
import { TargetPinningTerminal } from './TargetPinningTerminal';
import {
  MapPin,
  Radio,
  Trash2,
  Image as ImageIcon,
  Rocket,
  Download,
  FileJson,
  Navigation,
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Route,
} from 'lucide-react';

export interface LiveTelemetryViewProps {
  nodes: CulinaryNode[];
  waypoints: RouteWaypoint[];
  telemetry: TelemetryState;
  isTracking: boolean;
  onToggleTracking: () => void;
  language?: LanguageCode;
  onChangeLanguage?: (lang: LanguageCode) => void;
  onAddNode: (node: Omit<CulinaryNode, 'id' | 'timestamp' | 'timecodeSeconds'>) => void;
  onDeleteNode: (id: string) => void;
  onSyncToCloud: (validatedPayload?: RenderPayload) => Promise<void>;
  isSyncing: boolean;
  lastSyncReceipt: CloudSyncReceipt | null;
  activeRiderPos: { lat: number; lng: number };
  pinFormRef?: React.RefObject<HTMLDivElement | null>;
  onOpenSettings?: () => void;
  onDistrictResolved?: (districtLabel: string) => void;
}

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

export const LiveTelemetryView: React.FC<LiveTelemetryViewProps> = ({
  nodes,
  waypoints,
  telemetry,
  isTracking,
  onToggleTracking,
  language,
  onAddNode,
  onDeleteNode,
  onSyncToCloud,
  isSyncing,
  lastSyncReceipt,
  activeRiderPos,
  pinFormRef,
  onOpenSettings,
  onDistrictResolved,
}) => {
  const { accentColor, fontFamily } = useTheme();
  const { lang, t } = useTranslation();
  const activeLang = language || lang;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [earthZoomTriggerKey, setEarthZoomTriggerKey] = useState<number>(0);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const [isTelemetryDrawerOpen, setIsTelemetryDrawerOpen] = useState<boolean>(false);
  const [isPinDrawerOpen, setIsPinDrawerOpen] = useState<boolean>(false);

  const centralMapRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOpenPinDrawer = () => {
      setIsPinDrawerOpen(true);
      window.setTimeout(() => {
        pinFormRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    };
    window.addEventListener('vibepath_open_pin_drawer', handleOpenPinDrawer);
    return () => window.removeEventListener('vibepath_open_pin_drawer', handleOpenPinDrawer);
  }, [pinFormRef]);

  const cleanPayload = useMemo(() => {
    const rawTripData = {
      trip_id: 'TRIP_SAIGON_NIGHT_01',
      youtuber_id: 'vlogger_field_ops',
      language: activeLang,
      trip_name:
        activeLang === 'vi'
          ? 'Hành trình Ẩm thực Đêm Sài Gòn 3D'
          : 'Saigon Night Street Food 3D Tour',
      created_at: new Date().toISOString(),
      accent_color: accentColor,
      font_family: fontFamily,
      telemetry_data: waypoints.map((w) => ({
        latitude: w.lat,
        longitude: w.lng,
        altitude: 12.0,
        speed_kmh: w.speedKmh,
        heading: 30,
        timestamp: w.timestamp,
      })),
      food_pois: nodes.map((n) => ({
        poi_id: n.id,
        name: n.name,
        latitude: n.latitude,
        longitude: n.longitude,
        rating: n.rating,
        note: activeLang === 'en' ? n.noteEn : n.note,
        timestamp: n.timestamp,
        images: n.images,
      })),
    };
    return SchemaValidator.sanitizeRenderPayload(rawTripData);
  }, [nodes, waypoints, activeLang, accentColor, fontFamily]);

  const selectedPoi: FoodPOI | null = useMemo(() => {
    const found =
      cleanPayload.food_pois.find((p) => p.poi_id === selectedNodeId) ||
      cleanPayload.food_pois[0] ||
      null;
    return found;
  }, [cleanPayload.food_pois, selectedNodeId]);

  const handleTrigger3DZoomToNode = (node: CulinaryNode, scrollToMap = true) => {
    setSelectedNodeId(node.id);
    setEarthZoomTriggerKey((k) => k + 1);
    if (scrollToMap && centralMapRef.current) {
      centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const triggerFieldDownload = (
    content: string,
    filename: string,
    mimeType: string,
    label: string
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setExportToast(label);
    setTimeout(() => setExportToast(null), 3200);
  };

  const handlePickMapCoord = (_lat: number, _lng: number) => {
    // Coordinated through map picking
  };

  const handleAddPoiFromMap = (coords: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  }) => {
    const cleanLat = Number(coords.latitude.toFixed(6));
    const cleanLng = Number(coords.longitude.toFixed(6));
    onAddNode({
      name: coords.name && coords.name !== 'MAP_CLICK_TARGET' ? coords.name : `${t('pinning.defaultPoiPrefix')} #${nodes.length + 1}`,
      latitude: cleanLat,
      longitude: cleanLng,
      rating: 5,
      note: t('pinning.defaultPoiNote'),
      noteEn: t('pinning.defaultPoiNote'),
      images: [],
      durationSeconds: 18,
      district: 'District 1, Ben Thanh',
      temperatureC: telemetry.deviceTempC,
      audioPeakDb: telemetry.audioDb,
    });
    setEarthZoomTriggerKey((k) => k + 1);
  };

  const handleValidatedSyncAndZoom = async () => {
    const sanitized = SchemaValidator.sanitizeRenderPayload({
      trip_id: `TRIP_${Date.now()}`,
      youtuber_id: 'vlogger_field_ops',
      language: activeLang,
      trip_name:
        activeLang === 'vi'
          ? 'Hành trình Ẩm thực Đêm Sài Gòn 3D'
          : 'Saigon Night Street Food 3D Tour',
      created_at: new Date().toISOString(),
      accent_color: accentColor,
      font_family: fontFamily,
      telemetry_data: waypoints.map((w) => ({
        latitude: w.lat,
        longitude: w.lng,
        altitude: 12.0,
        speed_kmh: w.speedKmh,
        heading: 30,
        timestamp: w.timestamp,
      })),
      food_pois: nodes.map((n) => ({
        poi_id: n.id,
        name: n.name,
        latitude: n.latitude,
        longitude: n.longitude,
        rating: n.rating,
        note: activeLang === 'en' ? n.noteEn : n.note,
        timestamp: n.timestamp,
        images: n.images,
      })),
    });
    setEarthZoomTriggerKey((k) => k + 1);
    await onSyncToCloud(sanitized);
  };

  const openPinDrawerAndScroll = () => {
    setIsPinDrawerOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          pinFormRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-full overflow-hidden bg-[#05050A] rounded-none">
      {/* 1. Primary 80% Screen Estate 3D Mapbox Viewport */}
      <div ref={centralMapRef} className="w-full max-w-full overflow-hidden scroll-mt-4 rounded-none">
        <MapboxGlobePlayer
          telemetryData={cleanPayload.telemetry_data}
          foodPois={cleanPayload.food_pois}
          activePoi={selectedPoi}
          allNodes={nodes}
          waypoints={waypoints}
          onSelectNode={(n) => {
            setSelectedNodeId(n.id);
          }}
          onPickCoordinate={handlePickMapCoord}
          onAddPoiFromMap={handleAddPoiFromMap}
          onDistrictResolved={onDistrictResolved}
          language={activeLang}
          autoTriggerKey={earthZoomTriggerKey}
          onOpenSettings={onOpenSettings}
          onOpenPinModal={openPinDrawerAndScroll}
        />
      </div>

      {/* 2. Single Compact Telemetry Strip & Collapsible POI Drawer */}
      <section
        aria-label={t('telemetry.drawerAriaLabel')}
        className="bg-[#0D0E17] border border-[#1F1F2E] w-full max-w-full overflow-hidden rounded-none"
      >
        <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs">
            <div className="flex items-center gap-2">
              <Route className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
              <span className="text-[#8A8FA3]">
                {t('telemetry.distance')}:
              </span>
              <span className="font-bold text-white">
                {telemetry.distanceKm.toFixed(2)} KM
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
              <span className="text-[#8A8FA3]">{t('telemetry.time')}:</span>
              <span className="font-bold text-white">
                {formatDuration(telemetry.elapsedSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#00FF66] shrink-0" />
              <span className="text-[#8A8FA3]">{t('telemetry.pois')}:</span>
              <span className="font-bold text-[#00FF66]">{nodes.length}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleTracking}
              className={`min-h-[34px] px-3 bg-[#0D0E17] border font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none whitespace-nowrap ${
                isTracking
                  ? 'border-[#00FF66] text-[#00FF66]'
                  : 'border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)]'
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span>{isTracking ? t('telemetry.trackingActive') : t('telemetry.trackingPaused')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTelemetryDrawerOpen((prev) => !prev)}
              className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none whitespace-nowrap"
            >
              <span>
                {isTelemetryDrawerOpen
                  ? `${t('telemetry.hidePois')} (${nodes.length})`
                  : `${t('telemetry.showPois')} (${nodes.length})`}
              </span>
              {isTelemetryDrawerOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Telemetry & Pinned POIs Drawer Body */}
        {isTelemetryDrawerOpen && (
          <div className="border-t border-[#1F1F2E] p-3.5 space-y-3 bg-[#05050A] rounded-none">
            <div className="divide-y divide-[#1F1F2E] w-full max-w-full overflow-hidden">
              {nodes.map((node, index) => {
                const isSelected = node.id === selectedNodeId;
                const nodeNum = String(index + 1).padStart(2, '0');
                return (
                  <div
                    key={node.id}
                    onClick={() => handleTrigger3DZoomToNode(node, true)}
                    className={`py-3 px-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors cursor-pointer rounded-none ${
                      isSelected
                        ? 'bg-[#0D0E17] border-l-2 border-[#00E5FF]'
                        : 'hover:bg-[#0D0E17]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 bg-[#05050A] border border-[#1F1F2E] overflow-hidden shrink-0 relative flex items-center justify-center rounded-none">
                        {node.images[0] ? (
                          <img
                            src={node.images[0]}
                            alt={node.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-[#00E5FF]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                          <span className="font-bold text-[#00E5FF]">[ {nodeNum} // {t('telemetry.poiIndex')} ]</span>
                          <span className="font-bold text-white uppercase">{node.name}</span>
                          <span className="text-[#00FF66] font-bold">{node.rating}/5</span>
                        </div>
                        <p className="text-xs text-[#8A8FA3] line-clamp-1 mt-0.5">
                          {activeLang === 'vi' ? node.note : node.noteEn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrigger3DZoomToNode(node, true);
                        }}
                        className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none whitespace-nowrap"
                      >
                        <Rocket className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('telemetry.fly3d')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        className="min-h-[34px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:text-[#FF5252] hover:border-[#FF5252] flex items-center justify-center cursor-pointer rounded-none"
                        title={t('telemetry.removePoi')}
                        aria-label={t('telemetry.removePoi')}
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compact GIS Export Strip */}
            <div className="pt-2 border-t border-[#1F1F2E] flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-[#8A8FA3] flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>{t('telemetry.exportRouteTelemetry')}:</span>
              </span>

              {exportToast && (
                <span className="font-mono text-xs text-[#00FF66] font-bold">{exportToast}</span>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    triggerFieldDownload(
                      generateRouteGeoJson(nodes, waypoints),
                      'vibepath-culinary-gis.geojson',
                      'application/geo+json;charset=utf-8',
                      t('telemetry.exportedGeojson')
                    )
                  }
                  className="min-h-[32px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>.GEOJSON</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    triggerFieldDownload(
                      generateGpxTelemetry(nodes, waypoints),
                      'vibepath-telemetry.gpx',
                      'application/gpx+xml;charset=utf-8',
                      t('telemetry.exportedGpx')
                    )
                  }
                  className="min-h-[32px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>.GPX</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    triggerFieldDownload(
                      generateRawSensorJson(nodes, waypoints, activeLang),
                      'vibepath-telemetry.json',
                      'application/json;charset=utf-8',
                      t('telemetry.exportedJson')
                    )
                  }
                  className="min-h-[32px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>.JSON</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Collapsible One-Tap Spot Pinning Drawer (Triggered from Bottom-Center Chiseled 45° Pin POI Button) */}
      {isPinDrawerOpen && (
        <TargetPinningTerminal
          onAddNode={onAddNode}
          nodesCount={nodes.length}
          activeRiderPos={activeRiderPos}
          deviceTempC={telemetry.deviceTempC}
          audioPeakDb={telemetry.audioDb}
          lastSyncId={lastSyncReceipt?.syncId}
          isSyncing={isSyncing}
          onSyncToCloud={handleValidatedSyncAndZoom}
          onClose={() => setIsPinDrawerOpen(false)}
          onCoordinatesPinned={() => {
            setEarthZoomTriggerKey((k) => k + 1);
            if (centralMapRef.current) {
              centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          pinFormRef={pinFormRef}
        />
      )}
    </div>
  );
};
