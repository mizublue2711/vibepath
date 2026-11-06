export type Theater = 'Eastern' | 'Western' | 'Trans-Mississippi' | 'Naval/Coastal';
export type BattleOutcome = 'union' | 'confederate' | 'inconclusive';
export type BattleEventType = 'land_battle' | 'siege' | 'naval' | 'amphibious' | 'cavalry';
export type GeminiVoiceName = 'Zephyr' | 'Fenrir' | 'Kore' | 'Puck' | 'Charon';

export interface Commander {
  name: string;
  rank: string;
  side: 'union' | 'confederate';
  portraitUrl: string;
  bioSnippet: string;
}

export interface CasualtyBreakdown {
  killed: number;
  wounded: number;
  missing: number;
  total: number;
}

export interface Battle {
  id: string;
  name: string;
  date: string;
  startDate: string; // ISO format: YYYY-MM-DD
  endDate: string;
  year: number;
  month: number;
  location: string;
  state: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  theater: Theater;
  outcome: BattleOutcome;
  eventType?: BattleEventType;
  totalCasualties: number;
  casualties: {
    union: CasualtyBreakdown;
    confederate: CasualtyBreakdown;
  };
  forcesEngaged: {
    union: number;
    confederate: number;
  };
  unionCommanders: Commander[];
  confederateCommanders: Commander[];
  summary: string;
  strategicSignificance: string;
  tacticalOverview: string[];
  primaryQuote: {
    text: string;
    author: string;
    context: string;
  };
  npsReferenceUrl: string;
  archivalImage: string;
  campaignName: string;
  zoomLevel: number;
}

export interface CampaignTourStep {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  year: string;
  battleId: string;
  narrative: string;
  pedagogicalFocus: string;
  discussionQuestions: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  zoom: number;
}

export interface HistorianMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  battleContextName?: string;
  groundingNotes?: string;
}

export interface TimelineState {
  currentDateIndex: number;
  currentDateISO: string;
  isPlaying: boolean;
  playbackSpeed: number; // 1, 2, 5
  viewMode: 'cumulative' | 'window';
  selectedTheater: 'all' | Theater;
  selectedOutcome: 'all' | BattleOutcome;
}
