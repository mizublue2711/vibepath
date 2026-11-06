import React, { useState, useMemo, useEffect } from 'react';
import {
  CulinaryNode,
  RouteWaypoint,
  LanguageCode,
  LegoGraphicStyleKey,
  LEGO_STYLE_PRESETS,
  generateBilingualSrt,
  generatePremiereXmlMarkers,
  generateRouteGeoJson,
  generateGpxTelemetry,
  generateRawSensorJson,
  generateLightweightSvgTrack,
  generateLottieJsonTrack,
  buildDefaultAiCopy,
  formatChapterTime,
} from '../data/vibePathData';
import { ApiKeyManager } from '../services/apiKeyManager';
import { buildWebhookRenderPayload } from '../services/webhook';
import { SchemaValidator, FoodPOI } from '../services/schema-validator';
import { MapboxGlobePlayer } from './MapboxGlobePlayer';
import {
  Download,
  Film,
  FileText,
  FileCode2,
  Copy,
  Check,
  RefreshCw,
  Rocket,
  Layers,
  ShieldCheck,
  Sparkles,
  Navigation,
  Activity,
  FileJson,
} from 'lucide-react';

interface EditorStudioTabProps {
  nodes: CulinaryNode[];
  waypoints: RouteWaypoint[];
  language: LanguageCode;
  activeRiderPos: { lat: number; lng: number };
}

