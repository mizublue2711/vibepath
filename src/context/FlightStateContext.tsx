import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CulinaryNode } from '../data/vibePathData';

export const PINNED_SESSION_STORAGE_KEY = 'vibepath_pinned_session';

export interface FlightStateContextValue {
  pinnedLocations: CulinaryNode[];
  setPinnedLocations: React.Dispatch<React.SetStateAction<CulinaryNode[]>>;
  addPinnedLocation: (nodeData: Omit<CulinaryNode, 'id' | 'timestamp' | 'timecodeSeconds'>) => CulinaryNode;
  removePinnedLocation: (id: string) => void;
  clearPinnedLocations: () => void;
}

const FlightStateContext = createContext<FlightStateContextValue | undefined>(undefined);

export function getStoredPinnedLocations(): CulinaryNode[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(PINNED_SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.latitude === 'number' &&
          typeof item.longitude === 'number' &&
          !isNaN(item.latitude) &&
          !isNaN(item.longitude)
      );
    }
  } catch (err) {
    console.warn('[FlightStateContext] Failed to parse stored pinned session:', err);
  }
  return [];
}

export const FlightStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pinnedLocations, setPinnedLocations] = useState<CulinaryNode[]>(() => {
    return getStoredPinnedLocations();
  });

  // Sync pinnedLocations with localStorage on updates
  useEffect(() => {
    try {
      localStorage.setItem(PINNED_SESSION_STORAGE_KEY, JSON.stringify(pinnedLocations));
    } catch (err) {
      console.warn('[FlightStateContext] Failed to persist pinned locations to localStorage:', err);
    }
  }, [pinnedLocations]);

  // Listen to cross-tab storage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PINNED_SESSION_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setPinnedLocations(parsed);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addPinnedLocation = useCallback(
    (nodeData: Omit<CulinaryNode, 'id' | 'timestamp' | 'timecodeSeconds'>): CulinaryNode => {
      let createdNode: CulinaryNode | null = null;
      setPinnedLocations((prev) => {
        const lastEndSec =
          prev.length > 0
            ? prev[prev.length - 1].timecodeSeconds + prev[prev.length - 1].durationSeconds
            : 0;
        const created: CulinaryNode = {
          ...nodeData,
          id: `poi-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          timecodeSeconds: lastEndSec,
        };
        createdNode = created;
        return [...prev, created];
      });
      return createdNode!;
    },
    []
  );

  const removePinnedLocation = useCallback((id: string) => {
    setPinnedLocations((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearPinnedLocations = useCallback(() => {
    setPinnedLocations([]);
  }, []);

  return (
    <FlightStateContext.Provider
      value={{
        pinnedLocations,
        setPinnedLocations,
        addPinnedLocation,
        removePinnedLocation,
        clearPinnedLocations,
      }}
    >
      {children}
    </FlightStateContext.Provider>
  );
};

export function useFlightState(): FlightStateContextValue {
  const context = useContext(FlightStateContext);
  if (!context) {
    throw new Error('useFlightState must be used within a FlightStateProvider');
  }
  return context;
}
