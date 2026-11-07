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

const GENERIC_VIETNAMESE_FOOD_TERMS = [
  'quan chay',
  'nha hang chay',
  'com chay',
  'do chay',
  'chay',
  'banh cuon',
  'banh cuon long ga',
  'bun bo',
  'quan oc',
  'oc dem',
  'pho bo',
  'pho ga',
  'com tam',
  'banh mi',
  'ca phe',
  'coffee',
  'hu tieu',
  'bun cha',
  'bun dau',
  'bun rieu',
  'lau',
  'nuong',
  'quan an',
  'nha hang',
];

function normalizeVietnameseText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function isGenericVietnameseFoodQuery(rawQuery: string): boolean {
  const norm = normalizeVietnameseText(rawQuery);
  return GENERIC_VIETNAMESE_FOOD_TERMS.some(
    (term) => norm === term || norm.startsWith(`${term} `) || norm.includes(term)
  );
}

function isWithinVietnamBounds(lng: number, lat: number): boolean {
  return lng >= 102.0 && lng <= 110.5 && lat >= 8.0 && lat <= 23.8;
}

export async function searchLocationsMapbox(
  query: string,
  mapCenterLngLat?: [number, number]
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const envToken = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim();
  const customOrEnvToken = (ApiKeyManager.getMapKey() || '').trim();
  const token =
    envToken && envToken.startsWith('pk.') && !envToken.includes('xxxxxxxx')
      ? envToken
      : customOrEnvToken;

  // 1. Strict Proximity Bias: ALWAYS resolve [lng, lat] from active map center
  const [lng, lat] =
    mapCenterLngLat &&
    Number.isFinite(mapCenterLngLat[0]) &&
    Number.isFinite(mapCenterLngLat[1])
      ? [Number(mapCenterLngLat[0].toFixed(6)), Number(mapCenterLngLat[1].toFixed(6))]
      : [106.7024, 10.7611];

  // 2. Query Pre-Processing for Generic Vietnamese Food Terms & Vietnam Bounds
  const isGenericFood = isGenericVietnameseFoodQuery(query);
  const inVietnam = isWithinVietnamBounds(lng, lat);

  if (token && token.startsWith('pk.') && !token.includes('xxxxxxxx')) {
    try {
      const countryParam = inVietnam || isGenericFood ? '&country=vn' : '';
      const searchBoxTypes = isGenericFood
        ? 'poi'
        : 'poi,address,place,locality,district';
      const categoryParam = isGenericFood
        ? '&category=food_and_drink,restaurant,cafe'
        : '';

      // Primary Mapbox Search Box API v1 lookup with category & strict proximity bias
      const searchBoxEndpoint = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(
        query
      )}&access_token=${encodeURIComponent(
        token
      )}&types=${searchBoxTypes}${categoryParam}${countryParam}&language=vi&limit=8&proximity=${lng},${lat}`;

      const sbRes = await fetch(searchBoxEndpoint);
      if (!sbRes.ok) {
        console.error(
          `[Mapbox SearchBox HTTP Error] Status ${sbRes.status} (${sbRes.statusText}) for query "${query}"`
        );
      } else {
        const sbData = await sbRes.json();
        const rawItems = sbData.suggestions || sbData.features || [];
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const parsedSb = parseMapboxSearchBox(rawItems);
          if (parsedSb.length > 0) {
            return parsedSb;
          }
        }
      }

      // Fallback Mapbox Geocoding API with strict proximity bias & country=vn in Vietnam bounds
      const endpoint = isGenericFood || inVietnam
        ? `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${token}&types=poi,address&country=vn&language=vi&limit=8&proximity=${lng},${lat}`
        : `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${token}&types=poi,address,place,locality,district&language=vi&limit=8&proximity=${lng},${lat}`;

      const geoRes = await fetch(endpoint);
      if (!geoRes.ok) {
        console.error(
          `[Mapbox Geocoding HTTP Error] Status ${geoRes.status} (${geoRes.statusText}) for query "${query}"`
        );
      } else {
        const geoData = await geoRes.json();
        const geoFeatures = geoData.features || [];
        if (Array.isArray(geoFeatures) && geoFeatures.length > 0) {
          const parsedGeo = parseMapboxGeocoding(geoFeatures);
          if (parsedGeo.length > 0) {
            return parsedGeo;
          }
        }
      }
    } catch (err) {
      console.error('[Mapbox Search Network Error]:', err);
    }
  }

  // 3. Backend Proxy Fallback (/api/poi-search) with strict proximity bias
  try {
    const serverEndpoint = `/api/poi-search?q=${encodeURIComponent(query)}&proximity=${lng},${lat}`;
    const serverRes = await fetch(serverEndpoint);
    if (!serverRes.ok) {
      console.error(
        `[/api/poi-search HTTP Error] Status ${serverRes.status} (${serverRes.statusText}) for query "${query}"`
      );
      return [];
    }

    const serverData = await serverRes.json();
    if (Array.isArray(serverData)) {
      return serverData.slice(0, 8).map((item: any, idx: number): SearchResult => {
        const itemLng = Number(
          Number(item.coordinates?.[0] ?? item.longitude ?? lng).toFixed(6)
        );
        const itemLat = Number(
          Number(item.coordinates?.[1] ?? item.latitude ?? lat).toFixed(6)
        );
        const addr = String(item.address || item.fullAddress || item.name || '').trim();
        return {
          id: String(item.id || `mapbox-poi-${idx}`),
          name: String(item.name || query).trim(),
          address: addr,
          fullAddress: addr,
          coordinates: [itemLng, itemLat],
          longitude: itemLng,
          latitude: itemLat,
        };
      });
    }
  } catch (err) {
    console.error('[Mapbox Proxy Search Error]:', err);
  }

  return [];
}

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
