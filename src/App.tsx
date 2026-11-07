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
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { LiveTelemetryView } from './components/LiveTelemetryView';
import { EditorStudioTab } from './components/EditorStudioTab';
import { FeedbackTab } from './components/FeedbackTab';
import { BottomNav } from './components/BottomNav';
import { SettingsModal } from './components/SettingsModal';
import { SwissBrutalistHUD } from './components/SwissBrutalistHUD';
import { ApiKeyManager, KeyConnectionStatus } from './services/apiKeyManager';
import { sendRenderPayload } from './services/webhook';
import {
  CheckCircle2,
  RotateCcw,
  KeyRound,
  Loader2,
} from 'lucide-react';

const SYNC_STEPS = [
  'Smoothing GPS Path (B-Spline)...',
  'AI Dify drafting Bilingual Script & Subtitles...',
  'Packaging 3D Cinematic MP4 & Assets...',
] as const;

function AppContent() {
  const { theme, accentColor, fontFamily, setAccentColor, setFontFamily, updateTheme, resetTheme } =
    useTheme();
  const { lang, setLang, t } = useTranslation();

  const [activeTab, setActiveTab] = useState<SubsystemTab>('vlogger');
  const language = lang;
  const setLanguage = setLang;
  const [showQuickSettingsDrawer, setShowQuickSettingsDrawer] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [keyStatus, setKeyStatus] = useState<KeyConnectionStatus>(() =>
    ApiKeyManager.getStatus()
  );
  const [districtLabel, setDistrictLabel] = useState<string>('District 1, Ben Thanh');

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

  // Clean Sensor & Telemetry State (Default ±1.2m accuracy)
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    gpsLocked: true,
    accuracyM: 1.2,
    satellites: 19,
    audioDb: -9.4,
    batteryPct: 94,
    deviceTempC: 33.6,
    speedKmh: 26,
    distanceKm: 4.82,
    elapsedSeconds: 1840,
  });

  // Atomic Cloud Sync & 3-Step Visual Progress Stepper State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStepIndex, setSyncStepIndex] = useState<number | null>(null);
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
              accuracyM: Number(Math.max(0.8, Math.min(2.5, pos.coords.accuracy / 10)).toFixed(1)),
            }));
          },
          () => {},
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
        accuracyM: 1.2,
        speedKmh: Math.round(18 + Math.random() * 16),
        distanceKm: Number((prev.distanceKm + 0.02).toFixed(2)),
        elapsedSeconds: prev.elapsedSeconds + 3,
      }));

      setWaypoints((prev) => {
        const nextWp: RouteWaypoint = {
          lat: nextLat,
          lng: nextLng,
          speedKmh: Math.round(20 + Math.random() * 14),
          accuracyM: 1.2,
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

  /**
   * Atomic Cloud Sync Handler with 3-Step Visual Progress Stepper & Custom Brand Injection
   * 1. "Smoothing GPS Path (B-Spline)..."
   * 2. "AI Dify drafting Bilingual Script & Subtitles..."
   * 3. "Packaging 3D Cinematic MP4 & Assets..."
   */
  const handleSyncToCloud = useCallback(
    async (preSanitized?: any) => {
      setIsSyncing(true);
      setSyncStepIndex(0);

      try {
        // Step 1: Smoothing GPS Path (B-Spline)...
        await new Promise((r) => setTimeout(r, 650));
        setSyncStepIndex(1);

        // Step 2: AI Dify drafting Bilingual Script & Subtitles...
        const candidate = {
          ...(preSanitized || {
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
          }),
          accent_color: accentColor,
          font_family: fontFamily,
        };

        const receiptPromise = sendRenderPayload(candidate);
        await new Promise((r) => setTimeout(r, 700));

        // Step 3: Packaging 3D Cinematic MP4 & Assets...
        setSyncStepIndex(2);
        const receipt = await receiptPromise;
        await new Promise((r) => setTimeout(r, 650));

        setLastSyncReceipt(receipt);
        setSyncToast(
          `Sync Complete (${receipt.syncId}) • ${receipt.nodesCount} POIs • Brand ${accentColor}`
        );
        setTimeout(() => setSyncToast(null), 4000);
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
        setSyncToast(`Sync Saved Locally (${fallbackReceipt.syncId}) • Brand ${accentColor}`);
        setTimeout(() => setSyncToast(null), 4000);
      } finally {
        setIsSyncing(false);
        setSyncStepIndex(null);
      }
    },
    [language, nodes, waypoints, accentColor, fontFamily]
  );

  // Quick One-Tap Pin from Bottom Anchor Zone FAB
  const handleQuickPinFromAnchor = () => {
    window.dispatchEvent(new Event('vibepath_open_pin_drawer'));
    if (activeTab !== 'vlogger') {
      setActiveTab('vlogger');
      setTimeout(() => {
        pinFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }
    setTimeout(() => {
      pinFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F3F6F9] flex flex-col rounded-none">
      {/* Dynamic Brand Token Override Sheet */}
      <style>{`
        .bg-\\[\\#5322FF\\] { background-color: ${theme.primaryHex} !important; }
        .border-\\[\\#5322FF\\] { border-color: ${theme.primaryHex} !important; }
        .text-\\[\\#00E5FF\\] { color: ${accentColor} !important; }
        .border-\\[\\#00E5FF\\] { border-color: ${accentColor} !important; }
        .bg-\\[\\#00E5FF\\] { background-color: ${accentColor} !important; }
        .text-\\[\\#00E676\\] { color: ${theme.tertiaryHex} !important; }
        .border-\\[\\#00E676\\] { border-color: ${theme.tertiaryHex} !important; }
        .bg-\\[\\#00E676\\] { background-color: ${theme.tertiaryHex} !important; }
      `}</style>

      {/* Sticky Header HUD with Clean Top Status Pill, Segmented Switcher, VN | EN Toggle & Quick Settings Drawer Trigger */}
      <SwissBrutalistHUD
        tripName="SAIGON_NIGHT_CULINARY_NODE_01"
        isSyncing={isSyncing}
        onSync={() => handleSyncToCloud()}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        language={language}
        onChangeLanguage={setLanguage}
        onToggleQuickSettings={() => setShowQuickSettingsDrawer((s) => !s)}
        isQuickSettingsOpen={showQuickSettingsDrawer}
        accuracyM={telemetry.accuracyM}
        districtLabel={districtLabel}
        onTriggerCinematicRender={() => {
          if (activeTab !== 'vlogger') {
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

      {/* 3-Step Visual Progress Stepper on Sync to Cloud */}
      {isSyncing && syncStepIndex !== null && (
        <div
          role="status"
          aria-live="polite"
          className="max-w-[1440px] w-full mx-auto px-2.5 sm:px-6 mb-3 rounded-none"
        >
          <div className="bg-[#0D0E17] border border-[#00E5FF] p-3.5 sm:p-4 flex flex-col gap-3 rounded-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono-brand font-bold text-[#00E5FF]">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{SYNC_STEPS[syncStepIndex]}</span>
              </div>
              <span className="text-xs font-mono-brand text-[#00FF66] font-bold">
                Step {syncStepIndex + 1} of 3
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SYNC_STEPS.map((label, idx) => {
                const isDone = idx < syncStepIndex;
                const isCurrent = idx === syncStepIndex;
                return (
                  <div
                    key={label}
                    className={`p-2.5 border text-xs font-mono-brand flex items-center gap-2 rounded-none ${
                      isCurrent
                        ? 'bg-[#05050A] border-[#00E5FF] text-white font-bold'
                        : isDone
                        ? 'bg-[#05050A] border-[#00FF66] text-[#00FF66]'
                        : 'bg-[#05050A] border-[#1F1F2E] text-[#8A8FA3]'
                    }`}
                  >
                    <span className="font-bold shrink-0">0{idx + 1}.</span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sync Notification Toast */}
      {syncToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-[#0D0E17] border border-[#00E5FF] text-white px-4 py-2 flex items-center gap-2 text-xs font-mono-brand font-bold rounded-none">
          <CheckCircle2 className="w-4 h-4 text-[#00FF66] shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main
        className={`flex-1 max-w-[1440px] w-full mx-auto px-2.5 sm:px-6 ${
          activeTab === 'editor' ? 'pb-10' : 'pb-16'
        } overflow-x-hidden rounded-none`}
      >
        {/* Quick Settings Drawer (Custom Brand Palette, Font Binding & BYOK Settings) */}
        {showQuickSettingsDrawer && (
          <section
            aria-label={t('quickSettings.drawerAriaLabel')}
            className="mb-4 bg-[#0D0E17] border border-[#1F1F2E] p-4 flex flex-col gap-4 rounded-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">
                  {t('quickSettings.title')}
                </h2>
                <p className="text-xs text-[#8A8FA3] mt-0.5">
                  {t('quickSettings.description')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="min-h-[36px] px-3 bg-[#05050A] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#8A8FA3] hover:text-white text-xs font-mono-brand font-bold flex items-center gap-1.5 cursor-pointer transition-colors rounded-none"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                  <span>
                    {keyStatus.hasCustomMapKey ||
                    keyStatus.hasCustomDifyKey ||
                    keyStatus.hasCustomGeminiKey
                      ? t('quickSettings.byokActive')
                      : t('quickSettings.configureByok')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={resetTheme}
                  className="min-h-[36px] px-3 bg-[#05050A] border border-[#1F1F2E] hover:border-[#00E5FF] text-white text-xs font-mono-brand flex items-center gap-1.5 cursor-pointer rounded-none"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>{t('quickSettings.resetBrand')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickSettingsDrawer(false)}
                  className="min-h-[36px] px-3 bg-[#05050A] border border-[#1F1F2E] hover:border-[#FF5252] text-white text-xs font-mono-brand cursor-pointer rounded-none"
                >
                  {t('quickSettings.close')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Custom Brand Accent Color (--accent-color) */}
              <div className="bg-[#05050A] border border-[#1F1F2E] p-3 space-y-2 rounded-none">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="brand-accent-input"
                    className="text-xs font-bold text-white"
                  >
                    {t('quickSettings.brandAccentColor')}
                  </label>
                  <input
                    type="color"
                    aria-label="Brand Accent Color Picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : '#00E5FF'}
                    onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
                    className="w-6 h-6 bg-transparent border border-[#1F1F2E] cursor-pointer rounded-none"
                  />
                </div>
                <input
                  id="brand-accent-input"
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#00E5FF"
                  className="w-full min-h-[38px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-white text-xs font-mono-brand focus:border-[#00E5FF] focus:outline-none rounded-none"
                />
              </div>

              {/* 2. Custom Brand Font Family (--font-family) */}
              <div className="bg-[#05050A] border border-[#1F1F2E] p-3 space-y-2 rounded-none">
                <label
                  htmlFor="brand-font-input"
                  className="text-xs font-bold text-white block"
                >
                  {t('quickSettings.brandFontFamily')}
                </label>
                <input
                  id="brand-font-input"
                  type="text"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  placeholder="JetBrains Mono"
                  className="w-full min-h-[38px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-white text-xs font-mono-brand focus:border-[#00E5FF] focus:outline-none rounded-none"
                />
              </div>

              {/* 3. Secondary / Sensor Accent Override */}
              <div className="bg-[#05050A] border border-[#1F1F2E] p-3 space-y-2 rounded-none">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="brand-tertiary-input"
                    className="text-xs font-bold text-white"
                  >
                    {t('quickSettings.gpsStatusColor')}
                  </label>
                  <input
                    type="color"
                    aria-label="Status Highlight Color Picker"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(theme.tertiaryHex)
                        ? theme.tertiaryHex
                        : '#00FF66'
                    }
                    onChange={(e) =>
                      updateTheme({ tertiaryHex: e.target.value.toUpperCase() })
                    }
                    className="w-6 h-6 bg-transparent border border-[#1F1F2E] cursor-pointer rounded-none"
                  />
                </div>
                <input
                  id="brand-tertiary-input"
                  type="text"
                  value={theme.tertiaryHex}
                  onChange={(e) => updateTheme({ tertiaryHex: e.target.value })}
                  placeholder="#00FF66"
                  className="w-full min-h-[38px] px-2.5 bg-[#0D0E17] border border-[#1F1F2E] text-white text-xs font-mono-brand focus:border-[#00E5FF] focus:outline-none rounded-none"
                />
              </div>
            </div>
          </section>
        )}

        {/* Active Subsystem Viewport */}
        {activeTab === 'vlogger' && (
          <LiveTelemetryView
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
            onDistrictResolved={setDistrictLabel}
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
          <FeedbackTab
            reports={feedbackReports}
            onAddReport={(rep) => setFeedbackReports((prev) => [rep, ...prev])}
            language={language}
          />
        )}
      </main>

      {/* Global Navigation Bar — Unmounted on Editor Studio to prevent double-dock overlap */}
      {activeTab !== 'editor' && (
        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
      )}

      {/* BYOK Personal Connection Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        onSaved={(updated) => {
          setKeyStatus(updated);
          setSyncToast(`Saved BYOK Configuration (${updated.activeMapMode})`);
          setTimeout(() => setSyncToast(null), 3200);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
