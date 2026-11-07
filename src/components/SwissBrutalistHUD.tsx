import React, { useEffect, useState } from 'react';
import { FlightStageUpdate } from '../services/cinematicFlightEngine';
import { SubsystemTab } from '../data/vibePathData';
import { useTranslation, LanguageCode } from '../context/LanguageContext';
import { CloudUpload, Film, Sliders, MapPin, Bug, HelpCircle } from 'lucide-react';

export interface NavigationProps {
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
  onOpenGuide?: () => void;
}

export type HUDProps = NavigationProps;

export const SwissBrutalistHUD: React.FC<NavigationProps> = ({
  tripName,
  isSyncing,
  onSync,
  onTriggerCinematicRender,
  activeTab = 'vlogger',
  onChangeTab,
  language,
  onChangeLanguage,
  onToggleQuickSettings,
  isQuickSettingsOpen = false,
  accuracyM = 1.2,
  districtLabel = 'District 1, Ben Thanh',
  onOpenGuide,
}) => {
  const { lang, setLang, t } = useTranslation();
  const currentLang = language || lang;

  const handleLanguageChange = (nextLang: LanguageCode) => {
    setLang(nextLang);
    onChangeLanguage?.(nextLang);
  };

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
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#05050A]/95 backdrop-blur-sm border-b border-[#1F1F2E] text-[#F3F6F9] select-none mb-3 rounded-none shadow-none">
      {/* 1. Single Clean High-Tech Top Status Pill */}
      <div className="w-full bg-[#0D0E17] border-b border-[#1F1F2E] px-3 sm:px-6 py-1.5 rounded-none">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs font-mono-brand">
          <div
            role="status"
            aria-label={t('nav.systemStatus')}
            className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[#F3F6F9] font-semibold tracking-tight"
          >
            <span className="text-[#00FF66] font-bold">
              [🟢 {t('nav.gpsLocked')} • ±{accuracyM.toFixed(1)}m]
            </span>
            <span className="text-[#8A8FA3]">|</span>
            <span className="text-[#00E5FF] font-bold">[{districtLabel}]</span>
            <span className="text-[#8A8FA3]">|</span>
            <span className="text-white font-bold">[{t('nav.syncReady')}]</span>
          </div>

          {lastExportFile && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-[#05050A] border border-[#00FF66] text-[#00FF66] rounded-none">
              {t('nav.exported')}: {lastExportFile}
            </span>
          )}
        </div>
      </div>

      {/* 2. Sticky Header HUD Controls: Segmented Switcher, Language Toggle (VN | EN), Quick Settings Drawer & Sync */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Segmented Switcher: Field Tracker View vs. Editor Studio vs. Feedback */}
        <div
          role="tablist"
          aria-label={t('nav.workspaceSwitcher')}
          className="bg-[#0D0E17] border border-[#1F1F2E] p-1 flex items-center gap-1 flex-wrap rounded-none shadow-none"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vlogger'}
            onClick={() => onChangeTab?.('vlogger')}
            className={`min-h-[34px] px-3 border border-[#1F1F2E] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors rounded-none shadow-none ${
              activeTab === 'vlogger'
                ? 'bg-[#05050A] text-white border-b-2 border-b-[#00E5FF]'
                : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white hover:border-[#00E5FF]'
            }`}
          >
            <MapPin
              className={`w-3.5 h-3.5 shrink-0 ${
                activeTab === 'vlogger' ? 'text-[#00E5FF]' : 'text-[#8A8FA3]'
              }`}
            />
            <span>{t('nav.fieldTracker')}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'editor'}
            onClick={() => onChangeTab?.('editor')}
            className={`min-h-[34px] px-3 border border-[#1F1F2E] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors rounded-none shadow-none ${
              activeTab === 'editor'
                ? 'bg-[#05050A] text-white border-b-2 border-b-[#00E5FF]'
                : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white hover:border-[#00E5FF]'
            }`}
          >
            <Film
              className={`w-3.5 h-3.5 shrink-0 ${
                activeTab === 'editor' ? 'text-[#00E5FF]' : 'text-[#8A8FA3]'
              }`}
            />
            <span>{t('nav.editorStudio')}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feedback'}
            onClick={() => onChangeTab?.('feedback')}
            className={`min-h-[34px] px-2.5 border border-[#1F1F2E] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors rounded-none shadow-none ${
              activeTab === 'feedback'
                ? 'bg-[#05050A] text-white border-b-2 border-b-[#00E5FF]'
                : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white hover:border-[#00E5FF]'
            }`}
            title={t('nav.feedbackTitle')}
          >
            <Bug
              className={`w-3.5 h-3.5 shrink-0 ${
                activeTab === 'feedback' ? 'text-[#00E5FF]' : 'text-[#8A8FA3]'
              }`}
            />
            <span>{t('nav.feedback')}</span>
          </button>
        </div>

        {/* Right Controls: Language Toggle (VN | EN), Quick Settings Drawer Trigger, Cinematic Render & Sync to Cloud */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Toggle (VN | EN) */}
          <div
            role="group"
            aria-label={t('nav.languageToggle')}
            className="bg-[#0D0E17] border border-[#1F1F2E] p-0.5 flex items-center rounded-none"
          >
            <button
              type="button"
              onClick={() => handleLanguageChange('vi')}
              className={`min-h-[32px] px-2.5 font-mono text-xs font-bold cursor-pointer transition-colors rounded-none ${
                currentLang === 'vi'
                  ? 'bg-[#05050A] text-white border-b-2 border-b-[#00E5FF]'
                  : 'text-[#8A8FA3] hover:text-white'
              }`}
            >
              VN
            </button>
            <span className="text-[#1F1F2E] px-0.5">|</span>
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`min-h-[32px] px-2.5 font-mono text-xs font-bold cursor-pointer transition-colors rounded-none ${
                currentLang === 'en'
                  ? 'bg-[#05050A] text-white border-b-2 border-b-[#00E5FF]'
                  : 'text-[#8A8FA3] hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Persistent Guide Button */}
          <button
            type="button"
            onClick={() => onOpenGuide?.()}
            className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#8A8FA3] hover:text-[#00E5FF] font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
            title={t('onboarding.title')}
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[#00E5FF]" />
            <span>{t('onboarding.guideButton')}</span>
          </button>

          {/* Quick Settings Drawer Trigger */}
          {onToggleQuickSettings && (
            <button
              type="button"
              onClick={onToggleQuickSettings}
              className={`min-h-[34px] px-3 bg-[#0D0E17] border font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none ${
                isQuickSettingsOpen
                  ? 'border-[#00E5FF] text-white'
                  : 'border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>{t('nav.quickSettings')}</span>
            </button>
          )}

          {/* 1-Click 3D Render (subtle glowing cyan border and shadow without over-saturation) */}
          <button
            type="button"
            onClick={handleCinematicClick}
            className={`min-h-[34px] px-3.5 bg-[#0D0E17] border font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer rounded-none ${
              isRenderingCinematic
                ? 'border-[#00FF66] text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.35)]'
                : 'border-[#00E5FF] text-white shadow-[0_0_12px_rgba(0,229,255,0.35)] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_16px_rgba(0,229,255,0.5)]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span>
              {isRenderingCinematic ? t('nav.recordingCinematic') : t('nav.cinematicRender')}
            </span>
          </button>

          {/* Sync to Cloud CTA */}
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`min-h-[34px] px-4 bg-[#0D0E17] border font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer rounded-none ${
              isSyncing
                ? 'border-[#1F1F2E] text-[#8A8FA3] cursor-not-allowed'
                : 'border-[#00E5FF] text-white hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)]'
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span>{isSyncing ? t('nav.syncing') : t('nav.syncToCloud')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export const Navigation = SwissBrutalistHUD;
