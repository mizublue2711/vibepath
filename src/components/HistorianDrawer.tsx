import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Loader2,
  Lightbulb,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Battle, HistorianMessage } from '../types';
import { SheetSnapState } from './BattleDetailsDrawer';

interface HistorianDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBattle: Battle | null;
  activeYear: string;
  snapState?: SheetSnapState;
  onSnapChange?: (snap: SheetSnapState) => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

const DEFAULT_QUESTIONS = [
  'Why did the Emancipation Proclamation alter foreign diplomacy during the war?',
  'What made Pickett’s Charge on Day 3 of Gettysburg so disastrous for Lee?',
  'How did railroad and telegraph technology reshape Civil War strategic commands?',
  'Explain Grant’s Overland Campaign strategy vs earlier Union general tactics.',
  'What were the battlefield medical conditions and treatment for wounded soldiers?',
  'What role did the United States Colored Troops (USCT) play in the Union victory?',
];

export const HistorianDrawer: React.FC<HistorianDrawerProps> = ({
  isOpen,
  onClose,
  selectedBattle,
  activeYear,
  snapState,
  onSnapChange,
  isDesktopCollapsed,
  onToggleDesktopCollapse,
}) => {
  const [internalSnap, setInternalSnap] = useState<SheetSnapState>('half');
  const [internalDesktopCollapsed, setInternalDesktopCollapsed] = useState<boolean>(false);

  const activeSnap = snapState !== undefined ? snapState : internalSnap;
  const setSnap = onSnapChange || setInternalSnap;

  const isCollapsed = isDesktopCollapsed !== undefined ? isDesktopCollapsed : internalDesktopCollapsed;
  const toggleDesktopCollapse = onToggleDesktopCollapse || (() => setInternalDesktopCollapsed((prev) => !prev));

  const [messages, setMessages] = useState<HistorianMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Greetings, students and educators. I am your **AI Civil War Historian**. 

I am here to guide your inquiry into the 1861–1865 campaigns, battlefield tactics, high-command decisions, the Emancipation Proclamation, and the human cost of the conflict. 

Select any battle on the map or ask me a historical question below.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cancel speech synthesis on drawer unmount or close
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || inputValue.trim();
    if (!promptToSend || isLoading) return;

    const userMessage: HistorianMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build conversation history for context (guarantee first turn is user role for Gemini API)
      const validHistory = messages
        .filter((m) => m.id !== 'welcome' && !m.id.startsWith('err-') && !m.text.includes('temporarily unavailable'))
        .map((m) => ({
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          text: m.text,
        }));

      const recentHistory = validHistory.slice(-6);
      const firstUserIdx = recentHistory.findIndex((m) => m.role === 'user');
      const chatHistory = firstUserIdx !== -1 ? recentHistory.slice(firstUserIdx) : [];

      // Streamlined battle context to avoid sending large nested arrays
      const battleContextPayload = selectedBattle ? {
        id: selectedBattle.id,
        name: selectedBattle.name,
        date: selectedBattle.date,
        location: selectedBattle.location,
        theater: selectedBattle.theater,
        outcome: selectedBattle.outcome,
        totalCasualties: selectedBattle.totalCasualties,
        casualties: selectedBattle.casualties,
        unionCommanders: selectedBattle.unionCommanders?.map(c => ({ name: c.name, rank: c.rank })),
        confederateCommanders: selectedBattle.confederateCommanders?.map(c => ({ name: c.name, rank: c.rank })),
      } : undefined;

      const response = await fetch('/api/gemini/historian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          message: promptToSend,
          battleContext: battleContextPayload,
          activeYear,
          chatHistory,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || errorJson.details || 'Historian response failed');
      }

      const data = await response.json();
      
      const historianMessage: HistorianMessage = {
        id: `historian-${Date.now()}`,
        role: 'assistant',
        text: data.response || data.reply || 'I apologize, but I could not retrieve those battlefield archives at this moment.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        battleContextName: selectedBattle?.name,
      };

      setMessages((prev) => [...prev, historianMessage]);
    } catch (err: any) {
      console.error('Error fetching historian reply:', err);
      const isHighDemand = err?.message?.includes('high-demand') || err?.message?.includes('503') || err?.message?.includes('demand');
      const errorMessage: HistorianMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: isHighDemand 
          ? 'The AI Historian service experienced a brief high-demand spike. Click below to retry your question.'
          : 'My historical archives are temporarily experiencing high demand. Please retry your inquiry.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Text-to-Speech audio reading for classroom accessibility
  const handleToggleSpeech = (msg: HistorianMessage) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking && speakingMessageId === msg.id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
      const cleanText = msg.text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;
      utterance.pitch = 0.95;
      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      setSpeakingMessageId(msg.id);
    }
  };

  const handleClearHistory = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setMessages([
      {
        id: 'welcome-fresh',
        role: 'assistant',
        text: `Archives reset. Ask any question about Civil War campaigns (1861–1865) or select a battle marker on the map.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Close drawer on Escape key press
  useEffect(() => {
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

  const mobileHeightClass = {
    closed: 'translate-y-full pointer-events-none md:translate-y-0 md:pointer-events-auto',
    peek: 'h-[72px] translate-y-0 md:h-full',
    half: 'h-[50vh] translate-y-0 md:h-full',
    full: 'h-[90vh] translate-y-0 md:h-full',
  }[activeSnap];

  return (
    <>
      {/* Desktop Floating Edge Tab (when collapsed on wide screens) */}
      {isCollapsed && (
        <button
          onClick={toggleDesktopCollapse}
          aria-label="Expand AI Historian Drawer"
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-[#3d322a] hover:bg-[#4d4036] text-[#f5f2ed] border-l-2 border-y-2 border-[#a65d50] py-3.5 px-2 rounded-l-xl shadow-xl items-center gap-1.5 cursor-pointer transition-transform hover:-translate-x-1"
          title="Expand AI Historian Drawer"
        >
          <ChevronLeft className="w-4 h-4 text-[#a65d50]" />
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-xs font-cinzel font-bold">
            AI Historian
          </span>
        </button>
      )}

      {/* Main Historian Drawer / Bottom Sheet */}
      <aside 
        role="region"
        aria-label="Civil War AI Historian Inquiry Drawer"
        className={`
          /* Mobile / Tablet Portrait: Bottom Sheet Mode (< 768px) */
          fixed inset-x-0 bottom-0 z-30 flex flex-col bg-[#3d322a] border-t-2 border-[#2a221c] rounded-t-2xl shadow-2xl transition-all duration-300 ease-out
          ${mobileHeightClass}

          /* Desktop / Tablet Landscape: Collapsible Right Side Drawer (>= 768px) */
          md:relative md:inset-auto md:z-10 md:h-full md:rounded-none md:border-t-0 md:border-l md:border-[#2a221c] md:shadow-xl md:flex-shrink-0 md:translate-y-0 md:pointer-events-auto
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
          className="md:hidden shrink-0 bg-[#4d4036] border-b border-[#2a221c] rounded-t-2xl px-3 sm:px-4 py-2 flex flex-col items-center cursor-pointer select-none"
        >
          <div className="w-12 h-1.5 bg-[#8a7a67]/50 hover:bg-[#8a7a67] rounded-full mb-1.5" />
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="font-cinzel text-xs font-bold text-[#f5f2ed] truncate">
                AI Historian {selectedBattle ? `• ${selectedBattle.name}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  if (activeSnap === 'peek') setSnap('half');
                  else if (activeSnap === 'half') setSnap('full');
                  else setSnap('peek');
                }}
                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-[#2a221c] text-[#d9d2c4] border border-[#7c6c5a]/40"
                title={activeSnap === 'full' ? 'Collapse drawer' : 'Expand drawer'}
                aria-label={activeSnap === 'full' ? 'Collapse drawer' : 'Expand drawer'}
              >
                {activeSnap === 'full' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-[#c4baaa] hover:bg-[#2a221c] transition-colors"
                title="Close AI Historian"
                aria-label="Close AI Historian"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex p-4 border-b border-[#2a221c] bg-[#4d4036] items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2a221c] border border-[#7c6c5a]/60 flex items-center justify-center text-[#f5f2ed]" aria-hidden="true">
              <Sparkles className="w-4 h-4 text-[#f5f2ed]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-cinzel text-sm font-bold text-[#f5f2ed]">
                  AI Historian
                </h2>
                <span className="px-1.5 py-0.2 bg-[#2a221c] text-[#d9d2c4] border border-[#7c6c5a]/50 rounded text-[10px] font-semibold">
                  NPS Grounded
                </span>
              </div>
              <p className="text-[11px] text-[#c4baaa]">
                Grounded in NPS Civil War Archives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              className="px-2.5 py-2 min-h-[40px] rounded-lg text-[#c4baaa] hover:text-[#f5f2ed] hover:bg-[#2a221c] transition-colors text-xs font-semibold cursor-pointer"
              title="Reset Chat Session"
              aria-label="Reset Chat Session"
            >
              Reset
            </button>
            <button
              onClick={toggleDesktopCollapse}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#c4baaa] hover:text-[#f5f2ed] hover:bg-[#2a221c] transition-colors cursor-pointer"
              title="Collapse Historian Drawer"
              aria-label="Collapse Historian Drawer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#c4baaa] hover:text-[#f5f2ed] hover:bg-[#2a221c] transition-colors cursor-pointer"
              title="Close Historian Drawer"
              aria-label="Close AI Historian Drawer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Historian Body Container (Hidden in mobile peek mode) */}
        <div className={`${activeSnap === 'peek' ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-h-0`}>

      {/* Active Battle Grounding Indicator Banner */}
      {selectedBattle && (
        <div className="bg-[#2a221c] border-b border-[#4d4036] px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#a65d50] font-bold">●</span>
            <span className="text-[#d9d2c4]">
              Active Context: <strong className="text-[#f5f2ed]">{selectedBattle.name}</strong> ({selectedBattle.year})
            </span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isHistorian = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isHistorian ? 'items-start' : 'items-start flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${
                  isHistorian
                    ? 'bg-[#2a221c] border-[#7c6c5a]/60 text-[#f5f2ed]'
                    : 'bg-[#7c6c5a] border-[#d1c2ab] text-[#f5f2ed]'
                }`}
              >
                {isHistorian ? 'AH' : 'U'}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                  isHistorian
                    ? msg.id.startsWith('err-')
                      ? 'bg-[#3d221c] border border-[#a65d50]/60 text-[#f5f2ed]'
                      : 'bg-[#2a221c] border border-[#4d4036] text-[#f5f2ed]'
                    : 'bg-[#7c6c5a] text-[#f5f2ed] border border-[#8a7a67]'
                }`}
              >
                {/* Markdown Body */}
                <div className="prose prose-invert prose-sm max-w-none space-y-2 leading-relaxed text-[#f5f2ed]">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>

                {/* Inline Retry Button for errors */}
                {msg.id.startsWith('err-') && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        // Find last user message
                        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                        if (lastUserMsg) {
                          handleSendMessage(lastUserMsg.text);
                        }
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-[#a65d50] hover:bg-[#b86b5d] text-[#f5f2ed] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Retry Question</span>
                    </button>
                  </div>
                )}

                {/* Footer Bar for Message */}
                <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-white/10 text-[10px] text-[#c4baaa]">
                  <span>{msg.timestamp}</span>

                  {isHistorian && !msg.id.startsWith('err-') && (
                    <button
                      onClick={() => handleToggleSpeech(msg)}
                      className="flex items-center gap-1 text-[#d9d2c4] hover:text-[#f5f2ed] transition-colors cursor-pointer"
                      title={isSpeaking && speakingMessageId === msg.id ? 'Stop Reading' : 'Read Aloud'}
                    >
                      <span>{isSpeaking && speakingMessageId === msg.id ? '⏹ Stop Audio' : '🔊 Listen'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-[#c4baaa] p-2.5 bg-[#2a221c] rounded-xl w-fit border border-[#4d4036]">
            <Loader2 className="w-4 h-4 animate-spin text-[#8a7a67]" />
            <span>Consulting archival records & dispatch records...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Classroom Inquiries (Quick Chips) */}
      <div className="hidden sm:block px-4 py-2 bg-[#4d4036] border-t border-[#2a221c]">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#d9d2c4] mb-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-[#a65d50]" />
          <span>Classroom Discussion Prompts:</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {selectedBattle ? (
            <>
              <button
                onClick={() => handleSendMessage(`What were the decisive tactical blunders and strategic turning points at ${selectedBattle.name}?`)}
                className="px-2.5 py-1 bg-[#2a221c] hover:bg-[#1a1511] border border-[#7c6c5a]/40 rounded-lg text-[11px] text-[#d9d2c4] whitespace-nowrap transition-colors"
              >
                Decisive Turning Points at {selectedBattle.name.replace('Battle of ', '')}
              </button>
              <button
                onClick={() => handleSendMessage(`Analyze the leadership decisions of commanders at ${selectedBattle.name}.`)}
                className="px-2.5 py-1 bg-[#2a221c] hover:bg-[#1a1511] border border-[#7c6c5a]/40 rounded-lg text-[11px] text-[#d9d2c4] whitespace-nowrap transition-colors"
              >
                Commander Leadership Analysis
              </button>
            </>
          ) : (
            DEFAULT_QUESTIONS.slice(0, 3).map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="px-2.5 py-1 bg-[#2a221c] hover:bg-[#1a1511] border border-[#7c6c5a]/40 rounded-lg text-[11px] text-[#d9d2c4] whitespace-nowrap transition-colors"
              >
                {q.length > 42 ? q.substring(0, 42) + '...' : q}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Input Box */}
      <div className="p-4 border-t border-[#2a221c] bg-[#4d4036] safe-bottom-padding">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
          role="search"
          aria-label="Ask Historian Query"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              selectedBattle
                ? `Ask about ${selectedBattle.name}...`
                : 'Ask Dr. Vance about campaigns, tactics, politics...'
            }
            aria-label={
              selectedBattle
                ? `Ask Dr. Vance about ${selectedBattle.name}`
                : 'Ask Dr. Vance about Civil War campaigns, tactics, and primary sources'
            }
            disabled={isLoading}
            className="flex-1 min-h-[44px] bg-[#1a1511] border border-[#7c6c5a]/50 focus:border-[#8a7a67] focus:ring-1 focus:ring-[#8a7a67] rounded-xl px-4 py-2.5 text-sm text-[#f5f2ed] placeholder-[#8a7a67] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#8a7a67] hover:bg-[#7c6c5a] disabled:opacity-40 text-[#f5f2ed] font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
            title="Send Inquiry"
            aria-label="Send Historical Inquiry"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>

        </div>

      </aside>
    </>
  );
};
