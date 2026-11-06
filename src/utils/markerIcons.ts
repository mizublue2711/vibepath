import { Battle, BattleEventType, BattleOutcome } from '../types';

export interface EventTypeConfig {
  type: BattleEventType;
  label: string;
  glyph: string;
  description: string;
}

export const EVENT_TYPE_CONFIGS: Record<BattleEventType, EventTypeConfig> = {
  land_battle: {
    type: 'land_battle',
    label: 'Land Battle',
    glyph: '⚔',
    description: 'Field battle with infantry and artillery lines',
  },
  siege: {
    type: 'siege',
    label: 'Siege',
    glyph: '🏰',
    description: 'Fortress siege and trench operations',
  },
  naval: {
    type: 'naval',
    label: 'Naval Clash',
    glyph: '⚓',
    description: 'Ironclad and coastal fleet engagement',
  },
  amphibious: {
    type: 'amphibious',
    label: 'River Assault',
    glyph: '🌊',
    description: 'Riverine gunboat and infantry landing',
  },
  cavalry: {
    type: 'cavalry',
    label: 'Cavalry Raid',
    glyph: '⚡',
    description: 'Mounted cavalry reconnaissance and charge',
  },
};

export function getBattleEventType(battle: Battle): BattleEventType {
  if (battle.eventType) return battle.eventType;
  
  const nameLower = battle.name.toLowerCase();
  const idLower = battle.id.toLowerCase();
  
  if (idLower === 'fort-sumter' || idLower === 'vicksburg' || idLower === 'petersburg' || idLower === 'atlanta' || idLower === 'spotsylvania') {
    return 'siege';
  }
  if (idLower === 'hampton-roads' || idLower === 'mobile-bay' || nameLower.includes('monitor') || nameLower.includes('naval')) {
    return 'naval';
  }
  if (idLower === 'fort-donelson' || nameLower.includes('island no') || nameLower.includes('amphibious')) {
    return 'amphibious';
  }
  if (idLower === 'cedar-creek' || idLower === 'appomattox' || nameLower.includes('cavalry') || nameLower.includes('brandy station')) {
    return 'cavalry';
  }
  return 'land_battle';
}

export function getOutcomeColors(outcome: BattleOutcome, isSelected: boolean) {
  switch (outcome) {
    case 'union':
      return {
        background: '#1e40af', // Union Deep Blue
        borderColor: isSelected ? '#fbbf24' : '#ffffff',
        glyphColor: '#ffffff',
      };
    case 'confederate':
      return {
        background: '#991b1b', // Confederate Deep Red
        borderColor: isSelected ? '#fbbf24' : '#ffffff',
        glyphColor: '#ffffff',
      };
    case 'inconclusive':
    default:
      return {
        background: '#b45309', // Antique Gold / Amber
        borderColor: isSelected ? '#fbbf24' : '#ffffff',
        glyphColor: '#ffffff',
      };
  }
}

