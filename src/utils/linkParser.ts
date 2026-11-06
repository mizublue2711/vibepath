export interface ParsedLocationLink {
  matched: boolean;
  latitude?: number;
  longitude?: number;
  extractedName?: string;
  fallbackQuery: string;
  sourceType: 'GOOGLE_MAPS_URL' | 'RAW_COORDINATES' | 'SHORT_URL_FALLBACK' | 'KEYWORD_QUERY';
}

/**
 * Validate if latitude and longitude are within valid Earth bounds
 */
function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Decode URL-encoded place name from Google Maps URL path if present
 * e.g., https://www.google.com/maps/place/Ph%E1%BB%9F+B%C3%B2+Ph%C3%BA+Gia/@10.7674,106.6939,17z
 */
function extractPlaceNameFromUrl(rawInput: string): string | undefined {
  try {
    const placeMatch = rawInput.match(/\/maps\/place\/([^/@?]+)/i);
    if (placeMatch && placeMatch[1]) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded && !/^[-+]?\d/.test(decoded)) {
        return decoded;
      }
    }
    const queryParamMatch = rawInput.match(/[?&](?:q|query)=([^&]+)/i);
    if (queryParamMatch && queryParamMatch[1]) {
      const decoded = decodeURIComponent(queryParamMatch[1].replace(/\+/g, ' ')).trim();
      // Only return as name if it's not purely coordinates
      if (decoded && !/^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(decoded)) {
        return decoded;
      }
    }
  } catch (_) {}
  return undefined;
}

/**
 * Smart Link Parser Fallback (src/utils/linkParser.ts)
 * Safely extracts latitude/longitude coordinates from Google Maps URLs or raw coordinate strings.
 * Never throws or crashes React state on malformed/shortened URLs; falls back to Geocoding query.
 */
export function parseLocationInput(rawInput: string): ParsedLocationLink {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      matched: false,
      fallbackQuery: '',
      sourceType: 'KEYWORD_QUERY',
    };
  }

  try {
    const extractedName = extractPlaceNameFromUrl(trimmed);

    // 1. Pattern A: Google Maps @lat,lng pattern (e.g. @10.7611,106.7024,17z)
    const atCoordMatch = trimmed.match(/@([-+]?\d{1,2}\.\d+),\s*([-+]?\d{1,3}\.\d+)/);
    if (atCoordMatch) {
      const lat = parseFloat(atCoordMatch[1]);
      const lng = parseFloat(atCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return {
          matched: true,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          extractedName: extractedName || `GOOGLE_MAPS_PIN_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          fallbackQuery: extractedName || `${lat},${lng}`,
          sourceType: 'GOOGLE_MAPS_URL',
        };
      }
    }

    // 2. Pattern B: Google Maps !3d<lat>!4d<lng> data parameter pattern
    const bangCoordMatch = trimmed.match(/!3d([-+]?\d{1,2}\.\d+)!4d([-+]?\d{1,3}\.\d+)/);
    if (bangCoordMatch) {
      const lat = parseFloat(bangCoordMatch[1]);
      const lng = parseFloat(bangCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return {
          matched: true,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          extractedName: extractedName || `GOOGLE_MAPS_NODE_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          fallbackQuery: extractedName || `${lat},${lng}`,
          sourceType: 'GOOGLE_MAPS_URL',
        };
      }
    }

    // 3. Pattern C: Query parameters ?q=lat,lng or &ll=lat,lng or &center=lat,lng
    const queryCoordMatch = trimmed.match(
      /[?&](?:q|query|ll|center|destination)=([-+]?\d{1,2}\.\d+)(?:%2C|,\s*)([-+]?\d{1,3}\.\d+)/i
    );
    if (queryCoordMatch) {
      const lat = parseFloat(queryCoordMatch[1]);
      const lng = parseFloat(queryCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return {
          matched: true,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          extractedName: extractedName || `MAPS_QUERY_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          fallbackQuery: extractedName || `${lat},${lng}`,
          sourceType: 'GOOGLE_MAPS_URL',
        };
      }
    }

    // 4. Pattern D: Raw Coordinate Pair (e.g., "10.7611, 106.7024" or "10.7674°N, 106.6939°E")
    const rawCoordMatch = trimmed.match(
      /^([-+]?\d{1,2}\.\d+)\s*°?\s*[NS]?[\s,;]+([-+]?\d{1,3}\.\d+)\s*°?\s*[EW]?$/i
    );
    if (rawCoordMatch) {
      const lat = parseFloat(rawCoordMatch[1]);
      const lng = parseFloat(rawCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return {
          matched: true,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          extractedName: `COORD_LOCK_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          fallbackQuery: `${lat},${lng}`,
          sourceType: 'RAW_COORDINATES',
        };
      }
    }

    // 5. Pattern E: If input is a shortened or unparseable URL (e.g. maps.app.goo.gl/... or invalid link),
    // strip protocol/domain noise so the Geocoding API fallback gets a clean search query without crashing
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('google.com/maps') || trimmed.includes('goo.gl')) {
      if (extractedName) {
        return {
          matched: false,
          extractedName,
          fallbackQuery: extractedName,
          sourceType: 'SHORT_URL_FALLBACK',
        };
      }
      // Extract last meaningful path segment or fallback to Saigon default search
      const urlSlug = trimmed
        .replace(/^https?:\/\/[^/]+\//i, '')
        .replace(/^maps\/(?:place\/|search\/|dir\/)?/i, '')
        .split(/[/?&#]/)[0]
        .replace(/[-_+]+/g, ' ')
        .trim();

      return {
        matched: false,
        fallbackQuery: urlSlug && urlSlug.length >= 2 ? urlSlug : trimmed,
        sourceType: 'SHORT_URL_FALLBACK',
      };
    }

    return {
      matched: false,
      fallbackQuery: trimmed,
      sourceType: 'KEYWORD_QUERY',
    };
  } catch (_) {
    // Never crash React state on any input
    return {
      matched: false,
      fallbackQuery: trimmed.slice(0, 80),
      sourceType: 'KEYWORD_QUERY',
    };
  }
}
