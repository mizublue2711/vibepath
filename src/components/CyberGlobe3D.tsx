import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ApiKeyManager } from '../services/apiKeyManager';
import { getStoredThemeConfig } from '../context/ThemeContext';
import { MapModeController, UnifiedMapMode } from '../services/mapModeController';
import {
  CinematicFlightEngine,
  FlightStageUpdate,
  GlobalDistrictResolution,
  GLOBAL_BOUNDARIES_SOURCE_ID,
  GLOBAL_DISTRICT_FILL_LAYER_ID,
  GLOBAL_DISTRICT_STROKE_LAYER_ID,
} from '../services/cinematicFlightEngine';
import { GlobalBoundaryService } from '../services/globalBoundaryService';
import { PoiSearchBox, GeocodedPoiResult } from './PoiSearchBox';
import {
  CulinaryNode,
  RouteWaypoint,
  LanguageCode,
  LegoGraphicStyleKey,
} from '../data/vibePathData';
import { bsplineSmooth, CoordinatePoint } from '../utils/bsplineSmooth';
import {
  Globe2,
  Rocket,
  CheckCircle2,
  Compass,
  Layers,
  Film,
  MapPin,
} from 'lucide-react';

export interface TelemetryPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  timestamp?: string;
}

export interface FoodPOI {
  poi_id?: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number;
  note?: string;
  timestamp?: string;
  images?: string[];
}

export interface CyberGlobe3DProps {
  telemetryData: TelemetryPoint[];
  foodPois: FoodPOI[];
  activePoi?: FoodPOI | null;
  allNodes?: CulinaryNode[];
  waypoints?: RouteWaypoint[];
  onSelectNode?: (node: CulinaryNode) => void;
  onPickCoordinate?: (lat: number, lng: number) => void;
  onAddPoiFromMap?: (coords: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  }) => void;
  onDistrictResolved?: (districtLabel: string) => void;
  language?: LanguageCode;
  autoTriggerKey?: number;
  compactMode?: boolean;
  activeStyle?: LegoGraphicStyleKey;
  onStyleChange?: (style: LegoGraphicStyleKey) => void;
  onOpenSettings?: () => void;
  onOpenPinModal?: () => void;
}

function validateMapboxToken(rawToken: string): { valid: boolean } {
  const trimmed = (rawToken || '').trim();
  if (!trimmed || !trimmed.startsWith('pk.') || trimmed.includes('xxxxxxxx') || trimmed.length < 32) {
    return { valid: false };
  }
  return { valid: true };
}

function ensureBeaconKeyframesInjected(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vibepath-neon-beacon-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'vibepath-neon-beacon-keyframes';
  style.textContent = `
    @keyframes cyberRadarRingExpand {
      0% {
        transform: translate(-50%, -50%) scale(0.45);
        opacity: 0.95;
      }
      70% {
        transform: translate(-50%, -50%) scale(2.35);
        opacity: 0.25;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.75);
        opacity: 0;
      }
    }
    @keyframes cyberLaserBeamPulse {
      0%, 100% {
        opacity: 0.92;
        filter: drop-shadow(0 0 10px #00E5FF) drop-shadow(0 0 22px #00E5FF);
      }
      50% {
        opacity: 1;
        filter: drop-shadow(0 0 16px #00E5FF) drop-shadow(0 0 34px #00E5FF);
      }
    }
  `;
  document.head.appendChild(style);
}

