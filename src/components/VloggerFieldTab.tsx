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
import { SchemaValidator, RenderPayload, FoodPOI } from '../services/schema-validator';
import { buildWebhookRenderPayload } from '../services/webhook';
import { MapboxGlobePlayer } from './MapboxGlobePlayer';
import { PoiSearchBox, GeocodedPoiResult } from './PoiSearchBox';
import {
  MapPin,
  Radio,
  Star,
  CloudUpload,
  Plus,
  Trash2,
  Crosshair,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  ShieldCheck,
  Rocket,
  Code2,
  Download,
  FileJson,
  Navigation,
  Activity,
  KeyRound,
} from 'lucide-react';

interface VloggerFieldTabProps {
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
}

export const VloggerFieldTab: React.FC<VloggerFieldTabProps> = ({
  nodes,
  waypoints,
  telemetry,
  isTracking,
  onToggleTracking,
  language,
  onChangeLanguage,
  onAddNode,
  onDeleteNode,
  onSyncToCloud,
  isSyncing,
  lastSyncReceipt,
  activeRiderPos,
  pinFormRef,
  onOpenSettings,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [earthZoomTriggerKey, setEarthZoomTriggerKey] = useState<number>(0);
  const [showContractInspector, setShowContractInspector] = useState<boolean>(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [byokRev, setByokRev] = useState<number>(0);

  useEffect(() => {
    const onKeysUpdated = () => setByokRev((r) => r + 1);
    window.addEventListener('vibepath_apikeys_updated', onKeysUpdated);
    return () => window.removeEventListener('vibepath_apikeys_updated', onKeysUpdated);
  }, []);

  // One-Tap Spot Pinning Form State
  const [spotName, setSpotName] = useState<string>('');
  const [spotLat, setSpotLat] = useState<number>(Number(activeRiderPos.lat.toFixed(5)));
  const [spotLng, setSpotLng] = useState<number>(Number(activeRiderPos.lng.toFixed(5)));
  const [spotRating, setSpotRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [spotNote, setSpotNote] = useState<string>('');
  const [spotImages, setSpotImages] = useState<string[]>([FIELD_PRESET_IMAGES[0].url]);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

  const centralMapRef = React.useRef<HTMLDivElement | null>(null);

  // Sanitize Trip Data with SchemaValidator.sanitizeRenderPayload(rawTripData)
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
  }, [nodes, waypoints, language]);

  // Selected FoodPOI for MapboxGlobePlayer (stabilized so background GPS ticks don't reset 3D camera)
  const selectedPoi: FoodPOI | null = useMemo(() => {
    const found =
      cleanPayload.food_pois.find((p) => p.poi_id === selectedNodeId) ||
      cleanPayload.food_pois[0] ||
      null;
    return found;
  }, [cleanPayload.food_pois, selectedNodeId]);

  // Smoothly connect any "3D ZOOM" button or Node card click to the central 3D map
  const handleTrigger3DZoomToNode = (node: CulinaryNode, scrollToMap = true) => {
    setSelectedNodeId(node.id);
    setSpotLat(node.latitude);
    setSpotLng(node.longitude);
    setEarthZoomTriggerKey((k) => k + 1);
    if (scrollToMap && centralMapRef.current) {
      centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Live SchemaValidator.sanitizeRenderPayload preview & validation
  const validatedRenderContract = useMemo(() => {
    try {
      const clean = buildWebhookRenderPayload(cleanPayload);
      setContractError(null);
      return clean;
    } catch (err: any) {
      setContractError(err?.message || 'Data Contract Error');
      return null;
    }
  }, [cleanPayload, byokRev]);

  // Trigger 1-Touch GIS / Telemetry file download
  const triggerFieldDownload = (content: string, filename: string, mimeType: string, label: string) => {
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

  // Instant 1-Tap GPS Coordinate Lock
  const handleOneTapGpsLock = () => {
    const lockedLat = Number(activeRiderPos.lat.toFixed(6));
    const lockedLng = Number(activeRiderPos.lng.toFixed(6));
    setSpotLat(lockedLat);
    setSpotLng(lockedLng);
  };

  // Pick coordinate from 3D Map tap
  const handlePickMapCoord = (lat: number, lng: number) => {
    setSpotLat(lat);
    setSpotLng(lng);
  };

  // Interactive Map Click-to-Pin & Search Target Lock handler
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
        ? `[ NEW // POI ] Đã khóa tọa độ từ bản đồ 3D: ${cleanLat.toFixed(4)}°N, ${cleanLng.toFixed(4)}°E`
        : `[ NEW // POI ] Locked 3D map coordinates: ${cleanLat.toFixed(4)}°N, ${cleanLng.toFixed(4)}°E`
    );
    setTimeout(() => setPinSuccessMsg(null), 3500);
  };

  // Select location from Smart POI Autocomplete Search Bar (PoiSearchBox.tsx)
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
        ? `[ POI LOCKED ] "${result.name.toUpperCase()}" (${result.latitude.toFixed(4)}°N, ${result.longitude.toFixed(4)}°E)`
        : `[ POI LOCKED ] "${result.name.toUpperCase()}" (${result.latitude.toFixed(4)}°N, ${result.longitude.toFixed(4)}°E)`
    );
    if (centralMapRef.current) {
      centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setPinSuccessMsg(null), 4000);
  };

  // Toggle preset image in images[] array
  const handleToggleImage = (url: string) => {
    setSpotImages((prev) =>
      prev.includes(url) ? (prev.length > 1 ? prev.filter((u) => u !== url) : prev) : [...prev, url]
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
        ? `Điểm Ẩm Thực #${nodes.length + 1} (${spotLat.toFixed(4)})`
        : `Culinary Spot #${nodes.length + 1} (${spotLat.toFixed(4)})`);
    const cleanNote =
      spotNote.trim() ||
      (language === 'vi'
        ? 'Hương vị đậm đà, nhiệt độ món ăn nóng hổi vừa ra lò tại hiện trường.'
        : 'Bold street-side flavor captured fresh on location with verified GPS lock.');

    // Sanitize INT2 rating (1..5)
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
      district: 'TP.HCM Field Ops',
      temperatureC: telemetry.deviceTempC,
      audioPeakDb: telemetry.audioDb,
    });

    setSpotName('');
    setSpotNote('');
    setPinSuccessMsg(
      language === 'vi'
        ? `Đã khóa tọa độ & ghim "${cleanName}" (INT2 Rating: ${int2Rating}/5)`
        : `Locked GPS & pinned "${cleanName}" (INT2 Rating: ${int2Rating}/5)`
    );
    setEarthZoomTriggerKey((k) => k + 1);
    if (centralMapRef.current) {
      centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setPinSuccessMsg(null), 3500);
  };

  // Validate with SchemaValidator and trigger Earth-to-POI Zoom on Sync to Cloud
  const handleValidatedSyncAndZoom = async () => {
    try {
      const sanitized = SchemaValidator.sanitizeRenderPayload({
        trip_id: `TRIP_${Date.now()}`,
        youtuber_id: 'vlogger_field_ops',
        language,
        trip_name:
          language === 'vi'
            ? 'Hành trình Ẩm thực Đêm Sài Gòn 3D'
            : 'Saigon Night Street Food 3D Tour',
        created_at: new Date().toISOString(),
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
      if (centralMapRef.current) {
        centralMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      await onSyncToCloud(sanitized);
    } catch (err: any) {
      setContractError(err?.message || 'Validation failed');
    }
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6 w-full max-w-full overflow-hidden">
      {/* Left 5 Columns on Desktop: Invisible Background Tracker + Native Mapbox GL v3 3D Globe + Pinned POIs */}
      <div className="col-span-4 md:col-span-5 flex flex-col gap-4 w-full min-w-0 overflow-hidden">
        {/* Invisible Background Tracker Control Bar (#0D1017 Panel Slate) */}
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 w-full overflow-hidden">
          <div className="space-y-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <span className="vp-label-caps text-[#00E676]">
                [ SYS_TELEMETRY // ACTIVE · L1/L5 GNSS ±{telemetry.accuracyM.toFixed(2)}M ]
              </span>
              <span aria-hidden="true" className="text-[#9BA8B8]">//</span>
              <span className="vp-telemetry-sm text-[#00E5FF]">
                [ {waypoints.length} PTS · {telemetry.distanceKm.toFixed(2)} KM ]
              </span>
            </div>
            <h2 className="vp-headline-md text-[#F3F6F9] break-words">
              {language === 'vi'
                ? '[ NATIVE_MAPBOX_GL_V3_3D_GLOBE // DEM_TERRAIN & COAXIAL_LASER ]'
                : '[ NATIVE_MAPBOX_GL_V3_3D_GLOBE // DEM_TERRAIN & COAXIAL_LASER ]'}
            </h2>
            <p className="vp-body-md text-[#9BA8B8] break-words">
              {language === 'vi'
                ? 'Bản đồ Trái đất 3D WebGL (mapbox-terrain-dem-v1 1.6×, khối nhà 3D #0D1017 và đường đi Laser đồng trục #00E5FF).'
                : 'Native Mapbox GL v3 3D Globe (mapbox-terrain-dem-v1 1.6×, #0D1017 3D building extrusions, and #00E5FF coaxial laser route).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Language Switcher (vi / en) + 🔑 BYOK Shortcut */}
            <div
              role="group"
              aria-label="Language Switcher"
              className="bg-[#080A0F] border border-[#1F1F2E] p-1 flex items-center shrink-0"
            >
              <button
                type="button"
                onClick={() => onChangeLanguage('vi')}
                className={`vp-touch-target px-2.5 sm:px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  language === 'vi'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ VI ]
              </button>
              <button
                type="button"
                onClick={() => onChangeLanguage('en')}
                className={`vp-touch-target px-2.5 sm:px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ EN ]
              </button>
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="vp-touch-target px-2.5 sm:px-3 bg-[#080A0F] border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#080A0F] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                title={language === 'vi' ? 'Thiết lập kết nối BYOK' : 'BYOK Connection Settings'}
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>[ BYOK ]</span>
              </button>
            )}

            {/* Background Tracker Toggle Button */}
            <button
              type="button"
              onClick={onToggleTracking}
              className={`vp-touch-target flex-1 sm:flex-initial px-3 sm:px-4 font-mono-brand text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-colors cursor-pointer min-w-0 clip-button-chamfer ${
                isTracking
                  ? 'bg-[#00E5FF] text-[#080A0F] border border-[#00E5FF]'
                  : 'bg-[#080A0F] text-[#F3F6F9] border border-[#1F1F2E] hover:border-[#00E5FF]'
              }`}
            >
              <Radio className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isTracking
                  ? '[ ACTIVE_REC // TRACKING ]'
                  : '[ START_TRACKER ]'}
              </span>
            </button>
          </div>
        </div>

        {/* Mapbox GL JS v3 3D Globe & Hybrid Satellite-to-Vector Map (Central 3D Map) */}
        <div ref={centralMapRef} className="w-full max-w-full overflow-hidden scroll-mt-4">
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
            language={language}
            autoTriggerKey={earthZoomTriggerKey}
            onOpenSettings={onOpenSettings}
          />
        </div>

        {/* Pinned Culinary Nodes List with 1-Click Earth-to-POI Zoom */}
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-3 sm:p-4 w-full max-w-full overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 w-full">
            <div className="min-w-0 flex-1">
              <span className="vp-label-caps text-[#00E5FF] block truncate">
                [ CULINARY_NODES_LOG // CLICK_TO_FLY_IN_3D ]
              </span>
              <h3 className="vp-headline-md text-[#F3F6F9] mt-0.5 break-words">
                {language === 'vi'
                  ? `Điểm dừng chân đã ghim (${nodes.length})`
                  : `Pinned Culinary Stops (${nodes.length})`}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowContractInspector((s) => !s)}
              className="vp-touch-target px-2.5 sm:px-3 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#00E676] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 max-w-full"
            >
              <Code2 className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span className="truncate">
                {showContractInspector ? '[ × CLOSE_CONTRACT ]' : '[ SCHEMA_VALIDATOR ]'}
              </span>
            </button>
          </div>

          {/* Live SchemaValidator.sanitizeRenderPayload Inspector */}
          {showContractInspector && (
            <div className="mb-4 bg-[#080A0F] border border-[#1F1F2E] p-3 space-y-2 w-full overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="vp-label-caps text-[#00E676] flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[#00E676] shrink-0" />
                  <span className="truncate">
                    [ SchemaValidator.sanitizeRenderPayload() // DRAFT-07 ]
                  </span>
                </span>
                <span className="vp-telemetry-sm text-[#00E5FF]">
                  [ INT2_RATING & B_SPLINE_READY ]
                </span>
              </div>
              {contractError ? (
                <div className="vp-telemetry-sm text-[#FF5252] break-words">{contractError}</div>
              ) : (
                <pre className="font-mono-brand text-xs text-[#00E5FF] max-h-[200px] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(validatedRenderContract, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="divide-y divide-[#1F1F2E] w-full max-w-full overflow-hidden">
            {nodes.map((node, index) => {
              const isSelected = node.id === selectedNodeId;
              const nodeNum = String(index + 1).padStart(2, '0');
              return (
                <div
                  key={node.id}
                  onClick={() => handleTrigger3DZoomToNode(node, true)}
                  className={`py-3.5 px-2.5 sm:px-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors cursor-pointer w-full max-w-full overflow-hidden ${
                    isSelected
                      ? 'bg-[#080A0F] border-l-2 border-[#00E5FF]'
                      : 'hover:bg-[#080A0F]/60'
                  }`}
                >
                  {/* Node Thumbnail + Details */}
                  <div className="flex items-start gap-2.5 sm:gap-3.5 w-full min-w-0 flex-1 overflow-hidden">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#080A0F] border border-[#1F1F2E] overflow-hidden shrink-0 relative flex items-center justify-center">
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
                        <ImageIcon className="w-5 h-5 text-[#00E5FF]" />
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-[#080A0F]/95 border-t border-[#00E5FF] text-[#00E5FF] font-mono-brand text-[9px] font-bold text-center py-0.5 truncate">
                        [{nodeNum}]
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 w-full overflow-hidden">
                      {/* Coordinate & Timestamp Metadata Row */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs font-mono-tech text-[#00E5FF] w-full">
                        <span className="font-bold text-[#00E5FF]">[ {nodeNum} // POI ]</span>
                        <span aria-hidden="true" className="text-[#9BA8B8]">·</span>
                        <span>{node.timestamp}</span>
                        <span aria-hidden="true" className="text-[#9BA8B8]">·</span>
                        <span className="break-all sm:break-normal">
                          {node.latitude.toFixed(4)}°N, {node.longitude.toFixed(4)}°E
                        </span>
                        <span aria-hidden="true" className="text-[#9BA8B8]">·</span>
                        <span className="text-[#00E676] font-bold">
                          [ INT2: {node.rating}/5★ ]
                        </span>
                      </div>

                      <h4 className="font-mono-brand font-bold text-sm sm:text-base text-[#F3F6F9] mt-1 break-words whitespace-normal leading-snug w-full">
                        {node.name.toUpperCase()}
                      </h4>

                      <p className="vp-body-md text-xs sm:text-sm text-[#9BA8B8] line-clamp-2 break-words whitespace-normal mt-1 w-full">
                        {language === 'vi' ? node.note : node.noteEn}
                      </p>
                    </div>
                  </div>

                  {/* 3D ZOOM + Delete Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1F1F2E]">
                    <span className="vp-telemetry-sm text-[10px] text-[#00E676] sm:hidden">
                      {isSelected ? '[ ACTIVE_ON_3D_GLOBE ]' : '[ TAP_TO_FLY_3D ]'}
                    </span>

                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrigger3DZoomToNode(node, true);
                        }}
                        className={`vp-touch-target px-3 border vp-telemetry-sm flex items-center gap-1.5 transition-colors cursor-pointer clip-button-chamfer ${
                          isSelected
                            ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F] font-bold'
                            : 'bg-[#080A0F] border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#080A0F]'
                        }`}
                        title={
                          language === 'vi'
                            ? 'Bay 3D đến điểm dừng này trên bản đồ trung tâm'
                            : 'Fly 3D Camera to this POI on Central Map'
                        }
                      >
                        <Rocket className="w-3.5 h-3.5 shrink-0" />
                        <span>[ 3D_ZOOM ]</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        className="vp-touch-target px-2.5 bg-[#080A0F] border border-[#1F1F2E] text-[#9BA8B8] hover:text-[#FF5252] hover:border-[#FF5252] flex items-center justify-center transition-colors cursor-pointer"
                        title={language === 'vi' ? 'Xóa điểm dừng' : 'Remove POI'}
                        aria-label="Remove POI"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right 3 Columns on Desktop: One-Tap Spot Pinning + 1-Touch GIS & Telemetry Export Packaging */}
      <div
        ref={pinFormRef}
        className="col-span-4 md:col-span-3 flex flex-col gap-4 w-full min-w-0 max-w-full overflow-hidden"
      >
        <form
          onSubmit={handleSubmitSpotPin}
          className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-3 sm:p-4 md:p-5 flex flex-col gap-4 w-full max-w-full overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-3">
            <div className="min-w-0 flex-1">
              <span className="vp-label-caps text-[#00E5FF] block truncate">
                [ ONE_TAP_SPOT_PINNING // INT2_SCHEMA ]
              </span>
              <h2 className="vp-headline-md text-[#F3F6F9] mt-0.5 break-words">
                {language === 'vi' ? 'Ghim điểm dừng chân 1-chạm' : 'One-Tap POI Spot Pinning'}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleOneTapGpsLock}
              className="vp-touch-target px-2.5 sm:px-3 bg-[#080A0F] border border-[#00E676] text-[#00E676] hover:bg-[#00E676]/10 flex items-center gap-1.5 vp-telemetry-sm cursor-pointer transition-colors shrink-0"
              title={language === 'vi' ? 'Khóa tọa độ GPS hiện tại' : 'Lock current GPS coordinates'}
            >
              <Crosshair className="w-4 h-4 shrink-0" />
              <span>[ GPS_LOCK ]</span>
            </button>
          </div>

          {pinSuccessMsg && (
            <div className="bg-[#080A0F] border border-[#00E676] p-3 flex items-center gap-2 text-[#00E676] vp-body-md">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="break-words">{pinSuccessMsg}</span>
            </div>
          )}

          {/* 0. Smart POI Autocomplete Search & Link Parser (100% Mapbox API) */}
          <div className="space-y-1.5 bg-[#080A0F] border border-[#1F1F2E] p-3">
            <PoiSearchBox
              onSelectLocation={handleSelectAutocompletePoi}
              mapCenterLngLat={[spotLng, spotLat]}
              language={language}
            />
          </div>

          {/* 1. Tên địa điểm / quán ăn (name) */}
          <div className="space-y-1.5">
            <label htmlFor="poi-name" className="vp-label-caps text-[#9BA8B8] block">
              {language === 'vi' ? '[ 01 // SPOT_NAME ]' : '[ 01 // SPOT_NAME ]'}
            </label>
            <input
              id="poi-name"
              type="text"
              value={spotName}
              onChange={(e) => setSpotName(e.target.value)}
              placeholder={
                language === 'vi'
                  ? 'VD: Phở Bò Phú Gia — 146E Lý Chính Thắng...'
                  : 'e.g., Pho Bo Phu Gia — District 3...'
              }
              className="w-full min-h-[48px] px-3.5 bg-[#080A0F] border border-[#1F1F2E] text-[#F3F6F9] vp-body-lg focus:border-[#00E5FF] focus:outline-none"
            />
          </div>

          {/* 2. Tọa độ thực tế (latitude, longitude) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="poi-lat" className="vp-label-caps text-[#00E676] block truncate">
                [ LATITUDE_FLOAT ]
              </label>
              <input
                id="poi-lat"
                type="number"
                step="0.00001"
                value={spotLat}
                onChange={(e) => setSpotLat(Number(e.target.value))}
                className="w-full min-h-[48px] px-2.5 sm:px-3 bg-[#080A0F] border border-[#1F1F2E] text-[#00E676] vp-telemetry-sm focus:border-[#00E676] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="poi-lng" className="vp-label-caps text-[#00E676] block truncate">
                [ LONGITUDE_FLOAT ]
              </label>
              <input
                id="poi-lng"
                type="number"
                step="0.00001"
                value={spotLng}
                onChange={(e) => setSpotLng(Number(e.target.value))}
                className="w-full min-h-[48px] px-2.5 sm:px-3 bg-[#080A0F] border border-[#1F1F2E] text-[#00E676] vp-telemetry-sm focus:border-[#00E676] focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Đánh giá thực tế (rating kiểu số nguyên INT2 từ 1 - 5) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="vp-label-caps text-[#9BA8B8] truncate">
                [ 03 // FIELD_RATING_INT2 ]
              </span>
              <span className="vp-telemetry-sm text-[#00E5FF] shrink-0">[ {spotRating} / 5 ★ ]</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {([1, 2, 3, 4, 5] as const).map((starVal) => {
                const active = starVal <= spotRating;
                return (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setSpotRating(starVal)}
                    className={`vp-touch-target border flex items-center justify-center gap-1 vp-telemetry-sm transition-colors cursor-pointer min-w-0 ${
                      active
                        ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F] font-bold'
                        : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8] hover:border-[#00E5FF]'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                        active ? 'fill-[#080A0F] text-[#080A0F]' : ''
                      }`}
                    />
                    <span>{starVal}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Ghi chú trải nghiệm / hương vị (note) */}
          <div className="space-y-1.5">
            <label htmlFor="poi-note" className="vp-label-caps text-[#9BA8B8] block">
              [ 04 // TASTE_AND_FIELD_NOTE ]
            </label>
            <textarea
              id="poi-note"
              rows={3}
              value={spotNote}
              onChange={(e) => setSpotNote(e.target.value)}
              placeholder={
                language === 'vi'
                  ? 'Mô tả độ giòn, hương vị nước dùng, không khí quán để tạo phụ đề .SRT và YouTube Chapters...'
                  : 'Describe texture, broth aroma, and ambiance for .SRT subtitles and AI chapters...'
              }
              className="w-full p-3.5 bg-[#080A0F] border border-[#1F1F2E] text-[#F3F6F9] vp-body-md focus:border-[#00E5FF] focus:outline-none resize-none"
            />
          </div>

          {/* 5. Danh sách URL hình ảnh đính kèm (images[]) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="vp-label-caps text-[#9BA8B8] truncate">
                [ 05 // ATTACHED_MEDIA_URLS ]
              </span>
              <span className="vp-telemetry-sm text-[#00E5FF] shrink-0">
                [ {spotImages.length} SELECTED ]
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {FIELD_PRESET_IMAGES.map((preset) => {
                const selected = spotImages.includes(preset.url);
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => handleToggleImage(preset.url)}
                    className={`min-h-[48px] p-1.5 border flex items-center gap-2 text-left transition-colors cursor-pointer min-w-0 overflow-hidden ${
                      selected
                        ? 'bg-[#080A0F] border-[#00E5FF] text-[#F3F6F9]'
                        : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8] hover:border-[#00E5FF]'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.labelVi}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 object-cover shrink-0"
                    />
                    <span className="vp-body-md text-xs font-medium line-clamp-2 break-words min-w-0">
                      {language === 'vi' ? preset.labelVi : preset.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional Custom Image URL */}
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://r2.vibepath.io/..."
                className="flex-1 min-w-0 min-h-[48px] px-3 bg-[#080A0F] border border-[#1F1F2E] text-[#F3F6F9] vp-body-md focus:border-[#00E5FF] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomImage}
                className="vp-touch-target px-3 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#00E5FF] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title={language === 'vi' ? 'Thêm URL ảnh' : 'Add image URL'}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Primary Submit: One-Tap Pin POI */}
          <button
            type="submit"
            className="clip-button-chamfer w-full min-h-[50px] px-3 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#080A0F] font-mono-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-w-0 overflow-hidden"
          >
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="truncate">
              {language === 'vi'
                ? '[ + PIN_CULINARY_NODE // LOCK_POI ]'
                : '[ + PIN_CULINARY_NODE // LOCK_POI ]'}
            </span>
          </button>

          {/* SchemaValidator Atomic Cloud Sync + Earth-to-POI Zoom Section */}
          <div className="pt-2 border-t border-[#1F1F2E] flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#9BA8B8]">
              <span className="flex items-center gap-1.5 vp-telemetry-sm">
                <Globe className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                <span>
                  [ LOCALE: <strong className="text-[#F3F6F9] uppercase">{language}</strong> ]
                </span>
              </span>
              <span className="vp-telemetry-sm text-[#00E676] truncate">
                {lastSyncReceipt
                  ? `[ SYNCED // ${lastSyncReceipt.syncId} ]`
                  : '[ SCHEMA_VALIDATOR_READY ]'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleValidatedSyncAndZoom}
              disabled={isSyncing}
              className="w-full min-h-[50px] px-3 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] font-mono-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-w-0 overflow-hidden"
            >
              <CloudUpload className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="truncate">
                {isSyncing
                  ? '[ SYNCING_TO_N8N... ]'
                  : '[ ⚡ EXECUTE_SYNC // LAUNCH_3D_GLOBE ]'}
              </span>
            </button>
          </div>
        </form>

        {/* Export & Data Packaging (1-Touch GIS & L1/L5 Telemetry) */}
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-3 sm:p-4 md:p-5 flex flex-col gap-3 w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1F1F2E] pb-2.5">
            <div>
              <span className="vp-label-caps text-[#00E676]">
                [ 1_TOUCH_GIS_AND_L1_L5_TELEMETRY_PACKAGING ]
              </span>
              <h3 className="font-mono-brand font-bold text-sm text-[#F3F6F9] mt-0.5">
                {language === 'vi'
                  ? 'Xuất Gói Dữ Liệu Thực Địa Siêu Nhẹ'
                  : 'Field GIS & Sensor Data Packaging'}
              </h3>
            </div>
            <Download className="w-4 h-4 text-[#00E5FF]" />
          </div>

          <p className="vp-body-md text-xs text-[#9BA8B8]">
            {language === 'vi'
              ? 'Đóng gói lộ trình GPS băng tần kép L1/L5 (Galileo + GPS sai số <1m) và điểm ghim ẩm thực thành các chuẩn GIS mở cho hậu kỳ.'
              : 'Package dual-frequency L1/L5 GNSS trajectory and culinary nodes into open GIS & NLE telemetry formats.'}
          </p>

          {exportToast && (
            <div className="bg-[#080A0F] border border-[#00E676] px-3 py-2 vp-telemetry-sm text-[#00E676] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{exportToast}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* Button 1: Export GeoJSON (.GEOJSON) */}
            <button
              type="button"
              onClick={() =>
                triggerFieldDownload(
                  generateRouteGeoJson(nodes, waypoints),
                  'vibepath-culinary-gis.geojson',
                  'application/geo+json;charset=utf-8',
                  language === 'vi'
                    ? '[ OK // DOWNLOADED_RFC7946_GEOJSON ]'
                    : '[ OK // DOWNLOADED_RFC7946_GEOJSON ]'
                )
              }
              className="vp-touch-target w-full px-3.5 py-2.5 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF]/10 text-[#F3F6F9] flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Navigation className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <div className="text-left min-w-0">
                  <div className="font-mono-brand font-bold text-xs text-[#00E5FF]">
                    [ EXPORT_GEOJSON // .GEOJSON ]
                  </div>
                  <div className="vp-body-md text-[11px] text-[#9BA8B8] truncate">
                    {language === 'vi'
                      ? 'Cấu trúc không gian GIS + thuộc tính cảm quan món ăn'
                      : 'Full spatial FeatureCollection + sensory POI tags'}
                  </div>
                </div>
              </div>
              <span className="vp-telemetry-sm text-[#00E676] shrink-0">~4 KB</span>
            </button>

            {/* Button 2: Export GPX Telemetry (.GPX) */}
            <button
              type="button"
              onClick={() =>
                triggerFieldDownload(
                  generateGpxTelemetry(nodes, waypoints),
                  'vibepath-l1-l5-telemetry.gpx',
                  'application/gpx+xml;charset=utf-8',
                  language === 'vi'
                    ? '[ OK // DOWNLOADED_L1_L5_GPX_TRACK ]'
                    : '[ OK // DOWNLOADED_L1_L5_GPX_TRACK ]'
                )
              }
              className="vp-touch-target w-full px-3.5 py-2.5 bg-[#080A0F] border border-[#00E676] hover:bg-[#00E676]/10 text-[#F3F6F9] flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Activity className="w-4 h-4 text-[#00E676] shrink-0" />
                <div className="text-left min-w-0">
                  <div className="font-mono-brand font-bold text-xs text-[#00E676]">
                    [ EXPORT_GPX_TELEMETRY // .GPX ]
                  </div>
                  <div className="vp-body-md text-[11px] text-[#9BA8B8] truncate">
                    {language === 'vi'
                      ? 'Đồng bộ thời gian <trkpt> & <wpt> cho hậu kỳ video'
                      : 'Time-synced <trkpt> & <wpt> for NLE telemetry overlays'}
                  </div>
                </div>
              </div>
              <span className="vp-telemetry-sm text-[#00E5FF] shrink-0">~6 KB</span>
            </button>

            {/* Button 3: Export Raw JSON (.JSON) */}
            <button
              type="button"
              onClick={() =>
                triggerFieldDownload(
                  generateRawSensorJson(nodes, waypoints, language),
                  'vibepath-raw-l1-l5-sensor.json',
                  'application/json;charset=utf-8',
                  language === 'vi'
                    ? '[ OK // DOWNLOADED_RAW_SENSOR_JSON ]'
                    : '[ OK // DOWNLOADED_RAW_SENSOR_JSON ]'
                )
              }
              className="vp-touch-target w-full px-3.5 py-2.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#F3F6F9] flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileJson className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <div className="text-left min-w-0">
                  <div className="font-mono-brand font-bold text-xs text-[#F3F6F9]">
                    [ EXPORT_RAW_JSON // .JSON ]
                  </div>
                  <div className="vp-body-md text-[11px] text-[#9BA8B8] truncate">
                    {language === 'vi'
                      ? 'Dữ liệu cảm biến L1/L5 thô & ghi chú âm thanh/vị giác'
                      : 'Raw L1/L5 GNSS sensor log & audio/taste notes'}
                  </div>
                </div>
              </div>
              <span className="vp-telemetry-sm text-[#00E676] shrink-0">~8 KB</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
