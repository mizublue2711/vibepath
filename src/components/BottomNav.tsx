import React from 'react';
import { SubsystemTab } from '../data/vibePathData';
import { MapPin, Film, Bug } from 'lucide-react';

export interface BottomNavProps {
  activeTab: SubsystemTab;
  onChangeTab: (tab: SubsystemTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav
      aria-label="Global Workspace Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#05050A]/95 border-t border-[#1F1F2E] px-2.5 sm:px-6 py-1.5 rounded-none shadow-none"
    >
      <div className="max-w-[1440px] w-full mx-auto grid grid-cols-3 gap-1.5 sm:gap-2 rounded-none">
        <button
          type="button"
          onClick={() => onChangeTab('vlogger')}
          className={`min-h-[38px] px-3 bg-[#0D0E17] border border-[#1F1F2E] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-none shadow-none whitespace-nowrap ${
            activeTab === 'vlogger'
              ? 'text-white border-b-2 border-b-[#00E5FF]'
              : 'text-[#8A8FA3] hover:text-white hover:border-[#00E5FF]'
          }`}
        >
          <MapPin
            className={`w-3.5 h-3.5 shrink-0 ${
              activeTab === 'vlogger' ? 'text-[#00E5FF]' : 'text-[#8A8FA3]'
            }`}
          />
          <span>Field Tracker View</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('editor')}
          className={`min-h-[38px] px-3 bg-[#0D0E17] border border-[#1F1F2E] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-none shadow-none whitespace-nowrap ${
            activeTab === 'editor'
              ? 'text-white border-b-2 border-b-[#00E5FF]'
              : 'text-[#8A8FA3] hover:text-white hover:border-[#00E5FF]'
          }`}
        >
          <Film
            className={`w-3.5 h-3.5 shrink-0 ${
              activeTab === 'editor' ? 'text-[#00E5FF]' : 'text-[#8A8FA3]'
            }`}
          />
          <span>Editor Studio</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('feedback')}
          className={`min-h-[38px] px-3 bg-[#0D0E17] border border-[#1F1F2E] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-none shadow-none whitespace-nowrap ${
            activeTab === 'feedback'
              ? 'text-white border-b-2 border-b-[#00E5FF]'
              : 'text-[#8A8FA3] hover:text-white hover:border-[#00E5FF]'
          }`}
        >
          <Bug
            className={`w-3.5 h-3.5 shrink-0 ${
              activeTab === 'feedback' ? 'text-[#00E5FF]' : 'text-[#8A8FA3]'
            }`}
          />
          <span>Feedback</span>
        </button>
      </div>
    </nav>
  );
};
