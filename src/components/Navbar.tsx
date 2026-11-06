import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  BookOpen, 
  BarChart3, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Database,
  Menu,
  X,
  SlidersHorizontal
} from 'lucide-react';
import { Theater, BattleOutcome } from '../types';

interface NavbarProps {
  currentDateFormatted: string;
  activeBattlesCount: number;
  totalCasualties: number;
  selectedTheater: 'all' | Theater;
  onSelectTheater: (theater: 'all' | Theater) => void;
  selectedOutcome: 'all' | BattleOutcome;
  onSelectOutcome: (outcome: 'all' | BattleOutcome) => void;
  isTourActive: boolean;
  onToggleTour: () => void;
  isHistorianOpen: boolean;
  onToggleHistorian: () => void;
  onOpenAnalytics: () => void;
  onOpenDatasetExplorer: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentDateFormatted,
  activeBattlesCount,
  totalCasualties,
  selectedTheater,
  onSelectTheater,
  selectedOutcome,
  onSelectOutcome,
  isTourActive,
  onToggleTour,
  isHistorianOpen,
  onToggleHistorian,
  onOpenAnalytics,
  onOpenDatasetExplorer,
  audioEnabled,
  onToggleAudio,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key press
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <header className="relative w-full z-20 shrink-0 bg-[#ebe6db] border-b border-[#d1c2ab] text-[#3d322a] px-3 sm:px-4 py-2 safe-top-padding shadow-xs select-none">
      <div className="w-full flex items-center justify-between gap-2">
        
