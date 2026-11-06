import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ApiKeyManager } from '../services/apiKeyManager';
import { MapModeController, UnifiedMapMode } from '../services/mapModeController';
import {
  CinematicFlightEngine,
  FlightStageUpdate,
  GlobalDistrictResolution,
  GLOBAL_BOUNDARIES_SOURCE_ID,
  GLOBAL_DISTRICT_FILL_LAYER_ID,
  GLOBAL_DISTRICT_STROKE_LAYER_ID,
} from '../services/cinematicFlightEngine';
import { PoiSearchBox, GeocodedPoiResult } from './PoiSearchBox';
import {
  CulinaryNode,
  RouteWaypoint,
  LanguageCode,
  LegoGraphicStyleKey,
} from '../data/vibePathData';
import {
  Globe2,
  KeyRound,
  Rocket,
  ShieldAlert,
  CheckCircle2,
  Compass,
  Crosshair,
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
  language?: LanguageCode;
  autoTriggerKey?: number;
  compactMode?: boolean;
  activeStyle?: LegoGraphicStyleKey;
  onStyleChange?: (style: LegoGraphicStyleKey) => void;
  onOpenSettings?: () => void;
}

/**
 * Validate Mapbox GL v3 Public Access Token before WebGL initialization
 * Prevents placeholder tokens (e.g. pk.eyJ1xxxx...) or empty strings from crashing WebGL
 */
function validateMapboxToken(rawToken: string): { valid: boolean; reason?: string } {
  const trimmed = (rawToken || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      reason: 'MISSING_TOKEN // NO_VITE_MAPBOX_TOKEN_OR_BYOK_CONFIGURED',
    };
  }
  if (!trimmed.startsWith('pk.')) {
    return {
      valid: false,
      reason: 'INVALID_PREFIX // MAPBOX_PUBLIC_TOKEN_MUST_START_WITH_PK.',
    };
  }
  if (trimmed.includes('xxxxxxxx')) {
    return {
      valid: false,
      reason: 'PLACEHOLDER_TOKEN // REPLACE_PK.EYJ1XXXX_WITH_LIVE_MAPBOX_KEY',
    };
  }
  if (trimmed.length < 32) {
    return {
      valid: false,
      reason: 'MALFORMED_TOKEN // TOKEN_LENGTH_BELOW_MINIMUM_SPEC',
    };
  }
  return { valid: true };
}

