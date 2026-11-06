import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Swords, 
  MapPin, 
  Calendar, 
  Users, 
  Skull, 
  Sparkles, 
  BookOpen, 
  ExternalLink, 
  Quote, 
  Award,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Shield,
  Castle,
  Ship,
  Waves,
  Zap,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Headphones,
  FastForward,
  SkipForward,
  Loader2
} from 'lucide-react';
import { Battle, Commander, GeminiVoiceName } from '../types';
import { getBattleEventType, EVENT_TYPE_CONFIGS } from '../utils/markerIcons';
import { HighlightableText } from './HighlightableText';
import { geminiTts } from '../services/geminiTtsService';

interface CommanderCardProps {
  commander: Commander;
  faction: 'union' | 'confederate';
}

const CommanderCard: React.FC<CommanderCardProps> = ({ commander, faction }) => {
  const [hasImgError, setHasImgError] = useState(false);

  useEffect(() => {
    setHasImgError(false);
  }, [commander.name, commander.portraitUrl]);

  const isUnion = faction === 'union';
  const borderColor = isUnion ? 'border-[#3e5672]/30' : 'border-[#a65d50]/30';
  const rankColor = isUnion ? 'text-[#3e5672]' : 'text-[#a65d50]';
  const badgeBg = isUnion ? 'bg-[#3e5672] text-[#f5f2ed]' : 'bg-[#a65d50] text-[#f5f2ed]';

  return (
    <div className={`p-3 rounded-xl bg-[#f5f2ed] border ${borderColor} flex items-start gap-3 shadow-xs`}>
      {commander.portraitUrl && !hasImgError ? (
        <img
          src={commander.portraitUrl}
          alt={commander.name}
          referrerPolicy="no-referrer"
          onError={() => setHasImgError(true)}
          className="w-12 h-12 rounded-lg object-cover border border-[#d1c2ab] shrink-0 shadow-xs bg-[#ebe6db]"
        />
      ) : (
        <div 
          className={`w-12 h-12 rounded-lg ${badgeBg} border border-[#d1c2ab] flex flex-col items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
          title={`${commander.name} (${commander.rank})`}
        >
          <span className="font-serif text-sm leading-none">
            {commander.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('')}
          </span>
          <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5">
            {isUnion ? 'USA' : 'CSA'}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-[#3d322a] leading-tight font-serif">{commander.name}</div>
        <div className={`text-[10px] font-semibold ${rankColor} uppercase tracking-wider`}>{commander.rank}</div>
        <p className="text-[11px] text-[#5c4d3e] mt-1 leading-snug line-clamp-3">{commander.bioSnippet}</p>
      </div>
    </div>
  );
};

export type SheetSnapState = 'closed' | 'peek' | 'half' | 'full';

export interface BattleDetailsDrawerProps {
  battle: Battle | null;
  onClose: () => void;
  onAskHistorian: (battle: Battle) => void;
  snapState?: SheetSnapState;
  onSnapChange?: (snap: SheetSnapState) => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
  // Shared Tour & Gemini Read Synchronization
  isGeminiReadEnabled?: boolean;
  onToggleGeminiRead?: (enabled: boolean) => void;
  isPlayingTour?: boolean;
  propIsReading?: boolean;
  propIsPaused?: boolean;
  propIsLoadingAudio?: boolean;
  propActiveSectionId?: string | null;
  propActiveCharIndex?: number;
  propSelectedVoice?: GeminiVoiceName;
  propReadingSpeed?: number;
  activeSectionId?: string | null;
  activeCharIndex?: number;
  selectedVoice?: GeminiVoiceName;
  onSelectVoice?: (voice: GeminiVoiceName) => void;
  readingSpeed?: number;
  onChangeSpeed?: (speed: number) => void;
  onPlayOperationalOverview?: () => void;
  onPauseReading?: () => void;
  onResumeReading?: () => void;
  onStopReading?: () => void;
}

interface NarrativeSection {
  id: string;
  title: string;
  text: string;
}

export type { GeminiVoiceName };

export const BattleDetailsDrawer: React.FC<BattleDetailsDrawerProps> = ({
  battle,
  onClose,
  onAskHistorian,
  snapState,
  onSnapChange,
  isDesktopCollapsed,
  onToggleDesktopCollapse,
  isGeminiReadEnabled = false,
  onToggleGeminiRead,
  isPlayingTour = false,
  propIsReading,
  propIsPaused,
  propIsLoadingAudio,
  activeSectionId: rawActiveSectionId,
  propActiveSectionId,
  activeCharIndex: rawActiveCharIndex,
  propActiveCharIndex,
  selectedVoice: rawSelectedVoice,
  propSelectedVoice,
  onSelectVoice,
  readingSpeed: rawReadingSpeed,
  propReadingSpeed,
  onChangeSpeed,
  onPlayOperationalOverview,
  onPauseReading,
  onResumeReading,
  onStopReading,
}) => {
  const [internalSnap, setInternalSnap] = useState<SheetSnapState>('peek');
  const [internalDesktopCollapsed, setInternalDesktopCollapsed] = useState<boolean>(false);

  const activeSnap = snapState !== undefined ? snapState : internalSnap;
  const setSnap = onSnapChange || setInternalSnap;

  const isCollapsed = isDesktopCollapsed !== undefined ? isDesktopCollapsed : internalDesktopCollapsed;
  const toggleDesktopCollapse = onToggleDesktopCollapse || (() => setInternalDesktopCollapsed((prev) => !prev));

  const [imgError, setImgError] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!battle) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [battle, onClose]);

  // Reader Assistant Audio State with Gemini TTS
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoiceName>('Zephyr');
  const [showVoicePicker, setShowVoicePicker] = useState<boolean>(false);
  const [readingSpeed, setReadingSpeed] = useState<number>(1.0);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeCharIndex, setActiveCharIndex] = useState<number>(0);
  const [currentSectionQueueIndex, setCurrentSectionQueueIndex] = useState<number>(0);

  // Build the list of narrative speech sections for this battle
  const narrativeSections: NarrativeSection[] = useMemo(() => {
    if (!battle) return [];

    const u = battle.casualties.union;
    const c = battle.casualties.confederate;
    const casText = `Total casualties reached ${battle.totalCasualties.toLocaleString()} fallen. Union losses totaled ${u.total.toLocaleString()}, including ${u.killed.toLocaleString()} killed. Confederate losses totaled ${c.total.toLocaleString()}, including ${c.killed.toLocaleString()} killed.`;

    const sections: NarrativeSection[] = [
      {
        id: 'overview',
        title: 'Operational Overview',
        text: battle.summary,
      },
      {
        id: 'casualties',
        title: 'Casualty Report',
        text: casText,
      },
      {
        id: 'significance',
        title: 'Strategic Significance',
        text: battle.strategicSignificance,
      },
    ];

    if (battle.primaryQuote?.text) {
      sections.push({
        id: 'quote',
        title: 'Eyewitness Quote',
        text: battle.primaryQuote.text,
      });
    }

    if (battle.tacticalOverview && battle.tacticalOverview.length > 0) {
      battle.tacticalOverview.forEach((phaseText, idx) => {
        sections.push({
          id: `phase-${idx}`,
          title: `Phase ${idx + 1}`,
          text: phaseText,
        });
      });
    }

    return sections;
  }, [battle]);

  const effectiveIsReading = propIsReading !== undefined ? propIsReading : isReading;
  const effectiveIsPaused = propIsPaused !== undefined ? propIsPaused : isPaused;
  const effectiveIsLoadingAudio = propIsLoadingAudio !== undefined ? propIsLoadingAudio : isLoadingAudio;
  const effectiveActiveSectionId = propActiveSectionId !== undefined ? propActiveSectionId : (rawActiveSectionId !== undefined ? rawActiveSectionId : activeSectionId);
  const effectiveActiveCharIndex = propActiveCharIndex !== undefined ? propActiveCharIndex : (rawActiveCharIndex !== undefined ? rawActiveCharIndex : activeCharIndex);
  const effectiveSelectedVoice = propSelectedVoice !== undefined ? propSelectedVoice : (rawSelectedVoice !== undefined ? rawSelectedVoice : selectedVoice);
  const effectiveReadingSpeed = propReadingSpeed !== undefined ? propReadingSpeed : (rawReadingSpeed !== undefined ? rawReadingSpeed : readingSpeed);

  // Clean up and stop speech when battle changes or unmounts
  const stopReading = useCallback(() => {
    if (onStopReading) {
      onStopReading();
    } else {
      geminiTts.stop();
      setIsReading(false);
      setIsPaused(false);
      setIsLoadingAudio(false);
      setActiveSectionId(null);
      setActiveCharIndex(0);
    }
  }, [onStopReading]);

  // Subscribe to audio state changes for instant UI sync across tour and drawer
  useEffect(() => {
    const unsubscribe = geminiTts.subscribeState((state) => {
      if (state.ownerId && state.ownerId !== 'details' && state.ownerId !== 'tour') {
        setIsReading(false);
        setIsPaused(false);
        setIsLoadingAudio(false);
        return;
      }
      setIsReading(state.isPlaying);
      setIsPaused(state.isPaused);
      setIsLoadingAudio(state.isLoading);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // When tour is playing with Gemini Read, App.tsx handles reading the new battle
    if (!isPlayingTour || !isGeminiReadEnabled) {
      stopReading();
    }
    setImgError(false);

    // Preload battle overview summary in the background
    if (battle?.summary) {
      geminiTts.preload(battle.summary, effectiveSelectedVoice);
    }
  }, [battle?.id, battle?.summary, effectiveSelectedVoice, stopReading, isPlayingTour, isGeminiReadEnabled]);

  // Speech section playback function with Gemini TTS
  const playSectionAtIndex = useCallback(
    async (sectionIndex: number, startQueue = true) => {
      if (!narrativeSections[sectionIndex]) {
        stopReading();
        return;
      }

      const currentSec = narrativeSections[sectionIndex];
      const targetText = currentSec.text;

      setCurrentSectionQueueIndex(sectionIndex);
      setActiveSectionId(currentSec.id);
      setActiveCharIndex(0);
      setIsReading(true);
      setIsPaused(false);

      const isAlreadyCached = geminiTts.isCached(targetText, effectiveSelectedVoice);
      setIsLoadingAudio(!isAlreadyCached);

      try {
        await geminiTts.play({
          text: targetText,
          voice: effectiveSelectedVoice,
          playbackRate: effectiveReadingSpeed,
          ownerId: 'details',
          onProgress: (charIdx) => {
            setIsLoadingAudio(false);
            setActiveCharIndex(charIdx);
          },
          onEnd: () => {
            setIsLoadingAudio(false);
            if (startQueue && sectionIndex + 1 < narrativeSections.length) {
              playSectionAtIndex(sectionIndex + 1, true);
            } else {
              stopReading();
            }
          },
          onError: (err) => {
            console.warn('TTS playback issue in drawer:', err);
            setIsLoadingAudio(false);
            stopReading();
          },
        });
        setIsLoadingAudio(false);
      } catch (err) {
        console.warn('Playback error:', err);
        setIsLoadingAudio(false);
        stopReading();
      }
    },
    [narrativeSections, effectiveSelectedVoice, effectiveReadingSpeed, stopReading]
  );

  // Handle Play/Pause main button
  const handleTogglePlayReading = () => {
    if (effectiveIsReading) {
      if (effectiveIsPaused) {
        if (onResumeReading) onResumeReading();
        else geminiTts.resume();
      } else {
        if (onPauseReading) onPauseReading();
        else geminiTts.pause();
      }
    } else {
      if (isPlayingTour || isGeminiReadEnabled) {
        if (onPlayOperationalOverview) {
          onPlayOperationalOverview();
          return;
        }
      }
      playSectionAtIndex(0, true);
    }
  };

  // Play or pause/resume a specific section on demand
  const handlePlaySpecificSection = (secId: string) => {
    if (effectiveActiveSectionId === secId && effectiveIsReading) {
      if (effectiveIsPaused) {
        if (onResumeReading) onResumeReading();
        else geminiTts.resume();
      } else {
        if (onPauseReading) onPauseReading();
        else geminiTts.pause();
      }
      return;
    }

    if (secId === 'overview' && (isPlayingTour || isGeminiReadEnabled) && onPlayOperationalOverview) {
      onPlayOperationalOverview();
      return;
    }

    const idx = narrativeSections.findIndex((s) => s.id === secId);
    if (idx !== -1) {
      playSectionAtIndex(idx, false);
    }
  };

  // Change reading speed dynamically
  const handleChangeSpeed = (newSpeed: number) => {
    if (onChangeSpeed) {
      onChangeSpeed(newSpeed);
    }
    setReadingSpeed(newSpeed);
    geminiTts.setRate(newSpeed);
  };

  const handleSelectVoice = (voice: GeminiVoiceName) => {
    if (onSelectVoice) {
      onSelectVoice(voice);
    }
    setSelectedVoice(voice);
    setShowVoicePicker(false);
    if (effectiveIsReading && effectiveActiveSectionId) {
      if (effectiveActiveSectionId === 'overview' && (isPlayingTour || isGeminiReadEnabled) && onPlayOperationalOverview) {
        onPlayOperationalOverview();
        return;
      }
      const idx = narrativeSections.findIndex((s) => s.id === effectiveActiveSectionId);
      if (idx !== -1) {
        playSectionAtIndex(idx, true);
      }
    }
  };

  if (!battle) return null;

  const unionLosses = battle.casualties.union;
  const confedLosses = battle.casualties.confederate;
  const maxLosses = Math.max(unionLosses.total, confedLosses.total, 1);

  const voiceLabels: Record<GeminiVoiceName, { name: string; desc: string }> = {
    Zephyr: { name: 'Zephyr', desc: 'Warm Documentary Narrator' },
    Fenrir: { name: 'Fenrir', desc: 'Deep Resonant Voice' },
    Kore: { name: 'Kore', desc: 'Clear Educational Voice' },
    Puck: { name: 'Puck', desc: 'Dynamic & Expressive' },
    Charon: { name: 'Charon', desc: 'Authoritative Chronicle' },
  };

  const mobileHeightClass = {
    closed: 'translate-y-full pointer-events-none md:translate-y-0 md:pointer-events-auto',
    peek: 'h-[76px] translate-y-0 md:h-full',
    half: 'h-[48vh] translate-y-0 md:h-full',
    full: 'h-[88vh] translate-y-0 md:h-full',
  }[activeSnap];

  return (
    <>
      {/* Desktop Floating Edge Tab (when collapsed on wide screens) */}
      {isCollapsed && (
        <button
          onClick={toggleDesktopCollapse}
          aria-label={`Expand details for ${battle.name}`}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-[#ebe6db] hover:bg-[#d9d2c4] text-[#3d322a] border-l-2 border-y-2 border-[#a65d50] py-3.5 px-2 rounded-l-xl shadow-xl items-center gap-1.5 cursor-pointer transition-transform hover:-translate-x-1"
          title={`Expand details for ${battle.name}`}
        >
          <ChevronLeft className="w-4 h-4 text-[#a65d50]" />
          <BookOpen className="w-4 h-4 text-[#7c6c5a]" />
          <span className="text-xs font-cinzel font-bold max-w-[150px] truncate">
            {battle.name}
          </span>
        </button>
      )}

      {/* Main Drawer / Bottom Sheet Element */}
      <aside 
        role="region"
        aria-label={`Historical Tactical Details for ${battle.name}`}
        className={`
          /* Mobile / Tablet Portrait: Bottom Sheet Mode (< 768px) */
          fixed inset-x-0 bottom-0 z-30 flex flex-col bg-[#f5f2ed] border-t-2 border-[#d1c2ab] rounded-t-2xl shadow-2xl transition-all duration-300 ease-out
          ${mobileHeightClass}

          /* Desktop / Tablet Landscape: Collapsible Right Side Drawer (>= 768px) */
          md:relative md:inset-auto md:z-10 md:h-full md:rounded-none md:border-t-0 md:border-l md:border-[#d1c2ab] md:shadow-xl md:flex-shrink-0 md:translate-y-0 md:pointer-events-auto
          ${isCollapsed ? 'md:hidden' : 'md:w-[380px] lg:w-[430px] xl:w-[480px] md:flex'}
        `}
      >
        {/* Mobile Drag Handle & Peek Bar */}
        <div 
          onClick={() => {
            if (activeSnap === 'peek') setSnap('half');
            else if (activeSnap === 'half') setSnap('full');
            else setSnap('peek');
          }}
          className="md:hidden shrink-0 bg-[#ebe6db] border-b border-[#d1c2ab] rounded-t-2xl px-3 sm:px-4 py-2 flex flex-col items-center cursor-pointer select-none"
        >
          <div className="w-12 h-1.5 bg-[#8a7a67]/50 hover:bg-[#8a7a67] rounded-full mb-1.5" />
          <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="font-cinzel text-xs font-bold text-[#3d322a] truncate">
                {battle.name}
              </span>
              <span 
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  battle.outcome === 'union'
                    ? 'bg-[#3e5672]/15 text-[#3e5672]'
                    : battle.outcome === 'confederate'
                    ? 'bg-[#a65d50]/15 text-[#a65d50]'
                    : 'bg-[#c48a3f]/15 text-[#854d0e]'
                }`}
              >
                {battle.outcome === 'union' ? 'USA' : battle.outcome === 'confederate' ? 'CSA' : 'Siege'}
              </span>
              <span className="text-[10px] text-[#6e5d4b] hidden min-[420px]:inline truncate shrink-0">
                • ~{(battle.totalCasualties / 1000).toFixed(0)}k Losses
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Quick Audio Read Pill on Mobile */}
              <button
                onClick={handleTogglePlayReading}
                disabled={isLoadingAudio}
                className={`p-1.5 min-w-[32px] min-h-[32px] rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer ${
                  isReading && !isPaused ? 'bg-[#d97706] text-white' : 'bg-[#3d322a] text-[#f5f2ed]'
                }`}
                title="Gemini Audio Read"
                aria-label="Gemini Audio Read"
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                ) : isReading && !isPaused ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                )}
              </button>

              {/* Snap Size Toggle (Chevron) */}
              <button
                onClick={() => {
                  if (activeSnap === 'peek') setSnap('half');
                  else if (activeSnap === 'half') setSnap('full');
                  else setSnap('peek');
                }}
                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-[#f5f2ed] text-[#5c4d3e] border border-[#d1c2ab]"
                title={activeSnap === 'full' ? 'Collapse drawer' : 'Expand drawer'}
                aria-label={activeSnap === 'full' ? 'Collapse drawer' : 'Expand drawer'}
              >
                {activeSnap === 'full' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:bg-[#d9d2c4] transition-colors"
                title="Close Battle Details"
                aria-label="Close Battle Details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Drawer Header */}
        <div className="hidden md:flex p-4 border-b border-[#d1c2ab] bg-[#ebe6db] items-center justify-between gap-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span 
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                battle.outcome === 'union'
                  ? 'bg-[#3e5672]/15 text-[#3e5672] border border-[#3e5672]/40'
                  : battle.outcome === 'confederate'
                  ? 'bg-[#a65d50]/15 text-[#a65d50] border border-[#a65d50]/40'
                  : 'bg-[#c48a3f]/15 text-[#854d0e] border border-[#c48a3f]/40'
              }`}
            >
              {battle.outcome === 'union' ? 'Union Victory' : battle.outcome === 'confederate' ? 'Confederate Victory' : 'Inconclusive / Siege'}
            </span>
            {(() => {
              const evType = getBattleEventType(battle);
              const evConfig = EVENT_TYPE_CONFIGS[evType];
              return (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#d97706]/15 text-[#92400e] border border-[#d97706]/35 flex items-center gap-1">
                  <span>{evConfig.label}</span>
                </span>
              );
            })()}
            <span className="text-xs text-[#6e5d4b]">• {battle.theater} Theater</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleDesktopCollapse}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#d9d2c4] transition-colors cursor-pointer"
              title="Collapse drawer to view full panoramic map"
              aria-label="Collapse details drawer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#d9d2c4] active:bg-[#c4baaa] transition-colors cursor-pointer"
              title="Close Details Drawer"
              aria-label="Close Details Drawer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Drawer Body Container (Hidden in mobile peek mode) */}
        <div className={`${activeSnap === 'peek' ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-h-0`}>

      {/* Reader Assistant Interactive Audio Toolbar */}
      <div className="p-3 bg-[#e4ded0] border-b border-[#c4baaa] flex flex-wrap items-center justify-between gap-2 shadow-inner select-none flex-shrink-0">
        
        {/* Left: Reader Main Play / Pause */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlayReading}
            disabled={effectiveIsLoadingAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
              effectiveIsReading && !effectiveIsPaused
                ? 'bg-[#d97706] text-white shadow-amber-900/20'
                : 'bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed]'
            }`}
            title={effectiveIsReading ? (effectiveIsPaused ? 'Resume Reading' : 'Pause Reading') : 'Read Entire Battle Out Loud with Gemini Natural Voice'}
          >
            {effectiveIsLoadingAudio ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>Loading Voice...</span>
              </>
            ) : effectiveIsReading && !effectiveIsPaused ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{effectiveIsReading && effectiveIsPaused ? 'Resume' : 'Gemini Read'}</span>
              </>
            )}
          </button>

          {effectiveIsReading && (
            <button
              onClick={stopReading}
              className="p-1.5 rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#8a7a67] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer"
              title="Stop Reading"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Voice Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setShowVoicePicker(!showVoicePicker)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#5c4d3e] border border-[#d1c2ab] text-[11px] font-bold shadow-xs cursor-pointer"
              title="Choose Gemini Natural Voice"
            >
              <Headphones className="w-3 h-3 text-[#a65d50]" />
              <span>{effectiveSelectedVoice}</span>
            </button>

            {showVoicePicker && (
              <div className="absolute top-full left-0 mt-1 z-40 w-56 bg-[#fbf9f5] border border-[#c4baaa] rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8a7a67] border-b border-[#e4ded0]">
                  Gemini TTS Natural Voices
                </div>
                {(Object.keys(voiceLabels) as GeminiVoiceName[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => handleSelectVoice(v)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      effectiveSelectedVoice === v
                        ? 'bg-[#3e5672] text-[#f5f2ed] font-bold'
                        : 'hover:bg-[#ebe6db] text-[#3d322a]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{voiceLabels[v].name}</div>
                      <div className={`text-[10px] ${effectiveSelectedVoice === v ? 'text-amber-200' : 'text-[#8a7a67]'}`}>
                        {voiceLabels[v].desc}
                      </div>
                    </div>
                    {effectiveSelectedVoice === v && <Sparkles className="w-3 h-3 text-amber-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Reading Speed Pills */}
        <div className="flex items-center gap-1 bg-[#f5f2ed] p-0.5 rounded-lg border border-[#d1c2ab]">
          <span className="text-[10px] text-[#8a7a67] font-semibold px-1 hidden sm:inline">Speed:</span>
          {[0.8, 1.0, 1.25].map((spd) => (
            <button
              key={spd}
              onClick={() => handleChangeSpeed(spd)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                effectiveReadingSpeed === spd
                  ? 'bg-[#3d322a] text-[#f5f2ed]'
                  : 'text-[#8a7a67] hover:text-[#3d322a]'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Battle Title & Primary Metadata */}
        <div>
          <h2 className="font-cinzel text-2xl font-bold text-[#3d322a] tracking-wide mb-2 leading-tight">
            {battle.name}
          </h2>
          <div className="space-y-1.5 text-xs text-[#5c4d3e]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#a65d50] shrink-0" />
              <span className="font-semibold">{battle.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#a65d50] shrink-0" />
              <span>{battle.location} • {battle.state}</span>
            </div>
          </div>
        </div>

        {/* Archive Historical Image */}
        {battle.archivalImage && !imgError && (
          <div className="rounded-xl overflow-hidden border border-[#d1c2ab] bg-[#ebe6db] shadow-inner relative group">
            <img 
              src={battle.archivalImage} 
              alt={battle.name} 
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-44 object-cover contrast-105 saturate-80 group-hover:scale-102 transition-transform duration-500"
            />
            <div className="p-2 bg-[#ebe6db]/90 text-[10px] text-[#8a7a67] font-serif italic border-t border-[#d1c2ab]">
              Library of Congress / NPS Archive Collection
            </div>
          </div>
        )}

        {/* Operational Overview with Audio Listener */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a7a67]">
              <BookOpen className="w-4 h-4 text-[#3e5672]" />
              <span>Operational Overview</span>
            </div>
            <button
              onClick={() => handlePlaySpecificSection('overview')}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                effectiveActiveSectionId === 'overview' && effectiveIsReading
                  ? effectiveIsPaused
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                    : 'bg-[#d97706] text-white border-[#d97706] shadow-xs'
                  : 'bg-[#ebe6db] hover:bg-[#d9d2c4] text-[#5c4d3e] border-[#c4baaa]'
              }`}
              title={
                effectiveActiveSectionId === 'overview' && effectiveIsReading
                  ? effectiveIsPaused
                    ? 'Resume Operational Overview'
                    : 'Pause Operational Overview'
                  : 'Listen to Operational Overview with Gemini Voice'
              }
            >
              {effectiveActiveSectionId === 'overview' && effectiveIsReading ? (
                effectiveIsPaused ? (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                )
              ) : (
                <>
                  <Volume2 className="w-3 h-3" />
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>

          <HighlightableText
            text={battle.summary}
            sectionId="overview"
            activeSectionId={effectiveActiveSectionId}
            activeCharIndex={effectiveActiveCharIndex}
            isReading={effectiveIsReading}
            className="text-xs text-[#5c4d3e]"
          />
        </div>

        {/* Tactical Phased Overview */}
        {battle.tacticalOverview && battle.tacticalOverview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a7a67]">
                <Swords className="w-4 h-4 text-[#a65d50]" />
                <span>Tactical Engagement Phases</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {battle.tacticalOverview.map((phase, idx) => (
                <div key={idx} className="p-3 bg-[#ebe6db]/60 rounded-xl border border-[#d1c2ab]/70 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#a65d50] uppercase tracking-wide">
                      Phase {idx + 1} Engagement
                    </span>
                    <button
                      onClick={() => handlePlaySpecificSection(`phase-${idx}`)}
                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        effectiveActiveSectionId === `phase-${idx}` && effectiveIsReading
                          ? effectiveIsPaused
                            ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                            : 'bg-[#d97706] text-white border-[#d97706]'
                          : 'bg-[#f5f2ed] hover:bg-[#ebe6db] text-[#5c4d3e] border-[#d1c2ab]'
                      }`}
                      title={
                        effectiveActiveSectionId === `phase-${idx}` && effectiveIsReading
                          ? effectiveIsPaused
                            ? `Resume Phase ${idx + 1}`
                            : `Pause Phase ${idx + 1}`
                          : `Listen to Phase ${idx + 1}`
                      }
                    >
                      {effectiveActiveSectionId === `phase-${idx}` && effectiveIsReading ? (
                        effectiveIsPaused ? (
                          <>
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-2.5 h-2.5" />
                            <span>Pause</span>
                          </>
                        )
                      ) : (
                        <>
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                  <HighlightableText
                    text={phase}
                    sectionId={`phase-${idx}`}
                    activeSectionId={effectiveActiveSectionId}
                    activeCharIndex={effectiveActiveCharIndex}
                    isReading={effectiveIsReading}
                    className="text-xs text-[#5c4d3e]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Casualty Breakdown Card */}
        <div className="p-4 rounded-xl bg-[#ebe6db] border border-[#d1c2ab] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a7a67]">
              <Skull className="w-4 h-4 text-[#a65d50]" />
              <span>Casualty & Loss Breakdown</span>
            </div>
            <button
              onClick={() => handlePlaySpecificSection('casualties')}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                effectiveActiveSectionId === 'casualties' && isReading
                  ? isPaused
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                    : 'bg-[#d97706] text-white border-[#d97706]'
                  : 'bg-[#f5f2ed] hover:bg-[#e4ded0] text-[#5c4d3e] border-[#d1c2ab]'
              }`}
              title={
                effectiveActiveSectionId === 'casualties' && isReading
                  ? isPaused
                    ? 'Resume Casualty Report'
                    : 'Pause Casualty Report'
                  : 'Listen to Casualty Report'
              }
            >
              {effectiveActiveSectionId === 'casualties' && isReading ? (
                isPaused ? (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                )
              ) : (
                <>
                  <Volume2 className="w-3 h-3" />
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center py-2 bg-[#f5f2ed] rounded-lg border border-[#d1c2ab]">
            <div className="text-2xl font-cinzel font-bold text-[#3d322a]">
              ~{battle.totalCasualties.toLocaleString()}
            </div>
            <div className="text-[10px] font-semibold text-[#8a7a67] uppercase tracking-wider">
              Total Casualties (Killed, Wounded, Captured & Missing)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Union Stats */}
            <div className="p-2.5 bg-[#f5f2ed] rounded-lg border border-[#3e5672]/30 space-y-1">
              <div className="font-bold text-[#3e5672] flex items-center justify-between text-xs">
                <span>USA (Union)</span>
                <span>{unionLosses.total.toLocaleString()}</span>
              </div>
              <div className="w-full h-1.5 bg-[#d9d2c4] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#3e5672] rounded-full transition-all duration-500"
                  style={{ width: `${(unionLosses.total / maxLosses) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-[#8a7a67] pt-1 space-y-0.5">
                <div>Killed: <span className="text-[#3d322a] font-semibold">{unionLosses.killed.toLocaleString()}</span></div>
                <div>Wounded: <span className="text-[#3d322a] font-semibold">{unionLosses.wounded.toLocaleString()}</span></div>
                <div>Missing/Captured: <span className="text-[#3d322a] font-semibold">{unionLosses.missing.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Confederate Stats */}
            <div className="p-2.5 bg-[#f5f2ed] rounded-lg border border-[#a65d50]/30 space-y-1">
              <div className="font-bold text-[#a65d50] flex items-center justify-between text-xs">
                <span>CSA (Confederacy)</span>
                <span>{confedLosses.total.toLocaleString()}</span>
              </div>
              <div className="w-full h-1.5 bg-[#d9d2c4] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#a65d50] rounded-full transition-all duration-500"
                  style={{ width: `${(confedLosses.total / maxLosses) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-[#8a7a67] pt-1 space-y-0.5">
                <div>Killed: <span className="text-[#3d322a] font-semibold">{confedLosses.killed.toLocaleString()}</span></div>
                <div>Wounded: <span className="text-[#3d322a] font-semibold">{confedLosses.wounded.toLocaleString()}</span></div>
                <div>Missing/Captured: <span className="text-[#3d322a] font-semibold">{confedLosses.missing.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Source Eyewitness Quote */}
        {battle.primaryQuote && (
          <div className="p-4 rounded-xl bg-[#ebe6db] border-l-4 border-[#a65d50] space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#a65d50] uppercase tracking-wider">
                <Quote className="w-4 h-4" />
                <span>Primary Source Voice</span>
              </div>
              <button
                onClick={() => handlePlaySpecificSection('quote')}
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  effectiveActiveSectionId === 'quote' && effectiveIsReading
                    ? 'bg-[#d97706] text-white border-[#d97706]'
                    : 'bg-[#f5f2ed] hover:bg-[#e4ded0] text-[#5c4d3e] border-[#d1c2ab]'
                }`}
                title="Listen to Primary Source Eyewitness Quote"
              >
                <Volume2 className="w-3 h-3" />
                <span>Listen</span>
              </button>
            </div>
            <HighlightableText
              text={`"${battle.primaryQuote.text}"`}
              sectionId="quote"
              activeSectionId={effectiveActiveSectionId}
              activeCharIndex={effectiveActiveCharIndex}
              isReading={effectiveIsReading}
              className="font-serif italic text-xs text-[#3d322a]"
            />
            <div className="text-[11px] text-[#8a7a67] font-sans font-semibold pt-1 border-t border-[#d1c2ab]">
              — {battle.primaryQuote.author}, <span className="italic">{battle.primaryQuote.context}</span>
            </div>
          </div>
        )}

        {/* Strategic Significance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a7a67]">
              <Award className="w-4 h-4 text-[#c48a3f]" />
              <span>Strategic & Political Significance</span>
            </div>
            <button
              onClick={() => handlePlaySpecificSection('significance')}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                effectiveActiveSectionId === 'significance' && isReading
                  ? 'bg-[#d97706] text-white border-[#d97706]'
                  : 'bg-[#ebe6db] hover:bg-[#d9d2c4] text-[#5c4d3e] border-[#c4baaa]'
              }`}
              title="Listen to Strategic Significance"
            >
              <Volume2 className="w-3 h-3" />
              <span>Listen</span>
            </button>
          </div>
          <HighlightableText
            text={battle.strategicSignificance}
            sectionId="significance"
            activeSectionId={effectiveActiveSectionId}
            activeCharIndex={effectiveActiveCharIndex}
            isReading={isReading}
            className="text-xs text-[#5c4d3e]"
          />
        </div>

        {/* Key Commanders */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a7a67]">
            <Users className="w-4 h-4 text-[#3e5672]" />
            <span>Commanding Generals & Leaders</span>
          </div>
          
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-[#3e5672] uppercase tracking-wider">Union Commanders</div>
            <div className="space-y-2">
              {battle.unionCommanders.map((cmd) => (
                <CommanderCard key={cmd.name} commander={cmd} faction="union" />
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-bold text-[#a65d50] uppercase tracking-wider">Confederate Commanders</div>
            <div className="space-y-2">
              {battle.confederateCommanders.map((cmd) => (
                <CommanderCard key={cmd.name} commander={cmd} faction="confederate" />
              ))}
            </div>
          </div>
        </div>

        {/* NPS / Official Record Links */}
        <div className="pt-2 border-t border-[#d1c2ab] space-y-2">
          <a
            href={battle.npsReferenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-[#ebe6db] hover:bg-[#d9d2c4] border border-[#d1c2ab] text-xs font-semibold text-[#3d322a] transition-colors group shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
              <span>National Park Service (NPS) Official Record</span>
            </div>
            <ExternalLink className="w-4 h-4 text-[#8a7a67] group-hover:text-[#3d322a] transition-colors" />
          </a>
        </div>

      </div>

      {/* Drawer Footer Actions */}
      <div className="p-4 border-t border-[#d1c2ab] bg-[#ebe6db] flex items-center justify-between gap-3 flex-shrink-0">
        <button
          onClick={() => onAskHistorian(battle)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#3e5672] hover:bg-[#2f4258] text-[#f5f2ed] font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Ask Historian About This Battle</span>
        </button>
      </div>

        </div>

      </aside>
    </>
  );
};
