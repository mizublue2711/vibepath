import mapboxgl from 'mapbox-gl';
import { VideoRecorder } from './videoRecorder';
import { ApiKeyManager } from './apiKeyManager';
import { getStoredThemeConfig } from '../context/ThemeContext';

export type CinematicFlightStage =
  | 'IDLE'
  | 'ORBIT'
  | 'REGIONAL'
  | 'DISTRICT_FOCUS'
  | 'STREET_FLYOVER'
  | 'LOCKED';

export interface GlobalDistrictResolution {
  mapboxId: string;
  districtName: string;
  countryCode: string;
  hudReadout: string; // Clean readable district format: e.g. "District 1, Ben Thanh"
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
    VideoRecorder.cancelActive();
    if (map) {
      try {
        map.stop();
      } catch (_) {}
    }
  }

  private static stopScannerPulse(): void {
    if (this.pulseAnimationFrameId !== null) {
      cancelAnimationFrame(this.pulseAnimationFrameId);
      this.pulseAnimationFrameId = null;
    }
  }

  /**
   * Resolve clean District label (e.g. "District 1, Ben Thanh") for the top status bar
   */
  static async resolveGlobalDistrict(
    map: mapboxgl.Map | null,
    lng: number,
    lat: number
  ): Promise<GlobalDistrictResolution> {
    // Default Saigon District 1 check for central HCMC coordinates
    if (lat >= 10.74 && lat <= 10.82 && lng >= 106.66 && lng <= 106.73) {
      return {
        mapboxId: 'dXJuOm1ieGJuZDo2ODg0Njp2NA',
        districtName: 'District 1, Ben Thanh',
        countryCode: 'VN',
        hudReadout: 'District 1, Ben Thanh',
      };
    }

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
            const districtName = String(props.name_en || props.name || 'District 1, Ben Thanh');
            const countryCode = String(props.iso_3166_1 || 'VN').toUpperCase();
            return {
              mapboxId,
              districtName,
              countryCode,
              hudReadout: `${districtName}, ${countryCode}`,
            };
          }
        }
      } catch (_) {}
    }

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
            const districtName = String(feat.text_en || feat.text || 'District 1, Ben Thanh');
            const countryCtx = Array.isArray(feat.context)
              ? feat.context.find((c: any) => String(c.id || '').startsWith('country'))
              : null;
            const countryCode = String(countryCtx?.short_code || 'VN').toUpperCase();
            const mapboxId = String(
              feat.properties?.mapbox_id || feat.id || `adm2-${lng}-${lat}`
            );

            return {
              mapboxId,
              districtName,
              countryCode,
              hudReadout: `${districtName}, ${countryCode}`,
            };
          }
        }
      } catch (_) {}
    }

    return {
      mapboxId: `adm2-global-${lat.toFixed(3)}-${lng.toFixed(3)}`,
      districtName: 'District 1, Ben Thanh',
      countryCode: 'VN',
      hudReadout: 'District 1, Ben Thanh',
    };
  }

  static applyGlobalDistrictBoundaryFilter(
    map: mapboxgl.Map,
    lng: number,
    lat: number,
    resolution: GlobalDistrictResolution
  ): void {
    const activeMapboxId = resolution.mapboxId;
    const filterExpr: any = ['==', ['get', 'mapbox_id'], activeMapboxId];
    const accentColor = getStoredThemeConfig().accentColor || '#00E5FF';

    try {
      if (map.getLayer(GLOBAL_DISTRICT_FILL_LAYER_ID)) {
        map.setFilter(GLOBAL_DISTRICT_FILL_LAYER_ID, filterExpr);
        map.setPaintProperty(GLOBAL_DISTRICT_FILL_LAYER_ID, 'fill-color', accentColor);
        map.setPaintProperty(GLOBAL_DISTRICT_FILL_LAYER_ID, 'fill-opacity', 0.12);
      }
      if (map.getLayer(GLOBAL_DISTRICT_STROKE_LAYER_ID)) {
        map.setFilter(GLOBAL_DISTRICT_STROKE_LAYER_ID, filterExpr);
        map.setPaintProperty(GLOBAL_DISTRICT_STROKE_LAYER_ID, 'line-color', accentColor);
        map.setPaintProperty(GLOBAL_DISTRICT_STROKE_LAYER_ID, 'line-width', 2);
        map.setPaintProperty(GLOBAL_DISTRICT_STROKE_LAYER_ID, 'line-dasharray', [3, 1.5]);
      }
    } catch (_) {}

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
            'fill-color': accentColor,
            'fill-opacity': 0.12,
          },
        });
      } else {
        map.setFilter(DYNAMIC_BOUNDARY_FILL_ID, filterExpr);
        map.setPaintProperty(DYNAMIC_BOUNDARY_FILL_ID, 'fill-color', accentColor);
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
            'line-color': accentColor,
            'line-width': 2,
            'line-dasharray': [3, 1.5],
            'line-opacity': 1.0,
          },
        });
      } else {
        map.setFilter(DYNAMIC_BOUNDARY_STROKE_ID, filterExpr);
        map.setPaintProperty(DYNAMIC_BOUNDARY_STROKE_ID, 'line-color', accentColor);
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

  private static createFallbackTelemetryCanvas(
    targetName: string,
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
        const accentColor = getStoredThemeConfig().accentColor || '#00E5FF';
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
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 6]);
        ctx.fillRect(320, 180, 640, 360);
        ctx.strokeRect(320, 180, 640, 360);
        ctx.setLineDash([]);

        ctx.fillStyle = accentColor;
        ctx.font = 'bold 22px monospace';
        ctx.fillText(getDistrictScanLabel(), 60, 70);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(getStageLabel(), 60, 120);

        ctx.fillStyle = '#00E676';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(targetName.toUpperCase(), 60, 650);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return {
      canvas,
      cleanup: () => cancelAnimationFrame(rafId),
    };
  }

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
    const accentColor = getStoredThemeConfig().accentColor || '#00E5FF';

    const resolvedDistrict = await this.resolveGlobalDistrict(map, targetLng, targetLat);
    let currentStageBanner = 'Deep Orbit View';
    let currentDistrictScanTag = resolvedDistrict.hudReadout;

    try {
      if (map) {
        this.clearGlobalDistrictFilter(map);

        map.setFog({
          color: '#020B14',
          'high-color': accentColor,
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
            () => currentStageBanner,
            () => currentDistrictScanTag
          );
          fallbackCanvas = fb.canvas;
          this.fallbackCanvasCleanup = fb.cleanup;
        }
        VideoRecorder.startRecording(map, tripName, fallbackCanvas);
      }

      onStageChange?.({
        stage: 'ORBIT',
        stageNumber: 1,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: resolvedDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      await sleep(1500, signal);

      currentStageBanner = 'Regional Descent';
      onStageChange?.({
        stage: 'REGIONAL',
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

      const liveDistrict = await this.resolveGlobalDistrict(map, targetLng, targetLat);
      currentDistrictScanTag = liveDistrict.hudReadout;
      currentStageBanner = liveDistrict.hudReadout;

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
        stage: 'DISTRICT_FOCUS',
        stageNumber: 3,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: liveDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      await sleep(3000, signal);

      currentStageBanner = targetName;
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
        stage: 'STREET_FLYOVER',
        stageNumber: 4,
        label: currentStageBanner,
        hudLockTag: null,
        globalDistrictScanTag: currentDistrictScanTag,
        globalDistrictInfo: liveDistrict,
        isRecording: recordVideo,
        elapsedMs: Date.now() - sequenceStartMs,
      });

      await sleep(4500, signal);

      onStageChange?.({
        stage: 'LOCKED',
        stageNumber: 4,
        label: targetName,
        hudLockTag: null,
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
          stage: 'LOCKED',
          stageNumber: 0,
          label: targetName,
          hudLockTag: null,
          globalDistrictScanTag: currentDistrictScanTag,
          globalDistrictInfo: liveDistrict,
          isRecording: false,
          elapsedMs: Date.now() - sequenceStartMs,
        });
        onComplete?.(downloadInfo);
      } else {
        onStageChange?.({
          stage: 'IDLE',
          stageNumber: 0,
          label: '',
          hudLockTag: null,
          globalDistrictScanTag: currentDistrictScanTag,
          globalDistrictInfo: liveDistrict,
          isRecording: false,
          elapsedMs: Date.now() - sequenceStartMs,
        });
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
