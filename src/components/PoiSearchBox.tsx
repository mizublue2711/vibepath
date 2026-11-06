import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiKeyManager } from '../services/apiKeyManager';
import { parseLocationInput } from '../utils/linkParser';
import { LanguageCode } from '../data/vibePathData';
import { Search, Crosshair, CornerDownLeft, X, Link2, Sparkles, Loader2 } from 'lucide-react';

export interface GeocodedPoiResult {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  districtName?: string;
  countryCode?: string;
  source: 'MAPBOX_GEOCODING' | 'LINK_PARSER' | 'OPEN_GLOBAL_GEOCODER';
}

export interface PoiSearchBoxProps {
  onSelectLocation: (result: GeocodedPoiResult) => void;
  language?: LanguageCode;
  placeholder?: string;
  compact?: boolean;
}

/**
 * Unrestricted Global Free-Text Location Search (src/components/PoiSearchBox.tsx)
 * - Zero hardcoded mock arrays, zero static country tags, zero regional locks
 * - Queries Mapbox Geocoding API globally:
 *   https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&language=vi&limit=8
 * - Supports Smart Link Parser (src/utils/linkParser.ts) for pasted Google Maps URLs / coordinates
 * - Dropdown UI: border-radius: 0px !important, Background: #0D1017, Border: 1px solid #00E5FF
 * - Item format: [ 01 ] <LOCATION_NAME_UPPERCASE> with full place name/address subtitle
 */
