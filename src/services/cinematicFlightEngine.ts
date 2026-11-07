import mapboxgl from 'mapbox-gl';
import { VideoRecorder } from './videoRecorder';
import { getStoredThemeConfig } from '../context/ThemeContext';
import {
  GlobalBoundaryService,
  GlobalDistrictResolution,
  GLOBAL_BOUNDARIES_SOURCE_ID,
  GLOBAL_DISTRICT_FILL_LAYER_ID,
  GLOBAL_DISTRICT_STROKE_LAYER_ID,
} from './globalBoundaryService';

export {
  GLOBAL_BOUNDARIES_SOURCE_ID,
  GLOBAL_DISTRICT_FILL_LAYER_ID,
  GLOBAL_DISTRICT_STROKE_LAYER_ID,
};
export type { GlobalDistrictResolution };

export type CinematicFlightStage =
  | 'IDLE'
  | 'ORBIT'
  | 'REGIONAL'
  | 'DISTRICT_FOCUS'
  | 'STREET_FLYOVER'
  | 'LOCKED';

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

/**
 * Silky smooth cubic easing curve to eliminate micro-stutters and motion blur.
 */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
   * Resolve clean District label and real administrative boundary polygon via GlobalBoundaryService
   */
  static async resolveGlobalDistrict(
    map: mapboxgl.Map | null,
    lng: number,
    lat: number
  ): Promise<GlobalDistrictResolution> {
    return GlobalBoundaryService.resolveGlobalDistrict(map, lng, lat);
  }

  static applyGlobalDistrictBoundaryFilter(
    map: mapboxgl.Map,
    lng: number,
    lat: number,
    resolution: GlobalDistrictResolution
  ): void {
    GlobalBoundaryService.applyStage3BoundaryHighlight(map, lng, lat, resolution);
  }

  static clearGlobalDistrictFilter(map: mapboxgl.Map): void {
    this.stopScannerPulse();
    GlobalBoundaryService.clearBoundaryHighlight(map);
  }

  /**
   * Ground-Level Camera Transition for Live Pinning / POI Selection.
   * Keeps the camera pinned at ground/street level (zoom: ~16, pitch: ~45°)
   * smoothly gliding the camera along the ground using low-altitude easeTo / flyTo
   * without triggering the high-altitude space orbit sequence.
   */
  static glideToGroundLocation(
    map: mapboxgl.Map | null,
    lng: number,
    lat: number,
    durationMs = 1200
  ): void {
    if (!map) return;
    try {
      this.stopActiveFlight(map);
      map.easeTo({
        center: [lng, lat],
        zoom: 16,
        pitch: 45,
        bearing: 40,
        duration: durationMs,
        easing: easeInOutCubic,
        essential: true,
      });
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

      // Stage 1 Upgrade: Deep Orbit Globe Auto-Rotation (Duration: 3000ms)
      // Keep camera at deep space view zoom: 1.8, pitch: 0°.
      // Animate bearing smoothly from 0° to 35° over the first 3000ms using easeInOutCubic.
      if (map) {
        map.flyTo({
          center: [targetLng, targetLat],
          zoom: 1.8,
          pitch: 0,
          bearing: 35,
          duration: 3000,
          easing: easeInOutCubic,
          essential: true,
        });
      }

      await sleep(3000, signal);

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

      // Stage 2: Regional Descent with easeInOutCubic easing
      if (map) {
        map.flyTo({
          center: [targetLng, targetLat],
          zoom: 9.5,
          pitch: 30,
          bearing: -15,
          duration: 3500,
          easing: easeInOutCubic,
          essential: true,
        });
      }

      await sleep(3500, signal);

      const liveDistrict = await this.resolveGlobalDistrict(map, targetLng, targetLat);
      currentDistrictScanTag = liveDistrict.hudReadout;
      currentStageBanner = liveDistrict.hudReadout;

      // Stage 3: District Focus with easeInOutCubic easing
      if (map) {
        this.applyGlobalDistrictBoundaryFilter(map, targetLng, targetLat, liveDistrict);
        map.flyTo({
          center: [targetLng, targetLat],
          zoom: 13.8,
          pitch: 45,
          bearing: -35,
          duration: 3000,
          easing: easeInOutCubic,
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
      // Stage 4: 3D Street Flyover with easeInOutCubic easing
      if (map) {
        map.flyTo({
          center: [targetLng, targetLat],
          zoom: 17.8,
          pitch: 72,
          bearing: 40,
          duration: 4500,
          easing: easeInOutCubic,
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
