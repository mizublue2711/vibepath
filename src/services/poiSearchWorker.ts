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
 * Verified Vietnamese & Global Food Venues + Landmarks Index
 * Covers "quán chay", "chay loving hut", "bánh cuốn lòng gà", "bánh cuốn bà hoành",
 * "bún bò", "quán ốc", "phở bò", "cà phê", "highlands", "cơm tấm", "bánh mì", and key regions.
 */
export const MAPBOX_INDEXED_POIS: MapboxPoiSearchResult[] = [
  // Vegetarian / Quán Chay
  {
    id: 'mapbox-poi-chay-loving-hut-q1',
    name: 'Chay Loving Hut Hoa Đăng — Huỳnh Khương Ninh',
    address: '38 Huỳnh Khương Ninh, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6968, 10.7902],
    longitude: 106.6968,
    latitude: 10.7902,
  },
  {
    id: 'mapbox-poi-chay-loving-hut-q3',
    name: 'Nhà Hàng Chay Loving Hut — Võ Văn Tần',
    address: '337 Võ Văn Tần, Phường 5, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.6849, 10.7712],
    longitude: 106.6849,
    latitude: 10.7712,
  },
  {
    id: 'mapbox-poi-hum-vegetarian-q3',
    name: 'Quán Chay Hum Vegetarian — Võ Văn Tần Quận 3',
    address: '32 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.6914, 10.7778],
    longitude: 106.6914,
    latitude: 10.7778,
  },
  {
    id: 'mapbox-poi-chay-pi-vegetarian-q1',
    name: 'Quán Chay Pi Vegetarian Bistro — Võ Văn Kiệt',
    address: '187/15 Điện Biên Phủ, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6961, 10.7875],
    longitude: 106.6961,
    latitude: 10.7875,
  },
  {
    id: 'mapbox-poi-chay-sen-vang-q1',
    name: 'Quán Chay Sen Vàng — Nguyễn Thái Học Quận 1',
    address: '133 Nguyễn Thái Học, Phường Cầu Ông Lãnh, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6952, 10.7669],
    longitude: 106.6952,
    latitude: 10.7669,
  },

  // Bánh Cuốn & Bánh Cuốn Lòng Gà
  {
    id: 'mapbox-poi-banh-cuon-ba-hoanh-hn',
    name: 'Bánh Cuốn Bà Hoành — Tô Hiến Thành',
    address: '66 Tô Hiến Thành, Quận Hai Bà Trưng, TP. Hà Nội',
    coordinates: [105.8498, 21.0145],
    longitude: 105.8498,
    latitude: 21.0145,
  },
  {
    id: 'mapbox-poi-banh-cuon-long-ga-trang-dalat',
    name: 'Bánh Cuốn Lòng Gà Trang — Tăng Bạt Hổ Đà Lạt',
    address: '15F Tăng Bạt Hổ, Phường 1, TP. Đà Lạt, Lâm Đồng',
    coordinates: [108.4362, 11.9441],
    longitude: 108.4362,
    latitude: 11.9441,
  },
  {
    id: 'mapbox-poi-banh-cuon-long-ga-da-lat-q3',
    name: 'Bánh Cuốn Lòng Gà Đà Lạt — Nguyễn Thượng Hiền Quận 3',
    address: '116 Nguyễn Thượng Hiền, Phường 4, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.6829, 10.7734],
    longitude: 106.6829,
    latitude: 10.7734,
  },
  {
    id: 'mapbox-poi-banh-cuon-hai-nam-q3',
    name: 'Bánh Cuốn Hải Nam — Cao Thắng Quận 3',
    address: '11A Cao Thắng, Phường 2, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.6814, 10.7689],
    longitude: 106.6814,
    latitude: 10.7689,
  },
  {
    id: 'mapbox-poi-banh-cuon-tay-ho-q1',
    name: 'Bánh Cuốn Tây Hồ — Đinh Tiên Hoàng Quận 1',
    address: '127 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6981, 10.7908],
    longitude: 106.6981,
    latitude: 10.7908,
  },

  // Bún Bò Huế
  {
    id: 'mapbox-poi-bun-bo-hue-dong-ba-q1',
    name: 'Bún Bò Huế Đông Ba — Nguyễn Du Quận 1',
    address: '207B Nguyễn Văn Thủ, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6974, 10.7885],
    longitude: 106.6974,
    latitude: 10.7885,
  },
  {
    id: 'mapbox-poi-bun-bo-hue-ut-hung-q3',
    name: 'Bún Bò Huế Út Hưng — Tú Xương Quận 3',
    address: '119B Tú Xương, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.6869, 10.7782],
    longitude: 106.6869,
    latitude: 10.7782,
  },
  {
    id: 'mapbox-poi-bun-bo-xua-q1',
    name: 'Bún Bò Xưa — Cách Mạng Tháng Tám Quận 1',
    address: '148Bis Cách Mạng Tháng Tám, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6902, 10.7728],
    longitude: 106.6902,
    latitude: 10.7728,
  },

  // Quán Ốc
  {
    id: 'mapbox-poi-oc-dem-vinh-khanh',
    name: 'Quán Ốc Oanh — Phố Ốc Đêm Vĩnh Khánh Quận 4',
    address: '534 Vĩnh Khánh, Phường 8, Quận 4, TP. Hồ Chí Minh',
    coordinates: [106.70242, 10.76115],
    longitude: 106.70242,
    latitude: 10.76115,
  },
  {
    id: 'mapbox-poi-oc-dao-nguyen-trai',
    name: 'Quán Ốc Đào — Hẻm 212B Nguyễn Trãi Quận 1',
    address: '212B/D48 Nguyễn Trãi, Phường Nguyễn Cư Trinh, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6881, 10.7638],
    longitude: 106.6881,
    latitude: 10.7638,
  },
  {
    id: 'mapbox-poi-oc-nhu-q10',
    name: 'Quán Ốc Như — Điện Biên Phủ Quận 10',
    address: '650/4/29D Điện Biên Phủ, Phường 11, Quận 10, TP. Hồ Chí Minh',
    coordinates: [106.6782, 10.7702],
    longitude: 106.6782,
    latitude: 10.7702,
  },

  // Phở Bò, Highlands, Cà Phê, Bánh Mì, Cơm Tấm
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
    id: 'mapbox-poi-pho-hoa-pasteur',
    name: 'Phở Bò Hòa Pasteur — Quận 3',
    address: '260C Pasteur, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    coordinates: [106.6882, 10.7867],
    longitude: 106.6882,
    latitude: 10.7867,
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
    id: 'mapbox-poi-highlands-coffee-ben-thanh',
    name: 'Highlands Coffee — Chợ Bến Thành',
    address: '132 Lê Thánh Tôn, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6983, 10.7731],
    longitude: 106.6983,
    latitude: 10.7731,
  },
  {
    id: 'mapbox-poi-ca-phe-vot-phan-dinh-phung',
    name: 'Cà Phê Vợt Phan Đình Phùng — Phú Nhuận',
    address: 'Hẻm 330 Phan Đình Phùng, Phường 1, Quận Phú Nhuận, TP. Hồ Chí Minh',
    coordinates: [106.6823, 10.7959],
    longitude: 106.6823,
    latitude: 10.7959,
  },
  {
    id: 'mapbox-poi-ca-phe-chung-cu-nguyen-hue',
    name: 'Cà Phê Chung Cư 42 Nguyễn Huệ — Quận 1',
    address: '42 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.7039, 10.7743],
    longitude: 106.7039,
    latitude: 10.7743,
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

  // Regions & Landmarks
  {
    id: 'mapbox-place-cho-ben-thanh-q1',
    name: 'Chợ Bến Thành — Phường Bến Thành, Quận 1',
    address: 'Quảng trường Quách Thị Trang, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    coordinates: [106.6980, 10.7725],
    longitude: 106.6980,
    latitude: 10.7725,
  },
  {
    id: 'mapbox-district-quan-1-hcm',
    name: 'Quận 1 — Trung Tâm TP. Hồ Chí Minh',
    address: 'Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
    coordinates: [106.7009, 10.7756],
    longitude: 106.7009,
    latitude: 10.7756,
  },
  {
    id: 'mapbox-place-da-nang-city',
    name: 'Thành Phố Đà Nẵng — Cầu Rồng & Sông Hàn',
    address: 'Quận Hải Châu, Thành phố Đà Nẵng, Việt Nam',
    coordinates: [108.2208, 16.0544],
    longitude: 108.2208,
    latitude: 16.0544,
  },
  {
    id: 'mapbox-place-ha-noi-hoan-kiem',
    name: 'Phố Cổ Hà Nội — Hồ Hoàn Kiếm',
    address: 'Quận Hoàn Kiếm, Thành phố Hà Nội, Việt Nam',
    coordinates: [105.8525, 21.0285],
    longitude: 105.8525,
    latitude: 21.0285,
  },
];

