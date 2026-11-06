import React, { useState } from 'react';
import { 
  X, 
  Database, 
  BookOpen, 
  Swords, 
  Search, 
  Shield, 
  Skull, 
  Users, 
  Calendar, 
  MapPin, 
  ExternalLink, 
  ChevronRight, 
  Play, 
  HelpCircle, 
  GraduationCap, 
  Sparkles,
  Layers,
  Award
} from 'lucide-react';
import { CIVIL_WAR_BATTLES } from '../data/battlesData';
import { CAMPAIGN_TOUR_STEPS } from '../data/campaignTourData';
import { Battle, CampaignTourStep, Theater, BattleOutcome, Commander } from '../types';
import { getBattleEventType, EVENT_TYPE_CONFIGS } from '../utils/markerIcons';

const ExplorerCommanderCard: React.FC<{ commander: Commander; faction: 'union' | 'confederate' }> = ({ commander, faction }) => {
  const [imgErr, setImgErr] = useState(false);
  const isUnion = faction === 'union';

  return (
    <div className={`p-2 bg-[#ebe6db] rounded-lg border ${isUnion ? 'border-[#3e5672]/30' : 'border-[#a65d50]/30'} flex items-start gap-2.5`}>
      {commander.portraitUrl && !imgErr ? (
        <img 
          src={commander.portraitUrl} 
          alt={commander.name} 
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="w-10 h-10 rounded object-cover border border-[#d1c2ab] shrink-0 bg-[#ebe6db]" 
        />
      ) : (
        <div className={`w-10 h-10 rounded ${isUnion ? 'bg-[#3e5672] text-[#f5f2ed]' : 'bg-[#a65d50] text-[#f5f2ed]'} border border-[#d1c2ab] flex flex-col items-center justify-center font-bold text-xs shrink-0 font-serif`}>
          <span>{commander.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('')}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-bold text-[#3d322a] text-xs font-serif">{commander.name} ({commander.rank})</div>
        <div className="text-[11px] text-[#5c4d3e] leading-snug">{commander.bioSnippet}</div>
      </div>
    </div>
  );
};

interface DatasetExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBattle: (battle: Battle) => void;
  onStartTourChapter: (chapterIndex: number) => void;
  onAskHistorian: (battle: Battle) => void;
}

export const DatasetExplorerModal: React.FC<DatasetExplorerModalProps> = ({
  isOpen,
  onClose,
  onSelectBattle,
  onStartTourChapter,
  onAskHistorian,
}) => {
  const [activeTab, setActiveTab] = useState<'battles' | 'tour' | 'overview'>('battles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheater, setSelectedTheater] = useState<'all' | Theater>('all');
  const [selectedOutcome, setSelectedOutcome] = useState<'all' | BattleOutcome>('all');
  const [expandedBattleId, setExpandedBattleId] = useState<string | null>(null);

  // Handle Escape key to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter battles
  const filteredBattles = CIVIL_WAR_BATTLES.filter((b) => {
    const matchesSearch = 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.unionCommanders.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.confederateCommanders.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTheater = selectedTheater === 'all' || b.theater === selectedTheater;
    const matchesOutcome = selectedOutcome === 'all' || b.outcome === selectedOutcome;

    return matchesSearch && matchesTheater && matchesOutcome;
  });

  const totalCasualtiesAll = CIVIL_WAR_BATTLES.reduce((s, b) => s + b.totalCasualties, 0);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="dataset-modal-title"
        className="bg-[#f5f2ed] border border-[#d1c2ab] rounded-2xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col text-[#3d322a] overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 bg-[#ebe6db] border-b border-[#d1c2ab] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3d322a] text-[#f5f2ed] flex items-center justify-center shadow-xs shrink-0" aria-hidden="true">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="dataset-modal-title" className="font-cinzel text-lg md:text-xl font-bold text-[#3d322a]">
                  Historical Datasets & Tour Curriculum
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#3e5672]/15 text-[#3e5672] border border-[#3e5672]/30">
                  NPS Grounded Archives
                </span>
              </div>
              <p className="text-xs text-[#6e5d4b]">
                Deep inspection of <code>battlesData.ts</code> (22 Engagements) and <code>campaignTourData.ts</code> (8 Educational Chapters)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Dataset Explorer modal"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#d9d2c4] active:bg-[#c4baaa] transition-colors cursor-pointer"
            title="Close Dataset Explorer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#d1c2ab] bg-[#ebe6db]/60 px-4 pt-2 gap-2 overflow-x-auto scrollbar-none shrink-0" role="tablist" aria-label="Dataset Views">
          <button
            role="tab"
            aria-selected={activeTab === 'battles'}
            onClick={() => setActiveTab('battles')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 min-h-[44px] text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'battles'
                ? 'border-[#a65d50] text-[#a65d50]'
                : 'border-transparent text-[#6e5d4b] hover:text-[#3d322a]'
            }`}
          >
            <Swords className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Battles Dataset (battlesData.ts)</span>
            <span className="sm:hidden">Battles</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#d1c2ab] text-[#3d322a]">
              {CIVIL_WAR_BATTLES.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'tour'}
            onClick={() => setActiveTab('tour')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 min-h-[44px] text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'tour'
                ? 'border-[#a65d50] text-[#a65d50]'
                : 'border-transparent text-[#6e5d4b] hover:text-[#3d322a]'
            }`}
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Campaign Tour Curriculum</span>
            <span className="sm:hidden">Tour</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#d1c2ab] text-[#3d322a]">
              {CAMPAIGN_TOUR_STEPS.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 min-h-[44px] text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#a65d50] text-[#a65d50]'
                : 'border-transparent text-[#7c6c5a] hover:text-[#3d322a]'
            }`}
          >
            <Award className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Dataset Schema & Synthesis</span>
            <span className="sm:hidden">Schema</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* TAB 1: BATTLES DATASET */}
          {activeTab === 'battles' && (
            <div className="space-y-4">
              
              {/* Search and Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ebe6db] p-3 rounded-xl border border-[#d1c2ab]">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a67]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search battle name, commander, location, summary..."
                    className="w-full pl-9 pr-4 py-2 bg-[#f5f2ed] border border-[#d1c2ab] rounded-lg text-xs text-[#3d322a] placeholder-[#8a7a67] focus:outline-none focus:ring-1 focus:ring-[#a65d50]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedTheater}
                    onChange={(e) => setSelectedTheater(e.target.value as any)}
                    className="bg-[#f5f2ed] border border-[#d1c2ab] text-xs text-[#3d322a] rounded-lg px-2.5 py-2 focus:outline-none"
                  >
                    <option value="all">All Theaters</option>
                    <option value="Eastern">Eastern Theater</option>
                    <option value="Western">Western Theater</option>
                    <option value="Naval/Coastal">Naval / Coastal</option>
                  </select>

                  <select
                    value={selectedOutcome}
                    onChange={(e) => setSelectedOutcome(e.target.value as any)}
                    className="bg-[#f5f2ed] border border-[#d1c2ab] text-xs text-[#3d322a] rounded-lg px-2.5 py-2 focus:outline-none"
                  >
                    <option value="all">All Outcomes</option>
                    <option value="union">Union Victory</option>
                    <option value="confederate">Confederate Victory</option>
                    <option value="inconclusive">Inconclusive / Siege</option>
                  </select>
                </div>
              </div>

              {/* Battles Count Indicator */}
              <div className="flex justify-between items-center text-xs text-[#7c6c5a] px-1">
                <span>Showing {filteredBattles.length} of {CIVIL_WAR_BATTLES.length} documented engagements in <code>battlesData.ts</code></span>
                <span>Cumulative Casualties Sample: <strong>{filteredBattles.reduce((s, b) => s + b.totalCasualties, 0).toLocaleString()}</strong></span>
              </div>

              {/* Battles List Grid */}
              <div className="space-y-3">
                {filteredBattles.map((battle) => {
                  const isExpanded = expandedBattleId === battle.id;

                  return (
                    <div 
                      key={battle.id}
                      className="bg-[#ebe6db] border border-[#d1c2ab] rounded-xl overflow-hidden shadow-xs hover:border-[#a65d50] transition-all"
                    >
                      {/* Battle Header Row */}
                      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span 
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                battle.outcome === 'union'
                                  ? 'bg-[#3e5672]/15 text-[#3e5672] border border-[#3e5672]/40'
                                  : battle.outcome === 'confederate'
                                  ? 'bg-[#a65d50]/15 text-[#a65d50] border border-[#a65d50]/40'
                                  : 'bg-[#c48a3f]/15 text-[#854d0e] border border-[#c48a3f]/40'
                              }`}
                            >
                              {battle.outcome === 'union' ? 'Union Victory' : battle.outcome === 'confederate' ? 'Confederate Victory' : 'Inconclusive / Draw'}
                            </span>
                            {(() => {
                              const evType = getBattleEventType(battle);
                              const evConfig = EVENT_TYPE_CONFIGS[evType];
                              return (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#d97706]/15 text-[#92400e] border border-[#d97706]/35">
                                  {evConfig.label}
                                </span>
                              );
                            })()}
                            <span className="text-xs font-semibold text-[#8a7a67]">
                              {battle.theater} Theater &bull; {battle.year}
                            </span>
                          </div>

                          <h3 className="font-cinzel text-base font-bold text-[#3d322a]">
                            {battle.name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#5c4d3e]">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#7c6c5a]" />
                              {battle.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#a65d50]" />
                              {battle.location}
                            </span>
                            <span>
                              Casualties: <strong className="text-[#a65d50]">{battle.totalCasualties.toLocaleString()}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onSelectBattle(battle);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed] shadow-xs transition-colors flex items-center gap-1"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#f5f2ed]" />
                            <span>Locate on Map</span>
                          </button>

                          <button
                            onClick={() => setExpandedBattleId(isExpanded ? null : battle.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f5f2ed] hover:bg-[#d9d2c4] text-[#5c4d3e] border border-[#d1c2ab] transition-colors"
                          >
                            {isExpanded ? 'Hide Record Details' : 'View Full Record'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Record Details */}
                      {isExpanded && (
                        <div className="p-4 bg-[#f5f2ed] border-t border-[#d1c2ab] space-y-4 text-xs">
                          
                          {/* Summary & Significance */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-[#ebe6db] p-3 rounded-lg border border-[#d1c2ab]">
                              <div className="font-cinzel font-bold text-[#7c6c5a] uppercase mb-1">
                                Operational Summary
                              </div>
                              <p className="text-[#5c4d3e] leading-relaxed">
                                {battle.summary}
                              </p>
                            </div>

                            <div className="bg-[#ebe6db] p-3 rounded-lg border border-[#d1c2ab]">
                              <div className="font-cinzel font-bold text-[#7c6c5a] uppercase mb-1">
                                Strategic Significance
                              </div>
                              <p className="text-[#5c4d3e] leading-relaxed">
                                {battle.strategicSignificance}
                              </p>
                            </div>
                          </div>

                          {/* Commanders */}
                          <div>
                            <div className="font-cinzel font-bold text-[#7c6c5a] uppercase mb-2">
                              Opposing Commanders
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Union */}
                              <div className="space-y-1.5">
                                <span className="font-bold text-[#3e5672] uppercase text-[11px]">Union Command:</span>
                                {battle.unionCommanders.map((c) => (
                                  <ExplorerCommanderCard key={c.name} commander={c} faction="union" />
                                ))}
                              </div>

                              {/* Confederate */}
                              <div className="space-y-1.5">
                                <span className="font-bold text-[#a65d50] uppercase text-[11px]">Confederate Command:</span>
                                {battle.confederateCommanders.map((c) => (
                                  <ExplorerCommanderCard key={c.name} commander={c} faction="confederate" />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Tactical Phases */}
                          <div className="bg-[#ebe6db] p-3 rounded-lg border border-[#d1c2ab]">
                            <div className="font-cinzel font-bold text-[#7c6c5a] uppercase mb-1.5">
                              Tactical Overview Phases
                            </div>
                            <ol className="list-decimal list-inside space-y-1 text-[#5c4d3e]">
                              {battle.tacticalOverview.map((phase, idx) => (
                                <li key={idx} className="leading-relaxed">{phase}</li>
                              ))}
                            </ol>
                          </div>

                          {/* Primary Quote */}
                          {battle.primaryQuote && (
                            <div className="p-3 bg-[#ebe6db] rounded-lg border border-[#d1c2ab] italic text-[#3d322a]">
                              "{battle.primaryQuote.text}"
                              <div className="text-right text-[11px] font-semibold text-[#7c6c5a] not-italic mt-1">
                                &mdash; {battle.primaryQuote.author} ({battle.primaryQuote.context})
                              </div>
                            </div>
                          )}

                          {/* Footnote NPS link */}
                          <div className="flex items-center justify-between pt-1">
                            <a
                              href={battle.npsReferenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-[#a65d50] hover:text-[#3d322a] flex items-center gap-1"
                            >
                              <span>Official NPS Record ({battle.name})</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => {
                                onAskHistorian(battle);
                                onClose();
                              }}
                              className="text-xs font-bold text-[#3e5672] hover:text-[#3d322a] flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Ask our AI Historian about this battle</span>
                            </button>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 2: CAMPAIGN TOUR CURRICULUM */}
          {activeTab === 'tour' && (
            <div className="space-y-4">
              <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-1">
                <h3 className="font-cinzel text-sm font-bold text-[#3d322a] flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#a65d50]" />
                  Educational Curriculum & Guided Storyline
                </h3>
                <p className="text-xs text-[#5c4d3e] leading-relaxed">
                  Defined in <code>campaignTourData.ts</code>, these 8 chapters guide students and educators through the chronological narrative of the Civil War with curriculum-aligned pedagogical focuses and classroom discussion prompts.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {CAMPAIGN_TOUR_STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    className="bg-[#ebe6db] border border-[#d1c2ab] rounded-xl p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d1c2ab] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#a65d50] text-[#f5f2ed] flex items-center justify-center font-bold text-xs">
                          {step.order}
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#a65d50]">
                            {step.year} Theater Campaign &bull; Chapter {step.order}
                          </span>
                          <h4 className="font-cinzel text-sm font-bold text-[#3d322a]">
                            {step.title}
                          </h4>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onStartTourChapter(idx);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed] shadow-xs transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Launch Chapter {step.order}</span>
                      </button>
                    </div>

                    <div className="text-xs text-[#8a7a67] font-semibold">
                      {step.subtitle}
                    </div>

                    <p className="text-xs text-[#5c4d3e] leading-relaxed">
                      {step.narrative}
                    </p>

                    <div className="bg-[#f5f2ed] p-3 rounded-lg border border-[#d1c2ab] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#7c6c5a]">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Curriculum Focus Standard:</span>
                      </div>
                      <p className="text-xs text-[#5c4d3e] italic">
                        {step.pedagogicalFocus}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#3e5672]">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Classroom Discussion Prompts:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-[#5c4d3e] pl-1">
                        {step.discussionQuestions.map((q, qIdx) => (
                          <li key={qIdx}>{q}</li>
                        ))}
                      </ul>
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )}

          {/* TAB 3: OVERVIEW & SYNTHESIS */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-1 shadow-xs">
                  <div className="text-[10px] font-bold text-[#8a7a67] uppercase">Total Battles in Dataset</div>
                  <div className="font-cinzel text-2xl font-bold text-[#3d322a]">22 Engagements</div>
                  <p className="text-[11px] text-[#5c4d3e]">Spanning Eastern, Western, and Naval Theaters (1861–1865)</p>
                </div>

                <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-1 shadow-xs">
                  <div className="text-[10px] font-bold text-[#8a7a67] uppercase">Documented Casualties</div>
                  <div className="font-cinzel text-2xl font-bold text-[#a65d50]">{totalCasualtiesAll.toLocaleString()}</div>
                  <p className="text-[11px] text-[#5c4d3e]">Categorized by Killed, Wounded, and Missing / Captured</p>
                </div>

                <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-1 shadow-xs">
                  <div className="text-[10px] font-bold text-[#8a7a67] uppercase">Curriculum Tour Chapters</div>
                  <div className="font-cinzel text-2xl font-bold text-[#3e5672]">8 Chapters</div>
                  <p className="text-[11px] text-[#5c4d3e]">Equipped with high school AP/NPS discussion prompts</p>
                </div>
              </div>

              <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-2">
                <h4 className="font-cinzel font-bold text-[#3d322a] uppercase">
                  Data Architecture Breakdown
                </h4>
                <div className="space-y-2 text-[#5c4d3e] leading-relaxed">
                  <p>
                    <strong>1. <code>battlesData.ts</code> (Battle Object Schema):</strong> Each battle contains exact geographical coordinates (<code>lat</code>, <code>lng</code>), optimal map zoom level (<code>zoomLevel</code>), high-resolution commander portraits with biographical summaries, casualty matrices for Union and Confederate armies, tactical timeline phases, and primary source quotes.
                  </p>
                  <p>
                    <strong>2. <code>campaignTourData.ts</code> (Guided Storyline Schema):</strong> Contains step-by-step narrative chapters with geographic coordinates, pedagogical inquiries, and links to landmark battles.
                  </p>
                  <p>
                    <strong>3. Grounding with Dr. Shelby Vance (AI Historian):</strong> The AI Historian uses these grounded datasets in combination with NPS archives to answer classroom inquiries, compare commanders, and analyze strategic turning points.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#ebe6db] border-t border-[#d1c2ab] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#7c6c5a]">
            Historical datasets curated from U.S. National Park Service Battlefield Preservation Reports.
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed] transition-colors shadow-xs"
          >
            Return to Map
          </button>
        </div>

      </div>
    </div>
  );
};