export const CyberGlobe3D: React.FC<CyberGlobe3DProps> = ({
  telemetryData,
  foodPois,
  activePoi,
  allNodes = [],
  onSelectNode,
  onPickCoordinate,
  onAddPoiFromMap,
  language = 'vi',
  autoTriggerKey = 0,
  compactMode = false,
  onOpenSettings,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const newPinMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Unified Map Mode State (DEM_3D vs CAD_3D) on a single persistent Mapbox GL v3 instance
  const [activeMode, setActiveMode] = useState<UnifiedMapMode>('DEM_3D');
  const activeModeRef = useRef<UnifiedMapMode>('DEM_3D');

  // Interactive Click-to-Pin / Search Target Pin State ([ NEW // POI ])
  const [droppedNewPin, setDroppedNewPin] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);

  // Global Administrative Boundary HUD Readout State
  // Format: [ GLOBAL_DISTRICT_SCAN // <DISTRICT_NAME>, <COUNTRY_CODE> ]
  const [globalDistrictScan, setGlobalDistrictScan] =
    useState<GlobalDistrictResolution>({
      mapboxId: 'dXJuOm1ieGJuZDo2ODg0Njp2NA',
      districtName: 'DISTRICT 1',
      countryCode: 'VN',
      hudReadout: '[ GLOBAL_DISTRICT_SCAN // DISTRICT 1, VN ]',
    });

  // 4-Stage Cinematic Flight & 60FPS Video Recorder Status
  const [flightStatus, setFlightStatus] = useState<FlightStageUpdate | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    return ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
  });
  const [inlineTokenInput, setInlineTokenInput] = useState<string>('');
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{
    code: string;
    detail: string;
  } | null>(null);
  const [cameraTelemetry, setCameraTelemetry] = useState<{
    zoom: number;
    pitch: number;
    bearing: number;
  }>({
    zoom: 1.8,
    pitch: 0,
    bearing: 0,
  });

  const targetDisplayPoi: FoodPOI = droppedNewPin
    ? {
        poi_id: 'poi-dropped-new',
        name: droppedNewPin.label,
        latitude: droppedNewPin.latitude,
        longitude: droppedNewPin.longitude,
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

  // Listen for BYOK token updates across the app
  useEffect(() => {
    const handleKeysUpdated = () => {
      const updatedToken =
        ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
      setMapboxToken(updatedToken);
    };
    window.addEventListener('vibepath_apikeys_updated', handleKeysUpdated);
    return () => window.removeEventListener('vibepath_apikeys_updated', handleKeysUpdated);
  }, []);

  // Resolve and illuminate Global Administrative Boundary whenever target coordinates change
  useEffect(() => {
    let cancelled = false;
    CinematicFlightEngine.resolveGlobalDistrict(
      mapRef.current,
      targetDisplayPoi.longitude,
      targetDisplayPoi.latitude
    ).then((res) => {
      if (cancelled) return;
      setGlobalDistrictScan(res);
      if (mapRef.current && mapReady) {
        CinematicFlightEngine.applyGlobalDistrictBoundaryFilter(
          mapRef.current,
          targetDisplayPoi.longitude,
          targetDisplayPoi.latitude,
          res
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [targetDisplayPoi.longitude, targetDisplayPoi.latitude, mapReady]);

  /**
   * Drop [ NEW // POI ] Marker HUD tag on the 3D map, resolve global district boundary, and align camera
   */
  const dropNewPoiMarkerAndAlignCamera = useCallback(
    (lng: number, lat: number, customLabel?: string, flyFromOrbit = false) => {
      const cleanLng = Number(lng.toFixed(6));
      const cleanLat = Number(lat.toFixed(6));
      const displayLabel = (customLabel || 'NEW_TARGET_PIN').toUpperCase();

      setDroppedNewPin({
        latitude: cleanLat,
        longitude: cleanLng,
        label: displayLabel,
      });

      if (onPickCoordinateRef.current) {
        onPickCoordinateRef.current(cleanLat, cleanLng);
      }
      if (onAddPoiFromMapRef.current) {
        onAddPoiFromMapRef.current({
          longitude: cleanLng,
          latitude: cleanLat,
          name: customLabel,
        });
      }

      const map = mapRef.current;

      // Resolve Global Administrative Boundary for the clicked/searched point
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
        if (newPinMarkerRef.current) {
          newPinMarkerRef.current.remove();
          newPinMarkerRef.current = null;
        }

        const el = document.createElement('div');
        el.className = 'cyber-new-poi-tag';
        el.innerHTML = `
          <div style="
            background: #080A0F;
            border: 1px solid #00E676;
            color: #00E676;
            padding: 5px 10px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            border-radius: 0px !important;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            user-select: none;
            box-shadow: 0 0 0 1px #00E5FF;
          ">
            <span style="color: #00E676;">[ NEW // POI ]</span>
            <span style="color: #FFFFFF;">${displayLabel}</span>
            <span style="color: #00E5FF;">(${cleanLat.toFixed(4)}°N, ${cleanLng.toFixed(4)}°E)</span>
          </div>
        `;

        newPinMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([cleanLng, cleanLat])
          .addTo(map);

        if (flyFromOrbit) {
          map.flyTo({
            center: [cleanLng, cleanLat],
            zoom: 17.2,
            pitch: 72,
            bearing: 40,
            speed: 1.35,
            curve: 1.4,
            essential: true,
          });
        } else {
          map.easeTo({
            center: [cleanLng, cleanLat],
            zoom: Math.max(map.getZoom(), 16.5),
            pitch: 72,
            bearing: 40,
            duration: 1400,
            essential: true,
          });
        }
      } catch (_) {}
    },
    []
  );

  /**
   * Execute 4-Stage Cinematic Flight Sequence (with optional 1-click 60FPS video export)
   */
  const runCinematicSequence = useCallback(
    (recordVideo: boolean, customTripName?: string, overrideTarget?: FoodPOI) => {
      const target = overrideTarget || targetPoiRef.current;
      const resolvedTripName = customTripName || 'SAIGON_NIGHT_CULINARY_NODE_01';
      isRecordingRef.current = recordVideo;

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
          if (update.globalDistrictInfo) {
            setGlobalDistrictScan(update.globalDistrictInfo);
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
    []
  );

  // Listen for global [ 🎬 1-CLICK CINEMATIC RENDER ] trigger from SwissBrutalistHUD or EditorStudioTab
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

  /**
   * 3. Brutalist Marker HUD Injection:
   * Zero-radius HTML marker (border-radius: 0px !important, background #080A0F, 1px border #00E5FF)
   * Formatted as: [ 01 // POI ] <NAME_IN_UPPERCASE>
   */
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

  // Single Persistent Native Mapbox GL JS v3 WebGL Instance (only re-runs if mapboxToken changes)
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

    setMapReady(false);

    const resolvedToken =
      mapboxToken || ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';

    const tokenCheck = validateMapboxToken(resolvedToken);
    if (!tokenCheck.valid) {
      setErrorBanner({
        code: '[ ERR_MAPBOX_TOKEN // VALIDATION_GUARD ]',
        detail:
          tokenCheck.reason ||
          'MAPBOX_PUBLIC_TOKEN_REQUIRED // PROVIDE_PK.EYJ_KEY_VIA_BYOK_OR_ENV',
      });
      return;
    }

    if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) {
      setErrorBanner({
        code: '[ ERR_WEBGL_UNSUPPORTED // HARDWARE_CONTEXT_FAILED ]',
        detail: 'WEBGL2_RENDERING_CONTEXT_UNAVAILABLE_ON_THIS_DEVICE',
      });
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

      // 1. Initialize Single Persistent 3D Globe with WebGL Buffer Retention (preserveDrawingBuffer: true)
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        preserveDrawingBuffer: true, // CRITICAL: Prevents blank/black frames during MediaRecorder capture
        projection: 'globe',
        center: [startLng, startLat],
        zoom: 1.8,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });

      mapRef.current = map;

      // 💥 ĐIỂM CỐT LÕI 1: Ép Mapbox resize ngay sau khi nạp xong style/layout
      map.on('load', () => {
        window.setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize();
          }
        }, 100);
      });

      // 💥 ĐIỂM CỐT LÕI 2: Đăng ký ResizeObserver theo dõi kích thước container liên tục
      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              if (mapRef.current) {
                mapRef.current.resize();
              }
            })
          : null;

      if (resizeObserver && mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }

      map.on('error', (event: any) => {
        if (isUnmounted) return;
        const sourceId = String(event?.sourceId || '');
        // Ignore tileset-entitlement warnings on enterprise boundaries-adm2-v4 so base 3D globe continues
        if (sourceId === GLOBAL_BOUNDARIES_SOURCE_ID) {
          return;
        }
        const status = event?.error?.status;
        const msg = String(event?.error?.message || '');
        if (
          status === 401 ||
          (status === 403 && !msg.includes('boundaries-adm2')) ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('access token')
        ) {
          setMapReady(false);
          setErrorBanner({
            code: `[ ERR_MAPBOX_AUTH_${status || 401} // TOKEN_REJECTED ]`,
            detail:
              msg ||
              'MAPBOX_API_REJECTED_ACCESS_TOKEN // CONFIGURE_VALID_PK.EYJ_KEY_IN_BYOK',
          });
        }
      });

      map.on('move', () => {
        if (isUnmounted || !mapRef.current) return;
        setCameraTelemetry({
          zoom: Number(mapRef.current.getZoom().toFixed(2)),
          pitch: Math.round(mapRef.current.getPitch()),
          bearing: Math.round(mapRef.current.getBearing()),
        });
      });

      // 2. Interactive Map Click-To-Pin Listener:
      // Drops [ NEW // POI ] Marker HUD tag and triggers camera alignment
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        dropNewPoiMarkerAndAlignCamera(lng, lat, 'MAP_CLICK_TARGET', false);
      });

      map.on('style.load', () => {
        if (isUnmounted) return;
        try {
          setErrorBanner(null);
          setMapReady(true);

          const initialPreset = MapModeController.getPreset(activeModeRef.current);

          // Atmospheric Cyan Halo Shader
          map.setFog(initialPreset.fog);

          // 1a. 3D Terrain (DEM): raster-dem source mapbox://mapbox.mapbox-terrain-dem-v1
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

          // 1b. Global Administrative Boundaries Vector Tileset (mapbox://mapbox.boundaries-adm2-v4)
          try {
            if (!map.getSource(GLOBAL_BOUNDARIES_SOURCE_ID)) {
              map.addSource(GLOBAL_BOUNDARIES_SOURCE_ID, {
                type: 'vector',
                url: 'mapbox://mapbox.boundaries-adm2-v4',
              });
            }

            if (!map.getLayer(GLOBAL_DISTRICT_FILL_LAYER_ID)) {
              map.addLayer({
                id: GLOBAL_DISTRICT_FILL_LAYER_ID,
                type: 'fill',
                source: GLOBAL_BOUNDARIES_SOURCE_ID,
                'source-layer': 'boundaries_admin_2',
                filter: ['==', ['get', 'mapbox_id'], '__NONE__'],
                paint: {
                  'fill-color': '#00E5FF',
                  'fill-opacity': 0.12,
                },
              });
            }

            if (!map.getLayer(GLOBAL_DISTRICT_STROKE_LAYER_ID)) {
              map.addLayer({
                id: GLOBAL_DISTRICT_STROKE_LAYER_ID,
                type: 'line',
                source: GLOBAL_BOUNDARIES_SOURCE_ID,
                'source-layer': 'boundaries_admin_2',
                filter: ['==', ['get', 'mapbox_id'], '__NONE__'],
                paint: {
                  'line-color': '#00E5FF',
                  'line-width': 2,
                  'line-dasharray': [3, 1.5],
                },
              });
            }
          } catch (_) {}

          // 1c. 3D Building Extrusions: fill-extrusion layer mapped to composite/building
          const layers = map.getStyle()?.layers;
          const labelLayerId = layers?.find(
            (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
          )?.id;

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
                  'fill-extrusion-color': initialPreset.buildingColor,
                  'fill-extrusion-height': ['get', 'height'],
                  'fill-extrusion-base': ['get', 'min_height'],
                  'fill-extrusion-opacity': initialPreset.buildingOpacity,
                },
              },
              labelLayerId
            );
          }

          // Optional CAD Wireframe Footprint Layer toggled in-place by MapModeController.switchMode
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

          // 2. Spatial Coaxial Laser Route (#00E5FF) rendered directly inside Mapbox WebGL layers
          const routeCoords =
            telemetryData.length >= 2
              ? telemetryData.map((pt) => [pt.longitude, pt.latitude])
              : foodPois.map((fp) => [fp.longitude, fp.latitude]);

          if (routeCoords.length >= 2) {
            if (!map.getSource('cyber-route')) {
              map.addSource('cyber-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: routeCoords,
                  },
                },
              });
            }

            // Outer Glow Layer: line-color #00E5FF, line-width 12, line-opacity 0.2, line-blur 6
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

            // Core Laser Stream: line-color #00E5FF, line-width 2.5, line-opacity 1.0
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

          // 3. Inject Zero-Radius Brutalist HTML Markers: [ 01 // POI ] <NAME_IN_UPPERCASE>
          mountBrutalistMarkers(map, foodPois);
        } catch (layerErr: any) {
          setErrorBanner({
            code: '[ ERR_WEBGL_LAYER_INIT // STYLE_LOAD_SAFEGUARD ]',
            detail: String(layerErr?.message || 'FAILED_TO_BIND_3D_TERRAIN_OR_EXTRUSION'),
          });
        }
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
    } catch (initErr: any) {
      setMapReady(false);
      setErrorBanner({
        code: '[ ERR_MAPBOX_INIT_EXCEPTION // TRY_CATCH_SAFEGUARD ]',
        detail: String(
          initErr?.message || 'UNABLE_TO_INITIALIZE_MAPBOX_GL_V3_WEBGL_CONTEXT'
        ),
      });
    }
  }, [mapboxToken, dropNewPoiMarkerAndAlignCamera]);

  // Live GeoJSON LineString update for Coaxial Laser Route without recreating map or interrupting camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      const routeCoords =
        telemetryData.length >= 2
          ? telemetryData.map((pt) => [pt.longitude, pt.latitude])
          : foodPois.map((fp) => [fp.longitude, fp.latitude]);

      if (routeCoords.length >= 2) {
        const src = map.getSource('cyber-route') as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoords,
            },
          });
        }
      }
    } catch (_) {}
  }, [telemetryData, foodPois, mapReady]);

  // Keep Brutalist [ 01 // POI ] HTML markers synced when POIs or active selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      mountBrutalistMarkers(map, foodPois);
    } catch (_) {}
  }, [foodPois, activePoi, mapReady, mountBrutalistMarkers]);

  // Trigger 4-Stage Flight Sequence (without video recording) when active POI or autoTriggerKey changes,
  // unless an active 60FPS video export recording is already in progress.
  useEffect(() => {
    if (!mapReady || !activePoi) return;
    if (isRecordingRef.current) return;
    runCinematicSequence(false);
  }, [
    activePoi?.poi_id,
    activePoi?.latitude,
    activePoi?.longitude,
    autoTriggerKey,
    mapReady,
    runCinematicSequence,
  ]);

  const handleApplyInlineToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inlineTokenInput.trim();
    if (!cleaned) return;
    ApiKeyManager.saveKeys({ mapKey: cleaned });
    setMapboxToken(cleaned);
    setInlineTokenInput('');
  };

  /**
   * Handle selection from PoiSearchBox inside the 3D Map HUD:
   * Places [ NEW // POI ] marker, resolves global district boundary, and flies the 3D camera
   */
  const handleSelectSearchLocation = (result: GeocodedPoiResult) => {
    dropNewPoiMarkerAndAlignCamera(result.longitude, result.latitude, result.name, true);
    runCinematicSequence(false, undefined, {
      poi_id: result.id,
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      rating: 5,
    });
  };

  const currentHudReadout = MapModeController.getHudReadout(activeMode);
  const lockReadoutTag =
    flightStatus?.hudLockTag ||
    `[ 3D LOCK // ${targetDisplayPoi.latitude.toFixed(4)}°N, ${targetDisplayPoi.longitude.toFixed(4)}°E ]`;
  const activeDistrictReadout =
    flightStatus?.globalDistrictScanTag || globalDistrictScan.hudReadout;

  return (
    <div className="w-full max-w-full overflow-hidden bg-[#080A0F] border border-[#1F1F2E] flex flex-col">
      {/* Top Cybernetic Swiss Brutalist Telemetry Header + Unified Map Mode Controller */}
      <div className="bg-[#0D1017] border-b border-[#1F1F2E] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Globe2 className="w-4 h-4 text-[#00E5FF] shrink-0" />
          <span className="text-[10px] sm:text-xs font-bold text-[#00E5FF] tracking-wider truncate">
            {currentHudReadout}
          </span>
          <span className="text-[10px] font-bold text-[#00E676] bg-[#080A0F] border border-[#00E5FF] px-2 py-0.5 truncate">
            {activeDistrictReadout}
          </span>
        </div>

        {/* Instantaneous (< 50ms) Mode Switcher Controls on Persistent Mapbox Instance */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSwitchMode('DEM_3D')}
            className={`min-h-[30px] px-2.5 border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              activeMode === 'DEM_3D'
                ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8] hover:text-[#FFFFFF] hover:border-[#00E5FF]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>[ MAPBOX DEM 3D ]</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode('CAD_3D')}
            className={`min-h-[30px] px-2.5 border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              activeMode === 'CAD_3D'
                ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8] hover:text-[#FFFFFF] hover:border-[#00E5FF]'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" />
            <span>[ VOLUMETRIC CAD 3D ]</span>
          </button>

          <span className="text-[10px] text-[#9BA8B8] px-2 py-1 bg-[#080A0F] border border-[#1F1F2E]">
            [ Z:{cameraTelemetry.zoom} // P:{cameraTelemetry.pitch}° // B:{cameraTelemetry.bearing}° ]
          </span>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[30px] px-2.5 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <KeyRound className="w-3 h-3 shrink-0" />
              <span>[ BYOK_KEY ]</span>
            </button>
          )}
        </div>
      </div>

      {/* Integrated Smart POI Autocomplete Search Bar (PoiSearchBox.tsx) */}
      <div className="bg-[#0D1017] border-b border-[#1F1F2E] px-3 py-2.5">
        <PoiSearchBox
          onSelectLocation={handleSelectSearchLocation}
          language={language}
          compact={compactMode}
        />
      </div>

      {/* Main Viewport: Chuẩn hóa Khung Div Container (relative + absolute inset-0 w-full h-full) */}
      <div
        className={`relative w-full ${
          compactMode ? 'h-[420px]' : 'h-[72vh] min-h-[520px]'
        } overflow-hidden bg-[#080A0F]`}
      >
        {/* Canvas Mapbox nằm tuyệt đối tràn 100% khung hình */}
        <div
          ref={mapContainer}
          className={`absolute inset-0 w-full h-full ${errorBanner ? 'hidden' : 'block'}`}
        />

        {/* Các thẻ HUD nằm lớp trên z-index */}
        {!errorBanner && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Top-Left Live 4-Stage Flight Progress & Global District Scan HUD Overlay */}
            {flightStatus && (
              <div className="absolute top-3 left-3 max-w-[92%] bg-[#080A0F]/95 border border-[#00E5FF] px-3 py-2 flex flex-col gap-1 pointer-events-none">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  <span
                    className={`px-1.5 py-0.5 ${
                      flightStatus.isRecording
                        ? 'bg-[#00E676] text-[#080A0F]'
                        : 'bg-[#00E5FF] text-[#080A0F]'
                    }`}
                  >
                    {flightStatus.isRecording
                      ? `🔴 REC 60FPS · STAGE ${flightStatus.stageNumber}/4`
                      : `STAGE ${flightStatus.stageNumber}/4`}
                  </span>
                  <span className="text-[#00E5FF] truncate">{flightStatus.label}</span>
                </div>
                <div className="text-[10px] font-bold text-[#00E5FF]">
                  {activeDistrictReadout}
                </div>
                {flightStatus.hudLockTag && (
                  <div className="text-[11px] font-extrabold text-[#00E676] tracking-wider">
                    {flightStatus.hudLockTag}
                  </div>
                )}
              </div>
            )}

            {/* Active Dropped [ NEW // POI ] HUD Tag Indicator */}
            {droppedNewPin && (
              <div className="absolute bottom-3 left-3 bg-[#080A0F]/95 border border-[#00E676] px-3 py-1.5 flex flex-wrap items-center gap-2 text-[10px] font-mono-brand font-bold pointer-events-auto">
                <MapPin className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                <span className="text-[#00E676]">[ NEW // POI ]</span>
                <span className="text-[#FFFFFF]">{droppedNewPin.label}</span>
                <span className="text-[#00E5FF]">
                  ({droppedNewPin.latitude.toFixed(4)}°N, {droppedNewPin.longitude.toFixed(4)}°E)
                </span>
                <span className="text-[#00E676]">{activeDistrictReadout}</span>
              </div>
            )}

            {/* Top-Right Native Mapbox Camera Controls & 1-Click Cinematic Render Trigger */}
            {mapReady && (
              <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!mapRef.current) return;
                    CinematicFlightEngine.stopActiveFlight(mapRef.current);
                    setFlightStatus(null);
                    mapRef.current.flyTo({
                      center: [targetDisplayPoi.longitude, targetDisplayPoi.latitude],
                      zoom: 1.8,
                      pitch: 0,
                      bearing: 0,
                      speed: 1.2,
                      essential: true,
                    });
                  }}
                  className="min-h-[34px] px-2.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#00E5FF] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>[ SPACE_ORBIT // Z:1.8 ]</span>
                </button>

                <button
                  type="button"
                  onClick={() => runCinematicSequence(false)}
                  className="min-h-[34px] px-2.5 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Rocket className="w-3.5 h-3.5 shrink-0" />
                  <span>[ 4-STAGE_FLIGHT ]</span>
                </button>

                <button
                  type="button"
                  onClick={() => runCinematicSequence(true)}
                  className="clip-button-chamfer min-h-[34px] px-3 bg-[#00E5FF] text-[#080A0F] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {flightStatus?.isRecording
                      ? `[ 🔴 REC STAGE ${flightStatus.stageNumber}/4 ]`
                      : '[ 🎬 1-CLICK CINEMATIC RENDER ]'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. Fault Tolerance & API Key Safeguard: Brutalist Error Fallback Banner + Interactive Click-to-Pin Pad */}
        {errorBanner && (
          <div
            role="alert"
            aria-live="polite"
            className="flex-1 w-full bg-[#080A0F] p-4 sm:p-6 flex flex-col justify-between gap-4"
          >
            {/* Top Diagnostic Status */}
            <div className="bg-[#0D1017] border border-[#00E5FF] p-4 space-y-3 clip-chamfer-brutalist">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-2.5">
                <div className="flex items-center gap-2 text-[#00E5FF] text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <span>{errorBanner.code}</span>
                </div>
                <span className="text-[10px] text-[#00E676] font-bold">
                  {activeDistrictReadout}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-bold text-[#FFFFFF]">
                  {language === 'vi'
                    ? '[ NATIVE MAPBOX GL V3 3D GLOBE & GLOBAL BOUNDARIES (ADM2-V4) — YÊU CẦU KHÓA PUBLIC TOKEN ]'
                    : '[ NATIVE MAPBOX GL V3 3D GLOBE & GLOBAL BOUNDARIES (ADM2-V4) — PUBLIC TOKEN REQUIRED ]'}
                </p>
                <p className="text-[11px] text-[#9BA8B8] leading-relaxed">
                  {language === 'vi'
                    ? 'Nhập khóa pk.eyJ... bên dưới để tải trực tiếp lớp Vector Tileset ranh giới hành chính toàn cầu (mapbox.boundaries-adm2-v4). Bạn có thể chọn các địa điểm quốc tế (Shibuya Tokyo, Manhattan NY, Le Marais Paris, Myeongdong Seoul, Quận 1 TP.HCM) ở thanh tìm kiếm phía trên để kiểm tra ngay.'
                    : 'Paste your pk.eyJ... key below to stream Mapbox Global Boundaries Vector Tilesets (mapbox.boundaries-adm2-v4). Select any international POI (Shibuya Tokyo, Manhattan NY, Le Marais Paris, Myeongdong Seoul, District 1 VN) in the search bar above to test.'}
                </p>
              </div>

              {/* Inline Instant BYOK Mapbox Token Provisioner */}
              <form
                onSubmit={handleApplyInlineToken}
                className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <input
                  type="password"
                  value={inlineTokenInput}
                  onChange={(e) => setInlineTokenInput(e.target.value)}
                  placeholder="pk.eyJ1Ijoi... (Paste Mapbox GL v3 Public Token)"
                  aria-label="Mapbox Public Access Token"
                  className="flex-1 min-h-[40px] px-3 bg-[#080A0F] border border-[#1F1F2E] focus:border-[#00E5FF] text-xs text-[#00E5FF] focus:outline-none"
                />
                <button
                  type="submit"
                  className="clip-button-chamfer min-h-[40px] px-4 bg-[#00E5FF] text-[#080A0F] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>[ ⚡ INITIALIZE_3D_GLOBE ]</span>
                </button>
                <button
                  type="button"
                  onClick={() => runCinematicSequence(true)}
                  className="min-h-[40px] px-3.5 bg-[#080A0F] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#080A0F] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span>[ 🎬 1-CLICK CINEMATIC RENDER ]</span>
                </button>
              </form>
            </div>

            {/* Interactive Click-To-Pin Tactical Surface + Global Boundary Readout */}
            <div className="bg-[#0D1017] border border-[#1F1F2E] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-2">
                <span className="text-[10px] text-[#00E5FF] font-bold">
                  {activeDistrictReadout}
                </span>
                <span className="text-[10px] text-[#00E676] font-bold">
                  {lockReadoutTag}
                </span>
              </div>

              {/* Clickable Tactical Coordinate Surface when WebGL Canvas is awaiting token */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
                  const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
                  const clickedLng = Number((106.665 + relX * 0.065).toFixed(6));
                  const clickedLat = Number((10.805 - relY * 0.065).toFixed(6));
                  dropNewPoiMarkerAndAlignCamera(
                    clickedLng,
                    clickedLat,
                    'MAP_CLICK_TARGET',
                    false
                  );
                }}
                className="relative w-full h-[120px] bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] cursor-crosshair flex flex-col items-center justify-center p-3 select-none overflow-hidden"
                title="Click anywhere on this tactical surface to drop a [ NEW // POI ] pin"
              >
                <div className="text-[10px] font-mono-brand text-[#00E5FF] font-bold">
                  {activeDistrictReadout} // MAPBOX_ID: {globalDistrictScan.mapboxId}
                </div>
                <div className="mt-1.5 px-2.5 py-1 bg-[#0D1017] border border-[#00E5FF] text-[#00E676] text-[10px] font-mono-brand font-bold">
                  [ {droppedNewPin ? 'NEW // POI' : '01 // POI'} ]{' '}
                  {targetDisplayPoi.name.toUpperCase()} ({targetDisplayPoi.latitude.toFixed(4)}°N,{' '}
                  {targetDisplayPoi.longitude.toFixed(4)}°E)
                </div>
              </div>

              {/* Brutalist HTML Marker Matrix ([ 01 // POI ] <NAME_IN_UPPERCASE>) */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-[#9BA8B8] uppercase">
                  [ BRUTALIST_POI_HUD_MARKERS // CLICK_NODE_TO_LOCK_COORDINATES ]
                </div>
                <div className="flex flex-wrap gap-2">
                  {foodPois.map((poi, idx) => {
                    const code = String(idx + 1).padStart(2, '0');
                    const isSelected =
                      activePoi &&
                      ((activePoi.poi_id && activePoi.poi_id === poi.poi_id) ||
                        (Math.abs(activePoi.latitude - poi.latitude) < 0.0001 &&
                          Math.abs(activePoi.longitude - poi.longitude) < 0.0001));
                    return (
                      <button
                        key={poi.poi_id || `${poi.name}-${idx}`}
                        type="button"
                        onClick={() => {
                          setDroppedNewPin(null);
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
                        className={`min-h-[34px] px-2.5 py-1 bg-[#080A0F] border text-[10px] font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-[#00E676] text-[#00E676]'
                            : 'border-[#00E5FF] text-[#00E5FF] hover:bg-[#0D1017]'
                        }`}
                      >
                        <span className="text-[#00E5FF]">[ {code} // POI ]</span>
                        <span className="text-[#FFFFFF]">{poi.name.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry Strip with Final Lock HUD Tag & Global District Scan Readout */}
      <div className="bg-[#0D1017] border-t border-[#1F1F2E] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex flex-wrap items-center gap-2 text-[#00E5FF]">
          <Crosshair className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
          <span className="font-bold text-[#00E676]">{lockReadoutTag}</span>
          <span className="text-[#00E5FF] font-bold">{activeDistrictReadout}</span>
        </div>
        <div className="text-[#9BA8B8]">{currentHudReadout}</div>
      </div>
    </div>
  );
};
