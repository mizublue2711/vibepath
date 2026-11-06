import React, { useEffect, useState } from 'react';
import { FlightStageUpdate } from '../services/cinematicFlightEngine';
import { LanguageCode, SubsystemTab } from '../data/vibePathData';
import { CloudUpload, Film, Sliders, MapPin, Bug } from 'lucide-react';

export interface HUDProps {
  tripName: string;
  isSyncing: boolean;
  onSync: () => void;
  onTriggerCinematicRender?: () => void;
  activeTab?: SubsystemTab;
  onChangeTab?: (tab: SubsystemTab) => void;
  language?: LanguageCode;
  onChangeLanguage?: (lang: LanguageCode) => void;
  onToggleQuickSettings?: () => void;
  isQuickSettingsOpen?: boolean;
  accuracyM?: number;
  districtLabel?: string;
}

export const SwissBrutalistHUD: React.FC<HUDProps> = ({
  tripName,
  isSyncing,
  onSync,
  onTriggerCinematicRender,
  activeTab = 'vlogger',
  onChangeTab,
  language = 'vi',
  onChangeLanguage,
  onToggleQuickSettings,
  isQuickSettingsOpen = false,
  accuracyM = 1.2,
  districtLabel = 'District 1, Ben Thanh',
}) => {
  const [flightStatus, setFlightStatus] = useState<FlightStageUpdate | null>(null);
  const [lastExportFile, setLastExportFile] = useState<string | null>(null);

  useEffect(() => {
    const handleStageEvent = (e: Event) => {
      const custom = e as CustomEvent<FlightStageUpdate | null>;
      setFlightStatus(custom.detail || null);
    };

    const handleCompleteEvent = (e: Event) => {
      const custom = e as CustomEvent<{ filename?: string } | null>;
      if (custom.detail?.filename) {
        setLastExportFile(custom.detail.filename);
        window.setTimeout(() => setLastExportFile(null), 5000);
      }
    };

    window.addEventListener('vibepath_cinematic_status', handleStageEvent);
    window.addEventListener('vibepath_cinematic_complete', handleCompleteEvent);
    return () => {
      window.removeEventListener('vibepath_cinematic_status', handleStageEvent);
      window.removeEventListener('vibepath_cinematic_complete', handleCompleteEvent);
    };
  }, []);

  const isRenderingCinematic = Boolean(flightStatus?.isRecording);

  const handleCinematicClick = () => {
    if (onTriggerCinematicRender) {
      onTriggerCinematicRender();
    } else {
      window.dispatchEvent(
        new CustomEvent('vibepath_trigger_cinematic_render', {
          detail: {
            recordVideo: true,
            tripName: tripName || 'SAIGON_NIGHT_CULINARY_NODE_01',
          },
        })
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#080A0F]/95 backdrop-blur-sm border-b border-[#1F1F2E] text-[#F3F6F9] select-none mb-3">
      {/* 1. Single Clean High-Tech Top Status Pill */}
      <div className="w-full bg-[#0D1017] border-b border-[#1F1F2E] px-3 sm:px-6 py-1.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs font-mono-brand">
          <div
            role="status"
            aria-label="System Status Pill"
            className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[#F3F6F9] font-semibold tracking-tight"
          >
            <span className="text-[#00E676] font-bold">
              [🟢 GPS Locked • ±{accuracyM.toFixed(1)}m]
            </span>
            <span className="text-[#9BA8B8]">|</span>
            <span className="text-[#00E5FF] font-bold">[{districtLabel}]</span>
            <span className="text-[#9BA8B8]">|</span>
            <span className="text-[#F3F6F9] font-bold">[4K 60FPS Sync Ready]</span>
          </div>

          {lastExportFile && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-[#080A0F] border border-[#00E676] text-[#00E676] truncate">
              Exported: {lastExportFile}
            </span>
          )}
        </div>
      </div>

      {/* 2. Sticky Header HUD Controls: Segmented Switcher, Language Toggle (VN | EN), Quick Settings Drawer & Sync */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Segmented Switcher: Field Tracker View vs. Editor Studio */}
        <div
          role="tablist"
          aria-label="Workspace View Switcher"
          className="bg-[#0D1017] border border-[#1F1F2E] p-1 flex items-center gap-1 flex-wrap"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vlogger'}
            onClick={() => onChangeTab?.('vlogger')}
            className={`min-h-[36px] px-3 text-xs font-mono-brand font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'vlogger'
                ? 'bg-[#00E5FF] text-[#080A0F]'
                : 'text-[#F3F6F9] hover:text-[#00E5FF]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Field Tracker View</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'editor'}
            onClick={() => onChangeTab?.('editor')}
            className={`min-h-[36px] px-3 text-xs font-mono-brand font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'editor'
                ? 'bg-[#00E5FF] text-[#080A0F]'
                : 'text-[#F3F6F9] hover:text-[#00E5FF]'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>Editor Studio</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feedback'}
            onClick={() => onChangeTab?.('feedback')}
            className={`min-h-[36px] px-2.5 text-xs font-mono-brand font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'feedback'
                ? 'bg-[#00E5FF] text-[#080A0F]'
                : 'text-[#9BA8B8] hover:text-[#F3F6F9]'
            }`}
            title="AI Bug Triage & Field Feedback"
          >
            <Bug className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Feedback</span>
          </button>
        </div>

        {/* Right Controls: Language Toggle (VN | EN), Quick Settings Drawer Trigger, Cinematic Render & Sync to Cloud */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Toggle (VN | EN) */}
          <div
            role="group"
            aria-label="Language Toggle"
            className="bg-[#0D1017] border border-[#1F1F2E] p-0.5 flex items-center"
          >
            <button
              type="button"
              onClick={() => onChangeLanguage?.('vi')}
              className={`min-h-[34px] px-2.5 text-xs font-mono-brand font-bold cursor-pointer transition-colors ${
                language === 'vi'
                  ? 'bg-[#00E5FF] text-[#080A0F]'
                  : 'text-[#F3F6F9] hover:text-[#00E5FF]'
              }`}
            >
              VN
            </button>
            <span className="text-[#1F1F2E] px-0.5">|</span>
            <button
              type="button"
              onClick={() => onChangeLanguage?.('en')}
              className={`min-h-[34px] px-2.5 text-xs font-mono-brand font-bold cursor-pointer transition-colors ${
                language === 'en'
                  ? 'bg-[#00E5FF] text-[#080A0F]'
                  : 'text-[#F3F6F9] hover:text-[#00E5FF]'
              }`}
            >
              EN
            </button>
          </div>

          {/* Quick Settings Drawer Trigger */}
          {onToggleQuickSettings && (
            <button
              type="button"
              onClick={onToggleQuickSettings}
              className={`min-h-[36px] px-3 border text-xs font-mono-brand font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isQuickSettingsOpen
                  ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                  : 'bg-[#0D1017] border-[#1F1F2E] hover:border-[#00E5FF] text-[#F3F6F9]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>Quick Settings</span>
            </button>
          )}

          {/* 1-Click 3D Render */}
          <button
            type="button"
            onClick={handleCinematicClick}
            className={`clip-button-chamfer min-h-[36px] px-3.5 font-mono-brand font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isRenderingCinematic
                ? 'bg-[#00E676] text-[#080A0F] border border-[#00E676]'
                : 'bg-[#0D1017] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#080A0F] border border-[#00E5FF]'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isRenderingCinematic ? 'Recording 4K 60FPS...' : 'Cinematic Render'}
            </span>
          </button>

          {/* Sync to Cloud CTA */}
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`clip-button-chamfer min-h-[36px] px-4 font-mono-brand font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSyncing
                ? 'bg-[#1F1F2E] text-[#9BA8B8] border border-[#2D2D44] cursor-not-allowed'
                : 'bg-[#00E5FF] text-[#080A0F] hover:opacity-90 border border-[#00E5FF]'
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5 shrink-0" />
            <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