function buildLaserColumnFootprint(
  lng: number,
  lat: number,
  radiusMeters = 2.4
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const segments = 12;
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    ring.push([
      Number((lng + Math.cos(angle) * dLng).toFixed(7)),
      Number((lat + Math.sin(angle) * dLat).toFixed(7)),
    ]);
  }
  if (ring.length > 0) {
    ring.push(ring[0]);
  }

  return {
    type: 'Feature',
    properties: {
      height: 240,
      min_height: 0,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

export const CyberGlobe3D: React.FC<CyberGlobe3DProps> = ({
  telemetryData,
  foodPois,
  activePoi,
  allNodes = [],
  onSelectNode,
  onPickCoordinate,
  onAddPoiFromMap,
  onDistrictResolved,
  language = 'vi',
  autoTriggerKey = 0,
  compactMode = false,
  onOpenPinModal,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const newPinMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [activeMode, setActiveMode] = useState<UnifiedMapMode>('DEM_3D');
  const activeModeRef = useRef<UnifiedMapMode>('DEM_3D');
  const [mapMode, setMapModeState] = useState<'terrain' | 'cad' | 'orbit' | 'flyover'>('terrain');

  const [selectedSearchPoi, setSelectedSearchPoi] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    address?: string;
  } | null>(null);

  const [globalDistrictScan, setGlobalDistrictScan] =
    useState<GlobalDistrictResolution>({
      mapboxId: 'dXJuOm1ieGJuZDo2ODg0Njp2NA',
      districtName: 'District 1, Ben Thanh',
      countryCode: 'VN',
      hudReadout: 'District 1, Ben Thanh',
    });
  const globalDistrictScanRef = useRef<GlobalDistrictResolution>(globalDistrictScan);
  globalDistrictScanRef.current = globalDistrictScan;

  const [flightStatus, setFlightStatus] = useState<FlightStageUpdate | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const accentColorRef = useRef<string>(getStoredThemeConfig().accentColor || '#00E5FF');

  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    return ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
  });
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [useBuiltIn3DEngine, setUseBuiltIn3DEngine] = useState<boolean>(false);

  const [, setCameraTelemetry] = useState<{
    zoom: number;
    pitch: number;
    bearing: number;
  }>({
    zoom: 16.8,
    pitch: 72,
    bearing: 40,
  });

  const [activeMapCenter, setActiveMapCenter] = useState<[number, number]>(() => [
    activePoi?.longitude || 106.7024,
    activePoi?.latitude || 10.7611,
  ]);

  // Animated camera state for built-in 60FPS 3D Globe & Tactical Street Renderer
  const animCameraRef = useRef<{
    lng: number;
    lat: number;
    targetLng: number;
    targetLat: number;
    zoom: number;
    targetZoom: number;
    pitch: number;
    targetPitch: number;
    bearing: number;
    targetBearing: number;
  }>({
    lng: 106.7024,
    lat: 10.7611,
    targetLng: 106.7024,
    targetLat: 10.7611,
    zoom: 16.8,
    targetZoom: 16.8,
    pitch: 72,
    targetPitch: 72,
    bearing: 40,
    targetBearing: 40,
  });

  const targetDisplayPoi: FoodPOI = selectedSearchPoi
    ? {
        poi_id: 'poi-search-selected',
        name: selectedSearchPoi.name,
        latitude: selectedSearchPoi.latitude,
        longitude: selectedSearchPoi.longitude,
        rating: 5,
      }
    : activePoi ||
      foodPois[0] || {
        poi_id: 'poi-default',
        name: 'SAIGON_CULINARY_NODE_01',
        latitude: 10.7611,
        longitude: 106.7024,
        rating: 5,
      };

  const targetPoiRef = useRef<FoodPOI>(targetDisplayPoi);
  targetPoiRef.current = targetDisplayPoi;

  const onPickCoordinateRef = useRef(onPickCoordinate);
  onPickCoordinateRef.current = onPickCoordinate;

  const onAddPoiFromMapRef = useRef(onAddPoiFromMap);
  onAddPoiFromMapRef.current = onAddPoiFromMap;

  // Instantaneous (< 50ms) mode switch without destroying or re-mounting new mapboxgl.Map()
  const handleSwitchMode = useCallback((newMode: UnifiedMapMode) => {
    activeModeRef.current = newMode;
    setActiveMode(newMode);
    if (mapRef.current) {
      MapModeController.switchMode(mapRef.current, newMode);
    }
  }, []);


  /**
   * Stage 4 Upgrade: Mount Pulsing Cyberpunk Neon Venue Beacon + Ground Radar Ring + Vertical Cyan Laser Column
   * Displays HUD label: [ 📍 TARGET LOCKED // <VENUE_NAME_UPPERCASE> ]
   */
  const mountTargetRadarBeacon = useCallback(
    (map: mapboxgl.Map, lng: number, lat: number, venueName?: string) => {
      ensureBeaconKeyframesInjected();
      const cleanLng = Number(lng.toFixed(6));
      const cleanLat = Number(lat.toFixed(6));
      const displayLabel = (venueName || targetPoiRef.current?.name || 'FOOD_POI_TARGET')
        .trim()
        .toUpperCase();

      // 1. Update WebGL Ground Radar Ring & 3D Laser Light Column layers
      try {
        const pointData: GeoJSON.Feature<GeoJSON.Point> = {
          type: 'Feature',
          properties: { name: displayLabel },
          geometry: {
            type: 'Point',
            coordinates: [cleanLng, cleanLat],
          },
        };

        const existingRadarSrc = map.getSource('target-venue-radar-source') as
          | mapboxgl.GeoJSONSource
          | undefined;
        if (existingRadarSrc) {
          existingRadarSrc.setData(pointData);
        } else if (map.isStyleLoaded()) {
          map.addSource('target-venue-radar-source', {
            type: 'geojson',
            data: pointData,
          });
        }

        if (map.getSource('target-venue-radar-source') && !map.getLayer('target-venue-radar-outer')) {
          map.addLayer({
            id: 'target-venue-radar-outer',
            type: 'circle',
            source: 'target-venue-radar-source',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                8,
                15,
                22,
                18,
                38,
              ],
              'circle-color': 'rgba(0, 229, 255, 0.12)',
              'circle-stroke-color': '#00E5FF',
              'circle-stroke-width': 2,
              'circle-pitch-alignment': 'map',
            },
          });
        }

        if (map.getSource('target-venue-radar-source') && !map.getLayer('target-venue-radar-inner')) {
          map.addLayer({
            id: 'target-venue-radar-inner',
            type: 'circle',
            source: 'target-venue-radar-source',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                4,
                15,
                10,
                18,
                16,
              ],
              'circle-color': 'rgba(0, 229, 255, 0.35)',
              'circle-stroke-color': '#00E5FF',
              'circle-stroke-width': 2.5,
              'circle-pitch-alignment': 'map',
            },
          });
        }

        const laserFootprint = buildLaserColumnFootprint(cleanLng, cleanLat, 2.2);
        const existingLaserSrc = map.getSource('target-venue-laser-source') as
          | mapboxgl.GeoJSONSource
          | undefined;
        if (existingLaserSrc) {
          existingLaserSrc.setData(laserFootprint);
        } else if (map.isStyleLoaded()) {
          map.addSource('target-venue-laser-source', {
            type: 'geojson',
            data: laserFootprint,
          });
        }

        if (
          map.getSource('target-venue-laser-source') &&
          !map.getLayer('target-venue-laser-column-3d')
        ) {
          map.addLayer({
            id: 'target-venue-laser-column-3d',
            type: 'fill-extrusion',
            source: 'target-venue-laser-source',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': '#00E5FF',
              'fill-extrusion-height': 240,
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.52,
            },
          });
        }
      } catch (_) {}

      // 2. Mount High-Contrast Cyberpunk Neon Radar Beacon DOM Marker
      try {
        if (newPinMarkerRef.current) {
          newPinMarkerRef.current.remove();
          newPinMarkerRef.current = null;
        }

        const el = document.createElement('div');
        el.className = 'cyber-neon-venue-beacon';
        el.style.pointerEvents = 'none';
        el.innerHTML = `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            pointer-events: none;
            user-select: none;
          ">
            <!-- Top HUD Label: [ 📍 TARGET LOCKED // <VENUE_NAME_UPPERCASE> ] -->
            <div style="
              background: rgba(5, 5, 10, 0.94);
              border: 1px solid #00E5FF;
              color: #00E5FF;
              padding: 6px 12px;
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.08em;
              border-radius: 0px !important;
              display: flex;
              align-items: center;
              gap: 6px;
              white-space: nowrap;
              box-shadow: 0 0 18px rgba(0, 229, 255, 0.45), inset 0 0 8px rgba(0, 229, 255, 0.18);
            ">
              <span style="color: #00E5FF;">[ 📍 TARGET LOCKED //</span>
              <span style="color: #FFFFFF;">${displayLabel}</span>
              <span style="color: #00E5FF;">]</span>
            </div>

            <!-- Vertical Cyan Laser Light Column extending upwards from venue pin -->
            <div style="
              width: 3px;
              height: 112px;
              background: linear-gradient(180deg, rgba(0, 229, 255, 0.25) 0%, #00E5FF 65%, #FFFFFF 100%);
              box-shadow: 0 0 14px #00E5FF, 0 0 28px rgba(0, 229, 255, 0.85);
              animation: cyberLaserBeamPulse 1.8s infinite ease-in-out;
            "></div>

            <!-- Ground-Level Pulsing Neon Radar Rings (#00E5FF) -->
            <div style="
              position: relative;
              width: 24px;
              height: 24px;
              margin-top: -12px;
            ">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: 34px;
                height: 34px;
                border: 2px solid #00E5FF;
                background: rgba(0, 229, 255, 0.16);
                box-shadow: 0 0 16px #00E5FF;
                border-radius: 9999px;
                animation: cyberRadarRingExpand 1.9s infinite cubic-bezier(0.16, 1, 0.3, 1);
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: 34px;
                height: 34px;
                border: 1.5px solid #00E5FF;
                background: rgba(0, 229, 255, 0.08);
                border-radius: 9999px;
                animation: cyberRadarRingExpand 1.9s infinite 0.95s cubic-bezier(0.16, 1, 0.3, 1);
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: 10px;
                height: 10px;
                transform: translate(-50%, -50%);
                background: #FFFFFF;
                border: 2px solid #00E5FF;
                box-shadow: 0 0 14px #00E5FF, 0 0 24px #00E5FF;
              "></div>
            </div>
          </div>
        `;

        newPinMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([cleanLng, cleanLat])
          .addTo(map);
      } catch (_) {}
    },
    []
  );

  useEffect(() => {
    const handleKeysUpdated = () => {
      const updatedToken =
        ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
      setMapboxToken(updatedToken);
    };
    const handleThemeUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ accentColor?: string }>;
      const nextAccent = custom.detail?.accentColor || getStoredThemeConfig().accentColor || '#00E5FF';
      accentColorRef.current = nextAccent;
      MapModeController.updateRouteAccentColor(mapRef.current, nextAccent);
    };
    window.addEventListener('vibepath_apikeys_updated', handleKeysUpdated);
    window.addEventListener('vibepath_theme_updated', handleThemeUpdated);
    return () => {
      window.removeEventListener('vibepath_apikeys_updated', handleKeysUpdated);
      window.removeEventListener('vibepath_theme_updated', handleThemeUpdated);
    };
  }, []);

  // Resolve Global Administrative Boundary whenever target coordinates change
  useEffect(() => {
    let cancelled = false;
    CinematicFlightEngine.resolveGlobalDistrict(
      mapRef.current,
      targetDisplayPoi.longitude,
      targetDisplayPoi.latitude
    ).then((res) => {
      if (cancelled) return;
      setGlobalDistrictScan(res);
      if (onDistrictResolved) {
        onDistrictResolved(res.hudReadout || 'District 1, Ben Thanh');
      }
      if (mapRef.current && mapReady) {
        CinematicFlightEngine.applyGlobalDistrictBoundaryFilter(
          mapRef.current,
          targetDisplayPoi.longitude,
          targetDisplayPoi.latitude,
          res
        );
        mountTargetRadarBeacon(
          mapRef.current,
          targetDisplayPoi.longitude,
          targetDisplayPoi.latitude,
          targetDisplayPoi.name
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    targetDisplayPoi.longitude,
    targetDisplayPoi.latitude,
    targetDisplayPoi.name,
    mapReady,
    onDistrictResolved,
    mountTargetRadarBeacon,
  ]);

  /**
   * Center the 3D camera over target food POI and render the Pulsing Neon Venue Beacon
   */
  const flyToFoodPoiAndRenderTag = useCallback(
    (lng: number, lat: number, venueName?: string, address?: string) => {
      const cleanLng = Number(lng.toFixed(6));
      const cleanLat = Number(lat.toFixed(6));
      const displayLabel = (venueName || 'FOOD_POI_TARGET').toUpperCase();

      setSelectedSearchPoi({
        latitude: cleanLat,
        longitude: cleanLng,
        name: displayLabel,
        address,
      });

      // Animate built-in 3D renderer camera target
      animCameraRef.current.zoom = 9.5;
      animCameraRef.current.pitch = 35;
      animCameraRef.current.targetLng = cleanLng;
      animCameraRef.current.targetLat = cleanLat;
      animCameraRef.current.targetZoom = 17.5;
      animCameraRef.current.targetPitch = 72;
      animCameraRef.current.targetBearing = 40;

      if (onPickCoordinateRef.current) {
        onPickCoordinateRef.current(cleanLat, cleanLng);
      }
      if (onAddPoiFromMapRef.current) {
        onAddPoiFromMapRef.current({
          longitude: cleanLng,
          latitude: cleanLat,
          name: venueName,
          address,
        });
      }

      const map = mapRef.current;

      CinematicFlightEngine.resolveGlobalDistrict(map, cleanLng, cleanLat).then(
        (res) => {
          setGlobalDistrictScan(res);
          if (map) {
            CinematicFlightEngine.applyGlobalDistrictBoundaryFilter(
              map,
              cleanLng,
              cleanLat,
              res
            );
          }
        }
      );

      if (!map) return;

      try {
        mountTargetRadarBeacon(map, cleanLng, cleanLat, displayLabel);

        map.flyTo({
          center: [cleanLng, cleanLat],
          zoom: 17.5,
          pitch: 72,
          bearing: 40,
          speed: 1.35,
          curve: 1.4,
          essential: true,
        });
      } catch (_) {}
    },
    [mountTargetRadarBeacon]
  );

  /**
   * Execute 4-Stage Cinematic Flight Sequence (with optional 1-click 60FPS video export)
   */
  const runCinematicSequence = useCallback(
    (recordVideo: boolean, customTripName?: string, overrideTarget?: FoodPOI) => {
      const target = overrideTarget || targetPoiRef.current;
      const resolvedTripName = customTripName || 'SAIGON_NIGHT_CULINARY_NODE_01';
      isRecordingRef.current = recordVideo;

      // Sync built-in 3D camera stages
      animCameraRef.current.targetLng = target.longitude;
      animCameraRef.current.targetLat = target.latitude;

      if (mapRef.current) {
        mountTargetRadarBeacon(
          mapRef.current,
          target.longitude,
          target.latitude,
          target.name
        );
      }

      CinematicFlightEngine.runFourStageFlight({
        map: mapRef.current,
        targetLng: target.longitude,
        targetLat: target.latitude,
        targetName: target.name || 'SAIGON_CULINARY_NODE_01',
        tripName: resolvedTripName,
        recordVideo,
        onStageChange: (update) => {
          isRecordingRef.current = update.isRecording;
          setFlightStatus(update);
          if (update.stage === 'ORBIT') {
            animCameraRef.current.targetZoom = 1.8;
            animCameraRef.current.targetPitch = 0;
            animCameraRef.current.targetBearing = 35;
          } else if (update.stage === 'REGIONAL') {
            animCameraRef.current.targetZoom = 9.5;
            animCameraRef.current.targetPitch = 30;
            animCameraRef.current.targetBearing = -15;
          } else if (update.stage === 'DISTRICT_FOCUS') {
            animCameraRef.current.targetZoom = 13.8;
            animCameraRef.current.targetPitch = 45;
            animCameraRef.current.targetBearing = -35;
          } else {
            animCameraRef.current.targetZoom = 17.8;
            animCameraRef.current.targetPitch = 72;
            animCameraRef.current.targetBearing = 40;
            if (mapRef.current) {
              mountTargetRadarBeacon(
                mapRef.current,
                target.longitude,
                target.latitude,
                target.name
              );
            }
          }
          if (update.globalDistrictInfo) {
            setGlobalDistrictScan(update.globalDistrictInfo);
            if (onDistrictResolved) {
              onDistrictResolved(update.globalDistrictInfo.hudReadout || 'District 1, Ben Thanh');
            }
          }
          window.dispatchEvent(
            new CustomEvent('vibepath_cinematic_status', { detail: update })
          );
        },
        onComplete: (downloadInfo) => {
          isRecordingRef.current = false;
          if (downloadInfo) {
            window.dispatchEvent(
              new CustomEvent('vibepath_cinematic_complete', { detail: downloadInfo })
            );
          }
        },
      });
    },
    [mountTargetRadarBeacon, onDistrictResolved]
  );

  useEffect(() => {
    const handleTriggerEvent = (e: Event) => {
      const custom = e as CustomEvent<{ recordVideo?: boolean; tripName?: string } | undefined>;
      const shouldRecord = custom.detail?.recordVideo !== false;
      const tripName = custom.detail?.tripName || 'SAIGON_NIGHT_CULINARY_NODE_01';
      runCinematicSequence(shouldRecord, tripName);
    };

    window.addEventListener('vibepath_trigger_cinematic_render', handleTriggerEvent);
    return () => {
      window.removeEventListener('vibepath_trigger_cinematic_render', handleTriggerEvent);
    };
  }, [runCinematicSequence]);

  const handleSetOrbitView = useCallback(() => {
    CinematicFlightEngine.stopActiveFlight(mapRef.current);
    setFlightStatus(null);
    animCameraRef.current.targetZoom = 1.8;
    animCameraRef.current.targetPitch = 0;
    animCameraRef.current.targetBearing = 0;
    setCameraTelemetry({ zoom: 1.8, pitch: 0, bearing: 0 });
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [targetDisplayPoi.longitude, targetDisplayPoi.latitude],
        zoom: 1.8,
        pitch: 0,
        bearing: 0,
        speed: 1.2,
        essential: true,
      });
    }
  }, [targetDisplayPoi]);

  const setMapMode = useCallback(
    (mode: 'terrain' | 'cad' | 'orbit' | 'flyover') => {
      setMapModeState(mode);
      if (mode === 'terrain') {
        handleSwitchMode('DEM_3D');
      } else if (mode === 'cad') {
        handleSwitchMode('CAD_3D');
      } else if (mode === 'orbit') {
        handleSetOrbitView();
      } else if (mode === 'flyover') {
        runCinematicSequence(false);
      }
    },
    [handleSwitchMode, handleSetOrbitView, runCinematicSequence]
  );

  const triggerRenderEngine = useCallback(() => {
    runCinematicSequence(true);
  }, [runCinematicSequence]);

  const mountBrutalistMarkers = useCallback(
    (map: mapboxgl.Map, pois: FoodPOI[]) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      pois.forEach((poi, index) => {
        const el = document.createElement('div');
        el.className = 'cyber-poi-tag';
        const indexCode = String(index + 1).padStart(2, '0');
        const isActive =
          activePoi &&
          ((activePoi.poi_id && activePoi.poi_id === poi.poi_id) ||
            (Math.abs(activePoi.latitude - poi.latitude) < 0.0001 &&
              Math.abs(activePoi.longitude - poi.longitude) < 0.0001));

        el.innerHTML = `
          <div style="
            background: #080A0F;
            border: 1px solid ${isActive ? '#00E676' : '#00E5FF'};
            color: #00E5FF;
            padding: 4px 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            border-radius: 0px !important;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            white-space: nowrap;
            user-select: none;
          ">
            <span style="color: #00E5FF;">[ ${indexCode} // POI ]</span>
            <span style="color: #FFFFFF;">${(poi.name || 'NODE').toUpperCase()}</span>
          </div>
        `;

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (onSelectNode && allNodes.length > 0) {
            const matched = allNodes.find(
              (n) =>
                n.id === poi.poi_id ||
                (Math.abs(n.latitude - poi.latitude) < 0.0002 &&
                  Math.abs(n.longitude - poi.longitude) < 0.0002)
            );
            if (matched) onSelectNode(matched);
          }
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([poi.longitude, poi.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      });
    },
    [allNodes, onSelectNode, activePoi]
  );

  // 1. Initialize Persistent Native Mapbox GL JS v3 WebGL Instance (with ResizeObserver)
  // Or seamlessly activate Built-in 60FPS 3D Tactical Globe Canvas when no client token is configured
  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapRef.current) {
      try {
        CinematicFlightEngine.stopActiveFlight(mapRef.current);
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (newPinMarkerRef.current) {
          newPinMarkerRef.current.remove();
          newPinMarkerRef.current = null;
        }
        mapRef.current.remove();
      } catch (_) {}
      mapRef.current = null;
    }

    const resolvedToken =
      mapboxToken || ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';

    const tokenCheck = validateMapboxToken(resolvedToken);
    if (!tokenCheck.valid || (typeof mapboxgl.supported === 'function' && !mapboxgl.supported())) {
      setUseBuiltIn3DEngine(true);
      setMapReady(true);
      return;
    }

    let isUnmounted = false;

    try {
      mapboxgl.accessToken = resolvedToken.trim();

      const startLng =
        activePoi?.longitude ||
        (telemetryData.length > 0 ? telemetryData[0].longitude : 106.7024);
      const startLat =
        activePoi?.latitude ||
        (telemetryData.length > 0 ? telemetryData[0].latitude : 10.7611);

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        preserveDrawingBuffer: true,
        projection: 'globe',
        center: [startLng, startLat],
        zoom: 1.8,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });

      mapRef.current = map;
      setUseBuiltIn3DEngine(false);

      // Ép Mapbox resize ngay sau khi nạp xong style/layout
      // Ensure WebGL map canvas is initialized and scaled with crisp high DPI pixel ratios
      const applyHighDpiScaling = () => {
        if (!mapRef.current || !mapContainer.current) return;
        const canvas = mapRef.current.getCanvas();
        if (canvas) {
          const rect = mapContainer.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
          }
        }
        mapRef.current.resize();
      };

      map.on('load', () => {
        window.setTimeout(() => {
          applyHighDpiScaling();
        }, 100);
      });

      // Đăng ký ResizeObserver theo dõi kích thước container liên tục
      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              applyHighDpiScaling();
            })
          : null;

      if (resizeObserver && mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }

      map.on('error', (event: any) => {
        if (isUnmounted) return;
        const sourceId = String(event?.sourceId || '');
        if (sourceId === GLOBAL_BOUNDARIES_SOURCE_ID) return;
        const status = event?.error?.status;
        const msg = String(event?.error?.message || '');
        if (
          status === 401 ||
          (status === 403 && !msg.includes('boundaries-adm2')) ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('access token')
        ) {
          setUseBuiltIn3DEngine(true);
          setMapReady(true);
        }
      });

      map.on('move', () => {
        if (isUnmounted || !mapRef.current) return;
        const center = mapRef.current.getCenter();
        setActiveMapCenter([
          Number(center.lng.toFixed(6)),
          Number(center.lat.toFixed(6)),
        ]);
        setCameraTelemetry({
          zoom: Number(mapRef.current.getZoom().toFixed(2)),
          pitch: Math.round(mapRef.current.getPitch()),
          bearing: Math.round(mapRef.current.getBearing()),
        });
      });

      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        flyToFoodPoiAndRenderTag(lng, lat, 'MAP_PIN_VENUE');
      });

      map.on('style.load', () => {
        if (isUnmounted) return;
        try {
          setMapReady(true);
          const initialPreset = MapModeController.getPreset(activeModeRef.current);
          map.setFog(initialPreset.fog);

          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 512,
              maxzoom: 14,
            });
          }
          map.setTerrain({
            source: 'mapbox-dem',
            exaggeration: initialPreset.terrainExaggeration,
          });

          // Stage 3 Upgrade: Initialize Mapbox Boundaries Vector Tileset (adm2-v4) & Dynamic GeoJSON Boundary Layers
          GlobalBoundaryService.initBoundaryLayers(map);

          const layers = map.getStyle()?.layers;
          const labelLayerId = layers?.find(
            (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
          )?.id;

          // Stage 4 Upgrade: 3D Building Aesthetics (#0D1017 base with #1A233A tops + 0.4 ambient occlusion)
          if (!map.getLayer('3d-buildings')) {
            map.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 12,
                paint: {
                  'fill-extrusion-color': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12,
                    '#0D1017',
                    15,
                    [
                      'interpolate',
                      ['linear'],
                      ['coalesce', ['get', 'height'], 15],
                      0,
                      '#0D1017',
                      60,
                      '#1A233A',
                    ],
                  ],
                  'fill-extrusion-height': ['get', 'height'],
                  'fill-extrusion-base': ['get', 'min_height'],
                  'fill-extrusion-opacity': initialPreset.buildingOpacity,
                  'fill-extrusion-ambient-occlusion-intensity': 0.4,
                } as any,
              },
              labelLayerId
            );
          }

          if (!map.getLayer('3d-buildings-cad-wireframe')) {
            map.addLayer(
              {
                id: '3d-buildings-cad-wireframe',
                source: 'composite',
                'source-layer': 'building',
                type: 'line',
                minzoom: 13,
                layout: {
                  visibility: initialPreset.cadGridVisible ? 'visible' : 'none',
                },
                paint: {
                  'line-color': '#00E5FF',
                  'line-width': 0.8,
                  'line-opacity': 0.45,
                },
              },
              labelLayerId
            );
          }

          const rawControlPoints: CoordinatePoint[] =
            foodPois.length >= 2
              ? foodPois.map((fp) => [fp.longitude, fp.latitude])
              : telemetryData.length >= 2
              ? telemetryData.map((pt) => [pt.longitude, pt.latitude])
              : [];

          const smoothedCoords =
            rawControlPoints.length >= 2 ? bsplineSmooth(rawControlPoints, 8) : [];

          if (smoothedCoords.length >= 2) {
            if (!map.getSource('cyber-route')) {
              map.addSource('cyber-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: smoothedCoords,
                  },
                },
              });
            }

            if (!map.getLayer('cyber-route-glow')) {
              map.addLayer({
                id: 'cyber-route-glow',
                type: 'line',
                source: 'cyber-route',
                layout: { 'line-join': 'miter', 'line-cap': 'square' },
                paint: {
                  'line-color': '#00E5FF',
                  'line-width': initialPreset.routeGlowWidth,
                  'line-opacity': initialPreset.routeGlowOpacity,
                  'line-blur': initialPreset.routeGlowBlur,
                },
              });
            }

            if (!map.getLayer('cyber-route-core')) {
              map.addLayer({
                id: 'cyber-route-core',
                type: 'line',
                source: 'cyber-route',
                layout: { 'line-join': 'miter', 'line-cap': 'square' },
                paint: {
                  'line-color': '#00E5FF',
                  'line-width': initialPreset.routeCoreWidth,
                  'line-opacity': 1.0,
                },
              });
            }
          }

          mountBrutalistMarkers(map, foodPois);
          mountTargetRadarBeacon(
            map,
            targetPoiRef.current.longitude,
            targetPoiRef.current.latitude,
            targetPoiRef.current.name
          );
        } catch (_) {}
      });

      return () => {
        isUnmounted = true;
        try {
          resizeObserver?.disconnect();
          CinematicFlightEngine.stopActiveFlight(map);
          markersRef.current.forEach((m) => m.remove());
          markersRef.current = [];
          if (newPinMarkerRef.current) {
            newPinMarkerRef.current.remove();
            newPinMarkerRef.current = null;
          }
          map.remove();
        } catch (_) {}
        mapRef.current = null;
      };
    } catch (_) {
      setUseBuiltIn3DEngine(true);
      setMapReady(true);
    }
  }, [mapboxToken, flyToFoodPoiAndRenderTag, mountTargetRadarBeacon]);

  // Built-in 60FPS 3D Globe & Tactical Street Canvas Renderer (Zero User API Keys Required)
  useEffect(() => {
    if (!useBuiltIn3DEngine || !fallbackCanvasRef.current) return;
    const canvas = fallbackCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const resizeCanvas = () => {
      if (!canvas.parentElement) return;
      canvas.width = Math.max(640, canvas.parentElement.clientWidth);
      canvas.height = Math.max(380, canvas.parentElement.clientHeight);
    };
    resizeCanvas();

    const obs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resizeCanvas)
        : null;
    if (obs && canvas.parentElement) {
      obs.observe(canvas.parentElement);
    }

    const renderFrame = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const cam = animCameraRef.current;

      // Smoothly interpolate camera towards target (simulates map.flyTo)
      cam.lng += (cam.targetLng - cam.lng) * 0.08;
      cam.lat += (cam.targetLat - cam.lat) * 0.08;
      cam.zoom += (cam.targetZoom - cam.zoom) * 0.07;
      cam.pitch += (cam.targetPitch - cam.pitch) * 0.07;
      cam.bearing += (cam.targetBearing - cam.bearing) * 0.07;

      const w = canvas.width;
      const h = canvas.height;
      const isCad = activeModeRef.current === 'CAD_3D';

      // Background Terminal Black / Deep Space
      ctx.fillStyle = '#05050A';
      ctx.fillRect(0, 0, w, h);

      // Atmospheric Cyan Horizon Halo
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      grad.addColorStop(0, isCad ? 'rgba(0, 229, 255, 0.06)' : 'rgba(0, 229, 255, 0.16)');
      grad.addColorStop(1, 'rgba(5, 5, 10, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.45);

      // Perspective 3D Ground Grid & Extruded Urban Blocks
      const horizonY = h * 0.24;
      ctx.strokeStyle = isCad ? 'rgba(0, 229, 255, 0.24)' : 'rgba(31, 31, 46, 0.9)';
      ctx.lineWidth = 1;

      const gridOffset = ((cam.lng * 10000 + elapsed * 0.4) % 1) * 48;
      for (let i = -10; i <= 10; i++) {
        const topX = w / 2 + i * 28;
        const botX = w / 2 + i * 115 - gridOffset;
        ctx.beginPath();
        ctx.moveTo(topX, horizonY);
        ctx.lineTo(botX, h);
        ctx.stroke();
      }
      for (let row = 1; row <= 9; row++) {
        const t = Math.pow(row / 9, 1.55);
        const y = horizonY + t * (h - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const cx = w / 2;
      const cy = h * 0.62;
      const activeAccent = accentColorRef.current || '#00E5FF';

      // Stage 3 Real Organic Administrative Boundary Polygon
      ctx.save();
      ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.strokeStyle = activeAccent;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();

      const boundaryFeat = globalDistrictScanRef.current?.boundaryGeoJson;
      const rawRing =
        boundaryFeat?.geometry?.type === 'Polygon'
          ? boundaryFeat.geometry.coordinates[0]
          : boundaryFeat?.geometry?.type === 'MultiPolygon'
            ? boundaryFeat.geometry.coordinates[0]?.[0]
            : null;

      if (rawRing && rawRing.length >= 4) {
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        for (const pt of rawRing) {
          if (pt[0] < minX) minX = pt[0];
          if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] < minY) minY = pt[1];
          if (pt[1] > maxY) maxY = pt[1];
        }
        const spanX = Math.max(0.005, maxX - minX);
        const spanY = Math.max(0.005, maxY - minY);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        rawRing.forEach((pt, idx) => {
          const px = cx + ((pt[0] - midX) / spanX) * 440;
          const py = cy - ((pt[1] - midY) / spanY) * 210;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      } else {
        const organicPoints: [number, number][] = [
          [-210, -75],
          [-145, -98],
          [-65, -92],
          [25, -108],
          [115, -94],
          [195, -68],
          [238, -18],
          [224, 42],
          [246, 88],
          [182, 114],
          [94, 106],
          [12, 118],
          [-84, 108],
          [-168, 115],
          [-228, 74],
          [-242, 12],
        ];
        organicPoints.forEach(([dx, dy], idx) => {
          if (idx === 0) ctx.moveTo(cx + dx, cy + dy);
          else ctx.lineTo(cx + dx, cy + dy);
        });
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Stage 4 Enhanced 3D Building Extrusions (#0D1017 base with #1A233A building tops)
      const blocks = [
        { dx: -190, dy: 40, bw: 54, bh: 68 },
        { dx: -115, dy: -20, bw: 48, bh: 92 },
        { dx: 95, dy: -15, bw: 62, bh: 84 },
        { dx: 175, dy: 45, bw: 52, bh: 64 },
        { dx: -65, dy: 70, bw: 44, bh: 52 },
        { dx: 60, dy: 78, bw: 50, bh: 58 },
      ];

      blocks.forEach((b) => {
        const bx = cx + b.dx;
        const by = cy + b.dy;
        const roofOffset = b.bh * (cam.pitch / 72);
        const topY = by - roofOffset;
        const bGrad = ctx.createLinearGradient(bx, topY, bx, topY + b.bh);
        bGrad.addColorStop(0, '#1A233A');
        bGrad.addColorStop(1, '#0D1017');
        ctx.fillStyle = bGrad;
        ctx.strokeStyle = isCad ? 'rgba(0, 229, 255, 0.55)' : 'rgba(31, 31, 46, 1)';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, topY, b.bw, b.bh);
        ctx.strokeRect(bx, topY, b.bw, b.bh);
      });

      // Spatial Coaxial Laser Route (Dynamic Brand Accent Color: 12px outer glow + 2.5px core stream)
      // Rendered when foodPois >= 2 or fallback route is present
      const poisCount = foodPois.length;
      if (poisCount >= 2 || telemetryData.length >= 2) {
        ctx.save();
        ctx.strokeStyle = activeAccent;
        ctx.globalAlpha = 0.26;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(cx - 240, cy + 95);
        ctx.lineTo(cx - 95, cy + 35);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + 145, cy - 45);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = activeAccent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 240, cy + 95);
        ctx.lineTo(cx - 95, cy + 35);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + 145, cy - 45);
        ctx.stroke();
        ctx.restore();
      }

      // Stage 4 Pulsing Neon Venue Beacon: Ground Radar Rings + Vertical Cyan Laser Column
      const pulsePhase1 = (elapsed * 0.85) % 1;
      const pulsePhase2 = (elapsed * 0.85 + 0.5) % 1;

      [pulsePhase1, pulsePhase2].forEach((phase) => {
        const radius = 10 + phase * 38;
        ctx.save();
        ctx.strokeStyle = '#00E5FF';
        ctx.fillStyle = `rgba(0, 229, 255, ${(1 - phase) * 0.22})`;
        ctx.globalAlpha = 1 - phase;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // Vertical Cyan Laser Light Column extending upwards from venue pin
      const laserHeight = 115;
      ctx.save();
      const laserGlow = ctx.createLinearGradient(cx, cy - laserHeight, cx, cy);
      laserGlow.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
      laserGlow.addColorStop(0.65, '#00E5FF');
      laserGlow.addColorStop(1, '#FFFFFF');
      ctx.strokeStyle = laserGlow;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - laserHeight);
      ctx.stroke();
      ctx.restore();

      // Center Pin Lock Core
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 4, cy - 4, 8, 8);
      ctx.strokeRect(cx - 4, cy - 4, 8, 8);

      // Render Stage 4 HUD Label: [ 📍 TARGET LOCKED // <VENUE_NAME_UPPERCASE> ]
      const activePoiTarget = targetPoiRef.current;
      const venueUpper = (activePoiTarget.name || 'FOOD_POI').toUpperCase();
      const fullTag = `[ 📍 TARGET LOCKED // ${venueUpper} ]`;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(fullTag).width;
      const boxW = textWidth + 24;
      const boxH = 28;
      const boxX = cx - boxW / 2;
      const boxY = cy - laserHeight - boxH - 4;

      ctx.fillStyle = '#05050A';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#00E5FF';
      const prefix = '[ 📍 TARGET LOCKED // ';
      ctx.fillText(prefix, boxX + 12, boxY + 18);
      const prefixW = ctx.measureText(prefix).width;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(venueUpper, boxX + 12 + prefixW, boxY + 18);
      const venueW = ctx.measureText(venueUpper).width;
      ctx.fillStyle = '#00E5FF';
      ctx.fillText(' ]', boxX + 12 + prefixW + venueW, boxY + 18);

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      obs?.disconnect();
    };
  }, [useBuiltIn3DEngine]);

  // Live GeoJSON LineString update for Coaxial Laser Route with B-Spline Path Smoothing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      const rawControlPoints: CoordinatePoint[] =
        foodPois.length >= 2
          ? foodPois.map((fp) => [fp.longitude, fp.latitude])
          : telemetryData.length >= 2
          ? telemetryData.map((pt) => [pt.longitude, pt.latitude])
          : [];

      const smoothedCoords =
        rawControlPoints.length >= 2 ? bsplineSmooth(rawControlPoints, 8) : [];

      if (smoothedCoords.length >= 2) {
        let src = map.getSource('cyber-route') as mapboxgl.GeoJSONSource | undefined;
        if (!src) {
          map.addSource('cyber-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: smoothedCoords,
              },
            },
          });
          src = map.getSource('cyber-route') as mapboxgl.GeoJSONSource | undefined;
        } else {
          src.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: smoothedCoords,
            },
          });
        }

        const preset = MapModeController.getPreset(activeModeRef.current || 'DEM_3D');
        const activeAccent = accentColorRef.current || '#00E5FF';

        if (!map.getLayer('cyber-route-glow')) {
          map.addLayer({
            id: 'cyber-route-glow',
            type: 'line',
            source: 'cyber-route',
            layout: { 'line-join': 'miter', 'line-cap': 'square' },
            paint: {
              'line-color': activeAccent,
              'line-width': preset.routeGlowWidth,
              'line-opacity': preset.routeGlowOpacity,
              'line-blur': preset.routeGlowBlur,
            },
          });
        }

        if (!map.getLayer('cyber-route-core')) {
          map.addLayer({
            id: 'cyber-route-core',
            type: 'line',
            source: 'cyber-route',
            layout: { 'line-join': 'miter', 'line-cap': 'square' },
            paint: {
              'line-color': activeAccent,
              'line-width': preset.routeCoreWidth,
              'line-opacity': 1.0,
            },
          });
        }
      } else {
        // If < 2 POIs, clear route line coordinates if source exists
        const src = map.getSource('cyber-route') as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [],
            },
          });
        }
      }
    } catch (_) {}
  }, [telemetryData, foodPois, mapReady, activeMode]);

  // Keep Brutalist [ 01 // POI ] HTML markers synced
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      mountBrutalistMarkers(map, foodPois);
    } catch (_) {}
  }, [foodPois, activePoi, mapReady, mountBrutalistMarkers]);

  // Sync activePoi changes from parent list
  useEffect(() => {
    if (!activePoi) return;
    setSelectedSearchPoi(null);
    animCameraRef.current.targetLng = activePoi.longitude;
    animCameraRef.current.targetLat = activePoi.latitude;
    animCameraRef.current.targetZoom = 17.5;
    animCameraRef.current.targetPitch = 72;
    animCameraRef.current.targetBearing = 40;

    if (!mapReady || isRecordingRef.current) return;
    if (mapRef.current) {
      runCinematicSequence(false);
    }
  }, [
    activePoi?.poi_id,
    activePoi?.latitude,
    activePoi?.longitude,
    autoTriggerKey,
    mapReady,
    runCinematicSequence,
  ]);

  const handleSelectSearchLocation = (result: GeocodedPoiResult) => {
    const [lng, lat] = result.coordinates || [result.longitude, result.latitude];
    setActiveMapCenter([lng, lat]);
    flyToFoodPoiAndRenderTag(
      lng,
      lat,
      result.name,
      result.address || result.fullAddress
    );
    setCameraTelemetry({
      zoom: 17.5,
      pitch: 72,
      bearing: 40,
    });
  };

  return (
    <div className="w-full max-w-full overflow-hidden bg-[#05050A] border border-[#1F1F2E] flex flex-col rounded-none">
      {/* Search Terminal */}
      <div className="bg-[#0D0E17] border-b border-[#1F1F2E] px-3 py-2.5 rounded-none">
        <PoiSearchBox
          onSelectLocation={handleSelectSearchLocation}
          mapCenterLngLat={activeMapCenter}
          language={language}
          compact={true}
        />
      </div>

      {/* Primary 80% Screen Estate 3D Mapbox Viewport */}
      <div
        className={`relative w-full ${
          compactMode ? 'h-[440px]' : 'h-[78vh] min-h-[560px]'
        } overflow-hidden bg-[#05050A] rounded-none`}
      >
        <div
          ref={mapContainer}
          className={`absolute inset-0 w-full h-full ${
            useBuiltIn3DEngine ? 'hidden' : 'block'
          }`}
        />

        {useBuiltIn3DEngine && (
          <canvas
            ref={fallbackCanvasRef}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
              const relY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
              const baseLng = targetDisplayPoi.longitude;
              const baseLat = targetDisplayPoi.latitude;
              const clickedLng = Number((baseLng + relX * 0.012).toFixed(6));
              const clickedLat = Number((baseLat - relY * 0.012).toFixed(6));
              flyToFoodPoiAndRenderTag(clickedLng, clickedLat, 'MAP_CLICK_POI');
            }}
            className="absolute inset-0 w-full h-full cursor-crosshair block"
          />
        )}

        {/* Map Viewport Overlays */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Top-Left Active Target Readout */}
          <div className="absolute top-3 left-3 bg-[#0D0E17]/90 backdrop-blur-md border border-[#1F1F2E] px-3 py-1.5 flex items-center gap-2 font-mono text-xs pointer-events-auto rounded-none">
            <Globe2 className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="font-bold text-white uppercase tracking-tight">
              {targetDisplayPoi.name}
            </span>
            <span className="text-[#8A8FA3] hidden sm:inline">
              // {globalDistrictScan.hudReadout || 'District 1, Ben Thanh'}
            </span>
          </div>

          {/* Toolbar Pinned to Top-Right of Map Canvas */}
          <div className="absolute top-3 right-3 pointer-events-auto">
            <div className="flex items-center gap-3 bg-[#05050A]/90 p-1.5 border border-[#1F1F2E] backdrop-blur-md">
              {/* CỤM 1: VIEWPORT MODE SELECTOR (Segmented Controls) */}
              <div className="flex items-center border border-[#1F1F2E]">
                <button
                  onClick={() => setMapMode('terrain')}
                  className={`px-3 py-1.5 font-mono text-xs flex items-center gap-1.5 transition-colors ${
                    mapMode === 'terrain'
                      ? 'bg-[#00E5FF]/10 text-[#00E5FF] border-r border-[#00E5FF]'
                      : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white border-r border-[#1F1F2E]'
                  }`}
                >
                  <span className="text-[10px]">{mapMode === 'terrain' ? '●' : '○'}</span>
                  [3D TERRAIN]
                </button>

                <button
                  onClick={() => setMapMode('cad')}
                  className={`px-3 py-1.5 font-mono text-xs flex items-center gap-1.5 transition-colors ${
                    mapMode === 'cad'
                      ? 'bg-[#00E5FF]/10 text-[#00E5FF] border-r border-[#00E5FF]'
                      : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white border-r border-[#1F1F2E]'
                  }`}
                >
                  <span className="text-[10px]">⏣</span>
                  [VOLUMETRIC CAD]
                </button>

                <button
                  onClick={() => setMapMode('orbit')}
                  className={`px-3 py-1.5 font-mono text-xs flex items-center gap-1.5 transition-colors ${
                    mapMode === 'orbit'
                      ? 'bg-[#00E5FF]/10 text-[#00E5FF] border-r border-[#00E5FF]'
                      : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white border-r border-[#1F1F2E]'
                  }`}
                >
                  <span className="text-[10px]">◎</span>
                  [ORBIT VIEW]
                </button>

                <button
                  onClick={() => setMapMode('flyover')}
                  className={`px-3 py-1.5 font-mono text-xs flex items-center gap-1.5 transition-colors ${
                    mapMode === 'flyover'
                      ? 'bg-[#00E5FF]/10 text-[#00E5FF]'
                      : 'bg-[#0D0E17] text-[#8A8FA3] hover:text-white'
                  }`}
                >
                  <span className="text-[10px]">▲</span>
                  [FLYOVER]
                </button>
              </div>

              {/* ĐƯỜNG CHIA KỸ THUẬT 1PX */}
              <div className="h-5 w-[1px] bg-[#2D2D44]" />

              {/* CỤM 2: MASTER CTA TRIGGER (Luôn nổi bật với vệt cắt 45 độ & subtle glowing cyan border & shadow) */}
              <button
                onClick={triggerRenderEngine}
                className="group relative px-4 py-1.5 bg-[#5322FF] text-white font-mono text-xs font-semibold tracking-wider flex items-center gap-2 border border-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.35)] hover:bg-[#00E5FF] hover:text-[#05050A] hover:shadow-[0_0_16px_rgba(0,229,255,0.5)] transition-all duration-150"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                }}
              >
                <span className="w-1.5 h-1.5 bg-[#00FF66] animate-pulse group-hover:bg-[#05050A]" />
                <span>&gt; RENDER 60FPS VIDEO</span>
                <span className="text-[10px] text-[#00E5FF] group-hover:text-[#05050A] opacity-80">[4K]</span>
              </button>
            </div>
          </div>

          {/* Active Venue Target Lock HUD Label (Bottom-Left) */}
          <div className="absolute bottom-3 left-3 bg-[#0D0E17]/95 border border-[#00E5FF]/60 px-3 py-1.5 flex items-center gap-1.5 font-mono text-xs font-bold pointer-events-auto rounded-none shadow-[0_0_12px_rgba(0,229,255,0.2)]">
            <span className="text-[#00E5FF]">[ 📍 TARGET LOCKED //</span>
            <span className="text-white">{targetDisplayPoi.name.toUpperCase()}</span>
            <span className="text-[#00E5FF]">]</span>
          </div>

          {/* Consolidated Bottom-Center Chiseled 45° "Pin POI" Action Button */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                if (onOpenPinModal) {
                  onOpenPinModal();
                } else {
                  window.dispatchEvent(new Event('vibepath_open_pin_drawer'));
                }
              }}
              style={{
                clipPath:
                  'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
              }}
              className="min-h-[40px] px-5 bg-[#0D0E17] border border-[#00E5FF] text-white hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_14px_rgba(0,229,255,0.35)] font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-2 cursor-pointer transition-all rounded-none whitespace-nowrap"
            >
              <MapPin className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span>[ + PIN POI ]</span>
            </button>
          </div>

          {/* Interactive Pinned Food POIs Selector Strip (Bottom-Right) */}
          <div className="absolute bottom-3 right-3 hidden lg:flex flex-wrap items-center gap-1.5 pointer-events-auto max-w-[36%] justify-end">
            {foodPois.slice(0, 3).map((poi, idx) => {
              const code = String(idx + 1).padStart(2, '0');
              const isSelected =
                !selectedSearchPoi &&
                activePoi &&
                ((activePoi.poi_id && activePoi.poi_id === poi.poi_id) ||
                  (Math.abs(activePoi.latitude - poi.latitude) < 0.0001 &&
                    Math.abs(activePoi.longitude - poi.longitude) < 0.0001));
              return (
                <button
                  key={poi.poi_id || `${poi.name}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedSearchPoi(null);
                    flyToFoodPoiAndRenderTag(poi.longitude, poi.latitude, poi.name);
                    if (onSelectNode && allNodes.length > 0) {
                      const matched = allNodes.find(
                        (n) =>
                          n.id === poi.poi_id ||
                          (Math.abs(n.latitude - poi.latitude) < 0.0002 &&
                            Math.abs(n.longitude - poi.longitude) < 0.0002)
                      );
                      if (matched) onSelectNode(matched);
                    }
                  }}
                  className={`min-h-[30px] px-2.5 py-1 bg-[#0D0E17] border font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all rounded-none ${
                    isSelected
                      ? 'border-[#00E5FF] text-white'
                      : 'border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white'
                  }`}
                >
                  <span className="text-[#00E5FF]">[{code}]</span>
                  <span className="truncate max-w-[110px]">{poi.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
