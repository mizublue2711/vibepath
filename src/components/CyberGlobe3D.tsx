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
  Rocket,
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

function validateMapboxToken(rawToken: string): { valid: boolean } {
  const trimmed = (rawToken || '').trim();
  if (!trimmed || !trimmed.startsWith('pk.') || trimmed.includes('xxxxxxxx') || trimmed.length < 32) {
    return { valid: false };
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
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const newPinMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Unified Map Mode State (DEM_3D vs CAD_3D)
  const [activeMode, setActiveMode] = useState<UnifiedMapMode>('DEM_3D');
  const activeModeRef = useRef<UnifiedMapMode>('DEM_3D');

  // Selected / Dropped Food Venue Target ([ 01 // POI ])
  const [selectedSearchPoi, setSelectedSearchPoi] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    address?: string;
  } | null>(null);

  // Global Administrative Boundary HUD Readout State
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
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [useBuiltIn3DEngine, setUseBuiltIn3DEngine] = useState<boolean>(false);

  const [cameraTelemetry, setCameraTelemetry] = useState<{
    zoom: number;
    pitch: number;
    bearing: number;
  }>({
    zoom: 16.8,
    pitch: 72,
    bearing: 40,
  });

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

  useEffect(() => {
    const handleKeysUpdated = () => {
      const updatedToken =
        ApiKeyManager.getMapKey() || (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
      setMapboxToken(updatedToken);
    };
    window.addEventListener('vibepath_apikeys_updated', handleKeysUpdated);
    return () => window.removeEventListener('vibepath_apikeys_updated', handleKeysUpdated);
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
   * Center the 3D camera over target food POI and render the HUD tag [ 01 // POI ] <VENUE_NAME_UPPERCASE>
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
        if (newPinMarkerRef.current) {
          newPinMarkerRef.current.remove();
          newPinMarkerRef.current = null;
        }

        const el = document.createElement('div');
        el.className = 'cyber-new-poi-tag';
        el.innerHTML = `
          <div style="
            background: #080A0F;
            border: 1px solid #00E5FF;
            color: #00E5FF;
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
            box-shadow: 0 0 0 1px #00E676;
          ">
            <span style="color: #00E5FF;">[ 01 // POI ]</span>
            <span style="color: #FFFFFF;">${displayLabel}</span>
            <span style="color: #00E676;">(${cleanLat.toFixed(4)}°N, ${cleanLng.toFixed(4)}°E)</span>
          </div>
        `;

        newPinMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([cleanLng, cleanLat])
          .addTo(map);

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

      // Sync built-in 3D camera stages
      animCameraRef.current.targetLng = target.longitude;
      animCameraRef.current.targetLat = target.latitude;

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
          if (update.stage === 'STAGE_1_ORBIT') {
            animCameraRef.current.targetZoom = 1.8;
            animCameraRef.current.targetPitch = 0;
            animCameraRef.current.targetBearing = 0;
          } else if (update.stage === 'STAGE_2_REGIONAL') {
            animCameraRef.current.targetZoom = 9.5;
            animCameraRef.current.targetPitch = 30;
            animCameraRef.current.targetBearing = -15;
          } else if (update.stage === 'STAGE_3_DISTRICT_SCANNER') {
            animCameraRef.current.targetZoom = 13.8;
            animCameraRef.current.targetPitch = 45;
            animCameraRef.current.targetBearing = -35;
          } else {
            animCameraRef.current.targetZoom = 17.8;
            animCameraRef.current.targetPitch = 72;
            animCameraRef.current.targetBearing = 40;
          }
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
      map.on('load', () => {
        window.setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize();
          }
        }, 100);
      });

      // Đăng ký ResizeObserver theo dõi kích thước container liên tục
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
  }, [mapboxToken, flyToFoodPoiAndRenderTag]);

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
      ctx.fillStyle = '#080A0F';
      ctx.fillRect(0, 0, w, h);

      // Atmospheric Cyan Horizon Halo
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      grad.addColorStop(0, isCad ? 'rgba(0, 229, 255, 0.06)' : 'rgba(0, 229, 255, 0.16)');
      grad.addColorStop(1, 'rgba(8, 10, 15, 0)');
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

      // 3D Building Extrusions around target food POI
      const blocks = [
        { dx: -190, dy: 40, bw: 54, bh: 68 },
        { dx: -115, dy: -20, bw: 48, bh: 92 },
        { dx: 95, dy: -15, bw: 62, bh: 84 },
        { dx: 175, dy: 45, bw: 52, bh: 64 },
        { dx: -65, dy: 70, bw: 44, bh: 52 },
        { dx: 60, dy: 78, bw: 50, bh: 58 },
      ];
      const cx = w / 2;
      const cy = h * 0.58;

      blocks.forEach((b) => {
        const bx = cx + b.dx;
        const by = cy + b.dy;
        const roofOffset = b.bh * (cam.pitch / 72);
        ctx.fillStyle = isCad ? 'rgba(16, 24, 36, 0.92)' : 'rgba(13, 16, 23, 0.88)';
        ctx.strokeStyle = isCad ? 'rgba(0, 229, 255, 0.55)' : 'rgba(31, 31, 46, 1)';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by - roofOffset, b.bw, b.bh);
        ctx.strokeRect(bx, by - roofOffset, b.bw, b.bh);
      });

      // Global District Administrative Boundary Polygon (#00E5FF, fill-opacity 0.12, dashed stroke)
      ctx.save();
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 210, cy - 85);
      ctx.lineTo(cx + 215, cy - 95);
      ctx.lineTo(cx + 250, cy + 105);
      ctx.lineTo(cx - 235, cy + 110);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Spatial Coaxial Laser Route (#00E5FF: 12px outer glow + 2.5px core stream)
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(cx - 240, cy + 95);
      ctx.lineTo(cx - 95, cy + 35);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 145, cy - 45);
      ctx.stroke();

      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 240, cy + 95);
      ctx.lineTo(cx - 95, cy + 35);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 145, cy - 45);
      ctx.stroke();
      ctx.restore();

      // Target Food POI Pulse Ring & Crosshair Lock
      const pulseRadius = 14 + Math.sin(elapsed * 4.5) * 5;
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00E676';
      ctx.fillRect(cx - 4, cy - 4, 8, 8);

      // Render Brutalist Marker HUD Tag: [ 01 // POI ] <VENUE_NAME_UPPERCASE>
      const activePoiTarget = targetPoiRef.current;
      const tagText = `[ 01 // POI ] ${(activePoiTarget.name || 'FOOD_POI').toUpperCase()}`;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(tagText).width;
      const boxW = textWidth + 20;
      const boxH = 26;
      const boxX = cx - boxW / 2;
      const boxY = cy - 42;

      ctx.fillStyle = '#080A0F';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#00E5FF';
      ctx.fillText('[ 01 // POI ]', boxX + 10, boxY + 17);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        ` ${(activePoiTarget.name || 'FOOD_POI').toUpperCase()}`,
        boxX + 10 + ctx.measureText('[ 01 // POI ]').width,
        boxY + 17
      );

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      obs?.disconnect();
    };
  }, [useBuiltIn3DEngine]);

  // Live GeoJSON LineString update for Coaxial Laser Route
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

  /**
   * 4. Globe Handoff from PoiSearchBox (100% Mapbox API):
   * - Selecting an item passes [longitude, latitude] to CyberGlobe3D.tsx
   * - Automatically re-centers the 3D camera over the target location and places the [ 01 // POI ] HUD marker
   */
  const handleSelectSearchLocation = (result: GeocodedPoiResult) => {
    const [lng, lat] = result.coordinates || [result.longitude, result.latitude];
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

        {/* Instantaneous (< 50ms) Mode Switcher Controls */}
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
        </div>
      </div>

      {/* Unified 100% Mapbox Search Bar (Mapbox Search Box API v6 & Geocoding v5 via VITE_MAPBOX_TOKEN) */}
      <div className="bg-[#0D1017] border-b border-[#1F1F2E] px-3 py-2.5">
        <PoiSearchBox
          onSelectLocation={handleSelectSearchLocation}
          mapCenterLngLat={[targetDisplayPoi.longitude, targetDisplayPoi.latitude]}
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
          className={`absolute inset-0 w-full h-full ${
            useBuiltIn3DEngine ? 'hidden' : 'block'
          }`}
        />

        {/* Built-in 60FPS 3D Tactical Globe & Street Canvas (Active when no client token is needed) */}
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

        {/* Các thẻ HUD nằm lớp trên z-index */}
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

          {/* Active Target HUD Tag [ 01 // POI ] <VENUE_NAME_UPPERCASE> */}
          <div className="absolute bottom-3 left-3 bg-[#080A0F]/95 border border-[#00E5FF] px-3 py-1.5 flex flex-wrap items-center gap-2 text-[10px] font-mono-brand font-bold pointer-events-auto">
            <MapPin className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="text-[#00E5FF]">[ 01 // POI ]</span>
            <span className="text-[#FFFFFF]">{targetDisplayPoi.name.toUpperCase()}</span>
            <span className="text-[#00E676]">
              ({targetDisplayPoi.latitude.toFixed(4)}°N, {targetDisplayPoi.longitude.toFixed(4)}°E)
            </span>
          </div>

          {/* Interactive Pinned Food POIs Selector Strip on Bottom-Right */}
          <div className="absolute bottom-3 right-3 hidden sm:flex flex-wrap items-center gap-1.5 pointer-events-auto max-w-[55%] justify-end">
            {foodPois.slice(0, 4).map((poi, idx) => {
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
                  className={`min-h-[30px] px-2 py-1 bg-[#080A0F]/95 border text-[10px] font-mono-brand font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-[#00E676] text-[#00E676]'
                      : 'border-[#1F1F2E] hover:border-[#00E5FF] text-[#00E5FF]'
                  }`}
                >
                  <span>[ {code} // POI ]</span>
                  <span className="text-[#FFFFFF] truncate max-w-[120px]">
                    {poi.name.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Top-Right Native Mapbox Camera Controls & 1-Click Cinematic Render Trigger */}
          {mapReady && (
            <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={() => {
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
