import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiKeyManager } from '../services/apiKeyManager';
import { parseLocationInput } from '../utils/linkParser';
import { LanguageCode } from '../data/vibePathData';
import { Search, Crosshair, CornerDownLeft, X, Link2, Loader2 } from 'lucide-react';

export interface SearchResult {
  id: string;
  name: string;
  place_name?: string;
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

function normalizeVietnameseText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
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
        place_name: address,
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
        place_name: address,
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
 * Hybrid Search Strategy:
 * Step 1: Query Mapbox Geocoding API first (with proximity bias & language=vi).
 * Step 2: If Mapbox returns 0 relevant results, automatically fall back to OpenStreetMap Nominatim API.
 * Step 3: Supplement with /api/poi-search verified Vietnamese culinary index if needed.
 */
export async function searchLocationHybrid(
  query: string,
  currentLngLat?: [number, number]
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const envToken = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim();
  const customToken = (ApiKeyManager.getMapKey() || '').trim();
  const token =
    envToken && envToken.startsWith('pk.') && !envToken.includes('xxxxxxxx')
      ? envToken
      : customToken;

  const hasValidCoords =
    currentLngLat &&
    Number.isFinite(currentLngLat[0]) &&
    Number.isFinite(currentLngLat[1]);

  const [lng, lat] = hasValidCoords
    ? [Number(currentLngLat![0].toFixed(6)), Number(currentLngLat![1].toFixed(6))]
    : [106.7024, 10.7611];

  const proximity = `&proximity=${lng},${lat}`;
  const queryTokens = normalizeVietnameseText(trimmedQuery)
    .split(/\s+/)
    .filter((t) => t.length > 1);

  let results: SearchResult[] = [];

  // Step 1: Mapbox Primary Search (Broad types)
  if (token && token.startsWith('pk.') && !token.includes('xxxxxxxx')) {
    try {
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        trimmedQuery
      )}.json?access_token=${encodeURIComponent(token)}&language=vi&limit=8${proximity}`;
      const res = await fetch(mapboxUrl);
      if (!res.ok) {
        console.error(
          `[Mapbox Geocoding HTTP Error] Status ${res.status} (${res.statusText}) for query "${trimmedQuery}"`
        );
      } else {
        const data = await res.json();
        if (Array.isArray(data.features) && data.features.length > 0) {
          // Verify that Mapbox features actually match the Vietnamese venue query rather than unrelated fuzzy tokens
          const relevantFeatures = data.features.filter((f: any) => {
            if (queryTokens.length <= 1) return true;
            const hay = normalizeVietnameseText(
              `${f.text_vi || ''} ${f.text || ''} ${f.place_name_vi || ''} ${f.place_name || ''}`
            );
            const matchedCount = queryTokens.filter((tk) => hay.includes(tk)).length;
            return matchedCount >= Math.ceil(queryTokens.length * 0.65);
          });

          if (relevantFeatures.length > 0) {
            results = relevantFeatures.map((f: any, idx: number): SearchResult => {
              const center = Array.isArray(f.center) ? f.center : [lng, lat];
              const fLng = Number(Number(center[0]).toFixed(6));
              const fLat = Number(Number(center[1]).toFixed(6));
              const rawName = String(
                f.text_vi || f.text || String(f.place_name || '').split(',')[0] || trimmedQuery
              ).trim();
              const placeName = String(f.place_name_vi || f.place_name || rawName).trim();
              return {
                id: String(f.id || `mapbox-${idx}`),
                name: rawName,
                place_name: placeName,
                address: placeName,
                fullAddress: placeName,
                coordinates: [fLng, fLat],
                longitude: fLng,
                latitude: fLat,
              };
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Mapbox Search failed, attempting OSM Fallback]', e);
    }
  }

  // Step 2: OpenStreetMap Nominatim Fallback if Mapbox returns 0 results
  if (results.length === 0) {
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        trimmedQuery
      )}&format=json&addressdetails=1&limit=8&countrycodes=vn`;
      const osmRes = await fetch(osmUrl, {
        headers: {
          'Accept-Language': 'vi',
        },
      });
      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (Array.isArray(osmData) && osmData.length > 0) {
          results = osmData
            .map((item: any, index: number): SearchResult => {
              const displayName = String(item.display_name || trimmedQuery).trim();
              const rawName = Array.isArray(item.name)
                ? String(item.name[0] || '')
                : String(item.name || displayName.split(',')[0] || trimmedQuery).trim();
              const itemLng = Number(parseFloat(String(item.lon)).toFixed(6));
              const itemLat = Number(parseFloat(String(item.lat)).toFixed(6));
              return {
                id: `osm-${item.place_id || index}`,
                name: rawName || displayName.split(',')[0].trim(),
                place_name: displayName,
                address: displayName,
                fullAddress: displayName,
                coordinates: [itemLng, itemLat],
                longitude: itemLng,
                latitude: itemLat,
              };
            })
            .filter((r) => Number.isFinite(r.longitude) && Number.isFinite(r.latitude));
        }
      }
    } catch (e) {
      console.error('[OSM Search fallback failed]', e);
    }
  }

  // Step 3: Backend Proxy & Verified Vietnamese Culinary Index Fallback if still empty
  if (results.length === 0) {
    try {
      const serverRes = await fetch(
        `/api/poi-search?q=${encodeURIComponent(trimmedQuery)}${proximity}`
      );
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (Array.isArray(serverData) && serverData.length > 0) {
          results = serverData.slice(0, 8).map((item: any, idx: number): SearchResult => {
            const itemLng = Number(
              Number(item.coordinates?.[0] ?? item.longitude ?? lng).toFixed(6)
            );
            const itemLat = Number(
              Number(item.coordinates?.[1] ?? item.latitude ?? lat).toFixed(6)
            );
            const addr = String(
              item.place_name || item.address || item.fullAddress || item.name || ''
            ).trim();
            return {
              id: String(item.id || `poi-fallback-${idx}`),
              name: String(item.name || addr.split(',')[0] || trimmedQuery).trim(),
              place_name: addr,
              address: addr,
              fullAddress: addr,
              coordinates: [itemLng, itemLat],
              longitude: itemLng,
              latitude: itemLat,
            };
          });
        }
      }
    } catch (err) {
      console.error('[Proxy Search fallback failed]', err);
    }
  }

  return results;
}

