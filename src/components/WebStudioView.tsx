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
import { SchemaValidator, FoodPOI } from '../utils/schema-validator';
import { MapboxGlobePlayer } from './MapboxGlobePlayer';
import {
  Download,
  Copy,
  Check,
  RefreshCw,
  Rocket,
} from 'lucide-react';

export interface WebStudioViewProps {
  nodes: CulinaryNode[];
  waypoints: RouteWaypoint[];
  language: LanguageCode;
  activeRiderPos: { lat: number; lng: number };
}

/**
 * Generate CMX 3600 .EDL Track for DaVinci Resolve / Premiere Pro / Avid NLEs
 */
function generateCmx3600EdlTrack(nodes: CulinaryNode[]): string {
  const lines: string[] = [
    'TITLE: VIBEPATH_CULINARY_TIMELINE_60FPS',
    'FCM: NON-DROP FRAME',
    '',
  ];

  nodes.forEach((node, index) => {
    const eventNum = String(index + 1).padStart(3, '0');
    const startSec = Math.max(0, node.timecodeSeconds || index * 18);
    const endSec = startSec + Math.max(5, node.durationSeconds || 18);

    const toTimecode = (sec: number) => {
      const hrs = String(Math.floor(sec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const secs = String(Math.floor(sec % 60)).padStart(2, '0');
      return `${hrs}:${mins}:${secs}:00`;
    };

    const tcIn = toTimecode(startSec);
    const tcOut = toTimecode(endSec);

    lines.push(`${eventNum}  AX       V     C        ${tcIn} ${tcOut} ${tcIn} ${tcOut}`);
    lines.push(`* FROM CLIP NAME: ${node.name.toUpperCase()}`);
    lines.push(
      `* LOC: ${tcIn} CYAN    POI_${String(index + 1).padStart(2, '0')}_${node.name
        .toUpperCase()
        .replace(/\s+/g, '_')} (${node.latitude.toFixed(4)}N, ${node.longitude.toFixed(4)}E)`
    );
    lines.push('');
  });

  return lines.join('\n');
}

export const WebStudioView: React.FC<WebStudioViewProps> = ({
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
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const defaultAiCopy = useMemo(() => buildDefaultAiCopy(nodes, language), [nodes, language]);
  const [youtubeChapters, setYoutubeChapters] = useState<string>(defaultAiCopy.youtubeChapters);
  const [socialCaption, setSocialCaption] = useState<string>(defaultAiCopy.socialCaption);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
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
  const edlContent = useMemo(() => generateCmx3600EdlTrack(nodes), [nodes]);
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

  const showTransientStatus = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 2600);
  };

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
    showTransientStatus(`EXPORTED // ${filename.toUpperCase()}`);
  };

  const handleDownloadLightweightSvg = () => {
    triggerTextDownload(
      svgVectorContent,
      `vibepath-vector-track-${selectedVectorStyle}.svg`,
      'image/svg+xml;charset=utf-8'
    );
  };

  const handleDownloadLottieJson = () => {
    triggerTextDownload(
      lottieJsonContent,
      `vibepath-60fps-motion-${selectedVectorStyle}.lottie.json`,
      'application/json;charset=utf-8'
    );
  };

  const handleDownload3DMapVideo = () => {
    showTransientStatus('RENDERING 60FPS .WEBM STREAM...');
    window.dispatchEvent(
      new CustomEvent('vibepath_trigger_cinematic_render', {
        detail: {
          recordVideo: true,
          tripName: 'SAIGON_NIGHT_CULINARY_NODE_01',
        },
      })
    );
  };

  const handleCopyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showTransientStatus(`COPIED // ${label}`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (_) {}
  };

  const handleRegenerateWithGemini = async () => {
    setIsGeneratingAi(true);
    try {
      const data = await ApiKeyManager.safeCallGemini(nodes, language);
      if (data.youtubeChapters) setYoutubeChapters(data.youtubeChapters);
      if (data.socialCaption) setSocialCaption(data.socialCaption);
      showTransientStatus(`AI METADATA SYNCED (${data.modeUsed})`);
    } catch (_) {
      const fallback = buildDefaultAiCopy(nodes, language);
      setYoutubeChapters(fallback.youtubeChapters);
      setSocialCaption(fallback.socialCaption);
      showTransientStatus('SYNCHRONIZED CHAPTERS & HOOKS FROM TELEMETRY');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDownloadZipPackage = () => {
    handleDownloadLightweightSvg();
    setTimeout(() => {
      triggerTextDownload(
        srtContent,
        'vibepath-bilingual-subtitles.srt',
        'text/plain;charset=utf-8'
      );
    }, 180);
    setTimeout(() => {
      triggerTextDownload(
        xmlContent,
        'vibepath-premiere-davinci-markers.xml',
        'application/xml;charset=utf-8'
      );
    }, 380);
    setTimeout(() => {
      triggerTextDownload(
        edlContent,
        'vibepath-timeline-markers.edl',
        'text/plain;charset=utf-8'
      );
    }, 580);
    setTimeout(() => {
      triggerTextDownload(
        `=== YOUTUBE CHAPTERS ===\n${youtubeChapters}\n\n=== SOCIAL HOOKS ===\n${socialCaption}\n`,
        'vibepath-ai-chapters-metadata.txt',
        'text/plain;charset=utf-8'
      );
    }, 780);
  };

  return (
    <div
      className="w-full min-h-screen bg-[#05050A] text-white p-3 sm:p-5 flex flex-col gap-4 rounded-none select-none"
      style={{ borderRadius: '0px' }}
    >
      {/* 1. TOP STUDIO HEADER HUD */}
      <div className="w-full bg-[#0A0C14] border border-[#171825] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 rounded-none">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs">
          <span className="text-white font-bold tracking-wider whitespace-nowrap">
            [ VIBEPATH // NLE_ASSET_STUDIO ]
          </span>
          <span className="text-[#23263B]">|</span>
          <span className="text-[#00FF66] font-bold flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 bg-[#00FF66] inline-block" />
            <span>[ SYNC_STATUS: ● READY ]</span>
          </span>
          <span className="text-[#23263B] hidden sm:inline">|</span>
          <span className="text-[#8A8FA3] whitespace-nowrap hidden sm:inline">
            [ PRESET: DA_VINCI / PREMIERE ]
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          {statusFeedback ? (
            <span className="text-[#00FF66] font-bold tracking-wider whitespace-nowrap">
              [ {statusFeedback} ]
            </span>
          ) : (
            <span className="text-[#8A8FA3] whitespace-nowrap">
              [ {nodes.length} NODES · {waypoints.length} GPS PTS ]
            </span>
          )}
        </div>
      </div>

      {/* 2. HERO MODULE */}
      <div className="w-full bg-[#0A0C14] border border-[#171825] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 rounded-none">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00E5FF] inline-block shrink-0" />
            <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
              [ 00 // MASTER_PRODUCTION_SUITE ]
            </span>
          </div>
          <h1 className="font-bold text-lg sm:text-xl tracking-tight text-white uppercase">
            LIGHTWEIGHT CINEMATIC STUDIO
          </h1>
          <p className="font-mono text-xs text-[#8A8FA3]">
            4K/8K Vector Motion Tracks (~12KB), Bilingual Time-Synced Subtitles, XMEML/EDL Timeline Markers & AI Chapters.
          </p>
        </div>

        {/* Hero Action Row with 2 Aligned Buttons (No wrapping text) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          {/* Primary Hero Button — Exclusive #00E5FF + Mechanical 45° Corner Notch */}
          <button
            type="button"
            onClick={handleDownloadZipPackage}
            style={{
              clipPath:
                'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
              borderRadius: '0px',
            }}
            className="h-11 px-5 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#05050A] font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>[ DOWNLOAD .ZIP PACKAGE ]</span>
          </button>

          {/* Secondary Hero Button — Quantum Violet #5322FF NLE Timeline Export */}
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                xmlContent,
                'vibepath-premiere-davinci-markers.xml',
                'application/xml;charset=utf-8'
              )
            }
            className="h-11 px-5 bg-[#0E101D] border border-[#5322FF] text-white hover:border-[#00E5FF] hover:text-white font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0 rounded-none"
          >
            <span>[ EXPORT TIMELINE .XML ]</span>
          </button>
        </div>
      </div>

      {/* 3. 4-CELL BENTO MATRIX (2x2 Grid with 1px divider gap) */}
      <div className="w-full bg-[#171825] border border-[#171825] grid grid-cols-1 md:grid-cols-2 gap-[1px] rounded-none">
        {/* CELL 1: Vector Motion */}
        <div className="bg-[#0A0C14] p-5 flex flex-col justify-between gap-5 rounded-none">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                [ 01 // VECTOR_MOTION ]
              </span>
              <span className="font-mono text-xs text-[#8A8FA3]">4K/8K · 60FPS</span>
            </div>
            <h2 className="font-bold text-sm tracking-tight text-white uppercase">
              VECTOR MOTION & OVERLAY TRACKS
            </h2>
            <p className="font-mono text-xs text-[#8A8FA3]">
              Resolution-independent SVG trajectory (~12KB), 60FPS Lottie JSON animation, and transparent WebM sequence.
            </p>
          </div>

          {/* Clean row of 3 buttons: [ .SVG ], [ .LOTTIE ], [ .WEBM ] */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#171825]">
            <button
              type="button"
              onClick={handleDownloadLightweightSvg}
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              [ .SVG ]
            </button>

            <button
              type="button"
              onClick={handleDownloadLottieJson}
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              [ .LOTTIE ]
            </button>

            <button
              type="button"
              onClick={handleDownload3DMapVideo}
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              [ .WEBM ]
            </button>
          </div>
        </div>

        {/* CELL 2: Bilingual Subtitles */}
        <div className="bg-[#0A0C14] p-5 flex flex-col justify-between gap-5 rounded-none">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                [ 02 // BILINGUAL_SUBTITLES ]
              </span>
              <span className="font-mono text-xs text-[#8A8FA3]">
                UTF-8 · {nodes.length * 2} CUES
              </span>
            </div>
            <h2 className="font-bold text-sm tracking-tight text-white uppercase">
              BILINGUAL SUBTITLES & NARRATION SCRIPT
            </h2>
            <p className="font-mono text-xs text-[#8A8FA3]">
              Frame-accurate Vietnamese & English subtitle track synchronized with field culinary stops.
            </p>
          </div>

          {/* Action rack with [ DOWNLOAD .SRT ] and [ COPY SCRIPT ] */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#171825]">
            <button
              type="button"
              onClick={() =>
                triggerTextDownload(
                  srtContent,
                  'vibepath-bilingual-subtitles.srt',
                  'text/plain;charset=utf-8'
                )
              }
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              [ DOWNLOAD .SRT ]
            </button>

            <button
              type="button"
              onClick={() => handleCopyText(srtContent, 'srt-cell', 'BILINGUAL .SRT SCRIPT')}
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              {copiedKey === 'srt-cell' ? '[ COPIED ● ]' : '[ COPY SCRIPT ]'}
            </button>
          </div>
        </div>

        {/* CELL 3: NLE Marker Timeline */}
        <div className="bg-[#0A0C14] p-5 flex flex-col justify-between gap-5 rounded-none">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                [ 03 // NLE_MARKER_TIMELINE ]
              </span>
              <span className="font-mono text-xs text-[#5322FF]">
                XMEML V5 · CMX 3600
              </span>
            </div>
            <h2 className="font-bold text-sm tracking-tight text-white uppercase">
              NLE MARKER TIMELINE
            </h2>
            <p className="font-mono text-xs text-[#8A8FA3]">
              Direct timeline cut-points & chapter pins for DaVinci Resolve, Adobe Premiere Pro, and CapCut Pro.
            </p>
          </div>

          {/* Action rack with [ XMEML .XML ] and [ .EDL TRACK ] */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#171825]">
            <button
              type="button"
              onClick={() =>
                triggerTextDownload(
                  xmlContent,
                  'vibepath-premiere-davinci-markers.xml',
                  'application/xml;charset=utf-8'
                )
              }
              className="h-10 px-3 bg-[#0E101D] border border-[#5322FF] text-white hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              [ XMEML .XML ]
            </button>

            <button
              type="button"
              onClick={() =>
                triggerTextDownload(
                  edlContent,
                  'vibepath-timeline-markers.edl',
                  'text/plain;charset=utf-8'
                )
              }
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              [ .EDL TRACK ]
            </button>
          </div>
        </div>

        {/* CELL 4: AI Chapters & Metadata */}
        <div className="bg-[#0A0C14] p-5 flex flex-col justify-between gap-5 rounded-none">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                [ 04 // AI_CHAPTERS_&_METADATA ]
              </span>
              <span className="font-mono text-xs text-[#00FF66]">● READY</span>
            </div>
            <h2 className="font-bold text-sm tracking-tight text-white uppercase">
              AI CHAPTERS & METADATA
            </h2>
            <p className="font-mono text-xs text-[#8A8FA3]">
              Timestamped YouTube Chapters (MM:SS) and high-retention social hooks for Reels, TikTok & Shorts.
            </p>
          </div>

          {/* 1-Click Copy rack for YouTube Chapters and Social Hooks */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#171825]">
            <button
              type="button"
              onClick={() =>
                handleCopyText(youtubeChapters, 'chapters-cell', 'YOUTUBE CHAPTERS')
              }
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              {copiedKey === 'chapters-cell' ? '[ COPIED ● ]' : '[ COPY CHAPTERS ]'}
            </button>

            <button
              type="button"
              onClick={() =>
                handleCopyText(socialCaption, 'hooks-cell', 'SOCIAL HOOKS')
              }
              className="h-10 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
            >
              {copiedKey === 'hooks-cell' ? '[ COPIED ● ]' : '[ COPY HOOKS ]'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. SPATIAL TELEMETRY & GIS PACKAGING BAR */}
      <div className="w-full bg-[#0A0C14] border border-[#171825] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-none">
        <div className="space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase block">
            [ 05 // SPATIAL_TELEMETRY_ARCHIVE ]
          </span>
          <h3 className="font-bold text-sm tracking-tight text-white uppercase">
            RAW GNSS TRAJECTORY & GIS PACKAGING
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              triggerTextDownload(
                geoJsonContent,
                'vibepath-culinary-gis.geojson',
                'application/geo+json;charset=utf-8'
              )
            }
            className="h-10 px-4 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
          >
            [ .GEOJSON ]
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
            className="h-10 px-4 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
          >
            [ .GPX ]
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
            className="h-10 px-4 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] shadow-none font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center justify-center cursor-pointer transition-colors rounded-none"
          >
            [ .JSON ]
          </button>
        </div>
      </div>

      {/* 5. STUDIO WORKBENCH: 3D VIEWPORT SCRUBBER + CODE & METADATA INSPECTOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 6 Columns: 3D Globe Preview & Cut-Point Scrubber */}
        <div className="lg:col-span-6 bg-[#0A0C14] border border-[#171825] p-4 flex flex-col gap-3 rounded-none">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase block">
                [ 06 // NLE_3D_PREVIEW_MONITOR ]
              </span>
              <h3 className="font-bold text-sm tracking-tight text-white uppercase">
                3D CAMERA & TIMELINE CUT-POINT MONITOR
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setEarthZoomTriggerKey((k) => k + 1)}
              className="h-9 px-3.5 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#FFFFFF] font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors rounded-none"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>[ REPLAY FLYOVER ]</span>
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

          {/* Cut-Point Marker Strip */}
          <div className="pt-2 border-t border-[#171825]">
            <div className="flex items-center justify-between font-mono text-xs text-[#8A8FA3] mb-2">
              <span>TIMELINE MARKER NODES</span>
              <span className="text-[#00FF66]">● {nodes.length} CUT POINTS</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {nodes.map((node, i) => {
                const isSelected = node.id === selectedNodeId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setEarthZoomTriggerKey((k) => k + 1);
                    }}
                    className={`p-2.5 border text-left transition-colors cursor-pointer rounded-none ${
                      isSelected
                        ? 'bg-[#0E101D] border-[#5322FF]'
                        : 'bg-[#05050A] border-[#171825] hover:border-[#00E5FF]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#8A8FA3]">
                      <span className="flex items-center gap-1">
                        {isSelected && <span className="w-1.5 h-1.5 bg-[#00E5FF] inline-block" />}
                        <span>#{String(i + 1).padStart(2, '0')}</span>
                      </span>
                      <span>{formatChapterTime(node.timecodeSeconds)}</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white truncate mt-1">
                      {node.name.toUpperCase()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 6 Columns: Live Asset Source Inspector */}
        <div className="lg:col-span-6 bg-[#0A0C14] border border-[#171825] p-4 flex flex-col gap-4 rounded-none">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#171825] pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: 'ai', label: '[ AI CHAPTERS ]' },
                  { key: 'svg', label: '[ .SVG TRACK ]' },
                  { key: 'srt', label: '[ .SRT SUBS ]' },
                  { key: 'xml', label: '[ .XML / .EDL ]' },
                  { key: 'contract', label: '[ JSON SCHEMA ]' },
                ] as const
              ).map((tab) => {
                const active = activeInspectorTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveInspectorTab(tab.key)}
                    className={`h-9 px-3 border font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors rounded-none ${
                      active
                        ? 'bg-[#0E101D] border-[#5322FF] text-white font-bold'
                        : 'bg-[#05050A] border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white'
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 bg-[#00E5FF] inline-block" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeInspectorTab === 'ai' && (
              <button
                type="button"
                onClick={handleRegenerateWithGemini}
                disabled={isGeneratingAi}
                className="h-9 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors rounded-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAi ? '[ SYNCING... ]' : '[ REGENERATE AI ]'}</span>
              </button>
            )}
          </div>

          {/* Inspector Body */}
          {activeInspectorTab === 'ai' && (
            <div className="flex flex-col gap-3 flex-1">
              <div className="bg-[#05050A] border border-[#171825] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                    [ YOUTUBE CHAPTERS // MM:SS ]
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(youtubeChapters, 'chapters-inspector', 'YOUTUBE CHAPTERS')
                    }
                    className="h-8 px-2.5 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'chapters-inspector' ? (
                      <Check className="w-3.5 h-3.5 text-[#00FF66]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'chapters-inspector' ? '[ COPIED ]' : '[ COPY ]'}</span>
                  </button>
                </div>
                <pre className="font-mono text-xs text-white whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {youtubeChapters}
                </pre>
              </div>

              <div className="bg-[#05050A] border border-[#171825] p-3.5 space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                    [ SOCIAL HOOKS // REELS & TIKTOK ]
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(socialCaption, 'caption-inspector', 'SOCIAL HOOKS')
                    }
                    className="h-8 px-2.5 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'caption-inspector' ? (
                      <Check className="w-3.5 h-3.5 text-[#00FF66]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'caption-inspector' ? '[ COPIED ]' : '[ COPY ]'}</span>
                  </button>
                </div>
                <pre className="font-mono text-xs text-[#8A8FA3] whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto">
                  {socialCaption}
                </pre>
              </div>
            </div>
          )}

          {activeInspectorTab === 'svg' && (
            <div className="bg-[#05050A] border border-[#171825] p-3.5 flex flex-col gap-3 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.keys(LEGO_STYLE_PRESETS) as LegoGraphicStyleKey[]).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setSelectedVectorStyle(sk)}
                      className={`h-8 px-2.5 font-mono text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer border ${
                        selectedVectorStyle === sk
                          ? 'bg-[#0E101D] border-[#5322FF] text-white font-bold'
                          : 'bg-[#05050A] border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white'
                      }`}
                    >
                      [ {LEGO_STYLE_PRESETS[sk].title.toUpperCase()} ]
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleDownloadLightweightSvg}
                  className="h-8 px-3 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer"
                >
                  [ DOWNLOAD .SVG ]
                </button>
              </div>
              <pre className="font-mono text-xs text-[#8A8FA3] whitespace-pre-wrap leading-relaxed max-h-[340px] overflow-y-auto">
                {svgVectorContent}
              </pre>
            </div>
          )}

          {activeInspectorTab === 'srt' && (
            <div className="bg-[#05050A] border border-[#171825] p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                  [ BILINGUAL .SRT SUBTITLE STREAM ]
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(srtContent, 'srt-inspector', '.SRT SUBTITLES')}
                  className="h-8 px-2.5 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer"
                >
                  {copiedKey === 'srt-inspector' ? '[ COPIED ]' : '[ COPY .SRT ]'}
                </button>
              </div>
              <pre className="font-mono text-xs text-white whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto">
                {srtContent}
              </pre>
            </div>
          )}

          {activeInspectorTab === 'xml' && (
            <div className="bg-[#05050A] border border-[#171825] p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-widest text-[#5322FF] uppercase">
                  [ XMEML V5 & CMX 3600 EDL TIMELINE ]
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(xmlContent, 'xml-inspector', 'XMEML .XML')}
                  className="h-8 px-2.5 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer"
                >
                  {copiedKey === 'xml-inspector' ? '[ COPIED ]' : '[ COPY .XML ]'}
                </button>
              </div>
              <pre className="font-mono text-xs text-[#8A8FA3] whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto">
                {xmlContent}
              </pre>
            </div>
          )}

          {activeInspectorTab === 'contract' && (
            <div className="bg-[#05050A] border border-[#171825] p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-widest text-[#00FF66] uppercase">
                  [ SCHEMA VALIDATOR // DRAFT-07 READY ]
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(sanitizedRenderContractJson, 'contract-inspector', 'JSON SCHEMA')
                  }
                  className="h-8 px-2.5 bg-[#0E101D] border border-[#23263B] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer"
                >
                  {copiedKey === 'contract-inspector' ? '[ COPIED ]' : '[ COPY JSON ]'}
                </button>
              </div>
              <pre className="font-mono text-xs text-[#00FF66] whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto">
                {sanitizedRenderContractJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
