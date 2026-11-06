import mapboxgl from 'mapbox-gl';

export interface VideoRecorderSession {
  mimeType: string;
  extension: 'mp4' | 'webm';
  startedAt: number;
  stopAndDownload: () => Promise<{ filename: string; sizeBytes: number; durationMs: number }>;
  cancel: () => void;
}

/**
 * Seamless 1-Click Video Export Engine (videoRecorder.ts)
 * Captures Mapbox GL v3 WebGL canvas at 60 FPS (with preserveDrawingBuffer: true)
 * and synchronizes startRecording() at Stage 1 with stopRecording() 1.5s after Stage 4 lock.
 */
export class VideoRecorder {
  private static activeRecorder: MediaRecorder | null = null;
  private static activeChunks: BlobPart[] = [];
  private static activeStartedAt: number = 0;
  private static activeTripName: string = 'SAIGON_NIGHT_CULINARY_NODE_01';
  private static activeMimeType: string = 'video/webm';
  private static activeExtension: 'mp4' | 'webm' = 'webm';

  /**
   * Automatically detect best supported MediaRecorder MIME codec
   * Priority: video/webm;codecs=vp9 -> video/webm;codecs=vp8 -> video/mp4 -> video/webm
   */
  static detectSupportedMime(): { mimeType: string; extension: 'mp4' | 'webm' } {
    if (typeof MediaRecorder === 'undefined') {
      return { mimeType: 'video/webm', extension: 'webm' };
    }

    const candidates: Array<{ mimeType: string; extension: 'mp4' | 'webm' }> = [
      { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
      { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
      { mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
      { mimeType: 'video/mp4', extension: 'mp4' },
      { mimeType: 'video/webm', extension: 'webm' },
    ];

    for (const candidate of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
          return candidate;
        }
      } catch (_) {}
    }

    return { mimeType: 'video/webm', extension: 'webm' };
  }

  /**
   * Sanitize trip name for safe output filename:
   * VibePath_Cinematic_Landing_[TRIP_NAME].mp4 (or .webm)
   */
  static buildOutputFilename(tripName: string, extension: 'mp4' | 'webm'): string {
    const cleanTrip =
      (tripName || 'SAIGON_NIGHT_CULINARY_NODE_01')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'SAIGON_NIGHT_01';

    return `VibePath_Cinematic_Landing_${cleanTrip}.${extension}`;
  }

  /**
   * Triggered simultaneously when Stage 1 (Deep Orbit Space View) begins.
   * Captures map.getCanvas().captureStream(60) at 60 FPS uninterrupted.
   */
  static startRecording(
    map: mapboxgl.Map | null,
    tripName: string = 'SAIGON_NIGHT_CULINARY_NODE_01',
    fallbackCanvas?: HTMLCanvasElement | null
  ): boolean {
    try {
      this.cancelActive();

      const targetCanvas: HTMLCanvasElement | null =
        (map && typeof map.getCanvas === 'function' ? map.getCanvas() : null) ||
        fallbackCanvas ||
        (document.querySelector('canvas.mapboxgl-canvas') as HTMLCanvasElement | null) ||
        (document.querySelector('canvas') as HTMLCanvasElement | null);

      if (
        !targetCanvas ||
        typeof (targetCanvas as any).captureStream !== 'function' ||
        typeof MediaRecorder === 'undefined'
      ) {
        return false;
      }

      const { mimeType, extension } = this.detectSupportedMime();
      const stream: MediaStream = (targetCanvas as any).captureStream(60);

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000, // 8 Mbps high-definition 60FPS bitrate
      });

      this.activeChunks = [];
      this.activeStartedAt = Date.now();
      this.activeTripName = tripName;
      this.activeMimeType = mimeType;
      this.activeExtension = extension;
      this.activeRecorder = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.activeChunks.push(event.data);
        }
      };

      // Request data chunks every 250ms so buffer is continuously flushed without frame drops
      recorder.start(250);
      return true;
    } catch (err) {
      console.warn('[VideoRecorder] Unable to start MediaRecorder:', err);
      this.activeRecorder = null;
      return false;
    }
  }

  /**
   * Automatically triggered 1.5s AFTER Stage 4 completes its final camera lock.
   * Generates a Blob URL and automatically prompts a 1-click file download:
   * VibePath_Cinematic_Landing_[TRIP_NAME].mp4 (or .webm)
   */
  static stopRecording(
    overrideTripName?: string
  ): Promise<{ filename: string; sizeBytes: number; durationMs: number } | null> {
    return new Promise((resolve) => {
      const recorder = this.activeRecorder;
      const tripName = overrideTripName || this.activeTripName;
      const mimeType = this.activeMimeType;
      const extension = this.activeExtension;
      const startedAt = this.activeStartedAt;

      if (!recorder || recorder.state === 'inactive') {
        this.activeRecorder = null;
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        try {
          const blob = new Blob(this.activeChunks, { type: mimeType });
          const filename = this.buildOutputFilename(tripName, extension);
          const url = URL.createObjectURL(blob);

          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);

          window.setTimeout(() => URL.revokeObjectURL(url), 5000);

          const durationMs = Date.now() - startedAt;
          this.activeChunks = [];
          this.activeRecorder = null;

          resolve({
            filename,
            sizeBytes: blob.size,
            durationMs,
          });
        } catch (err) {
          console.warn('[VideoRecorder] Error finalizing video download:', err);
          this.activeChunks = [];
          this.activeRecorder = null;
          resolve(null);
        }
      };

      try {
        recorder.stop();
      } catch (_) {
        this.activeRecorder = null;
        resolve(null);
      }
    });
  }

  static cancelActive(): void {
    try {
      if (this.activeRecorder && this.activeRecorder.state !== 'inactive') {
        this.activeRecorder.onstop = null;
        this.activeRecorder.stop();
      }
    } catch (_) {}
    this.activeRecorder = null;
    this.activeChunks = [];
  }
}