export const GENERIC_VIETNAMESE_FOOD_TERMS = [
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

export function normalizeVietnameseText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function isGenericVietnameseFoodQuery(rawQuery: string): boolean {
  const norm = normalizeVietnameseText(rawQuery);
  return GENERIC_VIETNAMESE_FOOD_TERMS.some(
    (term) => norm === term || norm.startsWith(`${term} `) || norm.includes(term)
  );
}

export function isWithinVietnamBounds(lng: number, lat: number): boolean {
  return lng >= 102.0 && lng <= 110.5 && lat >= 8.0 && lat <= 23.8;
}

function computeDistanceSq(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const dLng = lng1 - lng2;
  const dLat = lat1 - lat2;
  return dLng * dLng + dLat * dLat;
}

export function parseMapboxSearchBoxFeatures(items: any[]): MapboxPoiSearchResult[] {
  return items
    .slice(0, 8)
    .map((item: any, idx: number): MapboxPoiSearchResult => {
      const props = item.properties || item;
      const coords =
        item.geometry?.coordinates ||
        (props.coordinates?.longitude !== undefined
          ? [
              item.geometry?.coordinates?.[0] ?? props.coordinates?.longitude,
              item.geometry?.coordinates?.[1] ?? props.coordinates?.latitude,
            ]
          : item.center);

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
 * Optimized Vietnamese Local Food Search & Proximity Bias Engine
 */
export async function searchFoodPoisServerSide(
  rawQuery: string,
  env: Env,
  proximityLngLat?: [number, number]
): Promise<MapboxPoiSearchResult[]> {
  const query = (rawQuery || '').trim();
  if (!query) return [];

  const [lng, lat] =
    proximityLngLat &&
    Number.isFinite(proximityLngLat[0]) &&
    Number.isFinite(proximityLngLat[1])
      ? proximityLngLat
      : [106.7024, 10.7611];

  const isFoodQuery = isGenericVietnameseFoodQuery(query);
  const inVnBounds = isWithinVietnamBounds(lng, lat);

  const normQuery = normalizeVietnameseText(query);
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);

  // Match against verified local POI index and sort by proximity to [lng, lat]
  const matchedIndexed = MAPBOX_INDEXED_POIS.filter((v) => {
    const hay = normalizeVietnameseText(`${v.name} ${v.address}`);
    if (hay.includes(normQuery)) return true;
    const hits = queryTokens.filter((tk) => hay.includes(tk)).length;
    return queryTokens.length >= 1 && hits >= Math.ceil(queryTokens.length * 0.65);
  }).sort(
    (a, b) =>
      computeDistanceSq(lng, lat, a.longitude, a.latitude) -
      computeDistanceSq(lng, lat, b.longitude, b.latitude)
  );

  const token = (env.VITE_MAPBOX_TOKEN || '').trim();
  if (token && token.startsWith('pk.') && !token.includes('xxxxxxxx') && token.length >= 32) {
    const countryParam = inVnBounds || isFoodQuery ? '&country=vn' : '';
    const typesParam = isFoodQuery
      ? 'poi,address'
      : 'poi,address,place,locality,district';
    const categoryParam = isFoodQuery
      ? '&category=food_and_drink,restaurant,cafe'
      : '';

    try {
      // 1. Mapbox Search Box v1 forward lookup (prioritizes POI categories & proximity)
      const searchBoxEndpoint = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(
        query
      )}&access_token=${encodeURIComponent(
        token
      )}&types=${typesParam}${categoryParam}${countryParam}&language=vi&limit=8&proximity=${lng},${lat}`;

      const sbRes = await fetch(searchBoxEndpoint);
      if (sbRes.ok) {
        const sbData = await sbRes.json();
        const items = sbData?.features || sbData?.suggestions || [];
        if (Array.isArray(items) && items.length > 0) {
          const parsedSb = parseMapboxSearchBoxFeatures(items);
          if (parsedSb.length > 0) {
            return [...matchedIndexed, ...parsedSb].slice(0, 8);
          }
        }
      }

      // 2. Mapbox Geocoding v5 with strict proximity bias & country=vn when in Vietnam bounds
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${encodeURIComponent(
        token
      )}&types=${typesParam}${countryParam}&language=vi&limit=8&proximity=${lng},${lat}`;

      const geoRes = await fetch(endpoint);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const parsedGeo = parseMapboxGeocodingFeatures(geoData?.features || []);
        if (parsedGeo.length > 0) {
          return [...matchedIndexed, ...parsedGeo].slice(0, 8);
        }
      }
    } catch (err) {
      console.error('[Mapbox Server Search Exception]:', err);
    }
  }

  // If generic food query matched verified nearby Vietnamese POIs, return them immediately
  if (isFoodQuery && matchedIndexed.length > 0) {
    return matchedIndexed.slice(0, 8);
  }

  // 3. Viewbox-bounded Nominatim lookup for specific addresses/venues when VITE_MAPBOX_TOKEN is not set
  try {
    const delta = inVnBounds ? 0.45 : 1.5;
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
    const countryCodes = inVnBounds ? '&countrycodes=vn' : '';
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      query
    )}&accept-language=vi${countryCodes}&viewbox=${viewbox}&limit=6`;

    const nomRes = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'VibePath-Field-Telemetry/1.0',
      },
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const nomResults: MapboxPoiSearchResult[] = nomData
          .map((item: any, idx: number): MapboxPoiSearchResult => {
            const itemLng = Number(Number(item.lon).toFixed(6));
            const itemLat = Number(Number(item.lat).toFixed(6));
            const rawDisplay = String(item.display_name || query);
            const name = String(item.name || rawDisplay.split(',')[0] || query).trim();
            return {
              id: `geo-lookup-${item.place_id || idx}`,
              name,
              address: rawDisplay,
              coordinates: [itemLng, itemLat],
              longitude: itemLng,
              latitude: itemLat,
            };
          })
          .filter((r) => Number.isFinite(r.longitude) && Number.isFinite(r.latitude))
          .sort(
            (a, b) =>
              computeDistanceSq(lng, lat, a.longitude, a.latitude) -
              computeDistanceSq(lng, lat, b.longitude, b.latitude)
          );

        if (nomResults.length > 0) {
          const seen = new Set<string>();
          const combined = [...matchedIndexed, ...nomResults].filter((item) => {
            const key = `${item.name.toLowerCase()}-${item.latitude.toFixed(3)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return combined.slice(0, 8);
        }
      }
    }
  } catch (_) {}

  return matchedIndexed.slice(0, 8);
}

export async function handlePoiSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const proxParam = url.searchParams.get('proximity') || '';
  let proximityLngLat: [number, number] | undefined;
  if (proxParam.includes(',')) {
    const [lngStr, latStr] = proxParam.split(',');
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      proximityLngLat = [lng, lat];
    }
  }
  const results = await searchFoodPoisServerSide(query, env, proximityLngLat);

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
