import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  Calendar,
  Layers,
  Flag,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Volume2
} from 'lucide-react';
import { Battle } from '../types';

interface TimelineSliderProps {
  currentDateIndex: number;
  totalDates: number;
  currentDateFormatted: string;
  onDateChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onReset: () => void;
  viewMode: 'all' | 'cumulative' | 'window';
  onToggleViewMode: () => void;
  battles: Battle[];
  activeBattles: Battle[];
  onSelectBattle: (battle: Battle) => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
  isDrawerPeeking?: boolean;
  isGeminiReadEnabled?: boolean;
  onToggleGeminiRead?: () => void;
  isReadingAudio?: boolean;
  isReadingLoading?: boolean;
}

// Milestone Key Landmarks for quick jumps
const MILESTONES = [
  { label: 'Fort Sumter', index: 0, date: 'Apr 1861', battleId: 'fort-sumter' },
  { label: 'Shiloh', index: 4, date: 'Apr 1862', battleId: 'shiloh' },
  { label: 'Antietam', index: 7, date: 'Sep 1862', battleId: 'antietam' },
  { label: 'Gettysburg', index: 11, date: 'Jul 1863', battleId: 'gettysburg' },
  { label: 'Vicksburg', index: 10, date: 'Jul 1863', battleId: 'vicksburg' },
  { label: 'Atlanta', index: 16, date: 'Jul 1864', battleId: 'atlanta' },
  { label: 'Appomattox', index: 19, date: 'Apr 1865', battleId: 'appomattox' },
];

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  currentDateIndex,
  totalDates,
  currentDateFormatted,
  onDateChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  onReset,
  viewMode,
  onToggleViewMode,
  battles,
  activeBattles,
  onSelectBattle,
  isCompact,
  onToggleCompact,
  isDrawerPeeking,
  isGeminiReadEnabled = false,
  onToggleGeminiRead,
  isReadingAudio = false,
  isReadingLoading = false,
}) => {
  const sliderRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [internalMinimized, setInternalMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return true; // Start in sleek micro-bar mode on mobile so the map is unobstructed!
    }
    return false;
  });

  const isMinimized = isCompact !== undefined ? isCompact : internalMinimized;
  const toggleMinimized = onToggleCompact || (() => setInternalMinimized((prev) => !prev));

  // Measure container width to dynamically scale text below the timeline and prevent overflow
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measurement
    const initialWidth = el.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setContainerWidth(initialWidth);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMinimized]);

  // Auto playback timer when Gemini Read is NOT enabled (standard timer mode).
  // When Gemini Read is enabled, the tour advancement is strictly triggered only
  // after the full content of Operational Overview sent to Gemini TTS finishes playing!
  useEffect(() => {
    if (!isPlaying || isGeminiReadEnabled) return;

    // 9,000ms base reading duration per battlefield at 1x speed
    const baseDuration = 9000;
    const intervalTime = Math.max(1500, baseDuration / playbackSpeed);
    const timer = setInterval(() => {
      if (currentDateIndex >= totalDates - 1) {
        onTogglePlay();
      } else {
        onDateChange(currentDateIndex + 1);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, isGeminiReadEnabled, playbackSpeed, currentDateIndex, totalDates, onDateChange, onTogglePlay]);

  if (isMinimized) {
    return (
      <div 
        role="region"
        aria-label="Campaign Timeline Micro Controls"
        className={`fixed sm:absolute z-20 max-w-[calc(100vw-1rem)] sm:max-w-xl mx-auto bg-[#ebe6db]/95 backdrop-blur-md border border-[#d1c2ab] rounded-xl px-2.5 sm:px-3.5 py-1.5 shadow-xl flex items-center justify-between gap-2 text-[#3d322a] select-none box-border animate-in fade-in slide-in-from-bottom-2 duration-150 transition-all ${
          isDrawerPeeking
            ? 'bottom-[88px] left-2 right-2 sm:bottom-[92px] sm:left-1/2 sm:-translate-x-1/2'
            : 'bottom-8 left-2 right-2 sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2'
        }`}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause Campaign Timeline Playback' : 'Play Campaign Timeline Tour'}
            className={`flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-lg font-bold text-xs shadow-xs cursor-pointer shrink-0 ${
              isPlaying ? 'bg-[#a65d50] text-[#f5f2ed]' : 'bg-[#3d322a] text-[#f5f2ed]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {onToggleGeminiRead && (
            <button
              onClick={onToggleGeminiRead}
              aria-label={isGeminiReadEnabled ? 'Disable Gemini Voice Reader' : 'Enable Gemini Voice Reader'}
              className={`flex items-center gap-1 px-2 py-1 min-h-[32px] rounded-lg font-bold text-xs cursor-pointer shrink-0 border ${
                isGeminiReadEnabled
                  ? 'bg-amber-100 text-amber-950 border-amber-400'
                  : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab]'
              }`}
              title={isGeminiReadEnabled ? 'Gemini Read is ON (advances after audio)' : 'Enable Gemini Read'}
            >
              {isReadingLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
              ) : (
                <Sparkles className={`w-3 h-3 ${isGeminiReadEnabled ? 'text-amber-600' : 'text-[#a65d50]'}`} />
              )}
              <span className="hidden sm:inline">Voice</span>
            </button>
          )}

          <button
            onClick={() => onDateChange(Math.max(0, currentDateIndex - 1))}
            disabled={currentDateIndex === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] border border-[#d1c2ab] disabled:opacity-40 text-[#5c4d3e] cursor-pointer shrink-0"
            title="Previous Campaign Date"
            aria-label="Previous Campaign Date"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2 px-1">
          <div className="flex items-baseline gap-1 shrink-0 whitespace-nowrap bg-[#f5f2ed] px-2 py-0.5 rounded-md border border-[#d1c2ab]">
            {(() => {
              const parts = currentDateFormatted.split(' ');
              if (parts.length >= 2) {
                return (
                  <>
                    <span className="font-sans font-bold text-[10px] sm:text-xs uppercase tracking-wider text-[#6e5d4b]">
                      {parts[0]}
                    </span>
                    <span className="font-cinzel text-xs sm:text-sm font-black text-[#a65d50] tracking-wide">
                      {parts.slice(1).join(' ')}
                    </span>
                  </>
                );
              }
              return (
                <span className="font-cinzel text-xs sm:text-sm font-bold text-[#a65d50] whitespace-nowrap">
                  {currentDateFormatted}
                </span>
              );
            })()}
          </div>
          <input
            type="range"
            min="0"
            max={totalDates - 1}
            value={currentDateIndex}
            onChange={(e) => onDateChange(parseInt(e.target.value, 10))}
            aria-label="Timeline Date Scrubber"
            className="w-full h-1.5 bg-[#d1c2ab] rounded-lg appearance-none cursor-pointer accent-[#a65d50]"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDateChange(Math.min(totalDates - 1, currentDateIndex + 1))}
            disabled={currentDateIndex === totalDates - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] border border-[#d1c2ab] disabled:opacity-40 text-[#5c4d3e] cursor-pointer shrink-0"
            title="Next Campaign Date"
            aria-label="Next Campaign Date"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleMinimized}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#5c4d3e] border border-[#d1c2ab] cursor-pointer shrink-0"
            title="Expand Full Timeline Controls"
            aria-label="Expand Full Timeline Controls"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`fixed sm:absolute z-20 max-w-[calc(100vw-1rem)] sm:max-w-3xl lg:max-w-4xl mx-auto bg-[#ebe6db]/95 backdrop-blur-md border border-[#d1c2ab] rounded-2xl p-2.5 sm:p-4 safe-bottom-padding shadow-xl text-[#3d322a] select-none box-border transition-all overflow-hidden ${
      isDrawerPeeking
        ? 'bottom-[88px] left-2 right-2 sm:bottom-[92px] sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-8rem)] lg:w-[calc(100%-10rem)]'
        : 'bottom-8 left-2 right-2 sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-8rem)] lg:w-[calc(100%-10rem)]'
    }`}>
      
      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1.5 sm:mb-2 w-full">
        
        {/* Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Step Back */}
          <button
            onClick={() => onDateChange(Math.max(0, currentDateIndex - 1))}
            disabled={currentDateIndex === 0}
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] active:bg-[#c4baaa] disabled:opacity-40 text-[#5c4d3e] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0"
            title="Previous Campaign Date"
            aria-label="Previous Campaign Date"
          >
            <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause Campaign Timeline Playback' : 'Play Campaign Timeline Tour'}
            aria-pressed={isPlaying}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 min-h-[32px] sm:min-h-[40px] rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer shrink-0 ${
              isPlaying
                ? 'bg-[#a65d50] hover:bg-[#8f4a3e] text-[#f5f2ed]'
                : 'bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" aria-hidden="true" />
                <span>Play<span className="hidden xs:inline sm:inline"> Tour</span></span>
              </>
            )}
          </button>

          {/* Step Forward */}
          <button
            onClick={() => onDateChange(Math.min(totalDates - 1, currentDateIndex + 1))}
            disabled={currentDateIndex === totalDates - 1}
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] active:bg-[#c4baaa] disabled:opacity-40 text-[#5c4d3e] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0"
            title="Next Campaign Date"
            aria-label="Next Campaign Date"
          >
            <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          </button>

          {/* Gemini Read Auto-Narration Toggle Button */}
          {onToggleGeminiRead && (
            <button
              onClick={onToggleGeminiRead}
              aria-label={isGeminiReadEnabled ? 'Disable Gemini Audio Reading for Tour' : 'Enable Gemini Audio Reading for Tour'}
              aria-pressed={isGeminiReadEnabled}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 min-h-[32px] sm:min-h-[40px] rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer shrink-0 border ${
                isGeminiReadEnabled
                  ? 'bg-amber-100/90 text-amber-950 border-amber-400 hover:bg-amber-200/90 shadow-amber-900/10'
                  : 'bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#5c4d3e] border-[#d1c2ab]'
              }`}
              title={
                isGeminiReadEnabled
                  ? 'Gemini Read is ON: Tour moves to next destination only after Operational Overview finishes reading out loud'
                  : 'Enable Gemini Read: Tour will automatically read Operational Overview out loud and advance when speech finishes'
              }
            >
              {isReadingLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Sparkles className={`w-3.5 h-3.5 ${isGeminiReadEnabled ? 'text-amber-600 fill-amber-300' : 'text-[#a65d50]'}`} />
              )}
              <span>Gemini Read</span>
              {isGeminiReadEnabled && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" aria-hidden="true" />
              )}
            </button>
          )}

          {/* Active Audio Narration Indicator */}
          {isPlaying && isGeminiReadEnabled && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-300/80 rounded-lg text-[11px] font-semibold text-amber-900 shrink-0">
              <Volume2 className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Narrating Overview • Advances after audio</span>
            </div>
          )}

          {/* Reset (Desktop only) */}
          <button
            onClick={onReset}
            className="hidden sm:flex p-2 min-w-[40px] min-h-[40px] items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] active:bg-[#c4baaa] text-[#5c4d3e] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer"
            title="Reset to 1861"
            aria-label="Reset timeline to April 1861"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Playback Speed Pill (Desktop only) */}
          <div className="hidden sm:flex items-center bg-[#f5f2ed] p-0.5 rounded-lg border border-[#d1c2ab] text-xs" role="group" aria-label="Playback speed">
            {[0.5, 1, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => onChangeSpeed(speed)}
                aria-label={`Set playback speed to ${speed}x`}
                aria-pressed={playbackSpeed === speed}
                className={`px-2.5 py-1.5 min-h-[36px] rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-[#3d322a] text-[#f5f2ed]'
                    : 'text-[#6e5d4b] hover:text-[#3d322a]'
                }`}
                title={`Tour Reading Speed ${speed}x`}
              >
                {speed}x
              </button>
            ))}
          </div>

        </div>

        {/* Current Active Date & Year Badge */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#f5f2ed] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#d1c2ab] shadow-xs shrink-0">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-[#7c6c5a] shrink-0" aria-hidden="true" />
            {(() => {
              const parts = currentDateFormatted.split(' ');
              if (parts.length >= 2) {
                return (
                  <span className="flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap">
                    <span className="font-sans font-bold text-[11px] sm:text-xs uppercase tracking-wider text-[#6e5d4b]">
                      {parts[0]}
                    </span>
                    <span className="font-cinzel text-xs sm:text-base font-black text-[#a65d50] tracking-wide">
                      {parts.slice(1).join(' ')}
                    </span>
                  </span>
                );
              }
              return (
                <span className="font-cinzel text-xs sm:text-base font-bold text-[#a65d50] tracking-wide whitespace-nowrap">
                  {currentDateFormatted}
                </span>
              );
            })()}
          </div>

          {/* Mode Toggle Button (Desktop only) */}
          <button
            onClick={onToggleViewMode}
            aria-label={`View mode: currently ${viewMode}. Click to toggle.`}
            className={`hidden sm:flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors shadow-xs cursor-pointer ${
              viewMode === 'all'
                ? 'bg-[#a65d50] text-[#f5f2ed] border-[#a65d50]'
                : viewMode === 'cumulative'
                ? 'bg-[#3e5672] text-[#f5f2ed] border-[#3e5672]'
                : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:bg-[#ebe6db]'
            }`}
            title="Switch between All Battles (1861-1865), Cumulative to Date, or Active Period"
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {viewMode === 'all'
                ? 'All Battles (22)'
                : viewMode === 'cumulative'
                ? 'Cumulative (to Date)'
                : 'Active Campaign'}
            </span>
          </button>

          {/* Mobile Options & Milestones Toggle Button */}
          <button
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            aria-label={isMobileExpanded ? 'Collapse timeline options' : 'Expand timeline options and turning points'}
            aria-expanded={isMobileExpanded}
            className={`sm:hidden w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isMobileExpanded
                ? 'bg-[#3d322a] text-[#f5f2ed] border-[#3d322a]'
                : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:bg-[#d9d2c4]'
            }`}
          >
            {isMobileExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Minimize / Dock Timeline to Micro-Bar */}
          <button
            onClick={toggleMinimized}
            aria-label="Minimize timeline to compact micro-bar"
            title="Minimize timeline to compact micro-bar"
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-[#f5f2ed] hover:bg-[#d9d2c4] active:bg-[#c4baaa] text-[#5c4d3e] hover:text-[#3d322a] border border-[#d1c2ab] transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          </button>
        </div>

      </div>

      {/* Main Scrubber Slider */}
      <div className="relative py-2 sm:py-2.5 w-full">
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max={totalDates - 1}
          value={currentDateIndex}
          onChange={(e) => onDateChange(parseInt(e.target.value, 10))}
          role="slider"
          aria-label="Civil War Campaign Timeline Date Scrubber"
          aria-valuemin={0}
          aria-valuemax={totalDates - 1}
          aria-valuenow={currentDateIndex}
          aria-valuetext={currentDateFormatted}
          className="w-full h-3 bg-[#d1c2ab] rounded-lg appearance-none cursor-pointer accent-[#a65d50] focus:outline-none focus:ring-2 focus:ring-[#a65d50]/40 block"
        />

        {/* Responsive Milestone Ticks: strictly scales and fits container width so text never collides or overflows */}
        {(() => {
          // If container width is very narrow (< 280px), hide ticks entirely
          if (containerWidth > 0 && containerWidth < 280) {
            return null;
          }

          // Compact / narrow containers (280px - 450px): Show only start and end bounds
          if (containerWidth > 0 && containerWidth < 450) {
            return (
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold text-[#6e5d4b] mt-1.5 px-2 font-sans select-none overflow-hidden" aria-hidden="true">
                <span className={`whitespace-nowrap shrink-0 ${currentDateIndex === 0 ? 'text-[#a65d50] font-black' : ''}`}>1861</span>
                <span className={`whitespace-nowrap shrink-0 ${currentDateIndex === totalDates - 1 ? 'text-[#a65d50] font-black' : ''}`}>1865</span>
              </div>
            );
          }

          // Standard / drawer-adjacent containers (450px - 720px, or initial render before measurement):
          // Show the 5 clean year numbers (1861, 1862, 1863, 1864, 1865).
          // 5 numbers of 4 characters each take ~150px total, leaving generous space in between and 0% risk of collision.
          if (containerWidth < 720) {
            return (
              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold text-[#6e5d4b] mt-1.5 px-2 font-sans select-none overflow-hidden" aria-hidden="true">
                <span className={`whitespace-nowrap shrink-0 ${currentDateIndex === 0 ? 'text-[#a65d50] font-black' : ''}`}>1861</span>
                <span className="whitespace-nowrap shrink-0">1862</span>
                <span className={`whitespace-nowrap shrink-0 ${currentDateIndex >= 9 && currentDateIndex <= 13 ? 'text-[#a65d50] font-black' : ''}`}>1863</span>
                <span className="whitespace-nowrap shrink-0">1864</span>
                <span className={`whitespace-nowrap shrink-0 ${currentDateIndex === totalDates - 1 ? 'text-[#a65d50] font-black' : ''}`}>1865</span>
              </div>
            );
          }

          // Very wide containers (>= 720px): Can display milestone labels, each strictly constrained to max 18% width with truncate
          return (
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#6e5d4b] tracking-wide mt-1.5 px-2 font-sans select-none overflow-hidden" aria-hidden="true">
              <span className={`truncate max-w-[18%] text-left ${currentDateIndex === 0 ? 'text-[#a65d50] font-black' : ''}`}>
                1861 Sumter
              </span>
              <span className="truncate max-w-[18%] text-center">
                1862 Antietam
              </span>
              <span className={`truncate max-w-[18%] text-center ${currentDateIndex >= 9 && currentDateIndex <= 13 ? 'text-[#a65d50] font-black' : ''}`}>
                1863 Gettysburg
              </span>
              <span className="truncate max-w-[18%] text-center">
                1864 Atlanta
              </span>
              <span className={`truncate max-w-[18%] text-right ${currentDateIndex === totalDates - 1 ? 'text-[#a65d50] font-black' : ''}`}>
                1865 Appomattox
              </span>
            </div>
          );
        })()}
      </div>

      {/* Expanded Controls on Mobile */}
      {isMobileExpanded && (
        <div className="sm:hidden pt-2 mt-1 border-t border-[#d1c2ab] flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          
          {/* Speed, Reset, View Mode bar */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onReset}
                className="px-2.5 py-1.5 min-h-[36px] flex items-center gap-1 rounded-lg bg-[#f5f2ed] text-[#5c4d3e] hover:text-[#3d322a] border border-[#d1c2ab] text-xs font-semibold cursor-pointer"
                title="Reset to 1861"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <div className="flex items-center bg-[#f5f2ed] p-0.5 rounded-lg border border-[#d1c2ab] text-xs" role="group" aria-label="Playback speed">
                {[0.5, 1, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => onChangeSpeed(speed)}
                    aria-label={`Set speed to ${speed}x`}
                    className={`px-2 py-1 min-h-[32px] rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      playbackSpeed === speed
                        ? 'bg-[#3d322a] text-[#f5f2ed]'
                        : 'text-[#6e5d4b]'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onToggleViewMode}
              className={`px-2.5 py-1.5 min-h-[36px] flex items-center gap-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-[#a65d50] text-[#f5f2ed] border-[#a65d50]'
                  : viewMode === 'cumulative'
                  ? 'bg-[#3e5672] text-[#f5f2ed] border-[#3e5672]'
                  : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{viewMode === 'all' ? 'All (22)' : viewMode === 'cumulative' ? 'Cumulative' : 'Active'}</span>
            </button>
          </div>

          {/* Quick Landmark Turning Points Jump Chips on Mobile */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1 pb-0.5 scrollbar-none" role="toolbar" aria-label="Key Turning Point Landmarks">
            <span className="text-[10px] uppercase font-bold text-[#6e5d4b] flex items-center gap-1 shrink-0">
              <Flag className="w-3 h-3 text-[#a65d50]" aria-hidden="true" />
            </span>
            {MILESTONES.map((m) => {
              const isCurrent = Math.abs(currentDateIndex - m.index) <= 1;
              return (
                <button
                  key={m.label}
                  onClick={() => {
                    onDateChange(m.index);
                    const matched = battles.find((b) => b.id === m.battleId);
                    if (matched) onSelectBattle(matched);
                  }}
                  aria-label={`Jump timeline to ${m.label} (${m.date})`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`px-2 py-1 min-h-[32px] flex items-center text-[10px] font-semibold rounded-md border whitespace-nowrap transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#a65d50] text-[#f5f2ed] border-[#a65d50] shadow-xs'
                      : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:bg-[#ebe6db]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Landmark Turning Points Jump Chips (Desktop always visible) */}
      {(!containerWidth || containerWidth >= 300) && (
        <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none w-full" role="toolbar" aria-label="Key Turning Point Landmarks">
          <span className="text-[10px] uppercase font-bold text-[#6e5d4b] flex items-center gap-1 shrink-0">
            <Flag className="w-3 h-3 text-[#a65d50]" aria-hidden="true" />
            <span className={containerWidth > 0 && containerWidth < 500 ? 'hidden' : 'inline'}>Turning Points:</span>
          </span>
          {MILESTONES.map((m) => {
            const isCurrent = Math.abs(currentDateIndex - m.index) <= 1;
            return (
              <button
                key={m.label}
                onClick={() => {
                  onDateChange(m.index);
                  const matched = battles.find((b) => b.id === m.battleId);
                  if (matched) onSelectBattle(matched);
                }}
                aria-label={`Jump timeline to ${m.label} (${m.date})`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`px-2.5 py-1.5 min-h-[36px] flex items-center text-[11px] font-semibold rounded-md border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isCurrent
                    ? 'bg-[#a65d50] text-[#f5f2ed] border-[#a65d50] shadow-xs'
                    : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:bg-[#ebe6db] hover:text-[#3d322a]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
};
