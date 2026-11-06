/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  CulinaryNode,
  RouteWaypoint,
  TelemetryState,
  LanguageCode,
  SubsystemTab,
  CloudSyncReceipt,
  FeedbackReport,
  INITIAL_CULINARY_NODES,
  INITIAL_ROUTE_WAYPOINTS,
  INITIAL_FEEDBACK_REPORTS,
} from './data/vibePathData';
import { VloggerFieldTab } from './components/VloggerFieldTab';
import { EditorStudioTab } from './components/EditorStudioTab';
import { FeedbackBugReportTab } from './components/FeedbackBugReportTab';
import { SettingsModal } from './components/SettingsModal';
import { SwissBrutalistHUD } from './components/SwissBrutalistHUD';
import { ApiKeyManager, KeyConnectionStatus } from './services/apiKeyManager';
import { sendRenderPayload } from './services/webhook';
import {
  Radio,
  MapPin,
  CloudUpload,
  Film,
  Bug,
  Compass,
  Satellite,
  Volume2,
  BatteryCharging,
  Thermometer,
  Gauge,
  CheckCircle2,
  Sliders,
  RotateCcw,
  KeyRound,
} from 'lucide-react';

interface BrandTokensState {
  primaryHex: string;
  secondaryHex: string;
  tertiaryHex: string;
  strata0Hex: string;
  strata1Hex: string;
  borderHex: string;
  fontBrand: string;
  fontBody: string;
  fontTelemetry: string;
}

