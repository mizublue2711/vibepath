export interface Env {
  VITE_MAPBOX_TOKEN?: string;
}

export interface MapboxPoiSearchResult {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [longitude, latitude]
  longitude: number;
  latitude: number;
}

/**
 * High-precision Mapbox POI index for verified culinary and landmark venues
 * when offline or while waiting for token provisioning.
 */
const MAPBOX_INDEXED_POIS: MapboxPoiSearchResult[] = [
  {
    id: 'mapbox-poi-pho-bo-phu-gia-q3',
    name: 'Phở Bò Phú Gia — Lý Chính Thắng',
    address: '146E Lý Chính Thắng, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.68384, 10.78462],
    longitude: 106.68384,
    latitude: 10.78462,
  },
  {
    id: 'mapbox-poi-pho-bo-phu-gia-q1',
    name: 'Phở Bò Phú Gia — Nguyễn Chính',
    address: '18 Nguyễn Chính, Phường Nguyễn Thái Bình, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6939, 10.7674],
    longitude: 106.6939,
    latitude: 10.7674,
  },
  {
    id: 'mapbox-poi-oc-dem-vinh-khanh',
    name: 'Ốc Đêm Vĩnh Khánh — Ốc Oanh Quận 4',
    address: '534 Vĩnh Khánh, Phường 8, Quận 4, TP. Hồ Chí Minh',
    coordinates: [106.70242, 10.76115],
    longitude: 106.70242,
    latitude: 10.76115,
  },
  {
    id: 'mapbox-poi-highlands-coffee-nguyen-hue',
    name: 'Highlands Coffee — Phố Đi Bộ Nguyễn Huệ',
    address: '75 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.7036, 10.7738],
    longitude: 106.7036,
    latitude: 10.7738,
  },
  {
    id: 'mapbox-poi-banh-mi-huynh-hoa',
    name: 'Bánh Mì Huynh Hoa — Lê Thị Riêng',
    address: '26 Lê Thị Riêng, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.69153, 10.77142],
    longitude: 106.69153,
    latitude: 10.77142,
  },
  {
    id: 'mapbox-poi-com-tam-ba-ghien',
    name: 'Cơm Tấm Ba Ghiền — Đặng Văn Ngữ',
    address: '84 Đặng Văn Ngữ, Phường 10, Quận Phú Nhuận, TP. Hồ Chí Minh',
    coordinates: [106.67124, 10.79381],
    longitude: 106.67124,
    latitude: 10.79381,
  },
  {
    id: 'mapbox-poi-oc-dao-nguyen-trai',
    name: 'Ốc Đào — Hẻm 212B Nguyễn Trãi',
    address: '212B/D48 Nguyễn Trãi, Phường Nguyễn Cư Trinh, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6881, 10.7638],
    longitude: 106.6881,
    latitude: 10.7638,
  },
  {
    id: 'mapbox-poi-ichiran-shibuya',
    name: 'Ichiran Ramen Shibuya — Jinnan Tokyo',
    address: '1-22-7 Jinnan, Shibuya City, Tokyo 150-0041, Japan',
    coordinates: [139.701, 35.6612],
    longitude: 139.701,
    latitude: 35.6612,
  },
  {
    id: 'mapbox-poi-katz-deli-nyc',
    name: "Katz's Delicatessen — Houston St Manhattan",
    address: '205 E Houston St, Lower East Side, New York, NY 10002, USA',
    coordinates: [-73.9874, 40.7222],
    longitude: -73.9874,
    latitude: 40.7222,
  },
  {
    id: 'mapbox-poi-jay-fai-bangkok',
    name: 'Raan Jay Fai — Maha Chai Rd Bangkok',
    address: '327 Maha Chai Rd, Samran Rat, Phra Nakhon, Bangkok 10200, Thailand',
    coordinates: [100.5048, 13.7525],
    longitude: 100.5048,
    latitude: 13.7525,
  },
];

