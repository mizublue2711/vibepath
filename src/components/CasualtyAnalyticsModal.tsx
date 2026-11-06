import React, { useState } from 'react';
import { 
  X, 
  Skull, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Award, 
  HeartHandshake, 
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react';
import { Battle } from '../types';

interface CasualtyAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  battles: Battle[];
  onSelectBattle: (battle: Battle) => void;
}

export const CasualtyAnalyticsModal: React.FC<CasualtyAnalyticsModalProps> = ({
  isOpen,
  onClose,
  battles,
  onSelectBattle,
}) => {
  const [activeTab, setActiveTab] = useState<'ranking' | 'theaters' | 'yearly' | 'human-cost'>('ranking');

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

  // Ranked battles by total casualties
  const sortedBattles = [...battles].sort((a, b) => b.totalCasualties - a.totalCasualties);
  const maxBattleCasualties = sortedBattles[0]?.totalCasualties || 1;

  // Theater aggregations
  const theaterStats = battles.reduce(
    (acc, b) => {
      const t = b.theater;
      if (!acc[t]) acc[t] = { count: 0, casualties: 0, union: 0, confed: 0 };
      acc[t].count += 1;
      acc[t].casualties += b.totalCasualties;
      acc[t].union += b.casualties.union.total;
      acc[t].confed += b.casualties.confederate.total;
      return acc;
    },
    {} as Record<string, { count: number; casualties: number; union: number; confed: number }>
  );

  // Yearly aggregations
  const yearlyStats = battles.reduce(
    (acc, b) => {
      const y = b.year;
      if (!acc[y]) acc[y] = { count: 0, casualties: 0, union: 0, confed: 0 };
      acc[y].count += 1;
      acc[y].casualties += b.totalCasualties;
      acc[y].union += b.casualties.union.total;
      acc[y].confed += b.casualties.confederate.total;
      return acc;
    },
    {} as Record<string, { count: number; casualties: number; union: number; confed: number }>
  );

  const totalAllCasualties = battles.reduce((sum, b) => sum + b.totalCasualties, 0);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="casualty-modal-title"
        className="bg-[#f5f2ed] border border-[#d1c2ab] rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col text-[#3d322a] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        
        {/* Modal Header */}
        <div className="p-4 bg-[#ebe6db] border-b border-[#d1c2ab] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#a65d50]/15 border border-[#a65d50]/30 flex items-center justify-center shrink-0" aria-hidden="true">
              <Skull className="w-5 h-5 text-[#a65d50]" />
            </div>
            <div>
              <h2 id="casualty-modal-title" className="font-cinzel text-lg font-bold text-[#3d322a]">
                Civil War Casualty Data & Historical Analytics
              </h2>
              <p className="text-xs text-[#6e5d4b]">
                Comparative analysis of major engagements, theaters, and human cost (1861–1865)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Casualty Analytics modal"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#6e5d4b] hover:text-[#3d322a] hover:bg-[#d9d2c4] active:bg-[#c4baaa] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#d1c2ab] bg-[#f5f2ed] px-4 pt-2 gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label="Casualty Analytics Sections">
          {[
            { id: 'ranking', label: 'Deadliest Battles Ranking', shortLabel: 'Deadliest', icon: BarChart3 },
            { id: 'theaters', label: 'Theater Comparison', shortLabel: 'Theaters', icon: Shield },
            { id: 'yearly', label: 'Yearly Escalation', shortLabel: 'By Year', icon: TrendingUp },
            { id: 'human-cost', label: 'Total Human Toll & Context', shortLabel: 'Human Toll', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-2.5 min-h-[44px] text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#a65d50] text-[#a65d50]'
                    : 'border-transparent text-[#6e5d4b] hover:text-[#3d322a]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* TAB 1: DEADLIEST BATTLES RANKING */}
          {activeTab === 'ranking' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-[#7c6c5a]">
                <span>Ranked by cumulative casualties (Killed, Wounded, Missing/Captured)</span>
                <span className="font-bold text-[#3d322a]">
                  Sample Total: {totalAllCasualties.toLocaleString()} casualties
                </span>
              </div>

              <div className="space-y-2.5">
                {sortedBattles.map((b, idx) => {
                  const pct = (b.totalCasualties / maxBattleCasualties) * 100;
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        onSelectBattle(b);
                        onClose();
                      }}
                      className="bg-[#ebe6db] hover:bg-[#d9d2c4] p-3 rounded-xl border border-[#d1c2ab] cursor-pointer transition-all hover:border-[#a65d50] group shadow-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#f5f2ed] border border-[#d1c2ab] flex items-center justify-center text-[10px] font-bold text-[#7c6c5a]">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-sm text-[#3d322a] group-hover:text-[#a65d50]">
                            {b.name}
                          </span>
                          <span className="text-xs text-[#7c6c5a]">
                            ({b.date} • {b.theater})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-cinzel font-bold text-sm text-[#a65d50]">
                            {b.totalCasualties.toLocaleString()}
                          </span>
                          <ChevronRight className="w-4 h-4 text-[#7c6c5a] group-hover:text-[#a65d50]" />
                        </div>
                      </div>

                      {/* Bar Visualization */}
                      <div className="w-full bg-[#d1c2ab] h-2.5 rounded-full overflow-hidden flex shadow-inner">
                        <div
                          className="bg-gradient-to-r from-[#a65d50] to-[#c48a3f] h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-[#7c6c5a] mt-1.5">
                        <span className="font-medium text-[#3e5672]">Union: {b.casualties.union.total.toLocaleString()}</span>
                        <span className="font-medium text-[#a65d50]">Confed: {b.casualties.confederate.total.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: THEATER COMPARISON */}
          {activeTab === 'theaters' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(theaterStats).map(([name, stat]) => (
                  <div key={name} className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-2 shadow-xs">
                    <h3 className="font-cinzel text-sm font-bold text-[#7c6c5a]">
                      {name} Theater
                    </h3>
                    <div className="text-2xl font-bold text-[#3d322a]">
                      {stat.casualties.toLocaleString()} <span className="text-xs font-normal text-[#7c6c5a]">losses</span>
                    </div>
                    <div className="text-xs text-[#7c6c5a]">
                      {stat.count} Key Engagements Recorded
                    </div>
                    <div className="pt-2 border-t border-[#d1c2ab] space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#3e5672] font-semibold">Union Losses:</span>
                        <span className="font-bold text-[#3d322a]">{stat.union.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#a65d50] font-semibold">Confederate Losses:</span>
                        <span className="font-bold text-[#3d322a]">{stat.confed.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] text-xs space-y-2 shadow-xs">
                <h4 className="font-cinzel text-xs font-bold text-[#a65d50] uppercase tracking-wider">
                  Strategic Theater Dynamics
                </h4>
                <p className="text-[#5c4d3e] leading-relaxed">
                  While the <strong>Eastern Theater</strong> featured titanic clashes between the Army of the Potomac and the Army of Northern Virginia within a compact 100-mile corridor between Washington and Richmond, the <strong>Western Theater</strong> spanned thousands of miles of river networks where Union forces systematically dismantled Confederate supply infrastructure.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: YEARLY ESCALATION */}
          {activeTab === 'yearly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {['1861', '1862', '1863', '1864', '1865'].map((year) => {
                  const stat = yearlyStats[year] || { count: 0, casualties: 0, union: 0, confed: 0 };
                  return (
                    <div key={year} className="bg-[#ebe6db] p-3.5 rounded-xl border border-[#d1c2ab] text-center space-y-1 shadow-xs">
                      <div className="font-cinzel text-base font-bold text-[#3d322a]">{year}</div>
                      <div className="text-sm font-bold text-[#a65d50]">
                        {stat.casualties.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#7c6c5a]">
                        {stat.count} battles
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-2 text-xs shadow-xs">
                <h4 className="font-cinzel font-bold text-[#7c6c5a] uppercase tracking-wider">
                  The Escalation of Industrialized Warfare
                </h4>
                <p className="text-[#5c4d3e] leading-relaxed">
                  From relatively small clashes in 1861 (First Bull Run), casualty rates escalated dramatically in 1862 (Shiloh, Antietam) and reached unprecedented levels in 1863–1864 as rifled muskets, entrenched earthworks, and continuous contact made warfare continuous rather than episodic.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: HUMAN COST & HISTORICAL CONTEXT */}
          {activeTab === 'human-cost' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#ebe6db] p-3.5 rounded-xl border border-[#d1c2ab] space-y-1 shadow-xs">
                  <div className="text-[11px] text-[#7c6c5a] uppercase font-bold">Total War Dead</div>
                  <div className="text-xl font-bold text-[#3d322a]">620,000 – 750,000</div>
                  <p className="text-[11px] text-[#5c4d3e]">Approx. 2% of the entire 1860 US population</p>
                </div>
                <div className="bg-[#ebe6db] p-3.5 rounded-xl border border-[#d1c2ab] space-y-1 shadow-xs">
                  <div className="text-[11px] text-[#7c6c5a] uppercase font-bold">Disease vs. Combat</div>
                  <div className="text-xl font-bold text-[#c48a3f]">2 to 1 Ratio</div>
                  <p className="text-[11px] text-[#5c4d3e]">Dysentery, typhoid, malaria killed 2x more than bullets</p>
                </div>
                <div className="bg-[#ebe6db] p-3.5 rounded-xl border border-[#d1c2ab] space-y-1 shadow-xs">
                  <div className="text-[11px] text-[#7c6c5a] uppercase font-bold">USCT Soldiers</div>
                  <div className="text-xl font-bold text-[#3e5672]">180,000+ Enlisted</div>
                  <p className="text-[11px] text-[#5c4d3e]">Over 38,000 Black soldiers died fighting for freedom</p>
                </div>
              </div>

              <div className="bg-[#ebe6db] p-4 rounded-xl border border-[#d1c2ab] space-y-2 leading-relaxed shadow-xs">
                <h4 className="font-cinzel font-bold text-[#a65d50] uppercase tracking-wider">
                  NPS Educational Takeaways for High School Students
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-[#5c4d3e]">
                  <li><strong>Medical Realities:</strong> Pre-germ theory medicine meant infection, gangrene, and minié ball shattering required massive field amputations.</li>
                  <li><strong>Prisoner of War Camps:</strong> The breakdown of prisoner exchanges in 1863 led to catastrophic overcrowding at camps like Andersonville (Georgia) and Elmira (New York).</li>
                  <li><strong>Reconstruction Legacy:</strong> The sacrifice preserved the constitutional Union, abolished chattel slavery via the 13th Amendment, and began the contested era of Reconstruction.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#ebe6db] border-t border-[#d1c2ab] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed] transition-colors shadow-xs"
          >
            Close Analytics
          </button>
        </div>

      </div>
    </div>
  );
};
