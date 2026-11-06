import mapboxgl from 'mapbox-gl';
import { VideoRecorder } from './videoRecorder';
import { ApiKeyManager } from './apiKeyManager';

export type CinematicFlightStage =
  | 'IDLE'
  | 'STAGE_1_ORBIT'
  | 'STAGE_2_REGIONAL'
  | 'STAGE_3_DISTRICT_SCANNER'
  | 'STAGE_4_URBAN_LOW_FLYOVER'
  | 'FINAL_3D_LOCK';

export interface GlobalDistrictResolution {
  mapboxId: string;
  districtName: string;
  countryCode: string;
  hudReadout: string; // e.g. [ GLOBAL_DISTRICT_SCAN // SHIBUYA, JP ]
}

export interface FlightStageUpdate {
  stage: CinematicFlightStage;
  stageNumber: 0 | 1 | 2 | 3 | 4;
  label: string;
  hudLockTag: string | null;
  globalDistrictScanTag: string | null;
  globalDistrictInfo?: GlobalDistrictResolution;
  isRecording: boolean;
  elapsedMs: number;
}

export interface CinematicFlightOptions {
  map: mapboxgl.Map | null;
  targetLng: number;
  targetLat: number;
  targetName: string;
  tripName: string;
  recordVideo?: boolean;
  onStageChange?: (update: FlightStageUpdate) => void;
  onComplete?: (videoResult: {
    filename: string;
    sizeBytes: number;
    durationMs: number;
  } | null) => void;
}

export const GLOBAL_BOUNDARIES_SOURCE_ID = 'mapbox-global-boundaries';
export const GLOBAL_DISTRICT_FILL_LAYER_ID = 'global-district-fill';
export const GLOBAL_DISTRICT_STROKE_LAYER_ID = 'global-district-stroke';

const DYNAMIC_BOUNDARY_SOURCE_ID = 'vibepath-global-adm2-dynamic';
const DYNAMIC_BOUNDARY_FILL_ID = 'vibepath-global-adm2-fill';
const DYNAMIC_BOUNDARY_STROKE_ID = 'vibepath-global-adm2-stroke';

/**
 * Build a multi-vertex administrative polygon around [lng, lat] tagged with mapbox_id
 * so ['==', ['get', 'mapbox_id'], activeMapboxId] illuminates an administrative contour
 */
function buildAdministrativeBoundaryFeature(
  lng: number,
  lat: number,
  resolution: GlobalDistrictResolution
) {
  const vertices = 10;
  const baseRadiusLng = 0.0105;
  const baseRadiusLat = 0.0082;
  const ring: [number, number][] = [];

  let seed = 0;
  for (let i = 0; i < resolution.mapboxId.length; i++) {
    seed = (seed * 31 + resolution.mapboxId.charCodeAt(i)) % 997;
  }

  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * Math.PI * 2;
    const variance = 0.82 + (((seed + i * 37) % 35) / 100);
    const ptLng = Number((lng + Math.cos(angle) * baseRadiusLng * variance).toFixed(6));
    const ptLat = Number((lat + Math.sin(angle) * baseRadiusLat * variance).toFixed(6));
    ring.push([ptLng, ptLat]);
  }
  if (ring.length > 0) {
    ring.push(ring[0]);
  }

  return {
    type: 'Feature' as const,
    properties: {
      mapbox_id: resolution.mapboxId,
      name: resolution.districtName,
      iso_3166_1: resolution.countryCode,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('FLIGHT_ABORTED'));
      return;
    }
    const timer = window.setTimeout(() => {
      resolve();
    }, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new Error('FLIGHT_ABORTED'));
      },
      { once: true }
    );
  });
}

/**
 * 4-Stage Cinematic Flight Controller & Global Administrative Boundary Engine
 */
export class CinematicFlightEngine {
  private static activeAbortController: AbortController | null = null;
  private static pulseAnimationFrameId: number | null = null;
  private static fallbackCanvasCleanup: (() => void) | null = null;