export const EditorStudioTab: React.FC<EditorStudioTabProps> = ({
  nodes,
  waypoints,
  language,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [earthZoomTriggerKey, setEarthZoomTriggerKey] = useState<number>(1);
  const [selectedVectorStyle, setSelectedVectorStyle] =
    useState<LegoGraphicStyleKey>('tactical_blueprint');
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    'ai' | 'srt' | 'xml' | 'svg' | 'contract'
  >('ai');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // AI Chapters & Social Captions State
  const defaultAiCopy = useMemo(() => buildDefaultAiCopy(nodes, language), [nodes, language]);
  const [youtubeChapters, setYoutubeChapters] = useState<string>(defaultAiCopy.youtubeChapters);
  const [socialCaption, setSocialCaption] = useState<string>(defaultAiCopy.socialCaption);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiStatusNote, setAiStatusNote] = useState<string | null>(null);
  const [byokRev, setByokRev] = useState<number>(0);

  useEffect(() => {
    const onKeysUpdated = () => setByokRev((r) => r + 1);
    window.addEventListener('vibepath_apikeys_updated', onKeysUpdated);
    return () => window.removeEventListener('vibepath_apikeys_updated', onKeysUpdated);
  }, []);

  useEffect(() => {
    const updated = buildDefaultAiCopy(nodes, language);
    setYoutubeChapters(updated.youtubeChapters);
    setSocialCaption(updated.socialCaption);
  }, [nodes, language]);

  const cleanPayload = useMemo(() => {
    const rawTripData = {
      trip_id: 'TRIP_SAIGON_STUDIO_60FPS',
      youtuber_id: 'vlogger_saigon_01',
      language,
      trip_name: 'Saigon Night Street Food 3D Tour',
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

  const selectedPoi: FoodPOI | null = useMemo(() => {
    return (
      cleanPayload.food_pois.find((p) => p.poi_id === selectedNodeId) ||
      cleanPayload.food_pois[0] ||
      null
    );
  }, [cleanPayload.food_pois, selectedNodeId]);

  const srtContent = useMemo(() => generateBilingualSrt(nodes, language), [nodes, language]);
  const xmlContent = useMemo(() => generatePremiereXmlMarkers(nodes), [nodes]);
  const geoJsonContent = useMemo(
    () => generateRouteGeoJson(nodes, waypoints),
    [nodes, waypoints]
  );
  const gpxContent = useMemo(() => generateGpxTelemetry(nodes, waypoints), [nodes, waypoints]);
  const rawSensorJsonContent = useMemo(
    () => generateRawSensorJson(nodes, waypoints, language),
    [nodes, waypoints, language]
  );
  const activePoiName = selectedPoi?.name || nodes[0]?.name || 'Saigon Street Food POI';
  const svgVectorContent = useMemo(
    () => generateLightweightSvgTrack(nodes, waypoints, activePoiName, selectedVectorStyle),
    [nodes, waypoints, activePoiName, selectedVectorStyle]
  );
  const lottieJsonContent = useMemo(
    () => generateLottieJsonTrack(nodes, waypoints, activePoiName),
    [nodes, waypoints, activePoiName]
  );

  // Sanitized RenderPayload + optional custom_dify_key via buildWebhookRenderPayload
  const sanitizedRenderContractJson = useMemo(() => {
    try {
      const sanitized = buildWebhookRenderPayload({
        trip_id: 'TRIP_SAIGON_STUDIO_60FPS',
        youtuber_id: 'vlogger_saigon_01',
        language,
        trip_name: 'Saigon Night Street Food 3D Tour',
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
      return JSON.stringify(sanitized, null, 2);
    } catch (e: any) {
      return JSON.stringify({ error: e?.message }, null, 2);
    }
  }, [nodes, waypoints, language, byokRev]);

  // Trigger browser file download helper
  const triggerTextDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  // Download Lightweight Vector (.SVG)
  const handleDownloadLightweightSvg = () => {
    triggerTextDownload(
      svgVectorContent,
      `vibepath-vector-track-${selectedVectorStyle}.svg`,
      'image/svg+xml;charset=utf-8'
    );
  };

  // Download 60FPS Lottie Vector Animation (.lottie.json)
  const handleDownloadLottieJson = () => {
    triggerTextDownload(
      lottieJsonContent,
      `vibepath-60fps-motion-${selectedVectorStyle}.lottie.json`,
      'application/json;charset=utf-8'
    );
  };

  // Trigger 4-Stage Cinematic Flight & Seamless 1-Click 60FPS Video Export Engine
  const handleDownload3DMapVideo = () => {
    window.dispatchEvent(
      new CustomEvent('vibepath_trigger_cinematic_render', {
        detail: {
          recordVideo: true,
          tripName: 'SAIGON_NIGHT_CULINARY_NODE_01',
        },
      })
    );
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (_) {}
  };

  const handleRegenerateWithGemini = async () => {
    setIsGeneratingAi(true);
    setAiStatusNote(null);
    try {
      const data = await ApiKeyManager.safeCallGemini(nodes, language);
      if (data.youtubeChapters) setYoutubeChapters(data.youtubeChapters);
      if (data.socialCaption) setSocialCaption(data.socialCaption);
      setAiStatusNote(
        language === 'vi'
          ? `[ AI GUARD OK // ${data.modeUsed} ] Đã cập nhật YouTube Chapters & Social Captions.`
          : `[ AI GUARD OK // ${data.modeUsed} ] Updated YouTube Chapters & Social Captions.`
      );
    } catch (err: any) {
      const fallback = buildDefaultAiCopy(nodes, language);
      setYoutubeChapters(fallback.youtubeChapters);
      setSocialCaption(fallback.socialCaption);
      setAiStatusNote(
        language === 'vi'
          ? `[ AUTO-FALLBACK GUARD ] ${err?.message || 'Đã đồng bộ nội dung chuẩn từ lộ trình hiện trường.'}`
          : `[ AUTO-FALLBACK GUARD ] ${err?.message || 'Synchronized chapters and captions from field telemetry.'}`
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDownloadAllBundle = () => {
    handleDownloadLightweightSvg();
    setTimeout(() => {
      triggerTextDownload(srtContent, 'vibepath-bilingual-subtitles.srt', 'text/plain;charset=utf-8');
    }, 200);
    setTimeout(() => {
      triggerTextDownload(
        xmlContent,
        'vibepath-premiere-capcut-markers.xml',
        'application/xml;charset=utf-8'
      );
    }, 450);
    setTimeout(() => {
      triggerTextDownload(
        `=== YOUTUBE CHAPTERS ===\n${youtubeChapters}\n\n=== SOCIAL CAPTIONS (FB/TIKTOK/REELS) ===\n${socialCaption}\n`,
        'vibepath-ai-chapters-captions.txt',
        'text/plain;charset=utf-8'
      );
    }, 700);
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6">
      {/* Top Studio Header & Lightweight Vector + Master Bundle Banner (Spans all 8 columns) */}
      <div className="col-span-4 md:col-span-8 bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 md:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 vp-telemetry-sm text-[#00E5FF]">
            <span>[ EDITOR_WEB_STUDIO // ACTIVE ]</span>
            <span aria-hidden="true">//</span>
            <span className="text-[#00E676]">[ NATIVE_MAPBOX_GL_V3_WEBGL ]</span>
            <span aria-hidden="true">//</span>
            <span>[ {nodes.length} CULINARY_NODES_SYNCED ]</span>
          </div>
          <h2 className="vp-headline-lg text-[#F3F6F9]">
            {language === 'vi'
              ? 'Bộ công cụ Đồ họa Điện ảnh Siêu Nhẹ & 1-Click NLE'
              : 'Lightweight Cinematic Vector & 1-Click NLE Studio'}
          </h2>
          <p className="vp-body-md text-[#9BA8B8]">
            {language === 'vi'
              ? 'Thay thế file MP4 hàng trăm MB bằng đồ họa Vector chuẩn phim: SVG Vector Track 4K/8K (~12 KB), Lottie JSON 60FPS (<50 KB), WebM Trong suốt và bộ GIS/GPX.'
              : 'Replace heavy MP4 files with ultra-light cinematic assets: 4K/8K SVG Vector Track (~12 KB), 60FPS Lottie JSON (<50 KB), Transparent WebM, and GIS/GPX.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0 min-w-0">
          <button
            type="button"
            onClick={handleDownloadLightweightSvg}
            className="vp-touch-target flex-1 lg:flex-initial px-3 sm:px-4 bg-[#080A0F] hover:bg-[#00E5FF]/15 border border-[#00E5FF] text-[#00E5FF] font-mono-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors min-w-0"
          >
            <Sparkles className="w-4 h-4 text-[#00E676] shrink-0" />
            <span className="truncate">[ DOWNLOAD_VECTOR // .SVG ]</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAllBundle}
            className="clip-button-chamfer vp-touch-target flex-1 lg:flex-initial px-3 sm:px-5 bg-[#00E5FF] hover:bg-[#00E5FF]/90 border border-[#00E5FF] text-[#080A0F] font-mono-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors min-w-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {language === 'vi'
                ? '[ ⚡ DOWNLOAD_ALL_STUDIO_ASSETS ]'
                : '[ ⚡ DOWNLOAD_ALL_STUDIO_ASSETS ]'}
            </span>
          </button>
        </div>
      </div>

      {/* 4-Card 1-Click Asset Download Catalog */}
      {/* Asset 1: Lightweight Vector (.SVG / .LOTTIE / .WEBM) & 60FPS Video */}
      <div className="col-span-4 md:col-span-2 bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="vp-label-caps text-[#00E5FF]">[ 01 // VECTOR & 60FPS OVERLAY ]</span>
            <Film className="w-4 h-4 text-[#00E5FF]" />
          </div>
          <h3 className="font-mono-brand font-bold text-base text-[#F3F6F9]">
            {language === 'vi'
              ? 'Đồ họa Vector .SVG / Lottie / 60FPS'
              : 'Lightweight .SVG / Lottie / 60FPS'}
          </h3>
          <p className="vp-body-md text-[#9BA8B8]">
            {language === 'vi'
              ? 'Xuất đường đi Vector nét căng 4K/8K (.SVG ~12KB), hoạt họa 60FPS (.LOTTIE) hoặc Video 3D (.WEBM).'
              : 'Export 4K/8K scalable vector route (.SVG ~12KB), 60FPS motion (.LOTTIE), or 3D video (.WEBM).'}
          </p>
        </div>

        <div className="pt-2 border-t border-[#1F1F2E] flex flex-col gap-2">
          <div className="vp-telemetry-sm text-[#00E676]">
            [ 4K/8K_VECTOR · ~12KB_SVG · 60FPS_WEBM ]
          </div>
          <button
            type="button"
            onClick={handleDownloadLightweightSvg}
            className="clip-button-chamfer vp-touch-target w-full px-3 bg-[#00E5FF] hover:bg-[#00E5FF]/90 border border-[#00E5FF] text-[#080A0F] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>[ DOWNLOAD_VECTOR // .SVG ]</span>
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleDownloadLottieJson}
              className="min-h-[40px] px-2 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E676] text-[#00E676] vp-telemetry-sm text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>[ .LOTTIE_60FPS ]</span>
            </button>
            <button
              type="button"
              onClick={handleDownload3DMapVideo}
              className="min-h-[40px] px-2 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#00E5FF] vp-telemetry-sm text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>[ 60FPS_.WEBM ]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Asset 2: File Phụ đề Song ngữ chuẩn .SRT */}
      <div className="col-span-4 md:col-span-2 bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="vp-label-caps text-[#00E676]">[ 02 // BILINGUAL SUBTITLES ]</span>
            <FileText className="w-4 h-4 text-[#00E676]" />
          </div>
          <h3 className="font-mono-brand font-bold text-base text-[#F3F6F9]">
            {language === 'vi' ? 'File Phụ đề Song ngữ .SRT' : 'Bilingual .SRT Subtitles'}
          </h3>
          <p className="vp-body-md text-[#9BA8B8]">
            {language === 'vi'
              ? 'Đồng bộ mốc thời gian khớp từng giây theo video 3D, chứa lời thoại & ghi chú Việt - Anh.'
              : 'Time-synced to the exact second of the 3D map video with Vietnamese - English captions.'}
          </p>
        </div>

        <div className="pt-2 border-t border-[#1F1F2E] flex flex-col gap-2">
          <div className="vp-telemetry-sm text-[#00E5FF]">
            [ UTF-8 · VI + EN · {nodes.length * 2} CUES ]
          </div>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                srtContent,
                'vibepath-bilingual-subtitles.srt',
                'text/plain;charset=utf-8'
              )
            }
            className="vp-touch-target w-full px-3 bg-[#080A0F] border border-[#00E676] hover:bg-[#00E676] text-[#00E676] hover:text-[#080A0F] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>[ DOWNLOAD_BILINGUAL // .SRT ]</span>
          </button>
        </div>
      </div>

      {/* Asset 3: File Marker Timeline dạng .XML */}
      <div className="col-span-4 md:col-span-2 bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="vp-label-caps text-[#00E5FF]">[ 03 // PREMIERE & CAPCUT ]</span>
            <FileCode2 className="w-4 h-4 text-[#00E5FF]" />
          </div>
          <h3 className="font-mono-brand font-bold text-base text-[#F3F6F9]">
            {language === 'vi' ? 'File Marker Timeline .XML' : 'NLE Marker Timeline .XML'}
          </h3>
          <p className="vp-body-md text-[#9BA8B8]">
            {language === 'vi'
              ? 'Chứa mốc đánh dấu sự kiện dừng chân, kéo thả trực tiếp vào Premiere Pro / CapCut để tự động chia đoạn.'
              : 'XMEML v5 stop markers; drag-and-drop directly into Adobe Premiere Pro or CapCut.'}
          </p>
        </div>

        <div className="pt-2 border-t border-[#1F1F2E] flex flex-col gap-2">
          <div className="vp-telemetry-sm text-[#00E676]">
            [ XMEML_V5 · 60_TIMEBASE · {nodes.length} MARKERS ]
          </div>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                xmlContent,
                'vibepath-premiere-capcut-markers.xml',
                'application/xml;charset=utf-8'
              )
            }
            className="vp-touch-target w-full px-3 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>[ DOWNLOAD_MARKERS // .XML ]</span>
          </button>
        </div>
      </div>

      {/* Asset 4: Nội dung Văn bản AI (YouTube Chapters + Social Captions) */}
      <div className="col-span-4 md:col-span-2 bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="vp-label-caps text-[#00E676]">[ 04 // AI COPY & CHAPTERS ]</span>
            <Layers className="w-4 h-4 text-[#00E676]" />
          </div>
          <h3 className="font-mono-brand font-bold text-base text-[#F3F6F9]">
            {language === 'vi' ? 'Nội dung Văn bản AI' : 'AI Chapters & Social Copy'}
          </h3>
          <p className="vp-body-md text-[#9BA8B8]">
            {language === 'vi'
              ? 'YouTube Chapters (MM:SS - Tên quán) và Social Captions tối ưu cho Facebook / TikTok / Reels.'
              : 'YouTube Chapters (MM:SS - Spot Name) & viral Social Captions for Facebook/TikTok/Reels.'}
          </p>
        </div>

        <div className="pt-2 border-t border-[#1F1F2E] flex flex-col gap-2">
          <div className="vp-telemetry-sm text-[#00E5FF]">
            [ MM:SS_CHAPTERS · REELS_HOOKS ]
          </div>
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                `=== YOUTUBE CHAPTERS ===\n${youtubeChapters}\n\n=== SOCIAL CAPTIONS ===\n${socialCaption}\n`,
                'vibepath-ai-chapters-captions.txt',
                'text/plain;charset=utf-8'
              )
            }
            className="vp-touch-target w-full px-3 bg-[#080A0F] border border-[#00E676] hover:bg-[#00E676] text-[#00E676] hover:text-[#080A0F] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>[ DOWNLOAD_AI_COPY // .TXT ]</span>
          </button>
        </div>
      </div>

      {/* 1-Touch GIS & L1/L5 Telemetry Export Packaging Strip (Spans all 8 columns) */}
      <div className="col-span-4 md:col-span-8 bg-[#0D1017] border border-[#1F1F2E] p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="vp-label-caps text-[#00E676]">
            [ EXPORT_AND_DATA_PACKAGING // 1_TOUCH_GIS_AND_L1_L5_TELEMETRY ]
          </div>
          <h3 className="font-mono-brand font-bold text-sm text-[#F3F6F9]">
            {language === 'vi'
              ? 'Đóng gói Dữ liệu Không gian GIS & Cảm biến L1/L5 (Galileo + GPS <1m)'
              : '1-Touch Spatial GIS & Dual-Frequency L1/L5 Sensor Packaging'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                geoJsonContent,
                'vibepath-culinary-gis.geojson',
                'application/geo+json;charset=utf-8'
              )
            }
            className="vp-touch-target px-4 py-2.5 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Navigation className="w-4 h-4 shrink-0" />
            <span>[ EXPORT_GEOJSON // .GEOJSON ]</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                gpxContent,
                'vibepath-l1-l5-telemetry.gpx',
                'application/gpx+xml;charset=utf-8'
              )
            }
            className="vp-touch-target px-4 py-2.5 bg-[#080A0F] border border-[#00E676] hover:bg-[#00E676] text-[#00E676] hover:text-[#080A0F] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>[ EXPORT_GPX // .GPX ]</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                rawSensorJsonContent,
                'vibepath-raw-l1-l5-sensor.json',
                'application/json;charset=utf-8'
              )
            }
            className="vp-touch-target px-4 py-2.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#F3F6F9] font-mono-brand font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <FileJson className="w-4 h-4 text-[#00E5FF] shrink-0" />
            <span>[ EXPORT_RAW_JSON // .JSON ]</span>
          </button>
        </div>
      </div>

      {/* Left 4 Columns: Native Mapbox GL v3 3D Globe Preview & NLE Marker Scrubber */}
      <div className="col-span-4 md:col-span-4 flex flex-col gap-4">
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="vp-label-caps text-[#00E5FF]">
                [ NATIVE_MAPBOX_GL_V3 // 3D_GLOBE_PREVIEW ]
              </span>
              <h3 className="vp-headline-md text-[#F3F6F9]">
                {language === 'vi'
                  ? 'Bản đồ Trái đất 3D & Đường đi Laser #00E5FF'
                  : 'Native 3D Globe & #00E5FF Coaxial Laser'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setEarthZoomTriggerKey((k) => k + 1)}
              className="clip-button-chamfer vp-touch-target px-3.5 border bg-[#00E5FF] border-[#00E5FF] text-[#080A0F] vp-telemetry-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Rocket className="w-4 h-4" />
              <span>[ REPLAY_3D_FLY_TO ]</span>
            </button>
          </div>

          <MapboxGlobePlayer
            telemetryData={cleanPayload.telemetry_data}
            foodPois={cleanPayload.food_pois}
            activePoi={selectedPoi}
            allNodes={nodes}
            waypoints={waypoints}
            onSelectNode={(n) => {
              setSelectedNodeId(n.id);
              setEarthZoomTriggerKey((k) => k + 1);
            }}
            language={language}
            autoTriggerKey={earthZoomTriggerKey}
            compactMode={true}
            activeStyle={selectedVectorStyle}
            onStyleChange={setSelectedVectorStyle}
          />

          {/* Interactive Timeline Marker Strip */}
          <div className="pt-1">
            <div className="flex items-center justify-between vp-label-caps text-[#9BA8B8] mb-2">
              <span>[ PREMIERE_PRO_CAPCUT_TIMELINE_MARKERS // CLICK_TO_FLY ]</span>
              <span className="text-[#00E5FF]">[ {nodes.length} CUT_POINTS ]</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {nodes.map((node, i) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    setEarthZoomTriggerKey((k) => k + 1);
                  }}
                  className={`min-h-[48px] p-2 border text-left transition-colors cursor-pointer ${
                    node.id === selectedNodeId
                      ? 'bg-[#080A0F] border-[#00E5FF]'
                      : 'bg-[#080A0F] border-[#1F1F2E] hover:border-[#00E5FF]'
                  }`}
                >
                  <div className="vp-telemetry-sm text-[#00E5FF]">
                    [ {String(i + 1).padStart(2, '0')} // POI ] · {formatChapterTime(node.timecodeSeconds)}
                  </div>
                  <div className="font-mono-brand text-xs font-bold text-[#F3F6F9] truncate mt-0.5">
                    {node.name.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right 4 Columns: Live Code, SVG Vector Track, Data Contract & AI Content Inspector */}
      <div className="col-span-4 md:col-span-4 flex flex-col gap-4">
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 flex flex-col gap-4 h-full">
          {/* Segmented Inspector Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-3">
            <div className="bg-[#080A0F] border border-[#1F1F2E] p-1 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveInspectorTab('ai')}
                className={`vp-touch-target px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  activeInspectorTab === 'ai'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ AI_COPY ]
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('svg')}
                className={`vp-touch-target px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  activeInspectorTab === 'svg'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ .SVG_VECTOR ]
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('srt')}
                className={`vp-touch-target px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  activeInspectorTab === 'srt'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ .SRT_SUBTITLES ]
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('xml')}
                className={`vp-touch-target px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  activeInspectorTab === 'xml'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ .XML_MARKERS ]
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('contract')}
                className={`vp-touch-target px-3 vp-telemetry-sm transition-colors cursor-pointer ${
                  activeInspectorTab === 'contract'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ SCHEMA_CONTRACT ]
              </button>
            </div>

            {activeInspectorTab === 'ai' && (
              <button
                type="button"
                onClick={handleRegenerateWithGemini}
                disabled={isGeneratingAi}
                className="vp-touch-target px-3 bg-[#080A0F] border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#080A0F] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAi ? '[ GEMINI_RUNNING... ]' : '[ GEMINI_AI_REFRESH ]'}</span>
              </button>
            )}
          </div>

          {aiStatusNote && activeInspectorTab === 'ai' && (
            <div className="vp-telemetry-sm text-[#00E676]">{aiStatusNote}</div>
          )}

          {/* Tab Content: AI YouTube Chapters & Social Captions */}
          {activeInspectorTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="bg-[#080A0F] border border-[#1F1F2E] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="vp-label-caps text-[#00E676]">
                    [ YOUTUBE_CHAPTERS // MM:SS ]
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(youtubeChapters, 'chapters')}
                    className="vp-touch-target px-2.5 bg-[#0D1017] border border-[#1F1F2E] text-[#F3F6F9] hover:border-[#00E5FF] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'chapters' ? (
                      <Check className="w-3.5 h-3.5 text-[#00E676]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                    )}
                    <span>{copiedKey === 'chapters' ? '[ COPIED ]' : '[ COPY ]'}</span>
                  </button>
                </div>
                <pre className="font-mono-brand text-xs text-[#F3F6F9] whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {youtubeChapters}
                </pre>
              </div>

              <div className="bg-[#080A0F] border border-[#1F1F2E] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="vp-label-caps text-[#00E5FF]">
                    [ SOCIAL_CAPTIONS // FACEBOOK_TIKTOK_REELS ]
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(socialCaption, 'caption')}
                    className="vp-touch-target px-2.5 bg-[#0D1017] border border-[#1F1F2E] text-[#F3F6F9] hover:border-[#00E5FF] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'caption' ? (
                      <Check className="w-3.5 h-3.5 text-[#00E676]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                    )}
                    <span>{copiedKey === 'caption' ? '[ COPIED ]' : '[ COPY ]'}</span>
                  </button>
                </div>
                <pre className="vp-body-md text-xs text-[#F3F6F9] whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto">
                  {socialCaption}
                </pre>
              </div>
            </div>
          )}

          {/* Tab Content: Lightweight SVG Vector Track Inspector */}
          {activeInspectorTab === 'svg' && (
            <div className="bg-[#080A0F] border border-[#1F1F2E] p-3.5 flex flex-col gap-3 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(Object.keys(LEGO_STYLE_PRESETS) as LegoGraphicStyleKey[]).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setSelectedVectorStyle(sk)}
                      className={`px-2.5 py-1 text-[11px] font-mono-brand cursor-pointer border ${
                        selectedVectorStyle === sk
                          ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F] font-bold'
                          : 'bg-[#0D1017] border-[#1F1F2E] text-[#9BA8B8]'
                      }`}
                    >
                      [ {LEGO_STYLE_PRESETS[sk].title.toUpperCase()} ]
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleDownloadLightweightSvg}
                  className="vp-touch-target px-3 bg-[#00E5FF] border border-[#00E5FF] text-[#080A0F] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>[ DOWNLOAD_.SVG ]</span>
                </button>
              </div>
              <pre className="font-mono-brand text-xs text-[#00E5FF] whitespace-pre-wrap leading-relaxed max-h-[340px] overflow-y-auto">
                {svgVectorContent}
              </pre>
            </div>
          )}

          {/* Tab Content: Bilingual .SRT Inspector */}
          {activeInspectorTab === 'srt' && (
            <div className="bg-[#080A0F] border border-[#1F1F2E] p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="vp-label-caps text-[#00E676]">
                  [ vibepath-bilingual-subtitles.srt // TIME_SYNCED ]
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(srtContent, 'srt')}
                  className="vp-touch-target px-2.5 bg-[#0D1017] border border-[#1F1F2E] text-[#F3F6F9] hover:border-[#00E5FF] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'srt' ? (
                    <Check className="w-3.5 h-3.5 text-[#00E676]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                  )}
                  <span>{copiedKey === 'srt' ? '[ COPIED ]' : '[ COPY_.SRT ]'}</span>
                </button>
              </div>
              <pre className="font-mono-brand text-xs text-[#F3F6F9] whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                {srtContent}
              </pre>
            </div>
          )}

          {/* Tab Content: Adobe Premiere Pro / CapCut .XML Inspector */}
          {activeInspectorTab === 'xml' && (
            <div className="bg-[#080A0F] border border-[#1F1F2E] p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="vp-label-caps text-[#00E5FF]">
                  [ vibepath-premiere-capcut-markers.xml // XMEML_V5 ]
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(xmlContent, 'xml')}
                  className="vp-touch-target px-2.5 bg-[#0D1017] border border-[#1F1F2E] text-[#F3F6F9] hover:border-[#00E5FF] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'xml' ? (
                    <Check className="w-3.5 h-3.5 text-[#00E676]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                  )}
                  <span>{copiedKey === 'xml' ? '[ COPIED ]' : '[ COPY_.XML ]'}</span>
                </button>
              </div>
              <pre className="font-mono-brand text-xs text-[#00E5FF] whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                {xmlContent}
              </pre>
            </div>
          )}

          {/* Tab Content: SchemaValidator RenderPayload Contract */}
          {activeInspectorTab === 'contract' && (
            <div className="bg-[#080A0F] border border-[#1F1F2E] p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="vp-label-caps text-[#00E676] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00E676]" />
                  <span>[ SchemaValidator.sanitizeRenderPayload() // DRAFT-07 ]</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(sanitizedRenderContractJson, 'contract')}
                  className="vp-touch-target px-2.5 bg-[#0D1017] border border-[#1F1F2E] text-[#F3F6F9] hover:border-[#00E5FF] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'contract' ? (
                    <Check className="w-3.5 h-3.5 text-[#00E676]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                  )}
                  <span>{copiedKey === 'contract' ? '[ COPIED ]' : '[ COPY_JSON ]'}</span>
                </button>
              </div>
              <pre className="font-mono-brand text-xs text-[#00E676] whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                {sanitizedRenderContractJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
