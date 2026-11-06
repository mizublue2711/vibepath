import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiKeyManager } from '../services/apiKeyManager';
import { parseLocationInput } from '../utils/linkParser';
import { LanguageCode } from '../data/vibePathData';
import { Search, Crosshair, CornerDownLeft, X, Link2, Sparkles, Loader2 } from 'lucide-react';

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

/**
 * Parse Mapbox Search Box API v6 suggestions / features into clean SearchResult items
 */
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
          'POI_VENUE'
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

/**
 * Parse Mapbox Geocoding v5 features into clean SearchResult items
 */
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
          'POI_VENUE'
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

/**
 * Unified 100% Mapbox Search Engine (Search Box API v6 with Geocoding v5 fallback)
 * Relies strictly on VITE_MAPBOX_TOKEN.
 */
export async function searchLocationsMapbox(
  query: string,
  mapCenterLngLat?: [number, number]
): Promise<SearchResult[]> {
  const token = ApiKeyManager.getMapKey() || import.meta.env.VITE_MAPBOX_TOKEN;
  if (!query.trim()) return [];

  // When a valid client VITE_MAPBOX_TOKEN is available, query Mapbox Search Box API v6 directly
  if (token && token.trim().startsWith('pk.') && !token.includes('xxxxxxxx')) {
    try {
      // Proximity bias: prioritize nearby locations if map center is available
      const proximity =
        mapCenterLngLat &&
        Number.isFinite(mapCenterLngLat[0]) &&
        Number.isFinite(mapCenterLngLat[1])
          ? `&proximity=${mapCenterLngLat[0]},${mapCenterLngLat[1]}`
          : '';

      // Mapbox Search Box API endpoint with POI & address types
      const endpoint = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(
        query
      )}&access_token=${token}&types=poi,address&category=food_and_drink,restaurant,cafe,bar&language=vi&limit=8${proximity}`;

      const res = await fetch(endpoint);
      if (!res.ok) {
        // Fallback to Mapbox Geocoding v5 if Search Box v6 feature flag is disabled
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

      // Secondary Mapbox Geocoding v5 check when category filter returns 0 items for general landmarks
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

  // Server-side Mapbox Search proxy using server VITE_MAPBOX_TOKEN
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

/**
 * Unified 100% Mapbox POI Search Component (src/components/PoiSearchBox.tsx)
 * - Uses Mapbox Search Box API v6 & Mapbox Geocoding v5 via single VITE_MAPBOX_TOKEN
 * - Swiss Brutalism UI: border-radius: 0px !important, Background #0D1017, Border 1px solid #00E5FF
 * - Display item header format: [ 01 // POI ] <VENUE_NAME_UPPERCASE>
 */
export const PoiSearchBox: React.FC<PoiSearchBoxProps> = ({
  onSelectLocation,
  mapCenterLngLat,
  language = 'vi',
  placeholder,
  compact = false,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [statusBadge, setStatusBadge] = useState<string>(
    '[ MAPBOX_SEARCH_V6 // READY ]'
  );

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
        setStatusBadge('[ MAPBOX_SEARCH_V6 // READY ]');
        return;
      }

      // Check if input is a coordinate pair or pasted location URL
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
            `POI_${lat.toFixed(4)}N_${lng.toFixed(4)}E`,
          address: addr,
          fullAddress: addr,
          coordinates: [lng, lat],
          longitude: lng,
          latitude: lat,
        };
        setResults([linkResult]);
        setActiveIndex(0);
        setStatusBadge(`[ COORDS_LOCKED // ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E ]`);
        setIsOpen(true);
        return;
      }

      const effectiveQuery = parsedLink.fallbackQuery || trimmed;
      setIsLoading(true);
      setStatusBadge('[ MAPBOX_SEARCH_V6 // QUERYING... ]');

      try {
        const items = await searchLocationsMapbox(effectiveQuery, mapCenterLngLat);
        setResults(items);
        setActiveIndex(0);
        setStatusBadge(`[ MAPBOX_SEARCH_V6 // ${items.length} POIS ]`);
        setIsOpen(items.length > 0);
      } catch (_) {
        setStatusBadge('[ MAPBOX_SEARCH_V6 // STANDBY ]');
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
      setStatusBadge('[ MAPBOX_SEARCH_V6 // READY ]');
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      executeMapboxSearch(val);
    }, 220);
  };

  const handleSelectResult = (item: SearchResult) => {
    setQuery(item.name);
    setIsOpen(false);
    setStatusBadge(
      `[ POI_LOCKED // ${item.coordinates[1].toFixed(4)}°N, ${item.coordinates[0].toFixed(4)}°E ]`
    );
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
    <div
      ref={containerRef}
      className="relative w-full max-w-full select-none"
      style={{ borderRadius: '0px' }}
    >
      {/* Top Brutalist Telemetry Header */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5 text-[10px] font-mono-brand">
          <span className="text-[#00E5FF] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>[ MAPBOX SEARCH BOX API v6 // VITE_MAPBOX_TOKEN ]</span>
          </span>
          <span className="text-[#00E676] truncate">{statusBadge}</span>
        </div>
      )}

      {/* Search Input Row (Zero Soft Radius Geometry: border-radius: 0px !important) */}
      <div
        className="flex items-stretch w-full bg-[#080A0F] border border-[#1F1F2E] focus-within:border-[#00E5FF] transition-colors"
        style={{ borderRadius: '0px' }}
      >
        <div className="px-3 flex items-center justify-center text-[#00E5FF] border-r border-[#1F1F2E] bg-[#0D1017] shrink-0">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />
          ) : query.includes('http') || query.includes('@') ? (
            <Link2 className="w-4 h-4 text-[#00E676]" />
          ) : (
            <Search className="w-4 h-4 text-[#00E5FF]" />
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
              ? 'Tìm quán ăn, địa chỉ, địa danh qua Mapbox API (VD: "Phở Bò Phú Gia", "Highlands Coffee")...'
              : 'Search food venues, street addresses, or landmarks via Mapbox API (e.g. "Phở Bò Phú Gia", "Highlands Coffee")...')
          }
          aria-label="Mapbox POI Search"
          className="flex-1 min-w-0 min-h-[42px] px-3 bg-[#080A0F] text-[#FFFFFF] text-xs font-mono-brand placeholder:text-[#9BA8B8]/70 focus:outline-none"
          style={{ borderRadius: '0px' }}
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="px-2.5 bg-[#080A0F] text-[#9BA8B8] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer"
            title="Clear search"
            style={{ borderRadius: '0px' }}
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
          className="px-3 bg-[#0D1017] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] border-l border-[#1F1F2E] text-[10px] font-mono-brand font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          style={{ borderRadius: '0px' }}
        >
          <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {isLoading ? '[ SCANNING... ]' : '[ MAPBOX_SEARCH ]'}
          </span>
        </button>
      </div>

      {/* Swiss Brutalism Dropdown:
          border-radius: 0px !important, Background: #0D1017, Border: 1px solid #00E5FF
          Display item header format: [ 01 // POI ] <VENUE_NAME_UPPERCASE> */}
      {isOpen && results.length > 0 && (
        <div
          role="listbox"
          aria-label="Mapbox Search Results"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0D1017] border border-[#00E5FF] shadow-2xl divide-y divide-[#1F1F2E] max-h-[320px] overflow-y-auto"
          style={{ borderRadius: '0px' }}
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
                  isHighlighted
                    ? 'bg-[#080A0F] border-l-2 border-[#00E5FF]'
                    : 'bg-[#0D1017] hover:bg-[#080A0F]'
                }`}
                style={{ borderRadius: '0px' }}
              >
                <div className="min-w-0 flex-1">
                  {/* Required Header Format: [ 01 // POI ] <VENUE_NAME_UPPERCASE> */}
                  <div className="font-mono-brand text-xs font-bold text-[#FFFFFF] flex items-center gap-1.5 break-words">
                    <span className="text-[#00E5FF] shrink-0">
                      [ {indexLabel} // POI ]
                    </span>
                    <span className="truncate">{item.name.toUpperCase()}</span>
                  </div>
                  {/* Subtitle: Full street address or district */}
                  <div className="text-[11px] font-mono-brand text-[#9BA8B8] truncate mt-0.5">
                    {item.address}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono-brand">
                  <div className="text-[10px] text-[#00E676] font-bold flex items-center justify-end gap-1">
                    <Crosshair className="w-3 h-3 text-[#00E5FF] shrink-0" />
                    <span>
                      {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                    </span>
                  </div>
                  <div className="text-[9px] text-[#00E5FF] uppercase mt-0.5">
                    [ MAPBOX_V6 ]
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
