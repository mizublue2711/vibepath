import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiKeyManager } from '../services/apiKeyManager';
import { parseLocationInput } from '../utils/linkParser';
import { LanguageCode } from '../data/vibePathData';
import { Search, Crosshair, CornerDownLeft, X, Link2, Loader2 } from 'lucide-react';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  fullAddress: string;
  coordinates: [number, number]; // [longitude, latitude]
  longitude: number;
  latitude: number;
}

export type GeocodedPoiResult = SearchResult;

export interface PoiSearchBoxProps {
  onSelectLocation: (result: SearchResult) => void;
  mapCenterLngLat?: [number, number];
  language?: LanguageCode;
  placeholder?: string;
  compact?: boolean;
}

export function parseMapboxSearchBox(suggestions: any[]): SearchResult[] {
  return suggestions
    .slice(0, 8)
    .map((item: any, idx: number): SearchResult => {
      const props = item.properties || item;
      const rawCoords =
        item.geometry?.coordinates ||
        (props.coordinates?.longitude !== undefined
          ? [props.coordinates.longitude, props.coordinates.latitude]
          : item.center);

      const longitude = Array.isArray(rawCoords)
        ? Number(Number(rawCoords[0]).toFixed(6))
        : 106.7024;
      const latitude = Array.isArray(rawCoords)
        ? Number(Number(rawCoords[1]).toFixed(6))
        : 10.7611;

      const name = String(
        props.name_preferred ||
          props.name ||
          item.text_vi ||
          item.text ||
          String(item.place_name || '').split(',')[0] ||
          'Culinary Venue'
      ).trim();

      const address = String(
        props.full_address ||
          props.place_formatted ||
          item.place_name_vi ||
          item.place_name ||
          props.address ||
          name
      ).trim();

      return {
        id: String(props.mapbox_id || item.id || `mapbox-searchbox-${idx}`),
        name,
        address,
        fullAddress: address,
        coordinates: [longitude, latitude],
        longitude,
        latitude,
      };
    })
    .filter((item) => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
}

export function parseMapboxGeocoding(features: any[]): SearchResult[] {
  return features
    .slice(0, 8)
    .map((feature: any, idx: number): SearchResult => {
      const center = feature.center || feature.geometry?.coordinates || [106.7024, 10.7611];
      const longitude = Number(Number(center[0]).toFixed(6));
      const latitude = Number(Number(center[1]).toFixed(6));

      const name = String(
        feature.text_vi ||
          feature.text ||
          feature.properties?.name ||
          String(feature.place_name || '').split(',')[0] ||
          'Culinary Venue'
      ).trim();

      const address = String(
        feature.place_name_vi ||
          feature.place_name ||
          feature.properties?.full_address ||
          feature.properties?.address ||
          name
      ).trim();

      return {
        id: String(feature.id || `mapbox-geocoding-${idx}`),
        name,
        address,
        fullAddress: address,
        coordinates: [longitude, latitude],
        longitude,
        latitude,
      };
    })
    .filter((item) => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
}

export async function searchLocationsMapbox(
  query: string,
  mapCenterLngLat?: [number, number]
): Promise<SearchResult[]> {
  const token = ApiKeyManager.getMapKey() || import.meta.env.VITE_MAPBOX_TOKEN;
  if (!query.trim()) return [];

  if (token && token.trim().startsWith('pk.') && !token.includes('xxxxxxxx')) {
    try {
      const proximity =
        mapCenterLngLat &&
        Number.isFinite(mapCenterLngLat[0]) &&
        Number.isFinite(mapCenterLngLat[1])
          ? `&proximity=${mapCenterLngLat[0]},${mapCenterLngLat[1]}`
          : '';

      const endpoint = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(
        query
      )}&access_token=${token}&types=poi,address&category=food_and_drink,restaurant,cafe,bar&language=vi&limit=8${proximity}`;

      const res = await fetch(endpoint);
      if (!res.ok) {
        const fallbackEndpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${token}&types=poi,address&language=vi&limit=8${proximity}`;
        const fallbackRes = await fetch(fallbackEndpoint);
        const fallbackData = await fallbackRes.json();
        return parseMapboxGeocoding(fallbackData.features || []);
      }

      const data = await res.json();
      const rawItems = data.suggestions || data.features || [];
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        return parseMapboxSearchBox(rawItems);
      }

      const fallbackEndpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${token}&types=poi,address&language=vi&limit=8${proximity}`;
      const fallbackRes = await fetch(fallbackEndpoint);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return parseMapboxGeocoding(fallbackData.features || []);
      }

      return [];
    } catch (err) {
      console.error('[Mapbox Search Error]:', err);
      return [];
    }
  }

  try {
    const serverRes = await fetch(`/api/poi-search?q=${encodeURIComponent(query)}`);
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (Array.isArray(serverData)) {
        return serverData.slice(0, 8).map((item: any, idx: number): SearchResult => {
          const lng = Number(
            Number(item.coordinates?.[0] ?? item.longitude ?? 106.7024).toFixed(6)
          );
          const lat = Number(
            Number(item.coordinates?.[1] ?? item.latitude ?? 10.7611).toFixed(6)
          );
          const addr = String(item.address || item.fullAddress || item.name || '').trim();
          return {
            id: String(item.id || `mapbox-poi-${idx}`),
            name: String(item.name || query).trim(),
            address: addr,
            fullAddress: addr,
            coordinates: [lng, lat],
            longitude: lng,
            latitude: lat,
          };
        });
      }
    }
  } catch (err) {
    console.error('[Mapbox Search Error]:', err);
  }

  return [];
}

export const PoiSearchBox: React.FC<PoiSearchBoxProps> = ({
  onSelectLocation,
  mapCenterLngLat,
  language = 'vi',
  placeholder,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const executeMapboxSearch = useCallback(
    async (rawInput: string) => {
      const trimmed = rawInput.trim();
      if (!trimmed) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      const parsedLink = parseLocationInput(trimmed);
      if (
        parsedLink.matched &&
        typeof parsedLink.latitude === 'number' &&
        typeof parsedLink.longitude === 'number'
      ) {
        const lng = Number(parsedLink.longitude.toFixed(6));
        const lat = Number(parsedLink.latitude.toFixed(6));
        const addr = `${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E`;
        const linkResult: SearchResult = {
          id: `mapbox-coord-${lat}-${lng}`,
          name:
            parsedLink.extractedName ||
            `Pinned Venue (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
          address: addr,
          fullAddress: addr,
          coordinates: [lng, lat],
          longitude: lng,
          latitude: lat,
        };
        setResults([linkResult]);
        setActiveIndex(0);
        setIsOpen(true);
        return;
      }

      const effectiveQuery = parsedLink.fallbackQuery || trimmed;
      setIsLoading(true);

      try {
        const items = await searchLocationsMapbox(effectiveQuery, mapCenterLngLat);
        setResults(items);
        setActiveIndex(0);
        setIsOpen(items.length > 0);
      } catch (_) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [mapCenterLngLat]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      executeMapboxSearch(val);
    }, 220);
  };

  const handleSelectResult = (item: SearchResult) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelectLocation(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && query.trim()) {
        executeMapboxSearch(query);
      } else if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && isOpen) {
        handleSelectResult(results[activeIndex] || results[0]);
      } else if (query.trim()) {
        executeMapboxSearch(query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-full select-none">
      <div className="flex items-stretch w-full bg-[#090D11]/90 border border-slate-800/70 rounded-lg focus-within:border-[var(--accent-color)] transition-colors overflow-hidden">
        <div className="px-3 flex items-center justify-center border-r border-slate-800/70 bg-[#121820]/80 shrink-0">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[var(--accent-color)] animate-spin" />
          ) : query.includes('http') || query.includes('@') ? (
            <Link2 className="w-4 h-4 text-[#00E676]" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ||
            (language === 'vi'
              ? 'Tìm quán ăn, địa chỉ đường phố (VD: Phở Bò Phú Gia, Highlands Coffee)...'
              : 'Search restaurants, street addresses, or landmarks (e.g., Phở Bò Phú Gia)...')
          }
          aria-label="Search POI Locations"
          className="flex-1 min-w-0 min-h-[42px] px-3 bg-transparent text-[#F8FAFC] text-xs font-medium placeholder:text-slate-400 focus:outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="px-2.5 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (results.length > 0 && isOpen) {
              handleSelectResult(results[activeIndex] || results[0]);
            } else if (query.trim()) {
              executeMapboxSearch(query);
            }
          }}
          style={{ backgroundColor: 'var(--accent-color)' }}
          className="px-3.5 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:brightness-110 transition-all shrink-0"
        >
          <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {isLoading ? (language === 'vi' ? 'Đang tìm...' : 'Searching...') : language === 'vi' ? 'Tìm địa điểm' : 'Search'}
          </span>
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <div
          role="listbox"
          aria-label="Location Search Results"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#121820]/95 backdrop-blur-md border border-slate-700/80 rounded-lg shadow-2xl divide-y divide-slate-800/60 max-h-[320px] overflow-y-auto"
        >
          {results.slice(0, 8).map((item, idx) => {
            const indexLabel = String(idx + 1).padStart(2, '0');
            const isHighlighted = idx === activeIndex;
            const [lng, lat] = item.coordinates;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onClick={() => handleSelectResult(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full px-3.5 py-2.5 text-left flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-slate-800/70' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-100 flex items-center gap-2 break-words">
                    <span
                      style={{ color: 'var(--accent-color)' }}
                      className="font-telemetry text-[11px] font-bold shrink-0"
                    >
                      {indexLabel}.
                    </span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.address}
                  </div>
                </div>

                <div className="shrink-0 text-right font-telemetry tabular-nums">
                  <div className="text-[11px] text-[#00E676] font-semibold flex items-center justify-end gap-1">
                    <Crosshair className="w-3 h-3 text-[#00E676] shrink-0" />
                    <span>
                      {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
