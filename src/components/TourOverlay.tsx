import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  HelpCircle, 
  GraduationCap,
  Sparkles,
  MapPin,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  Loader2,
  Sliders,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CampaignTourStep } from '../types';
import { CAMPAIGN_TOUR_STEPS } from '../data/campaignTourData';
import { HighlightableText } from './HighlightableText';
import { geminiTts } from '../services/geminiTtsService';

interface TourOverlayProps {
  currentStepIndex: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  onCloseTour: () => void;
  onSelectBattleById: (battleId: string) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
}

interface TourNarrativeSection {
  id: string;
  title: string;
  text: string;
}

export type GeminiVoiceName = 'Zephyr' | 'Fenrir' | 'Kore' | 'Puck' | 'Charon';

export const TourOverlay: React.FC<TourOverlayProps> = ({
  currentStepIndex,
  onNextStep,
  onPrevStep,
  onCloseTour,
  onSelectBattleById,
  audioEnabled,
  onToggleAudio,
}) => {
  const currentStep: CampaignTourStep = CAMPAIGN_TOUR_STEPS[currentStepIndex] || CAMPAIGN_TOUR_STEPS[0];

  // Reader Assistant Audio State
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoiceName>('Zephyr');
  const [showVoicePicker, setShowVoicePicker] = useState<boolean>(false);
  const [readingSpeed, setReadingSpeed] = useState<number>(1.0);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeCharIndex, setActiveCharIndex] = useState<number>(0);
  const [currentSectionQueueIndex, setCurrentSectionQueueIndex] = useState<number>(0);
  const [activeEngine, setActiveEngine] = useState<'gemini' | 'browser'>('gemini');
  const [cacheVersion, setCacheVersion] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Subscribe to audio cache and state changes so UI is always perfectly in sync
  useEffect(() => {
    const unsubscribeCache = geminiTts.subscribeCache(() => {
      setCacheVersion((v) => v + 1);
    });

    const unsubscribeState = geminiTts.subscribeState((state) => {
      if (state.ownerId && state.ownerId !== 'tour') {
        setIsReading(false);
        setIsPaused(false);
        setIsLoadingAudio(false);
        return;
      }
      setIsReading(state.isPlaying);
      setIsPaused(state.isPaused);
      setIsLoadingAudio(state.isLoading);
      setActiveEngine(state.currentEngine);
    });

    return () => {
      unsubscribeCache();
      unsubscribeState();
    };
  }, []);

  // Preload only current chapter in the background when step or voice changes
  useEffect(() => {
    geminiTts.preloadStep(currentStep, selectedVoice);
  }, [currentStep, selectedVoice]);

  // Build the list of narrative speech sections for this chapter
  const narrativeSections: TourNarrativeSection[] = useMemo(() => {
    if (!currentStep) return [];

    const sections: TourNarrativeSection[] = [
      {
        id: 'overview-narrative',
        title: 'Chapter Narrative',
        text: currentStep.narrative,
      },
      {
        id: 'curriculum-focus',
        title: 'Curriculum Focus',
        text: `Curriculum Focus and Core Standard: ${currentStep.pedagogicalFocus}`,
      },
    ];

    if (currentStep.discussionQuestions && currentStep.discussionQuestions.length > 0) {
      sections.push({
        id: 'discussion-prompts',
        title: 'Discussion Prompts',
        text: `Classroom Discussion Prompts: ${currentStep.discussionQuestions.join('. ')}`,
      });
    }

    return sections;
  }, [currentStep]);

  // Helper to check if a specific section is already preloaded in memory
  const isSectionPreloaded = useCallback(
    (secId: string) => {
      const sec = narrativeSections.find((s) => s.id === secId);
      if (!sec) return false;
      return geminiTts.isCached(sec.text, selectedVoice);
    },
    [narrativeSections, selectedVoice, cacheVersion]
  );

  const isNarrativePreloaded = isSectionPreloaded('overview-narrative');

  // Clean up and stop speech
  const stopReading = useCallback(() => {
    geminiTts.stop();
    setIsReading(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
    setActiveSectionId(null);
    setActiveCharIndex(0);
  }, []);

  // Play section at index with Gemini TTS
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

      // If already cached, don't show loading spinner
      const isAlreadyCached = geminiTts.isCached(targetText, selectedVoice);
      setIsLoadingAudio(!isAlreadyCached);

      try {
        await geminiTts.play({
          text: targetText,
          voice: selectedVoice,
          playbackRate: readingSpeed,
          ownerId: 'tour',
          onProgress: (charIdx) => {
            setIsLoadingAudio(false);
            setActiveCharIndex(charIdx);
            setActiveEngine(geminiTts.currentEngine);
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
            console.warn('TTS playback issue:', err);
            setIsLoadingAudio(false);
            stopReading();
          },
        });
        setIsLoadingAudio(false);
        setActiveEngine(geminiTts.currentEngine);
      } catch (err) {
        console.warn('Playback failure:', err);
        setIsLoadingAudio(false);
        stopReading();
      }
    },
    [narrativeSections, selectedVoice, readingSpeed, stopReading]
  );

  // When step changes, automatically trigger battle selection
  useEffect(() => {
    onSelectBattleById(currentStep.battleId);

    if (audioEnabled) {
      playSectionAtIndex(0, true);
    } else {
      stopReading();
    }
  }, [currentStepIndex, audioEnabled, currentStep.battleId, onSelectBattleById]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopReading();
    };
  }, [stopReading]);

  // Handle Escape key to exit tour
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseTour();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCloseTour]);

  // Toggle Read Aloud
  const handleTogglePlayReading = () => {
    if (isReading) {
      if (isPaused) {
        geminiTts.resume();
        setIsPaused(false);
      } else {
        geminiTts.pause();
        setIsPaused(true);
      }
    } else {
      playSectionAtIndex(0, true);
    }
  };

  // Play or pause/resume a specific section on demand
  const handlePlaySpecificSection = (secId: string) => {
    if (activeSectionId === secId && isReading) {
      if (isPaused) {
        geminiTts.resume();
      } else {
        geminiTts.pause();
      }
      return;
    }

    const idx = narrativeSections.findIndex((s) => s.id === secId);
    if (idx !== -1) {
      playSectionAtIndex(idx, false);
    }
  };

  // Change reading speed
  const handleChangeSpeed = (newSpeed: number) => {
    setReadingSpeed(newSpeed);
    geminiTts.setRate(newSpeed);
  };

  // Switch Gemini Voice
  const handleSelectVoice = (voice: GeminiVoiceName) => {
    setSelectedVoice(voice);
    setShowVoicePicker(false);
    if (isReading && activeSectionId) {
      const idx = narrativeSections.findIndex((s) => s.id === activeSectionId);
      if (idx !== -1) {
        playSectionAtIndex(idx, true);
      }
    }
  };

  const voiceLabels: Record<GeminiVoiceName, { name: string; desc: string }> = {
    Zephyr: { name: 'Zephyr', desc: 'Warm Documentary Narrator' },
    Fenrir: { name: 'Fenrir', desc: 'Deep Resonant Chronicle' },
    Kore: { name: 'Kore', desc: 'Clear Educational Voice' },
    Puck: { name: 'Puck', desc: 'Dynamic & Engaging' },
    Charon: { name: 'Charon', desc: 'Authoritative Historical' },
  };

  if (isMinimized) {
    return (
      <div 
        role="region"
        aria-label="Guided Civil War Campaign Tour Mini Controls"
        className="absolute top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-4 sm:right-auto sm:w-[460px] z-30 bg-[#ebe6db]/95 border-2 border-[#a65d50] rounded-xl shadow-xl backdrop-blur-md p-2.5 flex items-center justify-between gap-2 text-[#3d322a] select-none animate-in fade-in slide-in-from-top-2 duration-150"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#a65d50] flex items-center justify-center text-[#f5f2ed] font-bold text-xs shadow-xs shrink-0" aria-hidden="true">
            {currentStep.order}
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#a65d50] block truncate">
              Chapter {currentStep.order}/{CAMPAIGN_TOUR_STEPS.length} &bull; {currentStep.year}
            </span>
            <div className="text-xs font-bold text-[#3d322a] truncate font-cinzel">
              {currentStep.title}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Audio toggle button */}
          <button
            onClick={handleTogglePlayReading}
            disabled={isLoadingAudio}
            className={`p-1.5 min-w-[32px] min-h-[32px] rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1 ${
              isReading && !isPaused
                ? 'bg-[#d97706] text-white'
                : 'bg-[#3d322a] text-[#f5f2ed] hover:bg-[#4d4036]'
            }`}
            title={isReading ? (isPaused ? 'Resume Narration' : 'Pause Narration') : 'Play Gemini Voice'}
            aria-label="Toggle Tour Audio"
          >
            {isLoadingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : isReading && !isPaused ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Prev / Next buttons */}
          <button
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] border border-[#d1c2ab] disabled:opacity-40 text-[#5c4d3e] cursor-pointer"
            title="Previous Chapter"
            aria-label="Previous Chapter"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={onNextStep}
            disabled={currentStepIndex === CAMPAIGN_TOUR_STEPS.length - 1}
            className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] border border-[#d1c2ab] disabled:opacity-40 text-[#5c4d3e] cursor-pointer"
            title="Next Chapter"
            aria-label="Next Chapter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Expand button */}
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#3e5672] border border-[#d1c2ab] font-bold cursor-pointer"
            title="Expand Full Tour Guide"
            aria-label="Expand Full Tour Guide"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Close Tour */}
          <button
            onClick={onCloseTour}
            className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#ebe6db] transition-colors cursor-pointer"
            title="Exit Tour"
            aria-label="Exit Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      role="region"
      aria-label="Guided Civil War Campaign Tour"
      className="absolute top-3 bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:w-[460px] sm:bottom-auto sm:max-h-[calc(100%-1.5rem)] z-30 flex flex-col bg-[#ebe6db]/95 border-2 border-[#a65d50] rounded-2xl shadow-2xl backdrop-blur-md text-[#3d322a] overflow-hidden animate-in fade-in slide-in-from-top-4"
    >
      
      {/* Tour Header with Chapter Counter */}
      <div className="shrink-0 p-3 bg-[#d9d2c4] border-b border-[#c4baaa] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#a65d50] flex items-center justify-center text-[#f5f2ed] font-bold text-xs shadow-xs shrink-0" aria-hidden="true">
            {currentStep.order}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#a65d50] block leading-tight">
              Guided Campaign Tour &bull; Chapter {currentStep.order} of {CAMPAIGN_TOUR_STEPS.length}
            </span>
            <div className="text-xs font-bold text-[#3d322a] leading-tight">
              {currentStep.year} Theater Campaign
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Audio Speech Button (Activates Reader Assistance) */}
          <button
            onClick={() => {
              onToggleAudio();
              if (!isReading) {
                playSectionAtIndex(0, true);
              } else {
                stopReading();
              }
            }}
            aria-label={isReading ? 'Stop Gemini Natural Voice Narration' : 'Start Gemini Natural Voice Narration'}
            className={`p-2 min-w-[44px] min-h-[44px] rounded-lg border text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1 ${
              isReading || audioEnabled
                ? 'bg-[#3e5672] text-[#f5f2ed] border-[#3e5672] ring-2 ring-[#3e5672]/30' 
                : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:text-[#3d322a] hover:bg-[#ebe6db]'
            }`}
            title={isReading ? 'Stop Gemini Reader Assistant' : 'Start Gemini Natural Reader Assistant'}
          >
            {isReading ? <Volume2 className="w-4 h-4 text-amber-300 animate-pulse" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          </button>

          {/* Minimize Tour Card to Watch 3D Map */}
          <button
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize Tour to Watch 3D Map Flyover"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#ebe6db] transition-colors cursor-pointer"
            title="Minimize Tour Card to Watch 3D Map"
          >
            <Minimize2 className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Close Tour */}
          <button
            onClick={onCloseTour}
            aria-label="Exit Guided Campaign Tour"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#ebe6db] transition-colors cursor-pointer"
            title="Exit Tour Mode"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Reader Assistant Audio Toolbar */}
      <div className="shrink-0 p-2.5 bg-[#e4ded0] border-b border-[#c4baaa] flex flex-wrap items-center justify-between gap-2 shadow-inner select-none">
        {/* Left: Play / Pause / Reset Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlayReading}
            disabled={isLoadingAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
              isReading && !isPaused
                ? 'bg-[#d97706] text-white shadow-amber-900/20'
                : 'bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed]'
            }`}
            title={isReading ? (isPaused ? 'Resume Reading' : 'Pause Reading') : 'Read Chapter Aloud with Gemini Natural Voice'}
          >
            {isLoadingAudio ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>Loading Voice...</span>
              </>
            ) : isReading && !isPaused ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isReading && isPaused ? 'Resume' : 'Gemini Read'}</span>
              </>
            )}
          </button>

          {isReading && (
            <button
              onClick={stopReading}
              className="p-1.5 rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#8a7a67] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer"
              title="Stop & Reset Reading"
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
              <span>{selectedVoice}</span>
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
                      selectedVoice === v
                        ? 'bg-[#3e5672] text-[#f5f2ed] font-bold'
                        : 'hover:bg-[#ebe6db] text-[#3d322a]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{voiceLabels[v].name}</div>
                      <div className={`text-[10px] ${selectedVoice === v ? 'text-amber-200' : 'text-[#8a7a67]'}`}>
                        {voiceLabels[v].desc}
                      </div>
                    </div>
                    {selectedVoice === v && <Sparkles className="w-3 h-3 text-amber-300" />}
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
                readingSpeed === spd
                  ? 'bg-[#3d322a] text-[#f5f2ed]'
                  : 'text-[#8a7a67] hover:text-[#3d322a]'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Chapter Body with Synced Highlighting */}
      <div className="flex-1 min-h-0 p-4 space-y-3.5 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-cinzel text-lg font-bold text-[#3d322a] leading-snug">
              {currentStep.title}
            </h3>
            <p className="font-serif italic text-xs text-[#a65d50] font-semibold mt-0.5">
              {currentStep.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isNarrativePreloaded ? (
              <div className="flex items-center gap-1 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-800 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Audio Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-amber-100/70 border border-amber-300/80 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#8a5314] shadow-2xs">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Gemini TTS</span>
              </div>
            )}
          </div>
        </div>

        {/* Narrative with Synchronized Word Reader */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7a67]">
                Historical Narrative
              </span>
              {isSectionPreloaded('overview-narrative') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Preloaded & ready for instant playback" />
              )}
            </div>
            <button
              onClick={() => handlePlaySpecificSection('overview-narrative')}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                activeSectionId === 'overview-narrative' && isReading
                  ? isPaused
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                    : 'bg-[#d97706] text-white border-[#d97706] shadow-xs'
                  : 'bg-[#f5f2ed] hover:bg-[#ebe6db] text-[#5c4d3e] border-[#d1c2ab]'
              }`}
              title={
                activeSectionId === 'overview-narrative' && isReading
                  ? isPaused
                    ? 'Resume Historical Narrative'
                    : 'Pause Historical Narrative'
                  : 'Listen to Historical Narrative with Gemini TTS'
              }
            >
              {activeSectionId === 'overview-narrative' && isReading ? (
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
          <HighlightableText
            text={currentStep.narrative}
            sectionId="overview-narrative"
            activeSectionId={activeSectionId}
            activeCharIndex={activeCharIndex}
            isReading={isReading}
            className="text-xs text-[#5c4d3e]"
          />
        </div>

        {/* Pedagogical Focus (For History Teachers) */}
        <div className="bg-[#f5f2ed] p-3 rounded-xl border border-[#d1c2ab] space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#7c6c5a]">
              <GraduationCap className="w-4 h-4 text-[#a65d50]" />
              <span>Curriculum Focus & Core Standard:</span>
              {isSectionPreloaded('curriculum-focus') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Audio ready" />
              )}
            </div>
            <button
              onClick={() => handlePlaySpecificSection('curriculum-focus')}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                activeSectionId === 'curriculum-focus' && isReading
                  ? isPaused
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                    : 'bg-[#d97706] text-white border-[#d97706]'
                  : 'bg-[#ebe6db] hover:bg-[#d9d2c4] text-[#5c4d3e] border-[#c4baaa]'
              }`}
              title={
                activeSectionId === 'curriculum-focus' && isReading
                  ? isPaused
                    ? 'Resume Curriculum Focus'
                    : 'Pause Curriculum Focus'
                  : 'Listen to Curriculum Focus with Gemini TTS'
              }
            >
              {activeSectionId === 'curriculum-focus' && isReading ? (
                isPaused ? (
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
            text={`Curriculum Focus and Core Standard: ${currentStep.pedagogicalFocus}`}
            sectionId="curriculum-focus"
            activeSectionId={activeSectionId}
            activeCharIndex={activeCharIndex}
            isReading={isReading}
            className="text-xs text-[#5c4d3e] italic"
          />
        </div>

        {/* Discussion Questions */}
        <div className="space-y-2 pt-1 border-t border-[#c4baaa]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#3e5672]">
              <HelpCircle className="w-4 h-4" />
              <span>Classroom Discussion Prompts:</span>
              {isSectionPreloaded('discussion-prompts') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Audio ready" />
              )}
            </div>
            <button
              onClick={() => handlePlaySpecificSection('discussion-prompts')}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                activeSectionId === 'discussion-prompts' && isReading
                  ? isPaused
                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                    : 'bg-[#d97706] text-white border-[#d97706]'
                  : 'bg-[#f5f2ed] hover:bg-[#ebe6db] text-[#5c4d3e] border-[#d1c2ab]'
              }`}
              title={
                activeSectionId === 'discussion-prompts' && isReading
                  ? isPaused
                    ? 'Resume Discussion Prompts'
                    : 'Pause Discussion Prompts'
                  : 'Listen to Discussion Prompts with Gemini TTS'
              }
            >
              {activeSectionId === 'discussion-prompts' && isReading ? (
                isPaused ? (
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
            text={`Classroom Discussion Prompts: ${currentStep.discussionQuestions.join('. ')}`}
            sectionId="discussion-prompts"
            activeSectionId={activeSectionId}
            activeCharIndex={activeCharIndex}
            isReading={isReading}
            className="text-xs text-[#5c4d3e]"
          />
        </div>
      </div>

      {/* Tour Footer Navigation */}
      <div className="shrink-0 p-3 bg-[#d9d2c4] border-t border-[#c4baaa] flex items-center justify-between gap-2 safe-bottom-padding">
        <button
          onClick={onPrevStep}
          disabled={currentStepIndex === 0}
          aria-label="Go to previous campaign tour chapter"
          className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold bg-[#f5f2ed] hover:bg-[#ebe6db] disabled:opacity-40 text-[#5c4d3e] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>Previous</span>
        </button>

        {/* Dots Step Indicator */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Campaign tour chapters">
          {CAMPAIGN_TOUR_STEPS.map((step, idx) => (
            <div
              key={idx}
              role="tab"
              aria-selected={idx === currentStepIndex}
              aria-label={`Chapter ${step.order}: ${step.title}`}
              className={`h-2 rounded-full transition-all ${
                idx === currentStepIndex
                  ? 'w-5 bg-[#a65d50]'
                  : 'w-2 bg-[#c4baaa]'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onNextStep}
          disabled={currentStepIndex === CAMPAIGN_TOUR_STEPS.length - 1}
          aria-label="Go to next campaign tour chapter"
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-bold bg-[#3d322a] hover:bg-[#4d4036] disabled:opacity-40 text-[#f5f2ed] transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

    </div>
  );
};