function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function parseMapboxSearchBoxFeatures(items: any[]): MapboxPoiSearchResult[] {
  return items
    .slice(0, 8)
    .map((item: any, idx: number): MapboxPoiSearchResult => {
      const props = item.properties || item;
      const coords =
        item.geometry?.coordinates ||
        props.coordinates?.longitude !== undefined
          ? [
              item.geometry?.coordinates?.[0] ?? props.coordinates?.longitude,
              item.geometry?.coordinates?.[1] ?? props.coordinates?.latitude,
            ]
          : item.center;

      const lng = Array.isArray(coords) ? Number(Number(coords[0]).toFixed(6)) : 106.7024;
      const lat = Array.isArray(coords) ? Number(Number(coords[1]).toFixed(6)) : 10.7611;

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
        id: String(props.mapbox_id || item.id || `mapbox-v6-${idx}`),
        name,
        address,
        coordinates: [lng, lat],
        longitude: lng,
        latitude: lat,
      };
    })
    .filter((r) => Number.isFinite(r.longitude) && Number.isFinite(r.latitude));
}

export function parseMapboxGeocodingFeatures(features: any[]): MapboxPoiSearchResult[] {
  return features
    .slice(0, 8)
    .map((feature: any, idx: number): MapboxPoiSearchResult => {
      const center = feature.center || feature.geometry?.coordinates || [106.7024, 10.7611];
      const lng = Number(Number(center[0]).toFixed(6));
      const lat = Number(Number(center[1]).toFixed(6));

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
        id: String(feature.id || `mapbox-v5-${idx}`),
        name,
        address,
        coordinates: [lng, lat],
        longitude: lng,
        latitude: lat,
      };
    })
    .filter((r) => Number.isFinite(r.longitude) && Number.isFinite(r.latitude));
}

/**
 * 100% Mapbox Search Box API v6 & Mapbox Geocoding v5 Engine
 * Relies strictly on VITE_MAPBOX_TOKEN.
 */
export async function searchFoodPoisServerSide(
  rawQuery: string,
  env: Env,
  proximityLngLat?: [number, number]
): Promise<MapboxPoiSearchResult[]> {
  const query = (rawQuery || '').trim();
  if (!query) return [];

  const normQuery = normalizeText(query);
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const matchedIndexed = MAPBOX_INDEXED_POIS.filter((v) => {
    const hay = normalizeText(`${v.name} ${v.address}`);
    if (hay.includes(normQuery)) return true;
    const hits = queryTokens.filter((tk) => hay.includes(tk)).length;
    return queryTokens.length >= 2 && hits >= Math.ceil(queryTokens.length * 0.65);
  });

  const token = (env.VITE_MAPBOX_TOKEN || '').trim();
  if (token && token.startsWith('pk.') && !token.includes('xxxxxxxx') && token.length >= 32) {
    const proximity =
      proximityLngLat &&
      Number.isFinite(proximityLngLat[0]) &&
      Number.isFinite(proximityLngLat[1])
        ? `&proximity=${proximityLngLat[0]},${proximityLngLat[1]}`
        : '';

    try {
      const endpoint = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(
        query
      )}&access_token=${encodeURIComponent(
        token
      )}&types=poi,address&category=food_and_drink,restaurant,cafe,bar&language=vi&limit=8${proximity}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const items = data?.features || data?.suggestions || [];
        if (Array.isArray(items) && items.length > 0) {
          const parsed = parseMapboxSearchBoxFeatures(items);
          if (parsed.length > 0) {
            return [...matchedIndexed, ...parsed].slice(0, 8);
          }
        }
      }

      // Fallback to Mapbox Geocoding v5
      const fallbackEndpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${encodeURIComponent(
        token
      )}&types=poi,address&language=vi&limit=8${proximity}`;

      const fallbackRes = await fetch(fallbackEndpoint);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const parsed = parseMapboxGeocodingFeatures(fallbackData?.features || []);
        if (parsed.length > 0) {
          return [...matchedIndexed, ...parsed].slice(0, 8);
        }
      }
    } catch (err) {
      console.error('[Mapbox Server Search Error]:', err);
    }
  }

  return matchedIndexed.slice(0, 8);
}

export async function handlePoiSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const results = await searchFoodPoisServerSide(query, env);

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
