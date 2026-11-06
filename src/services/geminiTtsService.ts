// Service for high-fidelity natural speech narration using Gemini 3.1 Flash TTS
// with seamless Web Speech API fallback, state synchronization, and rock-solid pause/resume.

import { CampaignTourStep } from '../types';

export interface TtsPlayOptions {
  text: string;
  voice?: 'Zephyr' | 'Fenrir' | 'Kore' | 'Puck' | 'Charon';
  playbackRate?: number;
  ownerId?: string; // 'tour' | 'details'
  onProgress?: (charIndex: number, progressRatio: number) => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface TtsPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentEngine: 'gemini' | 'browser';
  activeText: string | null;
  activeVoice: string;
  ownerId: string | null;
}

// In-memory audio cache with LRU eviction (cap at 30 items to prevent unbounded memory growth)
const MAX_CACHE_SIZE = 30;
const audioCache = new Map<string, string>();

function setCachedAudio(key: string, dataUri: string): void {
  if (audioCache.has(key)) {
    audioCache.delete(key);
  } else if (audioCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey) audioCache.delete(oldestKey);
  }
  audioCache.set(key, dataUri);
}

// In-flight fetch promises to prevent duplicate parallel requests
const inFlightFetches = new Map<string, Promise<string | null>>();
// Listeners for cache updates
const cacheListeners = new Set<() => void>();
// Listeners for playback state changes
const stateListeners = new Set<(state: TtsPlayerState) => void>();

class GeminiTtsPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private audioTeardown: (() => void) | null = null;
  private fallbackUtterance: SpeechSynthesisUtterance | null = null;
  private isUsingFallback = false;
  private currentPlayOptions: TtsPlayOptions | null = null;

  public isPlaying = false;
  public isPaused = false;
  public isLoading = false;
  public currentEngine: 'gemini' | 'browser' = 'gemini';
  public activeText: string | null = null;
  public activeVoice: string = 'Zephyr';
  public ownerId: string | null = null;

  private emitState(): void {
    const state: TtsPlayerState = {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isLoading: this.isLoading,
      currentEngine: this.currentEngine,
      activeText: this.activeText,
      activeVoice: this.activeVoice,
      ownerId: this.ownerId,
    };
    stateListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error('Error in TTS state listener:', err);
      }
    });
  }

  /**
   * Subscribe to playback state changes (play, pause, resume, stop, loading)
   */
  subscribeState(listener: (state: TtsPlayerState) => void): () => void {
    stateListeners.add(listener);
    // Send immediate initial state
    listener({
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isLoading: this.isLoading,
      currentEngine: this.currentEngine,
      activeText: this.activeText,
      activeVoice: this.activeVoice,
      ownerId: this.ownerId,
    });
    return () => {
      stateListeners.delete(listener);
    };
  }

  /**
   * Check if a specific text and voice combo is already preloaded in cache
   */
  isCached(text: string, voice: string = 'Zephyr'): boolean {
    const cacheKey = `${voice}_${text.trim()}`;
    return audioCache.has(cacheKey);
  }

  /**
   * Get preloaded audio data URI if available
   */
  getCachedUri(text: string, voice: string = 'Zephyr'): string | null {
    const cacheKey = `${voice}_${text.trim()}`;
    return audioCache.get(cacheKey) || null;
  }

  /**
   * Subscribe to cache updates
   */
  subscribeCache(listener: () => void): () => void {
    cacheListeners.add(listener);
    return () => {
      cacheListeners.delete(listener);
    };
  }

  /**
   * Asynchronously fetch or preload audio into memory with retry logic
   */
  async preload(text: string, voice: string = 'Zephyr', retries = 1): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const cacheKey = `${voice}_${trimmed}`;

    if (audioCache.has(cacheKey)) {
      return audioCache.get(cacheKey) || null;
    }

    if (inFlightFetches.has(cacheKey)) {
      return inFlightFetches.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      let attempts = 0;
      while (attempts <= retries) {
        try {
          const res = await fetch('/api/gemini/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed, voice }),
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(`TTS server error ${res.status}: ${errJson.error || res.statusText}`);
          }

          const data = await res.json();
          if (!data.audioBase64) {
            throw new Error('No audio data in server response');
          }

          const audioDataUri = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
          setCachedAudio(cacheKey, audioDataUri);

          // Notify cache subscribers
          cacheListeners.forEach((fn) => fn());
          return audioDataUri;
        } catch (err) {
          attempts++;
          if (attempts <= retries) {
            await new Promise((r) => setTimeout(r, 600 * attempts));
          } else {
            console.warn(`[Gemini TTS] Preload/Fetch failed for "${trimmed.slice(0, 35)}...":`, err);
            return null;
          }
        }
      }
      return null;
    })().finally(() => {
      inFlightFetches.delete(cacheKey);
    });

    inFlightFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Focused chapter preloader: only preloads current chapter and optional next chapter
   * to strictly prevent API rate limits.
   */
  async preloadStep(step: CampaignTourStep | undefined, voice: string = 'Zephyr'): Promise<void> {
    if (!step) return;
    const texts: string[] = [];
    if (step.narrative) texts.push(step.narrative);
    if (step.pedagogicalFocus) texts.push(`Curriculum Focus and Core Standard: ${step.pedagogicalFocus}`);

    for (const txt of texts) {
      if (!this.isCached(txt, voice)) {
        await this.preload(txt, voice, 1);
        // Small delay between requests to be gentle on quota
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  /**
   * Request TTS audio from cache/server or fallback to browser speech synthesis
   */
  async play(options: TtsPlayOptions): Promise<void> {
    const {
      text,
      voice = 'Zephyr',
      playbackRate = 1.0,
      ownerId = null,
      onProgress,
      onEnd,
      onError,
    } = options;

    const trimmed = text.trim();
    if (!trimmed) return;

    // If already playing the EXACT same text and paused, simply resume
    if (
      this.isPlaying &&
      this.isPaused &&
      this.activeText === trimmed &&
      this.activeVoice === voice
    ) {
      this.resume();
      return;
    }

    // Stop current playback cleanly before starting new
    this.stopAudioOnly();

    this.currentPlayOptions = options;
    this.activeText = trimmed;
    this.activeVoice = voice;
    this.ownerId = ownerId;
    this.isPlaying = true;
    this.isPaused = false;

    const cacheKey = `${voice}_${trimmed}`;
    let audioDataUri = audioCache.get(cacheKey);

    if (!audioDataUri) {
      this.isLoading = true;
      this.emitState();

      if (inFlightFetches.has(cacheKey)) {
        audioDataUri = (await inFlightFetches.get(cacheKey)!) || undefined;
      } else {
        audioDataUri = (await this.preload(trimmed, voice, 1)) || undefined;
      }
      this.isLoading = false;
    }

    // Check if stopped while awaiting fetch
    if (!this.isPlaying || this.activeText !== trimmed) {
      return;
    }

    if (!audioDataUri) {
      console.warn('Gemini TTS unavailable, falling back to browser speech synthesis.');
      this.playBrowserFallback(trimmed, playbackRate, onProgress, onEnd, onError);
      return;
    }

    try {
      this.isUsingFallback = false;
      this.currentEngine = 'gemini';
      const audio = new Audio(audioDataUri);
      this.currentAudio = audio;
      audio.playbackRate = playbackRate;

      this.isPlaying = true;
      this.isPaused = false;
      this.emitState();

      const totalChars = trimmed.length;

      const updateProgress = () => {
        if (!this.currentAudio || !this.isPlaying || this.isPaused) return;

        const currentTime = this.currentAudio.currentTime;
        const duration = this.currentAudio.duration || 1;
        const ratio = Math.min(1, Math.max(0, currentTime / duration));

        if (onProgress) {
          const estimatedCharIndex = Math.min(totalChars - 1, Math.floor(ratio * totalChars));
          onProgress(estimatedCharIndex, ratio);
        }
      };

      const handlePlay = () => {
        this.isPaused = false;
        this.emitState();
      };

      const handlePause = () => {
        if (this.isPlaying) {
          this.isPaused = true;
          this.emitState();
        }
      };

      const handleEnded = () => {
        this.stopAudioOnly();
        this.isPlaying = false;
        this.isPaused = false;
        this.activeText = null;
        this.emitState();

        if (onProgress) onProgress(totalChars, 1);
        if (onEnd) onEnd();
      };

      const handleError = (e: any) => {
        console.warn('Audio playback error, switching to browser speech:', e);
        this.stopAudioOnly();
        this.playBrowserFallback(trimmed, playbackRate, onProgress, onEnd, onError);
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      this.audioTeardown = () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        try {
          audio.pause();
          audio.src = '';
          audio.load();
        } catch (_) {}
      };

      await audio.play();
      this.emitState();
    } catch (playErr) {
      console.warn('Audio autoplay failed or blocked, attempting fallback:', playErr);
      this.playBrowserFallback(trimmed, playbackRate, onProgress, onEnd, onError);
    }
  }

  /**
   * Browser SpeechSynthesis Fallback
   */
  private playBrowserFallback(
    text: string,
    rate: number,
    onProgress?: (charIndex: number, ratio: number) => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    if (!('speechSynthesis' in window)) {
      this.isPlaying = false;
      this.isPaused = false;
      this.activeText = null;
      this.emitState();
      if (onError) onError(new Error('Speech synthesis not supported in this browser.'));
      return;
    }

    this.isUsingFallback = true;
    this.currentEngine = 'browser';
    this.isPlaying = true;
    this.isPaused = false;
    this.emitState();

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    this.fallbackUtterance = utterance;
    utterance.rate = rate;

    // Choose preferred voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Alex'))
    ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onboundary = (e) => {
      if (onProgress && typeof e.charIndex === 'number') {
        const ratio = text.length > 0 ? e.charIndex / text.length : 0;
        onProgress(e.charIndex, ratio);
      }
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.activeText = null;
      this.emitState();

      if (onProgress) onProgress(text.length, 1);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      this.isPlaying = false;
      this.isPaused = false;
      this.activeText = null;
      this.emitState();
      if (onError) onError(e);
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Pause current narration (Gemini audio or browser fallback)
   */
  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    if (this.currentAudio && !this.isUsingFallback) {
      this.currentAudio.pause();
    } else if (this.isUsingFallback && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }

    this.isPaused = true;
    this.emitState();
  }

  /**
   * Resume paused narration
   */
  resume(): void {
    if (!this.isPlaying || !this.isPaused) return;

    if (this.currentAudio && !this.isUsingFallback) {
      this.currentAudio.play().catch((err) => {
        console.warn('Resume play error:', err);
      });
    } else if (this.isUsingFallback && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }

    this.isPaused = false;
    this.emitState();
  }

  /**
   * Toggle between play and pause
   */
  togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else if (this.isPlaying) {
      this.pause();
    }
  }

  /**
   * Update playback speed dynamically
   */
  setRate(rate: number): void {
    if (this.currentAudio && !this.isUsingFallback) {
      this.currentAudio.playbackRate = rate;
    }
  }

  private stopAudioOnly(): void {
    if (this.audioTeardown) {
      try {
        this.audioTeardown();
      } catch (_) {}
      this.audioTeardown = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.fallbackUtterance = null;
  }

  /**
   * Stop all playback and reset state
   */
  stop(): void {
    this.stopAudioOnly();
    this.isPlaying = false;
    this.isPaused = false;
    this.isLoading = false;
    this.activeText = null;
    this.currentPlayOptions = null;
    this.emitState();
  }
}

export const geminiTts = new GeminiTtsPlayer();