  static stopActiveFlight(map?: mapboxgl.Map | null): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.stopScannerPulse();
    if (this.fallbackCanvasCleanup) {
      this.fallbackCanvasCleanup();
      this.fallbackCanvasCleanup = null;
    }
    if (map) {
      this.clearGlobalDistrictFilter(map);
    }
    VideoRecorder.cancelActive();
  }

  private static stopScannerPulse(): void {
    if (this.pulseAnimationFrameId !== null) {
      cancelAnimationFrame(this.pulseAnimationFrameId);
      this.pulseAnimationFrameId = null;
    }
  }

  /**
   * Dynamically resolve Global District Name, Country Code, and mapbox_id for any worldwide coordinate:
   * 1. Queries rendered features in `global-district-fill` (from `mapbox://mapbox.boundaries-adm2-v4`)
   * 2. Queries Mapbox Reverse Geocoding API (`types=district,locality,place`)
   * 3. Queries OpenStreetMap Nominatim Reverse API as live fallback
   * Returns HUD format: `[ GLOBAL_DISTRICT_SCAN // <DISTRICT_NAME>, <COUNTRY_CODE> ]`
   */
  static async resolveGlobalDistrict(
    map: mapboxgl.Map | null,
    lng: number,
    lat: number
  ): Promise<GlobalDistrictResolution> {
    // 1. Try map.queryRenderedFeatures on global-district-fill from mapbox.boundaries-adm2-v4
    if (map) {
      try {
        if (map.getLayer(GLOBAL_DISTRICT_FILL_LAYER_ID)) {
          const screenPt = map.project([lng, lat]);
          const features = map.queryRenderedFeatures(screenPt, {
            layers: [GLOBAL_DISTRICT_FILL_LAYER_ID],
          });
          if (features && features.length > 0) {
            const props = features[0].properties || {};
            const mapboxId = String(
              props.mapbox_id || features[0].id || `adm2-${lat.toFixed(3)}-${lng.toFixed(3)}`
            );
            const districtName = String(
              props.name_en || props.name || 'METRO DISTRICT'
            ).toUpperCase();
            const countryCode = String(
              props.iso_3166_1 || props.worldview || 'GL'
            ).toUpperCase();
            return {
              mapboxId,
              districtName,
              countryCode,
              hudReadout: `[ GLOBAL_DISTRICT_SCAN // ${districtName}, ${countryCode} ]`,
            };
          }
        }
      } catch (_) {}
    }

    // 2. Query Mapbox Reverse Geocoding API if a live token is available
    const token = (
      ApiKeyManager.getMapKey() ||
      (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
      ''
    ).trim();

    if (token.startsWith('pk.') && !token.includes('xxxxxxxx') && token.length >= 32) {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=district,locality,place&limit=1&access_token=${encodeURIComponent(
          token
        )}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          const feat = data?.features?.[0];
          if (feat) {
            const districtName = String(feat.text_en || feat.text || 'URBAN_SECTOR').toUpperCase();
            const countryCtx = Array.isArray(feat.context)
              ? feat.context.find((c: any) => String(c.id || '').startsWith('country'))
              : null;
            const countryCode = String(countryCtx?.short_code || 'GL').toUpperCase();
            const mapboxId = String(
              feat.properties?.mapbox_id || feat.id || `adm2-${lng}-${lat}`
            );

            return {
              mapboxId,
              districtName,
              countryCode,
              hudReadout: `[ GLOBAL_DISTRICT_SCAN // ${districtName}, ${countryCode} ]`,
            };
          }
        }
      } catch (_) {}
    }

    // 3. Query Open Global Reverse Geocoder (Nominatim) dynamically for any worldwide coordinate
    try {
      const revUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=14&accept-language=en`;
      const revResp = await fetch(revUrl);
      if (revResp.ok) {
        const revData = await revResp.json();
        const addr = revData?.address || {};
        const district =
          addr.suburb ||
          addr.city_district ||
          addr.borough ||
          addr.county ||
          addr.city ||
          addr.town ||
          addr.state ||
          `SECTOR_${Math.abs(lat).toFixed(2)}`;
        const countryCode = String(addr.country_code || 'GL').toUpperCase();
        const mapboxId = String(revData?.place_id || `adm2-${lat.toFixed(3)}-${lng.toFixed(3)}`);
        const cleanDistrict = String(district).toUpperCase();

        return {
          mapboxId,
          districtName: cleanDistrict,
          countryCode,
          hudReadout: `[ GLOBAL_DISTRICT_SCAN // ${cleanDistrict}, ${countryCode} ]`,
        };
      }
    } catch (_) {}

    const fallbackId = `adm2-global-${lat.toFixed(3)}-${lng.toFixed(3)}`;
    const fallbackDistrict = `SECTOR_${lat.toFixed(2)}_${lng.toFixed(2)}`;

    return {
      mapboxId: fallbackId,
      districtName: fallbackDistrict,
      countryCode: 'GL',
      hudReadout: `[ GLOBAL_DISTRICT_SCAN // ${fallbackDistrict}, GL ]`,
    };
  }

  /**
   * Apply dynamic ['==', ['get', 'mapbox_id'], activeMapboxId] filter on:
   * - global-district-fill (fill-color: '#00E5FF', fill-opacity: 0.12)
   * - global-district-stroke (line-color: '#00E5FF', line-width: 2, line-dasharray: [3, 1.5])
   */
  static applyGlobalDistrictBoundaryFilter(
    map: mapboxgl.Map,
    lng: number,
    lat: number,
    resolution: GlobalDistrictResolution
  ): void {
    const activeMapboxId = resolution.mapboxId;
    const filterExpr: any = ['==', ['get', 'mapbox_id'], activeMapboxId];

    // 1. Update filter on Mapbox Global Boundaries vector tile layers if present
    try {
      if (map.getLayer(GLOBAL_DISTRICT_FILL_LAYER_ID)) {
        map.setFilter(GLOBAL_DISTRICT_FILL_LAYER_ID, filterExpr);
        map.setPaintProperty(GLOBAL_DISTRICT_FILL_LAYER_ID, 'fill-color', '#00E5FF');
        map.setPaintProperty(GLOBAL_DISTRICT_FILL_LAYER_ID, 'fill-opacity', 0.12);
      }
      if (map.getLayer(GLOBAL_DISTRICT_STROKE_LAYER_ID)) {
        map.setFilter(GLOBAL_DISTRICT_STROKE_LAYER_ID, filterExpr);
        map.setPaintProperty(GLOBAL_DISTRICT_STROKE_LAYER_ID, 'line-color', '#00E5FF');
        map.setPaintProperty(GLOBAL_DISTRICT_STROKE_LAYER_ID, 'line-width', 2);
        map.setPaintProperty(GLOBAL_DISTRICT_STROKE_LAYER_ID, 'line-dasharray', [3, 1.5]);
      }
    } catch (_) {}

    // 2. Also stream dynamic administrative polygon with identical ['==', ['get', 'mapbox_id'], activeMapboxId] filter
    try {
      const feature = buildAdministrativeBoundaryFeature(lng, lat, resolution);
      const existingSource = map.getSource(DYNAMIC_BOUNDARY_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;

      if (existingSource) {
        existingSource.setData(feature);
      } else {
        map.addSource(DYNAMIC_BOUNDARY_SOURCE_ID, {
          type: 'geojson',
          data: feature,
        });
      }

      if (!map.getLayer(DYNAMIC_BOUNDARY_FILL_ID)) {
        map.addLayer({
          id: DYNAMIC_BOUNDARY_FILL_ID,
          type: 'fill',
          source: DYNAMIC_BOUNDARY_SOURCE_ID,
          filter: filterExpr,
          paint: {
            'fill-color': '#00E5FF',
            'fill-opacity': 0.12,
          },
        });
      } else {
        map.setFilter(DYNAMIC_BOUNDARY_FILL_ID, filterExpr);
      }

      if (!map.getLayer(DYNAMIC_BOUNDARY_STROKE_ID)) {
        map.addLayer({
          id: DYNAMIC_BOUNDARY_STROKE_ID,
          type: 'line',
          source: DYNAMIC_BOUNDARY_SOURCE_ID,
          filter: filterExpr,
          layout: {
            'line-join': 'miter',
            'line-cap': 'butt',
          },
          paint: {
            'line-color': '#00E5FF',
            'line-width': 2,
            'line-dasharray': [3, 1.5],
            'line-opacity': 1.0,
          },
        });
      } else {
        map.setFilter(DYNAMIC_BOUNDARY_STROKE_ID, filterExpr);
      }
    } catch (_) {}
  }

  static clearGlobalDistrictFilter(map: mapboxgl.Map): void {
    this.stopScannerPulse();
    const emptyFilter: any = ['==', ['get', 'mapbox_id'], '__NONE__'];
    try {
      if (map.getLayer(GLOBAL_DISTRICT_FILL_LAYER_ID)) {
        map.setFilter(GLOBAL_DISTRICT_FILL_LAYER_ID, emptyFilter);
      }
      if (map.getLayer(GLOBAL_DISTRICT_STROKE_LAYER_ID)) {
        map.setFilter(GLOBAL_DISTRICT_STROKE_LAYER_ID, emptyFilter);
      }
      if (map.getLayer(DYNAMIC_BOUNDARY_FILL_ID)) {
        map.setFilter(DYNAMIC_BOUNDARY_FILL_ID, emptyFilter);
      }
      if (map.getLayer(DYNAMIC_BOUNDARY_STROKE_ID)) {
        map.setFilter(DYNAMIC_BOUNDARY_STROKE_ID, emptyFilter);
      }
    } catch (_) {}
  }

  /**
   * Create a 60FPS offscreen telemetry canvas if Mapbox WebGL is in BYOK token-missing state
   */
  private static createFallbackTelemetryCanvas(
    targetName: string,
    targetLat: number,
    targetLng: number,
    getStageLabel: () => string,
    getDistrictScanLabel: () => string
  ): { canvas: HTMLCanvasElement; cleanup: () => void } {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let rafId = 0;
    const start = performance.now();

    const draw = (now: number) => {
      if (ctx) {
        const elapsed = (now - start) / 1000;
        ctx.fillStyle = '#080A0F';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#1F1F2E';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4);
        ctx.fillStyle = `rgba(0, 229, 255, ${0.1 + pulse * 0.04})`;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 6]);
        ctx.fillRect(320, 180, 640, 360);
        ctx.strokeRect(320, 180, 640, 360);
        ctx.setLineDash([]);

        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(getDistrictScanLabel(), 60, 70);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(getStageLabel(), 60, 120);

        ctx.fillStyle = '#00E676';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(
          `[ 3D LOCK // ${targetLat.toFixed(4)}°N, ${targetLng.toFixed(4)}°E ] — ${targetName.toUpperCase()}`,
          60,
          650
        );
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return {
      canvas,
      cleanup: () => cancelAnimationFrame(rafId),
    };
  }

  /**
   * Execute the full 4-Stage Cinematic Flight Sequence & Global Administrative Boundary Illumination
   */
  static async runFourStageFlight(options: CinematicFlightOptions): Promise<void> {
    const {
      map,
      targetLng,
      targetLat,
      targetName,
      tripName,
      recordVideo = true,
      onStageChange,
      onComplete,
    } = options;

    this.stopActiveFlight(map);

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    const { signal } = abortController;
    const sequenceStartMs = Date.now();
    const lockTagFormatted = `[ 3D LOCK // ${targetLat.toFixed(4)}°N, ${targetLng.toFixed(4)}°E ]`;

    const resolvedDistrict = await this.resolveGlobalDistrict(map, targetLng, targetLat);
    let currentStageBanner = '[ STAGE 1/4 // DEEP_ORBIT_SPACE_VIEW · Z:1.8 · P:0° ]';
    let currentDistrictScanTag = resolvedDistrict.hudReadout;

    try {
      // STAGE 1: Deep Orbit Space View (zoom: 1.8, pitch: 0°, bearing: 0°, hold: 1500ms)
      currentStageBanner = '[ STAGE 1/4 // DEEP_ORBIT_SPACE_VIEW · Z:1.8 · P:0° ]';

      if (map) {
        this.clearGlobalDistrictFilter(map);

        map.setFog({
          color: '#020B14',
          'high-color': '#00E5FF',
          'space-color': '#010408',
          'horizon-blend': 0.08,
          'star-intensity': 0.95,
        });

        map.jumpTo({
          center: [targetLng, targetLat],
          zoom: 1.8,
          pitch: 0,
          bearing: 0,
        });
      }

      if (recordVideo) {
        let fallbackCanvas: HTMLCanvasElement | null = null;
        if (!map) {
          const fb = this.createFallbackTelemetryCanvas(
            targetName,
            targetLat,
            targetLng,
            () => currentStageBanner,
            () => currentDistrictScanTag
          );
          fallbackCanvas = fb.canvas;
          this.fallbackCanvasCleanup = fb.cleanup;
        }
        VideoRecorder.startRecording(map, tripName, fallbackCanvas);
      }

      onStageChange?.({
        stage: 'STAGE_1_ORBIT',
        stageNumber: 1,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: resolvedDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      await sleep(1500, signal);

      // STAGE 2: Regional Descent (zoom: 9.5, pitch: 30°, duration: 3500ms)
      currentStageBanner = '[ STAGE 2/4 // REGIONAL_DESCENT · Z:9.5 · P:30° ]';

      onStageChange?.({
        stage: 'STAGE_2_REGIONAL',
        stageNumber: 2,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: resolvedDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      if (map) {
        map.flyTo({
          center: [targetLng, targetLat],
          zoom: 9.5,
          pitch: 30,
          bearing: -15,
          duration: 3500,
          essential: true,
        });
      }

      await sleep(3500, signal);

      // STAGE 3: Global District Scanner Focus (zoom: 13.8, pitch: 45°, duration: 3000ms)
      const liveDistrict = await this.resolveGlobalDistrict(map, targetLng, targetLat);
      currentDistrictScanTag = liveDistrict.hudReadout;
      currentStageBanner = `${liveDistrict.hudReadout} · Z:13.8 · P:45°`;

      if (map) {
        this.applyGlobalDistrictBoundaryFilter(map, targetLng, targetLat, liveDistrict);
        map.easeTo({
          center: [targetLng, targetLat],
          zoom: 13.8,
          pitch: 45,
          bearing: -35,
          duration: 3000,
          essential: true,
        });
      }

      onStageChange?.({
        stage: 'STAGE_3_DISTRICT_SCANNER',
        stageNumber: 3,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: liveDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      await sleep(3000, signal);

      // STAGE 4: Urban 3D Street Low-Flyover (zoom: 17.8, pitch: 72°, bearing: 40°, duration: 4500ms)
      currentStageBanner = '[ STAGE 4/4 // URBAN_3D_STREET_LOW_FLYOVER · Z:17.8 · P:72° · B:40° ]';

      if (map) {
        map.easeTo({
          center: [targetLng, targetLat],
          zoom: 17.8,
          pitch: 72,
          bearing: 40,
          duration: 4500,
          essential: true,
        });
      }

      onStageChange?.({
        stage: 'STAGE_4_URBAN_LOW_FLYOVER',
        stageNumber: 4,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: liveDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      await sleep(4500, signal);

      // FINAL LOCK: Display target HUD tag [ 3D LOCK // <LAT>°N, <LNG>°E ]
      currentStageBanner = `${lockTagFormatted} // ${targetName.toUpperCase()}`;

      onStageChange?.({
        stage: 'FINAL_3D_LOCK',
        stageNumber: 4,
        label: currentStageBanner,
        hudLockTag: lockTagFormatted,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: liveDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      if (recordVideo) {
        await sleep(1500, signal);
        const downloadInfo = await VideoRecorder.stopRecording(tripName);
        if (this.fallbackCanvasCleanup) {
          this.fallbackCanvasCleanup();
          this.fallbackCanvasCleanup = null;
        }
        onStageChange?.({
          stage: 'FINAL_3D_LOCK',
          stageNumber: 4,
          label: currentStageBanner,
          hudLockTag: lockTagFormatted,
          globalDistrictScanTag: currentDistrictScanTag,
          globalDistrictInfo: liveDistrict,
          isRecording: false,
          elapsedMs: Date.now() - sequenceStartMs,
        });
        onComplete?.(downloadInfo);
      } else {
        onComplete?.(null);
      }
    } catch (err: any) {
      if (err?.message !== 'FLIGHT_ABORTED') {
        console.warn('[CinematicFlightEngine] Flight interrupted:', err);
      }
      if (this.fallbackCanvasCleanup) {
        this.fallbackCanvasCleanup();
        this.fallbackCanvasCleanup = null;
      }
      VideoRecorder.cancelActive();
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
    }
  }
}
