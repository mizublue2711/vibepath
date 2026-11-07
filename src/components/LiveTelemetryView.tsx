import React, { useState, useMemo, useEffect } from 'react';
import {
  CulinaryNode,
  RouteWaypoint,
  TelemetryState,
  LanguageCode,
  CloudSyncReceipt,
  FIELD_PRESET_IMAGES,
  generateRouteGeoJson,
  generateGpxTelemetry,
  generateRawSensorJson,
} from '../data/vibePathData';
import { SchemaValidator, RenderPayload, FoodPOI } from '../utils/schema-validator';
import { useTheme } from '../context/ThemeContext';
import { MapboxGlobePlayer } from './MapboxGlobePlayer';
import { PoiSearchBox, GeocodedPoiResult } from './PoiSearchBox';
import {
  MapPin,
  Radio,
  CloudUpload,
  Plus,
  Trash2,
  Crosshair,
  CheckCircle2,
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
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [earthZoomTriggerKey, setEarthZoomTriggerKey] = useState<number>(0);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const [isTelemetryDrawerOpen, setIsTelemetryDrawerOpen] = useState<boolean>(false);
  const [isPinDrawerOpen, setIsPinDrawerOpen] = useState<boolean>(false);

  const [spotName, setSpotName] = useState<string>('');
  const [spotLat, setSpotLat] = useState<number>(Number(activeRiderPos.lat.toFixed(5)));
  const [spotLng, setSpotLng] = useState<number>(Number(activeRiderPos.lng.toFixed(5)));
  const [spotRating, setSpotRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [spotNote, setSpotNote] = useState<string>('');
  const [spotImages, setSpotImages] = useState<string[]>([FIELD_PRESET_IMAGES[0].url]);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

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
      language,
      trip_name:
        language === 'vi'
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
        note: language === 'en' ? n.noteEn : n.note,
        timestamp: n.timestamp,
        images: n.images,
      })),
    };
    return SchemaValidator.sanitizeRenderPayload(rawTripData);
  }, [nodes, waypoints, language, accentColor, fontFamily]);

  const selectedPoi: FoodPOI | null = useMemo(() => {
    const found =
      cleanPayload.food_pois.find((p) => p.poi_id === selectedNodeId) ||
      cleanPayload.food_pois[0] ||
      null;
    return found;
  }, [cleanPayload.food_pois, selectedNodeId]);

  const handleTrigger3DZoomToNode = (node: CulinaryNode, scrollToMap = true) => {
    setSelectedNodeId(node.id);
    setSpotLat(node.latitude);
    setSpotLng(node.longitude);
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

  const handleOneTapGpsLock = () => {
    const lockedLat = Number(activeRiderPos.lat.toFixed(6));
    const lockedLng = Number(activeRiderPos.lng.toFixed(6));
    setSpotLat(lockedLat);
    setSpotLng(lockedLng);
  };

  const handlePickMapCoord = (lat: number, lng: number) => {
    setSpotLat(lat);
    setSpotLng(lng);
  };

  const handleAddPoiFromMap = (coords: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  }) => {
    const cleanLat = Number(coords.latitude.toFixed(6));
    const cleanLng = Number(coords.longitude.toFixed(6));
    setSpotLat(cleanLat);
    setSpotLng(cleanLng);
    if (coords.name && coords.name !== 'MAP_CLICK_TARGET') {
      setSpotName(coords.name);
    }
    setPinSuccessMsg(
      language === 'vi'
        ? `Đã khóa tọa độ từ bản đồ 3D: ${cleanLat.toFixed(4)}°N, ${cleanLng.toFixed(4)}°E`
        : `Locked 3D map coordinates: ${cleanLat.toFixed(4)}°N, ${cleanLng.toFixed(4)}°E`
    );
    setTimeout(() => setPinSuccessMsg(null), 3500);
  };

  const handleSelectAutocompletePoi = (result: GeocodedPoiResult) => {
    setSpotName(result.name);
    setSpotLat(result.latitude);
    setSpotLng(result.longitude);
    if (!spotNote.trim() && result.fullAddress) {
      setSpotNote(result.fullAddress);
    }
    setEarthZoomTriggerKey((k) => k + 1);
    setPinSuccessMsg(
      language === 'vi'
        ? `Đã chọn "${result.name}" (${result.latitude.toFixed(4)}°N, ${result.longitude.toFixed(4)}°E)`
        : `Selected "${result.name}" (${result.latitude.toFixed(4)}°N, ${result.longitude.toFixed(4)}°E)`
    );
    if (centralMapRef.current) {
      centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setPinSuccessMsg(null), 4000);
  };

  const handleToggleImage = (url: string) => {
    setSpotImages((prev) =>
      prev.includes(url)
        ? prev.length > 1
          ? prev.filter((u) => u !== url)
          : prev
        : [...prev, url]
    );
  };

  const handleAddCustomImage = () => {
    const trimmed = customImageUrl.trim();
    if (!trimmed) return;
    if (!spotImages.includes(trimmed)) {
      setSpotImages((prev) => [...prev, trimmed]);
    }
    setCustomImageUrl('');
  };

  const handleSubmitSpotPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName =
      spotName.trim() ||
      (language === 'vi'
        ? `Điểm Ẩm Thực #${nodes.length + 1}`
        : `Culinary Spot #${nodes.length + 1}`);
    const cleanNote =
      spotNote.trim() ||
      (language === 'vi'
        ? 'Hương vị đậm đà, nhiệt độ món ăn nóng hổi vừa ra lò tại hiện trường.'
        : 'Bold street-side flavor captured fresh on location with verified GPS lock.');

    const int2Rating = Math.min(5, Math.max(1, parseInt(String(spotRating), 10) || 5)) as
      | 1
      | 2
      | 3
      | 4
      | 5;

    onAddNode({
      name: cleanName,
      latitude: Number(spotLat),
      longitude: Number(spotLng),
      rating: int2Rating,
      note: cleanNote,
      noteEn: cleanNote,
      images: spotImages.length > 0 ? spotImages : [FIELD_PRESET_IMAGES[0].url],
      durationSeconds: 18,
      district: 'District 1, Ben Thanh',
      temperatureC: telemetry.deviceTempC,
      audioPeakDb: telemetry.audioDb,
    });

    setSpotName('');
    setSpotNote('');
    setPinSuccessMsg(
      language === 'vi'
        ? `Đã ghim "${cleanName}" (${int2Rating}/5)`
        : `Pinned "${cleanName}" (${int2Rating}/5)`
    );
    setEarthZoomTriggerKey((k) => k + 1);
    if (centralMapRef.current) {
      centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setPinSuccessMsg(null), 3500);
  };

  const handleValidatedSyncAndZoom = async () => {
    const sanitized = SchemaValidator.sanitizeRenderPayload({
      trip_id: `TRIP_${Date.now()}`,
      youtuber_id: 'vlogger_field_ops',
      language,
      trip_name:
        language === 'vi'
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
        note: language === 'en' ? n.noteEn : n.note,
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
            setSpotLat(n.latitude);
            setSpotLng(n.longitude);
          }}
          onPickCoordinate={handlePickMapCoord}
          onAddPoiFromMap={handleAddPoiFromMap}
          onDistrictResolved={onDistrictResolved}
          language={language}
          autoTriggerKey={earthZoomTriggerKey}
          onOpenSettings={onOpenSettings}
          onOpenPinModal={openPinDrawerAndScroll}
        />
      </div>

      {/* 2. Single Compact Telemetry Strip & Collapsible POI Drawer */}
      <section
        aria-label="Collapsible Telemetry Drawer"
        className="bg-[#0D0E17] border border-[#1F1F2E] w-full max-w-full overflow-hidden rounded-none"
      >
        <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs">
            <div className="flex items-center gap-2">
              <Route className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
              <span className="text-[#8A8FA3]">
                {language === 'vi' ? 'DISTANCE:' : 'DISTANCE:'}
              </span>
              <span className="font-bold text-white">
                {telemetry.distanceKm.toFixed(2)} KM
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
              <span className="text-[#8A8FA3]">TIME:</span>
              <span className="font-bold text-white">
                {formatDuration(telemetry.elapsedSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#00FF66] shrink-0" />
              <span className="text-[#8A8FA3]">POIs:</span>
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
              <span>{isTracking ? 'Tracking Active' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTelemetryDrawerOpen((prev) => !prev)}
              className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none whitespace-nowrap"
            >
              <span>
                {isTelemetryDrawerOpen
                  ? `Hide POIs (${nodes.length})`
                  : `POIs & GIS (${nodes.length})`}
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
                          <span className="font-bold text-[#00E5FF]">[ {nodeNum} // POI ]</span>
                          <span className="font-bold text-white uppercase">{node.name}</span>
                          <span className="text-[#00FF66] font-bold">{node.rating}/5</span>
                        </div>
                        <p className="text-xs text-[#8A8FA3] line-clamp-1 mt-0.5">
                          {language === 'vi' ? node.note : node.noteEn}
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
                        <span>Fly 3D</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        className="min-h-[34px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:text-[#FF5252] hover:border-[#FF5252] flex items-center justify-center cursor-pointer rounded-none"
                        title="Remove POI"
                        aria-label="Remove POI"
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
                <span>EXPORT_ROUTE_TELEMETRY:</span>
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
                      'Exported .GEOJSON'
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
                      'Exported .GPX'
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
                      generateRawSensorJson(nodes, waypoints, language),
                      'vibepath-telemetry.json',
                      'application/json;charset=utf-8',
                      'Exported .JSON'
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
      <div ref={pinFormRef} className="rounded-none">
        {isPinDrawerOpen && (
          <form
            onSubmit={handleSubmitSpotPin}
            className="bg-[#0D0E17] border border-[#1F1F2E] p-4 flex flex-col gap-3.5 w-full max-w-full overflow-hidden rounded-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-2.5">
              <div>
                <span className="font-mono text-[10px] tracking-widest text-[#5322FF] block">
                  [ 02 // TARGET_PINNING_TERMINAL ]
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-tight">
                  {language === 'vi' ? 'Ghim điểm dừng chân mới' : 'Pin New Culinary Spot'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOneTapGpsLock}
                  className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer rounded-none"
                >
                  <Crosshair className="w-3.5 h-3.5 shrink-0" />
                  <span>GPS Lock</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPinDrawerOpen(false)}
                  className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#FF5252] hover:text-white font-mono text-xs font-bold cursor-pointer rounded-none"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>

            {pinSuccessMsg && (
              <div className="bg-[#05050A] border border-[#00FF66] p-2.5 flex items-center gap-2 text-[#00FF66] font-mono text-xs rounded-none">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pinSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <PoiSearchBox
                  onSelectLocation={handleSelectAutocompletePoi}
                  mapCenterLngLat={[spotLng, spotLat]}
                  language={language}
                  placeholder='[ 🔍 NHẬP TÊN QUÁN HOẶC ĐỊA CHỈ (VD: "CHAY LOVING HUT", "BÁNH CUỐN BÀ HOÀNH"...) ]'
                  compact={true}
                />

                <input
                  id="poi-name"
                  type="text"
                  value={spotName}
                  onChange={(e) => setSpotName(e.target.value)}
                  placeholder={
                    language === 'vi'
                      ? 'Tên quán ăn (VD: Phở Bò Phú Gia)...'
                      : 'Venue name (e.g., Pho Bo Phu Gia)...'
                  }
                  className="w-full min-h-[40px] px-3 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="poi-lat"
                    type="number"
                    step="0.00001"
                    value={spotLat}
                    onChange={(e) => setSpotLat(Number(e.target.value))}
                    aria-label="Latitude"
                    className="w-full min-h-[38px] px-2.5 bg-[#05050A] border border-[#1F1F2E] text-[#00FF66] font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
                  />
                  <input
                    id="poi-lng"
                    type="number"
                    step="0.00001"
                    value={spotLng}
                    onChange={(e) => setSpotLng(Number(e.target.value))}
                    aria-label="Longitude"
                    className="w-full min-h-[38px] px-2.5 bg-[#05050A] border border-[#1F1F2E] text-[#00FF66] font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((starVal) => {
                    const active = starVal <= spotRating;
                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setSpotRating(starVal)}
                        className={`min-h-[36px] bg-[#0D0E17] border flex items-center justify-center gap-1 font-mono text-xs font-bold cursor-pointer rounded-none ${
                          active
                            ? 'border-[#00E5FF] text-[#00E5FF]'
                            : 'border-[#1F1F2E] text-[#8A8FA3]'
                        }`}
                      >
                        <span>{active ? '█' : '░'}</span>
                        <span>{starVal}</span>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  id="poi-note"
                  rows={2}
                  value={spotNote}
                  onChange={(e) => setSpotNote(e.target.value)}
                  placeholder={
                    language === 'vi'
                      ? 'Ghi chú hương vị cho phụ đề .SRT và YouTube Chapters...'
                      : 'Taste notes for .SRT subtitles and AI chapters...'
                  }
                  className="w-full p-2.5 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none resize-none rounded-none"
                />

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                    {FIELD_PRESET_IMAGES.map((preset) => {
                      const selected = spotImages.includes(preset.url);
                      return (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => handleToggleImage(preset.url)}
                          className={`px-2 py-1 bg-[#05050A] border font-mono text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 rounded-none ${
                            selected
                              ? 'border-[#00E5FF] text-white'
                              : 'border-[#1F1F2E] text-[#8A8FA3]'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.labelVi}
                            referrerPolicy="no-referrer"
                            className="w-5 h-5 object-cover"
                          />
                          <span>{language === 'vi' ? preset.labelVi : preset.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="Image URL..."
                    className="w-32 min-h-[32px] px-2 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs rounded-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomImage}
                    className="min-h-[32px] px-2 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] cursor-pointer rounded-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1F1F2E]">
              <span className="font-mono text-xs text-[#8A8FA3]">
                {lastSyncReceipt ? `LAST_SYNC: ${lastSyncReceipt.syncId}` : 'READY_TO_SYNC'}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  style={{
                    clipPath:
                      'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                  }}
                  className="min-h-[40px] px-4 bg-[#0D0E17] border border-[#00E5FF] text-white hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
                >
                  <MapPin className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <span>{language === 'vi' ? 'Lưu & Ghim Điểm Này' : 'Save & Pin Spot'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleValidatedSyncAndZoom}
                  disabled={isSyncing}
                  className="min-h-[40px] px-4 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
                >
                  <CloudUpload className="w-4 h-4 shrink-0" />
                  <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