export const PoiSearchBox: React.FC<PoiSearchBoxProps> = ({
  onSelectLocation,
  language = 'vi',
  placeholder,
  compact = false,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<GeocodedPoiResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [statusBadge, setStatusBadge] = useState<string>(
    '[ GLOBAL_GEOCODER // LIMIT:8 · UNRESTRICTED ]'
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const executeGlobalSearch = useCallback(async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setStatusBadge('[ GLOBAL_GEOCODER // LIMIT:8 · UNRESTRICTED ]');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. Check if input is a Google Maps link or raw coordinate pair via linkParser.ts
    const parsedLink = parseLocationInput(trimmed);
    if (
      parsedLink.matched &&
      typeof parsedLink.latitude === 'number' &&
      typeof parsedLink.longitude === 'number'
    ) {
      const linkResult: GeocodedPoiResult = {
        id: `parsed-link-${parsedLink.latitude}-${parsedLink.longitude}`,
        name:
          parsedLink.extractedName ||
          `TARGET_${parsedLink.latitude.toFixed(4)}N_${parsedLink.longitude.toFixed(4)}E`,
        fullAddress: `${parsedLink.latitude.toFixed(6)}°N, ${parsedLink.longitude.toFixed(6)}°E`,
        latitude: parsedLink.latitude,
        longitude: parsedLink.longitude,
        source: 'LINK_PARSER',
      };
      setResults([linkResult]);
      setActiveIndex(0);
      setStatusBadge(
        `[ LINK_COORDS_EXTRACTED // ${parsedLink.latitude.toFixed(4)}°N, ${parsedLink.longitude.toFixed(4)}°E ]`
      );
      setIsOpen(true);
      return;
    }

    const effectiveQuery = parsedLink.fallbackQuery || trimmed;
    setIsLoading(true);
    setStatusBadge('[ QUERYING_GLOBAL_GEOCODER... ]');

    try {
      const token = (
        ApiKeyManager.getMapKey() ||
        (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
        ''
      ).trim();

      // 2. Primary: Unrestricted Global Mapbox Geocoding API (no country filter, limit=8)
      if (token.startsWith('pk.') && !token.includes('xxxxxxxx') && token.length >= 32) {
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          effectiveQuery
        )}.json?access_token=${token}&language=vi&limit=8`;

        const response = await fetch(endpoint, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data?.features)) {
            const mapboxItems: GeocodedPoiResult[] = data.features
              .slice(0, 8)
              .map((feat: any, idx: number) => {
                const coords = Array.isArray(feat.center) ? feat.center : [0, 0];
                const countryCtx = Array.isArray(feat.context)
                  ? feat.context.find((c: any) => String(c.id || '').startsWith('country'))
                  : null;
                const districtCtx = Array.isArray(feat.context)
                  ? feat.context.find(
                      (c: any) =>
                        String(c.id || '').startsWith('district') ||
                        String(c.id || '').startsWith('locality') ||
                        String(c.id || '').startsWith('place') ||
                        String(c.id || '').startsWith('region')
                    )
                  : null;
                return {
                  id: String(feat.id || `mapbox-global-${idx}`),
                  name: String(feat.text_vi || feat.text || feat.place_name || effectiveQuery),
                  fullAddress: String(feat.place_name_vi || feat.place_name || ''),
                  longitude: Number(Number(coords[0]).toFixed(6)),
                  latitude: Number(Number(coords[1]).toFixed(6)),
                  districtName: districtCtx?.text
                    ? String(districtCtx.text).toUpperCase()
                    : String(feat.text || '').toUpperCase(),
                  countryCode: countryCtx?.short_code
                    ? String(countryCtx.short_code).toUpperCase()
                    : undefined,
                  source: 'MAPBOX_GEOCODING' as const,
                };
              });

            setResults(mapboxItems);
            setActiveIndex(0);
            setStatusBadge(`[ MAPBOX_GLOBAL_API // ${mapboxItems.length} RESULTS ]`);
            setIsOpen(mapboxItems.length > 0);
            setIsLoading(false);
            return;
          }
        }
      }

      // 3. Live Open Global Geocoder API Fallback (Nominatim OpenStreetMap, worldwide, limit=8)
      // Ensures dynamic global search works even before user inputs a Mapbox token
      const openEndpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&q=${encodeURIComponent(
        effectiveQuery
      )}&limit=8&accept-language=vi,en`;

      const openResp = await fetch(openEndpoint, { signal: controller.signal });
      if (openResp.ok) {
        const openData = await openResp.json();
        if (Array.isArray(openData)) {
          const dynamicItems: GeocodedPoiResult[] = openData
            .slice(0, 8)
            .map((item: any, idx: number) => {
              const displayName = String(item.display_name || effectiveQuery);
              const primaryName =
                String(item.name || '').trim() ||
                displayName.split(',')[0]?.trim() ||
                effectiveQuery;
              const addr = item.address || {};
              const district =
                addr.suburb ||
                addr.city_district ||
                addr.borough ||
                addr.county ||
                addr.city ||
                addr.town ||
                primaryName;
              const countryCode = addr.country_code
                ? String(addr.country_code).toUpperCase()
                : undefined;

              return {
                id: String(item.place_id || `global-osm-${idx}`),
                name: primaryName,
                fullAddress: displayName,
                latitude: Number(parseFloat(String(item.lat)).toFixed(6)),
                longitude: Number(parseFloat(String(item.lon)).toFixed(6)),
                districtName: String(district).toUpperCase(),
                countryCode,
                source: 'OPEN_GLOBAL_GEOCODER' as const,
              };
            });

          setResults(dynamicItems);
          setActiveIndex(0);
          setStatusBadge(`[ GLOBAL_GEOCODER_API // ${dynamicItems.length} RESULTS ]`);
          setIsOpen(dynamicItems.length > 0);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setStatusBadge('[ GEOCODER_STANDBY // TYPE_TO_SEARCH ]');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

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
      setStatusBadge('[ GLOBAL_GEOCODER // LIMIT:8 · UNRESTRICTED ]');
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      executeGlobalSearch(val);
    }, 220);
  };

  const handleSelectResult = (item: GeocodedPoiResult) => {
    setQuery(item.name);
    setIsOpen(false);
    setStatusBadge(
      `[ LOCKED // ${item.latitude.toFixed(4)}°N, ${item.longitude.toFixed(4)}°E ]`
    );
    onSelectLocation(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && query.trim()) {
        executeGlobalSearch(query);
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
        executeGlobalSearch(query);
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
            <span>[ GLOBAL_POI_AUTOCOMPLETE // FREE-TEXT WORLDWIDE GEOCODER ]</span>
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
              ? 'Nhập bất kỳ địa điểm nào trên thế giới (VD: "Shibuya Crossing", "Eiffel Tower", "Pho Bo Phu Gia")...'
              : 'Type any global location (e.g. "Shibuya Crossing", "Eiffel Tower", "Pho Bo Phu Gia", "Manhattan Central Park")...')
          }
          aria-label="Global Free-Text Location Search"
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
              executeGlobalSearch(query);
            }
          }}
          className="px-3 bg-[#0D1017] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] border-l border-[#1F1F2E] text-[10px] font-mono-brand font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          style={{ borderRadius: '0px' }}
        >
          <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {isLoading ? '[ SCANNING... ]' : '[ SEARCH ]'}
          </span>
        </button>
      </div>

      {/* Cybernetic Swiss Brutalism Dropdown UI:
          border-radius: 0px !important, Background: #0D1017, Border: 1px solid #00E5FF
          Item format: [ 01 ] <LOCATION_NAME_UPPERCASE> with subtitle displaying full place name/address */}
      {isOpen && results.length > 0 && (
        <div
          role="listbox"
          aria-label="Global Geocoding Results"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0D1017] border border-[#00E5FF] shadow-2xl divide-y divide-[#1F1F2E] max-h-[320px] overflow-y-auto"
          style={{ borderRadius: '0px' }}
        >
          {results.slice(0, 8).map((item, idx) => {
            const indexLabel = String(idx + 1).padStart(2, '0');
            const isHighlighted = idx === activeIndex;
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
                  {/* Required Item Format: [ 01 ] <LOCATION_NAME_UPPERCASE> */}
                  <div className="font-mono-brand text-xs font-bold text-[#FFFFFF] flex items-center gap-1.5 break-words">
                    <span className="text-[#00E5FF] shrink-0">[ {indexLabel} ]</span>
                    <span className="truncate">{item.name.toUpperCase()}</span>
                  </div>
                  {/* Subtitle displaying full place name/address */}
                  <div className="text-[11px] font-mono-brand text-[#9BA8B8] truncate mt-0.5">
                    {item.fullAddress}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono-brand">
                  <div className="text-[10px] text-[#00E676] font-bold flex items-center justify-end gap-1">
                    <Crosshair className="w-3 h-3 text-[#00E5FF] shrink-0" />
                    <span>
                      {item.latitude.toFixed(4)}°, {item.longitude.toFixed(4)}°
                    </span>
                  </div>
                  {item.countryCode && (
                    <div className="text-[9px] text-[#00E5FF] uppercase mt-0.5">
                      [ {item.districtName ? `${item.districtName}, ` : ''}
                      {item.countryCode} ]
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