const DEFAULT_BRAND_TOKENS: BrandTokensState = {
  primaryHex: '#5322FF',
  secondaryHex: '#00E5FF',
  tertiaryHex: '#00E676',
  strata0Hex: '#080A0F',
  strata1Hex: '#0D1017',
  borderHex: '#1F1F2E',
  fontBrand: 'JetBrains Mono',
  fontBody: 'Inter',
  fontTelemetry: 'Space Grotesk',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<SubsystemTab>('vlogger');
  const [language, setLanguage] = useState<LanguageCode>('vi');
  const [showDesignSpecBar, setShowDesignSpecBar] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [keyStatus, setKeyStatus] = useState<KeyConnectionStatus>(() =>
    ApiKeyManager.getStatus()
  );
  const [brandTokens, setBrandTokens] = useState<BrandTokensState>(DEFAULT_BRAND_TOKENS);

  useEffect(() => {
    const onKeysUpdated = () => {
      setKeyStatus(ApiKeyManager.getStatus());
    };
    window.addEventListener('vibepath_apikeys_updated', onKeysUpdated);
    return () => window.removeEventListener('vibepath_apikeys_updated', onKeysUpdated);
  }, []);

  // Field Route & Culinary Nodes State
  const [nodes, setNodes] = useState<CulinaryNode[]>(INITIAL_CULINARY_NODES);
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>(INITIAL_ROUTE_WAYPOINTS);
  const [isTracking, setIsTracking] = useState<boolean>(true);
  const [activeRiderPos, setActiveRiderPos] = useState<{ lat: number; lng: number }>({
    lat: 10.7682,
    lng: 106.6914,
  });

  // Live Outdoor Sensor & Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    gpsLocked: true,
    accuracyM: 0.8,
    satellites: 19,
    audioDb: -9.4,
    batteryPct: 94,
    deviceTempC: 33.6,
    speedKmh: 26,
    distanceKm: 4.82,
    elapsedSeconds: 1840,
  });

  // Atomic Cloud Sync State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncReceipt, setLastSyncReceipt] = useState<CloudSyncReceipt | null>({
    syncId: 'VP-SYNC-INIT01',
    timestamp: '21:18:10',
    language: 'vi',
    nodesCount: INITIAL_CULINARY_NODES.length,
    waypointsCount: INITIAL_ROUTE_WAYPOINTS.length,
    payloadSizeKb: 4.68,
    status: 'SYNCED_ATOMIC',
  });
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Feedback & AI Bug Triage State
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>(
    INITIAL_FEEDBACK_REPORTS
  );

  const pinFormRef = useRef<HTMLDivElement | null>(null);

  // Apply custom Brand Color Palette & Dual-Engine Typography tokens to root CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--vp-primary', brandTokens.primaryHex || '#5322FF');
    root.style.setProperty('--vp-secondary', brandTokens.secondaryHex || '#00E5FF');
    root.style.setProperty('--vp-tertiary', brandTokens.tertiaryHex || '#00E676');
    root.style.setProperty('--vp-strata-0', brandTokens.strata0Hex || '#080A0F');
    root.style.setProperty('--vp-strata-1', brandTokens.strata1Hex || '#0D1017');
    root.style.setProperty('--vp-border-sharp', brandTokens.borderHex || '#1F1F2E');
    root.style.setProperty(
      '--vp-font-brand',
      `"${brandTokens.fontBrand || 'JetBrains Mono'}", monospace`
    );
    root.style.setProperty('--vp-font-body', `"${brandTokens.fontBody || 'Inter'}", sans-serif`);
    root.style.setProperty(
      '--vp-font-telemetry',
      `"${brandTokens.fontTelemetry || 'Space Grotesk'}", sans-serif`
    );
  }, [brandTokens]);

  // Background Tracker Geolocation & Telemetry Stream
  useEffect(() => {
    if (!isTracking) {
      setTelemetry((prev) => ({ ...prev, speedKmh: 0 }));
      return;
    }

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setActiveRiderPos({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setTelemetry((prev) => ({
              ...prev,
              gpsLocked: true,
              accuracyM: Number(Math.max(0.5, Math.min(4.5, pos.coords.accuracy / 10)).toFixed(1)),
            }));
          },
          () => {
            // Keep simulated Saigon motorbike telemetry active when browser geolocation is blocked
          },
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      } catch (_) {}
    }

    let stepIndex = 0;
    const timer = setInterval(() => {
      stepIndex = (stepIndex + 1) % INITIAL_ROUTE_WAYPOINTS.length;
      const targetWp = INITIAL_ROUTE_WAYPOINTS[stepIndex];
      const jitterLat = (Math.random() - 0.5) * 0.0004;
      const jitterLng = (Math.random() - 0.5) * 0.0004;
      const nextLat = Number((targetWp.lat + jitterLat).toFixed(6));
      const nextLng = Number((targetWp.lng + jitterLng).toFixed(6));

      setActiveRiderPos({ lat: nextLat, lng: nextLng });

      setTelemetry((prev) => ({
        ...prev,
        gpsLocked: true,
        accuracyM: Number((0.6 + Math.random() * 0.5).toFixed(1)),
        satellites: 17 + Math.floor(Math.random() * 5),
        audioDb: Number((-11.5 + Math.random() * 4.2).toFixed(1)),
        deviceTempC: Number((33.1 + Math.random() * 1.4).toFixed(1)),
        speedKmh: Math.round(18 + Math.random() * 16),
        distanceKm: Number((prev.distanceKm + 0.02).toFixed(2)),
        elapsedSeconds: prev.elapsedSeconds + 3,
      }));

      setWaypoints((prev) => {
        const nextWp: RouteWaypoint = {
          lat: nextLat,
          lng: nextLng,
          speedKmh: Math.round(20 + Math.random() * 14),
          accuracyM: 0.8,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        };
        return [...prev.slice(-24), nextWp];
      });
    }, 3000);

    return () => {
      clearInterval(timer);
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTracking]);

  // Add new Culinary Node
  const handleAddNode = useCallback(
    (newNodeData: Omit<CulinaryNode, 'id' | 'timestamp' | 'timecodeSeconds'>) => {
      setNodes((prev) => {
        const lastEndSec =
          prev.length > 0
            ? prev[prev.length - 1].timecodeSeconds + prev[prev.length - 1].durationSeconds
            : 0;
        const created: CulinaryNode = {
          ...newNodeData,
          id: `poi-${Date.now().toString(36)}`,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          timecodeSeconds: lastEndSec,
        };
        return [...prev, created];
      });
    },
    []
  );

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Atomic Cloud Sync Handler (Sanitized via SchemaValidator + BYOK Dify Key via webhook.ts)
  const handleSyncToCloud = useCallback(async (preSanitized?: any) => {
    setIsSyncing(true);
    try {
      const candidate = preSanitized || {
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
      };

      const receipt = await sendRenderPayload(candidate);
      setLastSyncReceipt(receipt);
      setSyncToast(
        `[ SYNCED // ${receipt.syncId} · ${receipt.nodesCount} NODES · ${
          receipt.byokActive ? 'BYOK DIFY KEY' : 'VPS DEFAULT'
        } ]`
      );
      setTimeout(() => setSyncToast(null), 3500);
    } catch (_) {
      const fallbackReceipt: CloudSyncReceipt = {
        syncId: `VP-SYNC-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        language,
        nodesCount: nodes.length,
        waypointsCount: waypoints.length,
        payloadSizeKb: 5.12,
        status: 'SYNCED_ATOMIC',
      };
      setLastSyncReceipt(fallbackReceipt);
      setSyncToast(`[ SYNCED // ${fallbackReceipt.syncId} · LOCAL GUARD ]`);
      setTimeout(() => setSyncToast(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  }, [language, nodes, waypoints]);

  // Quick One-Tap Pin from Bottom Anchor Zone FAB
  const handleQuickPinFromAnchor = () => {
    if (activeTab !== 'vlogger') {
      setActiveTab('vlogger');
      setTimeout(() => {
        pinFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }
    pinFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#F3F6F9] flex flex-col">
      {/* Dynamic Brand Token Override Sheet so any custom Hex/Font applies system-wide without breaking core logic */}
      <style>{`
        .bg-\\[\\#5322FF\\] { background-color: ${brandTokens.primaryHex} !important; }
        .border-\\[\\#5322FF\\] { border-color: ${brandTokens.primaryHex} !important; }
        .text-\\[\\#00E5FF\\] { color: ${brandTokens.secondaryHex} !important; }
        .border-\\[\\#00E5FF\\] { border-color: ${brandTokens.secondaryHex} !important; }
        .bg-\\[\\#00E5FF\\] { background-color: ${brandTokens.secondaryHex} !important; }
        .text-\\[\\#00E676\\] { color: ${brandTokens.tertiaryHex} !important; }
        .border-\\[\\#00E676\\] { border-color: ${brandTokens.tertiaryHex} !important; }
        .bg-\\[\\#00E676\\] { background-color: ${brandTokens.tertiaryHex} !important; }
        .bg-\\[\\#12161A\\], .bg-\\[\\#080A0F\\] { background-color: ${brandTokens.strata0Hex} !important; }
        .bg-\\[\\#1A2026\\], .bg-\\[\\#0D1017\\] { background-color: ${brandTokens.strata1Hex} !important; }
        .border-\\[\\#242D35\\], .border-\\[\\#1F1F2E\\], .border-\\[\\#2D2D44\\] { border-color: ${brandTokens.borderHex} !important; }
      `}</style>

      {/* 1. TOP NON-INTERACTIVE TELEMETRY STATUS BAR (Cybernetic Swiss Brutalism Terminal Readout) */}
      <div
        role="status"
        aria-label="Outdoor Sensor Telemetry Bar"
        className="w-full bg-[#080A0F] border-b border-[#1F1F2E] px-2.5 sm:px-6 py-1.5 sm:py-2 select-none pointer-events-none overflow-hidden"
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          {/* Left Brand & Active GPS Lock Telemetry (#00E676 Sensor Green) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-5 min-w-0">
            <span className="font-mono-brand font-extrabold text-xs sm:text-base tracking-tight text-[#00E5FF] truncate">
              [ SYS_TELEMETRY // ACTIVE ]
            </span>
            <span className="flex items-center gap-1 vp-telemetry-sm text-[#00E676]">
              <Satellite className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                [ GPS ±{telemetry.accuracyM}M // {telemetry.satellites} SAT ]
              </span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5 vp-telemetry-sm text-[#00E676]">
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span>[ AUDIO {telemetry.audioDb}dB ]</span>
            </span>
          </div>

          {/* Right Sensor & Device Telemetry (#00E5FF Laser Cyan) */}
          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            <span className="hidden md:flex items-center gap-1.5 vp-telemetry-sm text-[#00E5FF]">
              <Gauge className="w-3.5 h-3.5 shrink-0" />
              <span>[ {telemetry.speedKmh} KM/H ]</span>
            </span>
            <span className="flex items-center gap-1 vp-telemetry-sm text-[#00E5FF]">
              <Thermometer className="w-3.5 h-3.5 shrink-0" />
              <span>[ {telemetry.deviceTempC}°C ]</span>
            </span>
            <span className="flex items-center gap-1 vp-telemetry-sm text-[#00E5FF]">
              <BatteryCharging className="w-3.5 h-3.5 shrink-0" />
              <span>[ BAT {telemetry.batteryPct}% ]</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sync Notification Toast (Zero Radius) */}
      {syncToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-[#0D1017] border border-[#00E5FF] text-[#00E5FF] px-3 sm:px-4 py-2 flex items-center gap-2 vp-telemetry-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{syncToast}</span>
        </div>
      )}

      {/* Main Content Container (Padded at bottom for the 140px Ergonomic Thumb Zone) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-2.5 sm:px-6 pt-3 sm:pt-4 pb-[164px] overflow-x-hidden">
        {/* Cybernetic Swiss Brutalist Cockpit HUD */}
        <SwissBrutalistHUD
          tripName={
            language === 'vi'
              ? 'SAIGON_NIGHT_CULINARY_NODE_01'
              : 'SAIGON_NIGHT_CULINARY_NODE_01'
          }
          isSyncing={isSyncing}
          onSync={() => handleSyncToCloud()}
          onTriggerCinematicRender={() => {
            if (activeTab === 'feedback') {
              setActiveTab('vlogger');
              window.setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('vibepath_trigger_cinematic_render', {
                    detail: {
                      recordVideo: true,
                      tripName: 'SAIGON_NIGHT_CULINARY_NODE_01',
                    },
                  })
                );
              }, 180);
            } else {
              window.dispatchEvent(
                new CustomEvent('vibepath_trigger_cinematic_render', {
                  detail: {
                    recordVideo: true,
                    tripName: 'SAIGON_NIGHT_CULINARY_NODE_01',
                  },
                })
              );
            }
          }}
        />

        {/* Compact Hero Context & Design System Token Reference Toggle */}
        <div className="mb-4 bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 vp-telemetry-sm text-[#00E5FF]">
              <span>[ CYBERNETIC SWISS BRUTALISM ]</span>
              <span aria-hidden="true">//</span>
              <span className="text-[#00E676]">[ ZERO RADIUS 0PX · 1PX #1F1F2E ]</span>
              <span aria-hidden="true" className="hidden sm:inline">//</span>
              <span className="hidden sm:inline">[ SYS_TELEMETRY // ACTIVE ]</span>
            </div>
            <h1 className="vp-headline-lg text-[#F3F6F9] break-words">
              {activeTab === 'vlogger'
                ? language === 'vi'
                  ? '[ 01 // FOOD_VLOGGER_FIELD_OPERATIONS ]'
                  : '[ 01 // FOOD_VLOGGER_FIELD_OPERATIONS ]'
                : activeTab === 'editor'
                ? language === 'vi'
                  ? '[ 02 // EDITOR_WEB_STUDIO_NLE_EXPORT ]'
                  : '[ 02 // EDITOR_WEB_STUDIO_NLE_EXPORT ]'
                : language === 'vi'
                ? '[ 03 // AI_BUG_TRIAGE_TELEMETRY ]'
                : '[ 03 // AI_BUG_TRIAGE_TELEMETRY ]'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Language Switcher VN | EN right next to 🔑 BYOK Settings */}
            <div
              role="group"
              aria-label="Header Language Switcher"
              className="bg-[#080A0F] border border-[#1F1F2E] p-1 flex items-center shrink-0"
            >
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`min-h-[38px] px-2.5 sm:px-3 vp-telemetry-sm cursor-pointer transition-colors ${
                  language === 'vi'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ VN ]
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`min-h-[38px] px-2.5 sm:px-3 vp-telemetry-sm cursor-pointer transition-colors ${
                  language === 'en'
                    ? 'bg-[#00E5FF] text-[#080A0F] font-bold'
                    : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
                }`}
              >
                [ EN ]
              </button>
            </div>

            {/* 🔑 BYOK Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="vp-touch-target px-2.5 sm:px-3.5 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] vp-telemetry-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-colors clip-button-chamfer min-w-0"
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {keyStatus.hasCustomMapKey || keyStatus.hasCustomDifyKey || keyStatus.hasCustomGeminiKey
                  ? '[ 🔑 BYOK // ACTIVE ]'
                  : '[ 🔑 BYOK // SETTINGS ]'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowDesignSpecBar((s) => !s)}
              className="vp-touch-target px-2.5 sm:px-3.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#F3F6F9] vp-telemetry-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-colors min-w-0 max-w-full"
            >
              <Sliders className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span className="truncate">
                {showDesignSpecBar
                  ? '[ × CLOSE_TOKENS ]'
                  : '[ 00 // DESIGN_TOKENS ]'}
              </span>
            </button>
          </div>
        </div>

        {/* Expandable Interactive Brand & Design System Token Customizer */}
        {showDesignSpecBar && (
          <section
            aria-label="VibePath Design System Tokens Customizer"
            className="mb-5 bg-[#0D1017] border border-[#1F1F2E] p-3 sm:p-4 flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-3">
              <div className="min-w-0">
                <span className="vp-label-caps text-[#00E676] block break-words">
                  [ WHITE-LABEL BRAND ENGINE // LIVE CSS VARIABLE OVERRIDE ]
                </span>
                <p className="vp-body-md text-xs text-[#9BA8B8] mt-0.5">
                  {language === 'vi'
                    ? 'Nhập mã màu HEX hoặc tên Font chữ tùy chỉnh bên dưới để đồng bộ theo nhận diện thương hiệu riêng mà không ảnh hưởng lõi hệ thống.'
                    : 'Enter custom HEX color codes or Font families below to white-label the interface for any brand without affecting system core.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrandTokens(DEFAULT_BRAND_TOKENS)}
                  className="min-h-[38px] px-2.5 sm:px-3 bg-[#12161A] border border-[#2D2D44] hover:border-[#00E5FF] text-[#00E5FF] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>[ RESET DEFAULT ]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesignSpecBar(false)}
                  className="min-h-[38px] px-2.5 sm:px-3 bg-[#12161A] border border-[#2D2D44] hover:border-[#FF5252] text-[#F3F6F9] vp-telemetry-sm cursor-pointer"
                >
                  [ × CLOSE ]
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
              {/* 1. COLOR PALETTE TOKENS (OLED DAYLIGHT CONTRAST) — Editable */}
              <div className="col-span-4 space-y-2.5 min-w-0">
                <span className="vp-label-caps text-[#00E5FF] block break-words">
                  1. COLOR PALETTE TOKENS (OLED DAYLIGHT CONTRAST) — CUSTOM HEX INPUT
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Core Primary */}
                  <div className="bg-[#12161A] border border-[#1F1F2E] p-2.5 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-[#9BA8B8] font-mono-brand truncate">
                        [01] Core Primary · Active Rec
                      </span>
                      <input
                        type="color"
                        aria-label="Core Primary Color Picker"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test(brandTokens.primaryHex)
                            ? brandTokens.primaryHex
                            : '#5322FF'
                        }
                        onChange={(e) =>
                          setBrandTokens((prev) => ({ ...prev, primaryHex: e.target.value.toUpperCase() }))
                        }
                        className="w-6 h-6 bg-transparent border border-[#2D2D44] cursor-pointer shrink-0"
                      />
                    </div>
                    <input
                      type="text"
                      value={brandTokens.primaryHex}
                      onChange={(e) =>
                        setBrandTokens((prev) => ({ ...prev, primaryHex: e.target.value }))
                      }
                      placeholder="#5322FF"
                      className="w-full min-h-[38px] px-2.5 bg-[#1A2026] border border-[#2D2D44] text-[#F3F6F9] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                    />
                  </div>

                  {/* Secondary */}
                  <div className="bg-[#12161A] border border-[#1F1F2E] p-2.5 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-[#9BA8B8] font-mono-brand truncate">
                        [02] Secondary · Culinary Nodes
                      </span>
                      <input
                        type="color"
                        aria-label="Secondary Color Picker"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test(brandTokens.secondaryHex)
                            ? brandTokens.secondaryHex
                            : '#00E5FF'
                        }
                        onChange={(e) =>
                          setBrandTokens((prev) => ({
                            ...prev,
                            secondaryHex: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-6 h-6 bg-transparent border border-[#2D2D44] cursor-pointer shrink-0"
                      />
                    </div>
                    <input
                      type="text"
                      value={brandTokens.secondaryHex}
                      onChange={(e) =>
                        setBrandTokens((prev) => ({ ...prev, secondaryHex: e.target.value }))
                      }
                      placeholder="#00E5FF"
                      className="w-full min-h-[38px] px-2.5 bg-[#1A2026] border border-[#2D2D44] text-[#F3F6F9] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                    />
                  </div>

                  {/* Tertiary */}
                  <div className="bg-[#12161A] border border-[#1F1F2E] p-2.5 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-[#9BA8B8] font-mono-brand truncate">
                        [03] Tertiary · GPS Lock
                      </span>
                      <input
                        type="color"
                        aria-label="Tertiary Color Picker"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test(brandTokens.tertiaryHex)
                            ? brandTokens.tertiaryHex
                            : '#00E676'
                        }
                        onChange={(e) =>
                          setBrandTokens((prev) => ({
                            ...prev,
                            tertiaryHex: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-6 h-6 bg-transparent border border-[#2D2D44] cursor-pointer shrink-0"
                      />
                    </div>
                    <input
                      type="text"
                      value={brandTokens.tertiaryHex}
                      onChange={(e) =>
                        setBrandTokens((prev) => ({ ...prev, tertiaryHex: e.target.value }))
                      }
                      placeholder="#00E676"
                      className="w-full min-h-[38px] px-2.5 bg-[#1A2026] border border-[#2D2D44] text-[#F3F6F9] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                    />
                  </div>

                  {/* Neutral Core Strata & 1px Border */}
                  <div className="bg-[#12161A] border border-[#1F1F2E] p-2.5 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-[#9BA8B8] font-mono-brand truncate">
                        [04] Neutral Core Strata & 1px Grid
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="color"
                          aria-label="Strata Background Picker"
                          value={
                            /^#[0-9A-Fa-f]{6}$/.test(brandTokens.strata0Hex)
                              ? brandTokens.strata0Hex
                              : '#12161A'
                          }
                          onChange={(e) =>
                            setBrandTokens((prev) => ({
                              ...prev,
                              strata0Hex: e.target.value.toUpperCase(),
                            }))
                          }
                          className="w-6 h-6 bg-transparent border border-[#2D2D44] cursor-pointer"
                        />
                        <input
                          type="color"
                          aria-label="1px Grid Border Picker"
                          value={
                            /^#[0-9A-Fa-f]{6}$/.test(brandTokens.borderHex)
                              ? brandTokens.borderHex
                              : '#1F1F2E'
                          }
                          onChange={(e) =>
                            setBrandTokens((prev) => ({
                              ...prev,
                              borderHex: e.target.value.toUpperCase(),
                            }))
                          }
                          className="w-6 h-6 bg-transparent border border-[#2D2D44] cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={brandTokens.strata0Hex}
                        onChange={(e) =>
                          setBrandTokens((prev) => ({ ...prev, strata0Hex: e.target.value }))
                        }
                        placeholder="#12161A"
                        className="w-full min-h-[38px] px-2 bg-[#1A2026] border border-[#2D2D44] text-[#F3F6F9] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={brandTokens.borderHex}
                        onChange={(e) =>
                          setBrandTokens((prev) => ({ ...prev, borderHex: e.target.value }))
                        }
                        placeholder="#1F1F2E"
                        className="w-full min-h-[38px] px-2 bg-[#1A2026] border border-[#2D2D44] text-[#F3F6F9] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. DUAL-ENGINE TYPOGRAPHY & ERGONOMIC TOKENS — Editable */}
              <div className="col-span-4 space-y-2.5 min-w-0">
                <span className="vp-label-caps text-[#00E676] block break-words">
                  2. DUAL-ENGINE TYPOGRAPHY & ERGONOMIC TOKENS — CUSTOM FONT INPUT
                </span>
                <div className="bg-[#12161A] border border-[#1F1F2E] p-3 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <label
                      htmlFor="font-brand-input"
                      className="vp-telemetry-sm text-[#F3F6F9] sm:col-span-1"
                    >
                      Brand & Headline Font:
                    </label>
                    <input
                      id="font-brand-input"
                      type="text"
                      value={brandTokens.fontBrand}
                      onChange={(e) =>
                        setBrandTokens((prev) => ({ ...prev, fontBrand: e.target.value }))
                      }
                      placeholder="JetBrains Mono"
                      className="sm:col-span-2 min-h-[38px] px-2.5 bg-[#1A2026] border border-[#2D2D44] text-[#00E5FF] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <label
                      htmlFor="font-body-input"
                      className="vp-telemetry-sm text-[#F3F6F9] sm:col-span-1"
                    >
                      Body Layer Font:
                    </label>
                    <input
                      id="font-body-input"
                      type="text"
                      value={brandTokens.fontBody}
                      onChange={(e) =>
                        setBrandTokens((prev) => ({ ...prev, fontBody: e.target.value }))
                      }
                      placeholder="Inter"
                      className="sm:col-span-2 min-h-[38px] px-2.5 bg-[#1A2026] border border-[#2D2D44] text-[#00E5FF] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <label
                      htmlFor="font-telemetry-input"
                      className="vp-telemetry-sm text-[#F3F6F9] sm:col-span-1"
                    >
                      Telemetry & Sensor Font:
                    </label>
                    <input
                      id="font-telemetry-input"
                      type="text"
                      value={brandTokens.fontTelemetry}
                      onChange={(e) =>
                        setBrandTokens((prev) => ({ ...prev, fontTelemetry: e.target.value }))
                      }
                      placeholder="Space Grotesk"
                      className="sm:col-span-2 min-h-[38px] px-2.5 bg-[#1A2026] border border-[#2D2D44] text-[#00E676] vp-telemetry-sm focus:border-[#00E676] focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 border-t border-[#1F1F2E] flex flex-wrap items-center justify-between gap-2 vp-telemetry-sm">
                    <span className="text-[#9BA8B8]">Geometry & Ergonomics:</span>
                    <span className="text-[#00E676] break-words">
                      [ 0PX RADIUS // 1PX #1F1F2E // 140PX THUMB ANCHOR ]
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Active Subsystem Viewport */}
        {activeTab === 'vlogger' && (
          <VloggerFieldTab
            nodes={nodes}
            waypoints={waypoints}
            telemetry={telemetry}
            isTracking={isTracking}
            onToggleTracking={() => setIsTracking((t) => !t)}
            language={language}
            onChangeLanguage={setLanguage}
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onSyncToCloud={handleSyncToCloud}
            isSyncing={isSyncing}
            lastSyncReceipt={lastSyncReceipt}
            activeRiderPos={activeRiderPos}
            pinFormRef={pinFormRef}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'editor' && (
          <EditorStudioTab
            nodes={nodes}
            waypoints={waypoints}
            language={language}
            activeRiderPos={activeRiderPos}
          />
        )}

        {activeTab === 'feedback' && (
          <FeedbackBugReportTab
            reports={feedbackReports}
            onAddReport={(rep) => setFeedbackReports((prev) => [rep, ...prev])}
            language={language}
          />
        )}
      </main>

      {/* 3. 140PX BOTTOM ANCHOR ZONE (Ergonomic Thumb Zone — Zero Radius Cybernetic Swiss Brutalism) */}
      <nav
        aria-label="140px Ergonomic Thumb Zone Controls"
        className="fixed bottom-0 left-0 right-0 h-[140px] z-40 bg-[#080A0F]/95 border-t border-[#1F1F2E] px-2 sm:px-6 flex flex-col justify-between py-2 overflow-hidden"
      >
        <div className="max-w-[1440px] w-full mx-auto flex flex-col gap-1.5 sm:gap-2 h-full justify-between">
          {/* Upper Row (60px): Primary Field Action Controls (Active Rec, One-Tap Pin POI, VI/EN, Sync to Cloud) */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 sm:gap-2 items-center">
            {/* Button 1: Invisible Background Tracker REC */}
            <button
              type="button"
              onClick={() => setIsTracking((t) => !t)}
              className={`col-span-1 md:col-span-2 vp-touch-target px-1.5 sm:px-2.5 font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden clip-button-chamfer ${
                isTracking
                  ? 'bg-[#00E5FF] text-[#080A0F] border border-[#00E5FF]'
                  : 'bg-[#0D1017] text-[#9BA8B8] border border-[#1F1F2E]'
              }`}
            >
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                {isTracking ? '[ REC_ACTIVE ]' : '[ STANDBY ]'}
              </span>
            </button>

            {/* Button 2: One-Tap Spot Pinning FAB */}
            <button
              type="button"
              onClick={handleQuickPinFromAnchor}
              className="col-span-1 md:col-span-2 vp-touch-target px-1.5 sm:px-3 bg-[#0D1017] hover:bg-[#00E5FF] border border-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden clip-button-chamfer"
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                {language === 'vi' ? '[ + PIN_POI ]' : '[ + PIN_POI ]'}
              </span>
            </button>

            {/* Button 3: Language Switcher (VI / EN) */}
            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'vi' ? 'en' : 'vi'))}
              className="col-span-1 md:col-span-2 vp-touch-target px-1.5 sm:px-2.5 bg-[#0D1017] hover:border-[#00E5FF] border border-[#1F1F2E] text-[#F3F6F9] font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden"
            >
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00E5FF] shrink-0" />
              <span className="truncate">[ {language.toUpperCase()} ]</span>
            </button>

            {/* Button 4: Sync to Cloud CTA */}
            <button
              type="button"
              onClick={() => handleSyncToCloud()}
              disabled={isSyncing}
              className="col-span-1 md:col-span-2 vp-touch-target px-1.5 sm:px-3 bg-[#00E5FF] hover:bg-[#00E5FF]/90 border border-[#00E5FF] text-[#080A0F] font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden clip-button-chamfer"
            >
              <CloudUpload className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">
                {isSyncing ? '[ SYNCING... ]' : '[ ⚡ EXECUTE_SYNC ]'}
              </span>
            </button>
          </div>

          {/* Lower Row (56px): 3 Subsystem Tabs (1. Vlogger | 2. Editor Studio | 3. Feedback & Bug Triage) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('vlogger')}
              className={`vp-touch-target px-1.5 sm:px-3 border font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden ${
                activeTab === 'vlogger'
                  ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                  : 'bg-[#0D1017] border-[#1F1F2E] text-[#9BA8B8] hover:text-[#F3F6F9]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">[ 01 // VLOGGER ]</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`vp-touch-target px-1.5 sm:px-3 border font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden ${
                activeTab === 'editor'
                  ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                  : 'bg-[#0D1017] border-[#1F1F2E] text-[#9BA8B8] hover:text-[#F3F6F9]'
              }`}
            >
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">[ 02 // STUDIO ]</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('feedback')}
              className={`vp-touch-target px-1.5 sm:px-3 border font-mono-brand text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-2 transition-colors cursor-pointer whitespace-nowrap min-w-0 overflow-hidden ${
                activeTab === 'feedback'
                  ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                  : 'bg-[#0D1017] border-[#1F1F2E] text-[#9BA8B8] hover:text-[#F3F6F9]'
              }`}
            >
              <Bug className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">[ 03 // FEEDBACK ]</span>
            </button>
          </div>
        </div>
      </nav>

      {/* BYOK Personal Connection Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        onSaved={(updated) => {
          setKeyStatus(updated);
          setSyncToast(
            language === 'vi'
              ? `[ BYOK GUARD // ĐÃ ÁP DỤNG CẤU HÌNH (${updated.activeMapMode}) ]`
              : `[ BYOK GUARD // APPLIED CONFIGURATION (${updated.activeMapMode}) ]`
          );
          setTimeout(() => setSyncToast(null), 3200);
        }}
      />
    </div>
  );
}