export const searchLocationsMapbox = searchLocationHybrid;

export const DEFAULT_POI_SEARCH_PLACEHOLDER =
  '[ 🔍 NHẬP TÊN QUÁN HOẶC ĐỊA CHỈ (VD: "CHAY LOVING HUT", "BÁNH CUỐN BÀ HOÀNH"...) ]';

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
          place_name: addr,
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
        const items = await searchLocationHybrid(effectiveQuery, mapCenterLngLat);
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
    <div ref={containerRef} className="relative w-full max-w-full select-none rounded-none">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#8A8FA3] uppercase">
          [ 01 // GEO_INDEX_LOOKUP ]
        </span>
        <span className="font-mono text-[10px] text-[#8A8FA3] hidden sm:inline">
          MAPBOX_V6 // PROXIMITY_BIAS_ACTIVE
        </span>
      </div>

      <div className="flex items-stretch w-full bg-[#05050A] border border-[#1F1F2E] rounded-none focus-within:border-[#00E5FF] transition-colors overflow-hidden">
        <div className="px-3 flex items-center justify-center border-r border-[#1F1F2E] bg-[#0D0E17] shrink-0 rounded-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />
          ) : query.includes('http') || query.includes('@') ? (
            <Link2 className="w-4 h-4 text-[#00FF66]" />
          ) : (
            <Search className="w-4 h-4 text-[#8A8FA3]" />
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
          placeholder={placeholder || DEFAULT_POI_SEARCH_PLACEHOLDER}
          aria-label="Search POI Locations"
          className="flex-1 min-w-0 min-h-[40px] px-3 bg-transparent text-[#FFFFFF] font-mono text-xs placeholder:text-[#8A8FA3] focus:outline-none rounded-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="px-2.5 text-[#8A8FA3] hover:text-white flex items-center justify-center cursor-pointer rounded-none"
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
          className="px-3.5 bg-[#0D0E17] border-l border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 rounded-none"
        >
          <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">
            {isLoading
              ? language === 'vi'
                ? 'ĐANG TÌM...'
                : 'SEARCHING...'
              : language === 'vi'
              ? 'Tìm địa điểm'
              : 'Find POI'}
          </span>
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <div
          role="listbox"
          aria-label="Location Search Results"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0D0E17] border border-[#1F1F2E] rounded-none divide-y divide-[#1F1F2E] max-h-[320px] overflow-y-auto"
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
                className={`w-full px-3.5 py-2.5 text-left flex items-start justify-between gap-3 cursor-pointer transition-colors rounded-none ${
                  isHighlighted
                    ? 'bg-[#171825] border-l-2 border-l-[#00E5FF]'
                    : 'hover:bg-[#141622]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-white flex items-center gap-2 break-words">
                    <span className="font-mono text-[11px] font-bold text-[#00E5FF] shrink-0">
                      [ {indexLabel} ]
                    </span>
                    <span className="uppercase">{item.name}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#8A8FA3] mt-0.5">
                    {item.address}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono tabular-nums">
                  <div className="text-[11px] text-[#00FF66] font-bold flex items-center justify-end gap-1">
                    <Crosshair className="w-3 h-3 text-[#00FF66] shrink-0" />
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