        {/* Brand & Educator Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#7c6c5a] border border-[#8a7a67] flex items-center justify-center text-[#f5f2ed] shadow-inner shrink-0" aria-hidden="true">
            <Compass className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h1 className="font-cinzel font-bold tracking-tight text-[#3d322a] whitespace-nowrap">
                <span className="sm:hidden text-xs">CIVIL WAR TOUR</span>
                <span className="hidden sm:inline text-sm md:text-base lg:text-lg">CIVIL WAR BATTLEFIELD TOUR</span>
              </h1>
              <span className="hidden 2xl:inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#f5f2ed] text-[#5c4d3e] border border-[#d1c2ab] rounded-full font-sans whitespace-nowrap shrink-0">
                1861 – 1865
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-[#6e5d4b] font-sans hidden 2xl:block truncate">
              Interactive Battlefield Cartography &bull; National Park Service Archives
            </p>
          </div>
        </div>

        {/* Real-Time Classroom Live Data Ticker (Desktop 2xl only to preserve space) */}
        <div className="hidden 2xl:flex items-center gap-4 bg-[#f5f2ed] px-3.5 py-1.5 rounded-lg border border-[#d1c2ab] shadow-xs shrink-0" role="region" aria-label="Classroom Live Data Ticker">
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e5d4b]">
              Scrubbed Period
            </div>
            <div className="text-sm font-bold text-[#3d322a] whitespace-nowrap">
              {currentDateFormatted}
            </div>
          </div>
          <div className="h-7 w-[1px] bg-[#d1c2ab]" aria-hidden="true" />
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e5d4b]">
              Active Markers
            </div>
            <div className="text-sm font-bold text-[#3e5672]">
              {activeBattlesCount} <span className="text-xs font-normal text-[#6e5d4b]">battles</span>
            </div>
          </div>
          <div className="h-7 w-[1px] bg-[#d1c2ab]" aria-hidden="true" />
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e5d4b]">
              Cumulative Losses
            </div>
            <div className="text-sm font-bold text-[#a65d50]">
              {totalCasualties.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Action Controls & Navigation (hidden on mobile < 768px) */}
        <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Theater Filter: Dropdown on md-lg (< xl), full segmented buttons on xl+ */}
          <div className="flex xl:hidden items-center">
            <label htmlFor="theater-select" className="sr-only">Filter by Theater</label>
            <select
              id="theater-select"
              value={selectedTheater}
              onChange={(e) => onSelectTheater(e.target.value as any)}
              className="bg-[#f5f2ed] text-[#3d322a] font-semibold text-xs border border-[#d1c2ab] rounded-lg px-2.5 py-2 min-h-[40px] focus:ring-1 focus:ring-[#7c6c5a] cursor-pointer shadow-xs"
            >
              <option value="all">All Theaters</option>
              <option value="Eastern">Eastern Theater</option>
              <option value="Western">Western Theater</option>
              <option value="Naval/Coastal">Naval/Coastal</option>
            </select>
          </div>

          <div className="hidden xl:flex items-center gap-1 bg-[#f5f2ed] p-1 rounded-lg border border-[#d1c2ab]" role="group" aria-label="Filter battles by theater">
            {(['all', 'Eastern', 'Western', 'Naval/Coastal'] as const).map((theater) => (
              <button
                key={theater}
                onClick={() => onSelectTheater(theater)}
                aria-pressed={selectedTheater === theater}
                className={`px-2.5 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  selectedTheater === theater
                    ? 'bg-[#3d322a] text-[#f5f2ed] shadow-xs font-semibold'
                    : 'text-[#5c4d3e] hover:text-[#3d322a] hover:bg-[#ebe6db]'
                }`}
              >
                {theater === 'all' ? 'All Theaters' : theater}
              </button>
            ))}
          </div>

          {/* Dataset Explorer Launcher */}
          <button
            onClick={onOpenDatasetExplorer}
            title="Inspect battlesData.ts and campaignTourData.ts records"
            aria-label="Open Datasets and Tour Explorer"
            className="flex items-center justify-center gap-1.5 px-2.5 xl:px-3 py-2 min-h-[40px] text-xs font-semibold bg-[#f5f2ed] hover:bg-[#d9d2c4] active:bg-[#c4baaa] text-[#3d322a] border border-[#d1c2ab] rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Database className="w-4 h-4 text-[#7c6c5a]" aria-hidden="true" />
            <span className="hidden 2xl:inline">Datasets &amp; Tour</span>
          </button>

          {/* Casualties Analytics Modal Launcher */}
          <button
            onClick={onOpenAnalytics}
            title="View Casualty Analytics & Rankings"
            aria-label="Open Casualty Analytics and Rankings Modal"
            className="flex items-center justify-center gap-1.5 px-2.5 xl:px-3 py-2 min-h-[40px] text-xs font-semibold bg-[#f5f2ed] hover:bg-[#d9d2c4] active:bg-[#c4baaa] text-[#3d322a] border border-[#d1c2ab] rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-[#7c6c5a]" aria-hidden="true" />
            <span className="hidden xl:inline">Analytics</span>
          </button>

          {/* Guided Tour Mode Toggle */}
          <button
            onClick={onToggleTour}
            aria-label={isTourActive ? 'Exit Guided Campaign Tour' : 'Start Guided Campaign Tour'}
            aria-pressed={isTourActive}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg border transition-all shadow-xs cursor-pointer whitespace-nowrap ${
              isTourActive
                ? 'bg-[#a65d50] text-[#f5f2ed] border-[#a65d50] ring-2 ring-[#a65d50]/30 font-bold'
                : 'bg-[#f5f2ed] hover:bg-[#ebe6db] text-[#a65d50] border-[#a65d50]'
            }`}
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span className="hidden lg:inline">{isTourActive ? 'Exit Tour' : 'Campaign Tour'}</span>
            <span className="lg:hidden">{isTourActive ? 'Exit' : 'Tour'}</span>
          </button>

          {/* Audio Narration Toggle */}
          <button
            onClick={onToggleAudio}
            title={audioEnabled ? 'Mute Historical Narration' : 'Enable Audio Narration'}
            aria-label={audioEnabled ? 'Mute Historical Audio Narration' : 'Enable Historical Audio Narration'}
            aria-pressed={audioEnabled}
            className={`p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border text-xs transition-colors shadow-xs cursor-pointer ${
              audioEnabled
                ? 'bg-[#3e5672] text-[#f5f2ed] border-[#3e5672]'
                : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:text-[#3d322a] hover:bg-[#ebe6db]'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
          </button>

          {/* Grounded Historian Drawer Launcher */}
          <button
            onClick={onToggleHistorian}
            aria-label={isHistorianOpen ? 'Close AI Civil War Historian Drawer' : 'Open AI Civil War Historian Drawer'}
            aria-expanded={isHistorianOpen}
            className={`relative flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-bold rounded-full border transition-all shadow-sm cursor-pointer whitespace-nowrap ${
              isHistorianOpen
                ? 'bg-[#4d4036] text-[#f5f2ed] border-[#3d322a] ring-2 ring-[#7c6c5a]/40'
                : 'bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed] border-[#2a221c]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#f5f2ed]" aria-hidden="true" />
            <span>Ask Historian</span>
            <span className="flex h-2 w-2 relative" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a65d50] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#a65d50]"></span>
            </span>
          </button>

        </div>

        {/* Mobile Action Bar (< 768px): Kept ultra-clean with only Historian and Menu button */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {/* Ask Historian Button (Compact) */}
          <button
            onClick={onToggleHistorian}
            aria-label={isHistorianOpen ? 'Close AI Historian' : 'Open AI Historian'}
            aria-expanded={isHistorianOpen}
            className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-bold rounded-full border transition-all shadow-sm cursor-pointer whitespace-nowrap ${
              isHistorianOpen
                ? 'bg-[#4d4036] text-[#f5f2ed] border-[#3d322a]'
                : 'bg-[#3d322a] text-[#f5f2ed] border-[#2a221c]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#f5f2ed]" aria-hidden="true" />
            <span>Historian</span>
            <span className="flex h-1.5 w-1.5 relative" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a65d50] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#a65d50]"></span>
            </span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={isMobileMenuOpen}
            className={`p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border transition-colors shadow-xs cursor-pointer ${
              isMobileMenuOpen
                ? 'bg-[#3d322a] text-[#f5f2ed] border-[#3d322a]'
                : 'bg-[#f5f2ed] text-[#3d322a] border-[#d1c2ab] hover:bg-[#d9d2c4]'
            }`}
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

        </div>

      </div>

      {/* Mobile Overflow Menu Dropdown */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#ebe6db]/98 border-b border-[#d1c2ab] shadow-2xl backdrop-blur-md p-4 flex flex-col gap-3 max-h-[calc(100vh-64px)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
          role="region"
          aria-label="Mobile Navigation and Filters Menu"
        >
          {/* Theater Filter Chips on Mobile */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#6e5d4b] mb-1.5 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Theater of War</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['all', 'Eastern', 'Western', 'Naval/Coastal'] as const).map((theater) => (
                <button
                  key={theater}
                  onClick={() => {
                    onSelectTheater(theater);
                    setIsMobileMenuOpen(false);
                  }}
                  aria-pressed={selectedTheater === theater}
                  className={`px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg border transition-all text-center cursor-pointer ${
                    selectedTheater === theater
                      ? 'bg-[#3d322a] text-[#f5f2ed] border-[#3d322a] shadow-xs'
                      : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:bg-[#ebe6db]'
                  }`}
                >
                  {theater === 'all' ? 'All Theaters' : theater}
                </button>
              ))}
            </div>
          </div>

          {/* Guided Campaign Tour Launcher on Mobile */}
          <button
            onClick={() => {
              onToggleTour();
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border transition-all shadow-xs cursor-pointer ${
              isTourActive
                ? 'bg-[#a65d50] text-[#f5f2ed] border-[#a65d50]'
                : 'bg-[#f5f2ed] text-[#a65d50] border-[#a65d50] hover:bg-[#ebe6db]'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{isTourActive ? 'Exit Guided Campaign Tour' : 'Start Guided Campaign Tour'}</span>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isTourActive ? 'bg-white/20 text-white' : 'bg-[#a65d50]/15 text-[#a65d50]'}`}>
              {isTourActive ? 'Active' : '10 Chapters'}
            </span>
          </button>

          {/* Modals & Tools on Mobile */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#d1c2ab]/60">
            <button
              onClick={() => {
                onOpenAnalytics();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-semibold bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#3d322a] border border-[#d1c2ab] rounded-xl shadow-xs cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-[#a65d50]" />
              <span>Casualty Analytics</span>
            </button>

            <button
              onClick={() => {
                onOpenDatasetExplorer();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-semibold bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#3d322a] border border-[#d1c2ab] rounded-xl shadow-xs cursor-pointer"
            >
              <Database className="w-4 h-4 text-[#3e5672]" />
              <span>Datasets & Tour</span>
            </button>
          </div>

          {/* Audio Narration Toggle on Mobile */}
          <button
            onClick={onToggleAudio}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border transition-colors shadow-xs cursor-pointer ${
              audioEnabled
                ? 'bg-[#3e5672] text-[#f5f2ed] border-[#3e5672]'
                : 'bg-[#f5f2ed] text-[#5c4d3e] border-[#d1c2ab] hover:bg-[#ebe6db]'
            }`}
          >
            <div className="flex items-center gap-2">
              {audioEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4" />}
              <span>Historical Audio Narration</span>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${audioEnabled ? 'bg-white/20 text-white' : 'bg-[#d1c2ab] text-[#3d322a]'}`}>
              {audioEnabled ? 'Active' : 'Muted'}
            </span>
          </button>

          {/* Quick Stats Ticker on Mobile */}
          <div className="grid grid-cols-3 gap-2 bg-[#f5f2ed] p-2.5 rounded-xl border border-[#d1c2ab] text-center shadow-xs">
            <div>
              <div className="text-[9px] uppercase font-bold text-[#6e5d4b]">Period</div>
              <div className="text-xs font-bold text-[#3d322a] truncate">{currentDateFormatted}</div>
            </div>
            <div className="border-x border-[#d1c2ab]/80 px-1">
              <div className="text-[9px] uppercase font-bold text-[#6e5d4b]">Active</div>
              <div className="text-xs font-bold text-[#3e5672]">{activeBattlesCount} battles</div>
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-[#6e5d4b]">Casualties</div>
              <div className="text-xs font-bold text-[#a65d50] truncate">{totalCasualties.toLocaleString()}</div>
            </div>
          </div>

        </div>
      )}

    </header>
  );
};

