import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Battle, Theater, BattleOutcome, BattleEventType } from '../types';
import { 
  Compass, 
  RotateCw, 
  Eye, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sparkles,
  Mountain,
  Plane,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  MousePointer,
  Move,
  HelpCircle,
  AlertTriangle,
  X,
  Key
} from 'lucide-react';
import { 
  getBattleEventType, 
  EVENT_TYPE_CONFIGS, 
  getOutcomeColors 
} from '../utils/markerIcons';
import { CIVIL_WAR_BATTLES } from '../data/battlesData';

interface BattleMapProps {
  battles: Battle[];
  selectedBattle: Battle | null;
  onSelectBattle: (battle: Battle) => void;
  selectedTheater: 'all' | Theater;
  selectedOutcome: 'all' | BattleOutcome;
  focusCoordinates?: { lat: number; lng: number } | null;
  focusZoom?: number | null;
  onFlightComplete?: (battle: Battle | null) => void;
}

// Google Maps Platform usage tracking attribution ID (solution id)
const TRACKING_ID = 'gmp_mcp_codeassist_v1_aistudio';

// Convert zoom level to 3D map camera range in meters
function zoomToRange(zoom: number): number {
  if (zoom >= 13) return 8000;
  if (zoom >= 12) return 12000;
  if (zoom >= 11) return 18000;
  if (zoom >= 10) return 30000;
  if (zoom >= 9) return 60000;
  if (zoom >= 8) return 120000;
  if (zoom >= 7) return 300000;
  if (zoom >= 6) return 650000;
  return 850000;
}

// Easing function for smooth cinematic acceleration and deceleration
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Calculate great-circle bearing between two coordinates in degrees
function calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
  if (Math.abs(startLat - destLat) < 0.00001 && Math.abs(startLng - destLng) < 0.00001) {
    return 90; // Default facing East
  }
  const φ1 = (startLat * Math.PI) / 180;
  const φ2 = (destLat * Math.PI) / 180;
  const Δλ = ((destLng - startLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

// Calculate heading for the 3D horse glTF model so its head faces along the travel bearing.
// Rotating 90 degrees more to the right (+90° clockwise) ensures the horse's head aligns
// perfectly with the travel trajectory.
function getHorseModelHeading(bearing: number): number {
  return (bearing + 180) % 360;
}

// Calculate scale so the 3D horse model (1.87m in horse.glb) visually matches the size of a map pin marker (~42px)
function getMarkerEquivalentScale(cameraRange: number): number {
  return Math.max(35, Math.min(25000, cameraRange * 0.032));
}

export const BattleMap: React.FC<BattleMapProps> = ({
  battles,
  selectedBattle,
  onSelectBattle,
  selectedTheater,
  selectedOutcome,
  focusCoordinates,
  focusZoom,
  onFlightComplete,
}) => {
  const map3dContainerRef = useRef<HTMLDivElement | null>(null);
  const map3dElementRef = useRef<any>(null);
  const [is3dReady, setIs3dReady] = useState<boolean>(false);
  
  const onFlightCompleteRef = useRef(onFlightComplete);
  onFlightCompleteRef.current = onFlightComplete;
  const currentDestBattleRef = useRef<Battle | null>(null);
  
  // Current live camera tracker
  const currentCameraRef = useRef({
    lat: 38.0,
    lng: -80.0,
    altitude: 0,
    range: 850000,
    tilt: 65,
    heading: 0,
  });

  // React State for UI & Camera Readouts
  const [center, setCenter] = useState<{ lat: number; lng: number; altitude: number }>({
    lat: 38.0,
    lng: -80.0,
    altitude: 0,
  });
  const [tilt, setTilt] = useState<number>(65); // 65° for dramatic topography
  const [range, setRange] = useState<number>(850000); // meters
  const [heading, setHeading] = useState<number>(0); // compass angle
  const [mapMode, setMapMode] = useState<'HYBRID' | 'SATELLITE'>('SATELLITE');
  const [isMobileHudExpanded, setIsMobileHudExpanded] = useState<boolean>(false);
  
  // Animation States
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const [flyingDestName, setFlyingDestName] = useState<string>('');
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(6); // deg per sec
  const [hoveredBattle, setHoveredBattle] = useState<Battle | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const flightAnimRef = useRef<number | null>(null);
  const orbitAnimRef = useRef<number | null>(null);
  const lastTargetKeyRef = useRef<string>('');
  const markersMapRef = useRef<Map<string, { markerEl: any; pinEl?: any; battle: Battle; groupKey: string }>>(new Map());

  // 3D Running Horse Model Tracker (Model3DElement)
  const horseModelRef = useRef<any>(null);
  const horseCoordsRef = useRef<{ lat: number; lng: number }>({ lat: 38.8144, lng: -77.5228 });
  const horseBearingRef = useRef<number>(0);

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  // Listen for Google Maps Authentication errors (e.g. RefererNotAllowedMapError or quota exhaustion)
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps Authentication Notice: RefererNotAllowedMapError or key restriction detected.');
      setAuthError('RefererNotAllowedMapError');
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    };

    // Auto-dismiss or hide any Google Maps API development/alpha channel banner
    const removeAlphaBanners = () => {
      const allDivs = document.querySelectorAll('body > div');
      allDivs.forEach((div) => {
        const text = div.textContent || '';
        if (text.includes('alpha channel of the Google Maps') || text.includes('For development purposes only')) {
          const dismissBtn = div.querySelector('button, a') as HTMLElement | null;
          if (dismissBtn && typeof dismissBtn.click === 'function') {
            dismissBtn.click();
          }
          (div as HTMLElement).style.display = 'none';
          div.remove();
        }
      });
    };

    removeAlphaBanners();
    const observer = new MutationObserver(removeAlphaBanners);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Initialize and mount Google Maps Photorealistic 3D Map
  useEffect(() => {
    let isMounted = true;

    async function init3DMap() {
      try {
        if (!(window as any).google?.maps?.maps3d?.Map3DElement && !(window as any).google?.maps?.importLibrary) {
          const existingScript = document.getElementById('google-maps-3d-sdk');
          if (!existingScript) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.id = 'google-maps-3d-sdk';
              script.src = `https://maps.googleapis.com/maps/api/js?loading=async&key=${apiKey}&libraries=maps3d,marker&v=beta&solution_channel=${TRACKING_ID}`;
              script.async = true;
              script.onload = () => resolve();
              script.onerror = (e) => reject(e);
              document.head.appendChild(script);
            });
          }
        }

        let markerLib: any = null;
        let maps3dLib: any = null;

        if ((window as any).google?.maps?.importLibrary) {
          maps3dLib = await (window as any).google.maps.importLibrary('maps3d');
          markerLib = await (window as any).google.maps.importLibrary('marker');
        }

        if (!isMounted || !map3dContainerRef.current) return;

        // Clean container
        map3dContainerRef.current.innerHTML = '';

        const Map3DClass = maps3dLib?.Map3DElement || (window as any).google?.maps?.maps3d?.Map3DElement;
        let mapEl: any;

        if (Map3DClass) {
          mapEl = new Map3DClass({
            center: { lat: center.lat, lng: center.lng, altitude: center.altitude },
            range: range,
            tilt: tilt,
            heading: heading,
            mode: mapMode,
            gestureHandling: 'GREEDY',
            internalUsageAttributionIds: [TRACKING_ID],
          });
        } else {
          mapEl = document.createElement('gmp-map-3d');
          mapEl.center = { lat: center.lat, lng: center.lng, altitude: center.altitude };
          mapEl.range = range;
          mapEl.tilt = tilt;
          mapEl.heading = heading;
          mapEl.mode = mapMode;
          mapEl.gestureHandling = 'GREEDY';
          mapEl.setAttribute('gesture-handling', 'greedy');
          mapEl.setAttribute('internal-usage-attribution-ids', TRACKING_ID);
        }

        // Camera change listener to synchronize live mouse movements (pan, zoom, tilt, heading)
        let cameraRafId: number | null = null;
        mapEl.addEventListener('gmp-camerachange', () => {
          if (mapEl.center) {
            const curLat = typeof mapEl.center.lat === 'function' ? mapEl.center.lat() : mapEl.center.lat;
            const curLng = typeof mapEl.center.lng === 'function' ? mapEl.center.lng() : mapEl.center.lng;
            const curAlt = mapEl.center.altitude || 0;
            if (typeof curLat === 'number' && typeof curLng === 'number') {
              currentCameraRef.current.lat = curLat;
              currentCameraRef.current.lng = curLng;
              currentCameraRef.current.altitude = curAlt;
            }
          }
          if (typeof mapEl.range === 'number') {
            currentCameraRef.current.range = mapEl.range;
            // Dynamically scale 3D horse model to match marker size at current zoom range (only when not traveling)
            if (horseModelRef.current && !flightAnimRef.current) {
              try {
                horseModelRef.current.scale = getMarkerEquivalentScale(mapEl.range);
              } catch (_) {}
            }
          }
          if (typeof mapEl.tilt === 'number') currentCameraRef.current.tilt = mapEl.tilt;
          if (typeof mapEl.heading === 'number') currentCameraRef.current.heading = mapEl.heading;

          if (!cameraRafId) {
            cameraRafId = requestAnimationFrame(() => {
              cameraRafId = null;
              if (currentCameraRef.current) {
                setTilt(Math.round(currentCameraRef.current.tilt));
                setHeading(Math.round(currentCameraRef.current.heading));
              }
            });
          }
        });

        // Pause auto-orbit and flight animations when user begins manual gestures
        const handleUserGestureStart = () => {
          if (orbitAnimRef.current) {
            cancelAnimationFrame(orbitAnimRef.current);
            orbitAnimRef.current = null;
          }
          if (flightAnimRef.current) {
            cancelAnimationFrame(flightAnimRef.current);
            flightAnimRef.current = null;
          }
          setIsOrbiting(false);
          setIsFlying(false);
        };

        mapEl.addEventListener('pointerdown', handleUserGestureStart);
        mapEl.addEventListener('mousedown', handleUserGestureStart);
        mapEl.addEventListener('wheel', handleUserGestureStart, { passive: true });
        mapEl.addEventListener('touchstart', handleUserGestureStart, { passive: true });

        // Initialize 3D Horse Model using Google Maps 3D Platform (Model3DElement)
        // Reference: https://developers.google.com/maps/documentation/javascript/3d/models
        const horseModelUrl = new URL('/horse.glb', window.location.href).href;
        const initialLat = selectedBattle?.coordinates.lat || focusCoordinates?.lat || battles[0]?.coordinates.lat || 38.8144;
        const initialLng = selectedBattle?.coordinates.lng || focusCoordinates?.lng || battles[0]?.coordinates.lng || -77.5228;
        horseCoordsRef.current = { lat: initialLat, lng: initialLng };

        const nextTargetLat = battles[1]?.coordinates.lat || 35.1517;
        const nextTargetLng = battles[1]?.coordinates.lng || -88.3242;
        const initialBearing = calculateBearing(initialLat, initialLng, nextTargetLat, nextTargetLng);
        const initialHeading = getHorseModelHeading(initialBearing);
        horseBearingRef.current = initialHeading;

        const Model3DClass = maps3dLib?.Model3DElement || (window as any).google?.maps?.maps3d?.Model3DElement;
        let horseEl: any = null;

        try {
          if (Model3DClass) {
            horseEl = new Model3DClass({
              src: horseModelUrl,
              position: { lat: initialLat, lng: initialLng, altitude: 0 },
              altitudeMode: 'CLAMP_TO_GROUND',
              orientation: { heading: initialHeading, tilt: 270, roll: 0 },
              scale: getMarkerEquivalentScale(range),
            });
          } else {
            horseEl = document.createElement('gmp-model-3d');
            horseEl.src = horseModelUrl;
            horseEl.setAttribute('src', horseModelUrl);
            horseEl.position = { lat: initialLat, lng: initialLng, altitude: 0 };
            horseEl.setAttribute('position', `${initialLat},${initialLng}`);
            horseEl.altitudeMode = 'CLAMP_TO_GROUND';
            horseEl.setAttribute('altitude-mode', 'clamp-to-ground');
            horseEl.orientation = { heading: initialHeading, tilt: 270, roll: 0 };
            horseEl.setAttribute('orientation', `${initialHeading},270,0`);
            horseEl.scale = getMarkerEquivalentScale(range);
            horseEl.setAttribute('scale', String(getMarkerEquivalentScale(range)));
          }

          mapEl.append(horseEl);
          horseModelRef.current = horseEl;

          // Attempt enabling native glTF skeletal animation if supported by Maps 3D runtime
          try {
            (horseEl as any).autoplay = true;
            (horseEl as any).runAnimations = true;
            (horseEl as any).animation = 'Armature|run';
            horseEl.setAttribute('autoplay', 'true');
            horseEl.setAttribute('run-animations', 'true');
            horseEl.setAttribute('animation', 'Armature|run');
            if ((horseEl as any).activeAnimations) {
              (horseEl as any).activeAnimations.addAll({ loop: 1 });
            }
          } catch (_) {}
        } catch (horseErr) {
          console.warn('Notice creating 3D Horse Model:', horseErr);
        }

        mapEl.style.width = '100%';
        mapEl.style.height = '100%';
        mapEl.style.display = 'block';
        map3dElementRef.current = mapEl;
        map3dContainerRef.current.appendChild(mapEl);

        if (isMounted) setIs3dReady(true);
      } catch (err: any) {
        console.warn('Notice initializing Maps 3D:', err);
        if (isMounted) {
          setIs3dReady(true);
        }
      }
    }

    init3DMap();

    return () => {
      isMounted = false;
      if (flightAnimRef.current) cancelAnimationFrame(flightAnimRef.current);
      if (orbitAnimRef.current) cancelAnimationFrame(orbitAnimRef.current);
      
      // Cleanly remove 3D Horse Model
      if (horseModelRef.current) {
        try {
          if (horseModelRef.current.parentNode) {
            horseModelRef.current.parentNode.removeChild(horseModelRef.current);
          }
          horseModelRef.current.remove?.();
        } catch (_) {}
        horseModelRef.current = null;
      }

      // Cleanly remove all active 3D markers from Map instance
      markersMapRef.current.forEach((record) => {
        try {
          if (record.markerEl.parentNode) {
            record.markerEl.parentNode.removeChild(record.markerEl);
          }
          record.markerEl.remove();
        } catch (_) {}
      });
      markersMapRef.current.clear();

      if (map3dContainerRef.current) {
        map3dContainerRef.current.innerHTML = '';
      }
      map3dElementRef.current = null;
    };
  }, []);

  // Filter battles by theater & outcome
  const filteredBattles = useMemo(() => {
    return battles.filter((b) => {
      const matchesTheater = selectedTheater === 'all' || b.theater === selectedTheater;
      const matchesOutcome = selectedOutcome === 'all' || b.outcome === selectedOutcome;
      return matchesTheater && matchesOutcome;
    });
  }, [battles, selectedTheater, selectedOutcome]);

  // Handle resize / orientation change smoothly re-centering on focus
  useEffect(() => {
    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const targetCoords = focusCoordinates || (selectedBattle ? selectedBattle.coordinates : null);
        if (targetCoords && map3dElementRef.current) {
          try {
            map3dElementRef.current.center = {
              lat: targetCoords.lat,
              lng: targetCoords.lng,
              altitude: 0,
            };
          } catch (_) {}
        }
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [focusCoordinates, selectedBattle]);

  // Group co-located battles (within ~2.5km of each other) to combine multi-year battles at the same battlefield
  interface BattleMarkerGroup {
    primaryBattle: Battle;
    battles: Battle[];
    commonName: string;
    yearsLabel: string;
    displayLabel: string;
    coordinates: { lat: number; lng: number };
    isSelected: boolean;
    hasMajorBattle: boolean;
  }

  const markerGroups: BattleMarkerGroup[] = useMemo(() => {
    const groups: BattleMarkerGroup[] = [];
    const seenBattleIds = new Set<string>();

    // Helper to calculate approximate distance in km
    const getDistKm = (c1: { lat: number; lng: number }, c2: { lat: number; lng: number }) => {
      const dLat = (c2.lat - c1.lat) * 111.32;
      const dLng = (c2.lng - c1.lng) * (111.32 * Math.cos((c1.lat * Math.PI) / 180));
      return Math.sqrt(dLat * dLat + dLng * dLng);
    };

    filteredBattles.forEach((battle) => {
      if (seenBattleIds.has(battle.id)) return;
      seenBattleIds.add(battle.id);

      // Find existing group within 2.5km
      const existingGroup = groups.find(
        (g) => getDistKm(g.coordinates, battle.coordinates) <= 2.5
      );

      if (existingGroup) {
        existingGroup.battles.push(battle);
      } else {
        groups.push({
          primaryBattle: battle,
          battles: [battle],
          commonName: '',
          yearsLabel: '',
          displayLabel: '',
          coordinates: { lat: battle.coordinates.lat, lng: battle.coordinates.lng },
          isSelected: false,
          hasMajorBattle: false,
        });
      }
    });

    // Post-process each group to calculate combined labels
    groups.forEach((group) => {
      // Sort battles chronologically
      group.battles.sort((a, b) => a.year - b.year || a.month - b.month);

      // Check if any battle in group is selected
      const selectedInGroup = group.battles.find((b) => b.id === selectedBattle?.id);
      group.isSelected = !!selectedInGroup;
      if (selectedInGroup) {
        group.primaryBattle = selectedInGroup;
      } else {
        group.primaryBattle = group.battles[group.battles.length - 1];
      }

      group.hasMajorBattle = group.battles.some((b) => b.totalCasualties > 20000);

      // Clean common base name
      const names = group.battles.map((b) =>
        b.name
          .replace(/First Battle of |Second Battle of |Battle of |Battles for /gi, '')
          .replace(/ \(Second Manassas\)| \(Manassas\)| \(Pittsburg Landing\)| \(Sharpsburg\)/gi, '')
          .trim()
      );

      // If all battles in group share root name (e.g., "Bull Run" or "Manassas"), consolidate
      const baseName = names[0];
      const allSameBase = names.every((n) => n.toLowerCase().includes(baseName.toLowerCase()) || baseName.toLowerCase().includes(n.toLowerCase()));
      const commonName = allSameBase ? baseName : names.join(' / ');

      // Collect unique years: e.g., "1861, 1862"
      const years = Array.from(new Set(group.battles.map((b) => String(b.year))));
      const yearsLabel = years.join(', ');

      group.commonName = commonName;
      group.yearsLabel = yearsLabel;
      // If multiple battles occurred at the same location, display: "Location (Year1, Year2)"
      // If only one battle occurred at this location, display just the clean name: "Location"
      group.displayLabel = group.battles.length > 1 ? `${commonName} (${yearsLabel})` : commonName;
    });

    return groups;
  }, [filteredBattles, selectedBattle?.id]);

  // Synchronize 3D Markers on the Map instance using in-place reconciliation
  useEffect(() => {
    if (!is3dReady || !map3dElementRef.current) return;
    const mapEl = map3dElementRef.current;

    const MarkerInteractiveClass = 
      (window as any).google?.maps?.maps3d?.Marker3DInteractiveElement ||
      (window as any).google?.maps?.maps3d?.Marker3DElement;

    // Helper to ensure PinElement exists, is appended, and is styled with outcome colors & glyphText
    const ensureStyledPin = (
      markerEl: any,
      existingPin: any,
      colors: { background: string; borderColor: string; glyphColor: string },
      glyph: string,
      isSelected: boolean
    ) => {
      const PinClass = (window as any).google?.maps?.marker?.PinElement;
      const targetScale = isSelected ? 1.3 : 1.0;

      if (existingPin) {
        try {
          existingPin.background = colors.background;
          existingPin.borderColor = colors.borderColor;
          existingPin.glyphColor = colors.glyphColor;
          // Use modern glyphText property to prevent deprecation warnings
          if ('glyphText' in existingPin || typeof existingPin.glyphText !== 'undefined') {
            existingPin.glyphText = glyph;
          } else {
            existingPin.glyph = glyph;
          }
          existingPin.scale = targetScale;
          return existingPin;
        } catch (_) {}
      }

      if (PinClass && markerEl) {
        try {
          const newPin = new PinClass({
            background: colors.background,
            borderColor: colors.borderColor,
            glyphColor: colors.glyphColor,
            glyphText: glyph,
            scale: targetScale,
          });

          // PinElement instance itself or its DOM element
          if (typeof markerEl.append === 'function') {
            markerEl.append(newPin);
          } else if (typeof markerEl.appendChild === 'function') {
            markerEl.appendChild(newPin);
          }
          return newPin;
        } catch (e) {
          console.warn('Notice creating PinElement:', e);
        }
      }

      return null;
    };

    const activeGroupKeys = new Set<string>();

    markerGroups.forEach((group) => {
      const groupKey = group.battles.map((b) => b.id).sort().join('-');
      activeGroupKeys.add(groupKey);

      const battle = group.primaryBattle;
      const isSelected = group.isSelected;
      const isMajorBattle = group.hasMajorBattle;
      const eventType = getBattleEventType(battle);
      const eventConfig = EVENT_TYPE_CONFIGS[eventType];
      const outcomeColors = getOutcomeColors(battle.outcome, isSelected);

      const existing = markersMapRef.current.get(groupKey);

      if (existing) {
        // Update existing marker in-place without destroying and re-instantiating!
        try {
          existing.markerEl.label = group.displayLabel;
          existing.markerEl.extruded = isSelected || isMajorBattle;
          existing.battle = battle;
          existing.pinEl = ensureStyledPin(
            existing.markerEl,
            existing.pinEl,
            outcomeColors,
            eventConfig.glyph,
            isSelected
          );
        } catch (_) {}
        return;
      }

      // Create new marker instance ONCE
      const positionObj = {
        lat: group.coordinates.lat,
        lng: group.coordinates.lng,
        altitude: 0,
      };

      if (MarkerInteractiveClass) {
        try {
          const marker = new MarkerInteractiveClass({
            position: positionObj,
            altitudeMode: 'CLAMP_TO_GROUND',
            extruded: isSelected || isMajorBattle,
            label: group.displayLabel,
            collisionBehavior: 'REQUIRED_AND_HIDES_OPTIONAL',
          });

          // Create styled Google Maps PinElement with glyph and outcome color
          const pin = ensureStyledPin(marker, null, outcomeColors, eventConfig.glyph, isSelected);

          marker.addEventListener('gmp-click', (e: any) => {
            e?.stopPropagation?.();
            const rec = markersMapRef.current.get(groupKey);
            onSelectBattle(rec ? rec.battle : battle);
          });

          marker.addEventListener('pointerenter', () => {
            const rec = markersMapRef.current.get(groupKey);
            setHoveredBattle(rec ? rec.battle : battle);
          });

          marker.addEventListener('pointerleave', () => {
            setHoveredBattle(null);
          });

          mapEl.append(marker);
          markersMapRef.current.set(groupKey, { markerEl: marker, pinEl: pin, battle, groupKey });
          return;
        } catch (mErr) {
          console.warn('Notice creating programmatic Marker3D:', mErr);
        }
      }

      // Fallback custom element marker with object position
      try {
        const markerEl = document.createElement('gmp-marker-3d') as any;
        markerEl.position = positionObj;
        markerEl.altitudeMode = 'CLAMP_TO_GROUND';
        markerEl.extruded = isSelected || isMajorBattle;
        markerEl.label = group.displayLabel;
        const pin = ensureStyledPin(markerEl, null, outcomeColors, eventConfig.glyph, isSelected);
        
        markerEl.addEventListener('click', () => {
          const rec = markersMapRef.current.get(groupKey);
          onSelectBattle(rec ? rec.battle : battle);
        });
        mapEl.append(markerEl);
        markersMapRef.current.set(groupKey, { markerEl: markerEl, pinEl: pin, battle, groupKey });
      } catch (_) {}
    });

    // Remove any markers that are no longer active
    Array.from(markersMapRef.current.entries()).forEach(([key, record]) => {
      if (!activeGroupKeys.has(key)) {
        try {
          if (record.markerEl.parentNode) {
            record.markerEl.parentNode.removeChild(record.markerEl);
          }
          record.markerEl.remove();
        } catch (_) {}
        markersMapRef.current.delete(key);
      }
    });
  }, [is3dReady, markerGroups, onSelectBattle]);

  // Smooth cinematic camera flight animation with automatic orbit on arrival
  const flyCameraTo = useCallback((
    targetCenter: { lat: number; lng: number; altitude: number },
    targetRange: number,
    targetTilt: number = 65,
    destTitle: string = 'Battlefield',
    destBattle: Battle | null = null
  ) => {
    currentDestBattleRef.current = destBattle;

    // Cancel any running animations
    if (flightAnimRef.current) {
      cancelAnimationFrame(flightAnimRef.current);
      flightAnimRef.current = null;
    }
    if (orbitAnimRef.current) {
      cancelAnimationFrame(orbitAnimRef.current);
      orbitAnimRef.current = null;
    }

    setIsOrbiting(false);
    setIsFlying(true);
    setFlyingDestName(destTitle);

    const startCamera = { ...currentCameraRef.current };
    const distDeg = Math.hypot(
      targetCenter.lat - startCamera.lat,
      targetCenter.lng - startCamera.lng
    );

    // Calculate dynamic flight duration (2.0s to 3.6s) based on distance
    const duration = Math.min(3600, Math.max(2000, distDeg * 350 + 1600));
    // Ground-following camera tracking elevation (capped at a gentle scenic lift rather than stratospheric orbit)
    const maxArcElevation = Math.min(distDeg * 3500, 16000);

    // Horse departure and destination coordinates
    const horseStart = horseCoordsRef.current
      ? { ...horseCoordsRef.current }
      : { lat: startCamera.lat, lng: startCamera.lng };
    const horseTarget = { lat: targetCenter.lat, lng: targetCenter.lng };

    // Calculate heading/bearing to target event so horse faces forward while running
    const distToTarget = Math.hypot(
      horseTarget.lat - horseStart.lat,
      horseTarget.lng - horseStart.lng
    );

    let runHeading = horseBearingRef.current;
    if (distToTarget > 0.0001) {
      const runBearing = calculateBearing(
        horseStart.lat,
        horseStart.lng,
        horseTarget.lat,
        horseTarget.lng
      );
      runHeading = getHorseModelHeading(runBearing);
      horseBearingRef.current = runHeading;
    }

    // Stable ground-anchored horse scale (smoothly interpolating between start and target battle views)
    const startHorseScale = getMarkerEquivalentScale(startCamera.range);
    const targetHorseScale = getMarkerEquivalentScale(targetRange);

    const startTime = performance.now();

    const animateFlight = (now: number) => {
      const elapsed = now - startTime;
      const rawProgress = Math.min(1, elapsed / duration);
      const easedProgress = easeInOutCubic(rawProgress);

      // Horse travels smoothly following the floor between battle sites
      const curHorseLat = horseStart.lat + (horseTarget.lat - horseStart.lat) * easedProgress;
      const curHorseLng = horseStart.lng + (horseTarget.lng - horseStart.lng) * easedProgress;

      // Camera smoothly follows the horse across the terrain floor
      const baseRange = startCamera.range + (targetRange - startCamera.range) * easedProgress;
      const arcBonus = Math.sin(rawProgress * Math.PI) * maxArcElevation;
      const curRange = baseRange + arcBonus;

      // Camera tilt smoothly transitions
      const curTilt = startCamera.tilt + (targetTilt - startCamera.tilt) * easedProgress;

      // Horse scale stays firmly ground-anchored, never ballooning with camera altitude
      const horseScale = startHorseScale + (targetHorseScale - startHorseScale) * easedProgress;

      // Procedural galloping gait animation: authentic 3 Hz gallop cadence
      // Simulates the physical gallop cycle with rhythmic pitch dip/leap and weight-shift roll
      const stridePhase = elapsed * 0.017;
      const gallopPitch = Math.sin(stridePhase) * 3.0; // Pitch bob (±3°)
      const gallopRoll = Math.cos(stridePhase * 0.5) * 1.2; // Lateral roll (±1.2°)
      const gallopYaw = Math.sin(stridePhase * 0.5) * 0.8; // Head sway (±0.8°)

      if (horseModelRef.current) {
        try {
          horseModelRef.current.position = { lat: curHorseLat, lng: curHorseLng, altitude: 0 };
          horseModelRef.current.orientation = {
            heading: (runHeading + gallopYaw + 360) % 360,
            tilt: 270 + gallopPitch,
            roll: gallopRoll,
          };
          horseModelRef.current.scale = horseScale;
        } catch (_) {}
      }
      horseCoordsRef.current = { lat: curHorseLat, lng: curHorseLng };

      // Camera follows the running horse
      currentCameraRef.current = {
        ...currentCameraRef.current,
        lat: curHorseLat,
        lng: curHorseLng,
        range: curRange,
        tilt: curTilt,
      };

      // Apply to Map 3D element
      if (map3dElementRef.current) {
        try {
          map3dElementRef.current.center = { lat: curHorseLat, lng: curHorseLng, altitude: 0 };
          map3dElementRef.current.range = curRange;
          map3dElementRef.current.tilt = curTilt;
        } catch (_) {}
      }

      // Update state for UI
      setCenter({ lat: curHorseLat, lng: curHorseLng, altitude: 0 });
      setRange(Math.round(curRange));
      setTilt(Math.round(curTilt));

      if (rawProgress < 1) {
        flightAnimRef.current = requestAnimationFrame(animateFlight);
      } else {
        // Flight completed! Arrived at destination event.
        flightAnimRef.current = null;
        setIsFlying(false);

        // Snap horse and camera to exact target values
        horseCoordsRef.current = horseTarget;
        const finalHorseScale = getMarkerEquivalentScale(targetRange);

        if (horseModelRef.current) {
          try {
            horseModelRef.current.position = { lat: targetCenter.lat, lng: targetCenter.lng, altitude: 0 };
            horseModelRef.current.orientation = { heading: runHeading, tilt: 270, roll: 0 };
            horseModelRef.current.scale = finalHorseScale;
          } catch (_) {}
        }

        currentCameraRef.current = {
          ...currentCameraRef.current,
          lat: targetCenter.lat,
          lng: targetCenter.lng,
          range: targetRange,
          tilt: targetTilt,
        };

        if (map3dElementRef.current) {
          try {
            map3dElementRef.current.center = targetCenter;
            map3dElementRef.current.range = targetRange;
            map3dElementRef.current.tilt = targetTilt;
          } catch (_) {}
        }

        setCenter(targetCenter);
        setRange(targetRange);
        setTilt(targetTilt);

        // AUTOMATICALLY START ORBIT UPON ARRIVAL
        setIsOrbiting(true);

        // Notify parent that the horse has arrived so event details right-side pane is displayed
        if (onFlightCompleteRef.current) {
          onFlightCompleteRef.current(currentDestBattleRef.current);
        }
      }
    };

    flightAnimRef.current = requestAnimationFrame(animateFlight);
  }, []);

  // Trigger camera flight when selectedBattle, focusCoordinates, or focusZoom changes
  useEffect(() => {
    if (!is3dReady) return;

    const targetCoords = focusCoordinates || (selectedBattle ? selectedBattle.coordinates : null);
    if (!targetCoords) return;

    // Resolve target battle: prefer selectedBattle, or find matching battle by coordinates
    let targetBattle: Battle | null = selectedBattle;
    if (!targetBattle && targetCoords) {
      targetBattle = battles.find(
        (b) => Math.abs(b.coordinates.lat - targetCoords.lat) < 0.08 && Math.abs(b.coordinates.lng - targetCoords.lng) < 0.08
      ) || CIVIL_WAR_BATTLES.find(
        (b) => Math.abs(b.coordinates.lat - targetCoords.lat) < 0.08 && Math.abs(b.coordinates.lng - targetCoords.lng) < 0.08
      ) || null;
    }

    const targetKey = `${targetCoords.lat.toFixed(4)},${targetCoords.lng.toFixed(4)},${focusZoom || ''},${targetBattle?.id || ''}`;
    if (targetKey === lastTargetKeyRef.current) return;
    lastTargetKeyRef.current = targetKey;

    const targetRange = focusZoom 
      ? zoomToRange(focusZoom) 
      : targetBattle?.zoomLevel 
      ? zoomToRange(targetBattle.zoomLevel) 
      : 22000;

    const newCenter = {
      lat: targetCoords.lat,
      lng: targetCoords.lng,
      altitude: 0,
    };

    const destTitle = targetBattle ? targetBattle.name : 'Battlefield Site';
    flyCameraTo(newCenter, targetRange, 65, destTitle, targetBattle);
  }, [is3dReady, selectedBattle, focusCoordinates, focusZoom, flyCameraTo, battles]);

  // 360° Cinematic Battlefield Orbit Animation Loop
  useEffect(() => {
    if (!isOrbiting) {
      if (orbitAnimRef.current) {
        cancelAnimationFrame(orbitAnimRef.current);
        orbitAnimRef.current = null;
      }
      return;
    }

    let lastTimestamp = performance.now();
    const rotateLoop = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      setHeading((prev) => {
        const next = (prev + delta * orbitSpeed) % 360;
        currentCameraRef.current.heading = next;
        if (map3dElementRef.current) {
          try {
            map3dElementRef.current.heading = next;
          } catch (_) {}
        }
        // Keep 3D horse oriented nicely on the battlefield
        if (horseModelRef.current) {
          try {
            horseModelRef.current.orientation = { heading: horseBearingRef.current, tilt: 270, roll: 0 };
          } catch (_) {}
        }
        return next;
      });

      orbitAnimRef.current = requestAnimationFrame(rotateLoop);
    };

    orbitAnimRef.current = requestAnimationFrame(rotateLoop);

    return () => {
      if (orbitAnimRef.current) {
        cancelAnimationFrame(orbitAnimRef.current);
        orbitAnimRef.current = null;
      }
    };
  }, [isOrbiting, orbitSpeed]);

  // Direct Camera Controls
  const handleZoomIn = () => {
    setRange((prev) => {
      const next = Math.max(4000, Math.round(prev * 0.65));
      currentCameraRef.current.range = next;
      if (map3dElementRef.current) map3dElementRef.current.range = next;
      return next;
    });
  };

  const handleZoomOut = () => {
    setRange((prev) => {
      const next = Math.min(1500000, Math.round(prev * 1.45));
      currentCameraRef.current.range = next;
      if (map3dElementRef.current) map3dElementRef.current.range = next;
      return next;
    });
  };

  const handleCycleTilt = () => {
    setTilt((prev) => {
      const next = prev >= 68 ? 45 : prev >= 40 ? 10 : 68;
      currentCameraRef.current.tilt = next;
      if (map3dElementRef.current) map3dElementRef.current.tilt = next;
      return next;
    });
  };

  const handleResetTheaterOverview = () => {
    const initialCenter = { lat: 37.5, lng: -82.0, altitude: 0 };
    flyCameraTo(initialCenter, 850000, 55, 'Theater Overview');
  };

  const handleResetNorth = () => {
    setHeading(0);
    currentCameraRef.current.heading = 0;
    if (map3dElementRef.current) {
      try {
        map3dElementRef.current.heading = 0;
      } catch (_) {}
    }
  };

  const handleToggleOrbit = () => {
    setIsOrbiting((prev) => !prev);
  };

  const handleToggleMode = () => {
    setMapMode((prev) => {
      const next = prev === 'HYBRID' ? 'SATELLITE' : 'HYBRID';
      if (map3dElementRef.current) {
        try {
          map3dElementRef.current.mode = next;
        } catch (_) {}
      }
      return next;
    });
  };

  // Quick next / prev battlefield flight selector
  const handleNavigateBattlefield = (direction: 'next' | 'prev') => {
    if (filteredBattles.length === 0) return;
    const currentIndex = selectedBattle ? filteredBattles.findIndex((b) => b.id === selectedBattle.id) : -1;
    let nextIndex = 0;
    if (currentIndex !== -1) {
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % filteredBattles.length;
      } else {
        nextIndex = (currentIndex - 1 + filteredBattles.length) % filteredBattles.length;
      }
    }
    const nextBattle = filteredBattles[nextIndex];
    onSelectBattle(nextBattle);
  };

  return (
    <div className="relative w-full h-full bg-[#1b1714] overflow-hidden select-none">
      
      {/* 3D Photorealistic Map Container */}
      <div 
        ref={map3dContainerRef} 
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Loading Overlay if not ready */}
      {!is3dReady && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1b1714] text-[#e5dec9] p-6 text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-[#8a7a67]/30 border-t-[#c48a3f] animate-spin" />
            <Mountain className="w-7 h-7 text-[#c48a3f] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="font-cinzel text-lg font-bold text-[#f5f2ed] mb-1">
            Loading Photorealistic 3D Battlefield Engine
          </h3>
          <p className="text-xs text-[#a89985] max-w-sm">
            Initializing 3D terrain elevation and Google Maps 3D Platform...
          </p>
        </div>
      )}

      {/* Google Maps API Key Authorization Notice */}
      {authError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] bg-[#2b221a]/95 border border-amber-500/60 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-[#f5f2ed] text-xs animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-cinzel font-bold text-amber-300">
                  Google Maps API Key Configuration Notice
                </span>
                <button 
                  onClick={() => setAuthError(null)}
                  className="p-1 text-[#a89985] hover:text-[#f5f2ed] transition-colors rounded-lg cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-[#e5dec9] leading-relaxed">
                The current API key has HTTP referrer restrictions (<code>RefererNotAllowedMapError</code>). To enable full map rendering on this deployment:
              </p>
              <ul className="text-[10px] text-[#cfc4b2] list-disc list-inside space-y-0.5 mt-1 font-mono">
                <li>Add <code>https://*.run.app/*</code> to Allowed HTTP Referrers in Google Cloud Console</li>
                <li>Or configure an unrestricted Maps API Key / Demo Key in Settings</li>
              </ul>
            </div>
          </div>
        </div>
      )}



      {/* Floating 3D Camera Controls HUD */}
      <div 
        id="camera-controls-hud"
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col gap-1 sm:gap-1.5 bg-[#241d18]/90 border border-[#524438] p-1 sm:p-1.5 rounded-xl shadow-xl backdrop-blur-md text-[#f5f2ed] max-h-[calc(100vh-5rem)] overflow-y-auto"
      >
        <button
          onClick={handleZoomIn}
          className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#f5f2ed] hover:text-white transition-all flex items-center justify-center cursor-pointer"
          title="Zoom In (+)"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#f5f2ed] hover:text-white transition-all flex items-center justify-center cursor-pointer"
          title="Zoom Out (-)"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Mobile toggle button to collapse/expand 3D camera angles & orbit */}
        <button
          onClick={() => setIsMobileHudExpanded(!isMobileHudExpanded)}
          className="sm:hidden p-1.5 min-w-[36px] min-h-[36px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#c48a3f] transition-all flex items-center justify-center cursor-pointer"
          title={isMobileHudExpanded ? "Collapse camera tools" : "Show 3D tilt & rotation controls"}
          aria-label={isMobileHudExpanded ? "Collapse camera tools" : "Show 3D tilt & rotation controls"}
          aria-expanded={isMobileHudExpanded}
        >
          <Mountain className="w-4 h-4" />
        </button>

        {/* 3D and orientation controls (always visible on sm+, toggleable on mobile) */}
        <div className={`${isMobileHudExpanded ? 'flex' : 'hidden'} sm:flex flex-col gap-1 sm:gap-1.5`}>
          <div className="w-full h-px bg-[#524438]/60 my-0.5" />

          <button
            onClick={handleCycleTilt}
            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#f5f2ed] hover:text-white transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            title={`Cycle 3D Tilt (${tilt}°)`}
            aria-label="Cycle 3D camera tilt"
          >
            <Mountain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c48a3f]" />
            <span className="text-[8px] sm:text-[9px] font-mono leading-none">{tilt}°</span>
          </button>

          <button
            onClick={handleResetNorth}
            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#f5f2ed] hover:text-white transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            title={`Reset Heading to North (${heading}°)`}
            aria-label="Reset Heading to North"
          >
            <Compass 
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#93c5fd] transition-transform duration-200" 
              style={{ transform: `rotate(${-heading}deg)` }}
            />
            <span className="text-[8px] sm:text-[9px] font-mono leading-none">N</span>
          </button>

          <button
            onClick={handleToggleOrbit}
            className={`p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
              isOrbiting
                ? 'bg-[#c48a3f] text-[#1b1714] font-bold shadow-md shadow-[#c48a3f]/20 animate-pulse'
                : 'bg-[#332922] hover:bg-[#473930] text-[#f5f2ed] hover:text-white'
            }`}
            title={isOrbiting ? "Pause 360° Battlefield Orbit" : "Start 360° Battlefield Orbit"}
            aria-label="Toggle 360 camera orbit"
          >
            <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isOrbiting ? 'animate-spin' : ''}`} />
          </button>

          <div className="w-full h-px bg-[#524438]/60 my-0.5" />

          <button
            onClick={handleToggleMode}
            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#f5f2ed] hover:text-white transition-all flex items-center justify-center cursor-pointer"
            title={`Switch to ${mapMode === 'HYBRID' ? 'Satellite' : 'Hybrid'} View`}
            aria-label="Toggle Satellite or Hybrid mode"
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#a89985]" />
          </button>

          <button
            onClick={handleResetTheaterOverview}
            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-[#332922] hover:bg-[#473930] active:scale-95 text-[#f5f2ed] hover:text-white transition-all flex items-center justify-center cursor-pointer"
            title="Reset Theater Overview"
            aria-label="Reset Theater Overview"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#a89985]" />
          </button>
        </div>
      </div>

      {/* 3D Courier Flight HUD Banner */}
      {isFlying && (
        <div className={`absolute ${authError ? 'top-28 sm:top-24' : 'top-3 sm:top-4'} left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-6rem)] sm:max-w-md w-max flex items-center gap-2.5 sm:gap-3 bg-[#1b1714]/95 border border-[#c48a3f]/70 rounded-full px-3.5 sm:px-5 py-1.5 sm:py-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 box-border pointer-events-none`}>
          <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#c48a3f]/20 border border-[#c48a3f]/40 text-amber-300 animate-pulse text-xs sm:text-sm shrink-0">
            🐎
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-cinzel font-bold text-[#f5f2ed] tracking-wide truncate">
              Dispatching Courier to {flyingDestName}
            </span>
            <span className="text-[9px] sm:text-[10px] text-[#c48a3f] truncate">
              3D Running Horse navigating terrain &bull; Camera following courier
            </span>
          </div>
        </div>
      )}
      {hoveredBattle && !selectedBattle && (
        <div 
          className="absolute top-20 left-3 sm:left-4 z-30 w-76 max-w-[calc(100vw-1.5rem)] bg-[#241d18]/95 border border-[#524438] rounded-2xl p-4 shadow-2xl backdrop-blur-md text-[#f5f2ed] animate-in fade-in slide-in-from-top-2 pointer-events-none box-border"
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#a89985]">
                {hoveredBattle.theater} Theater &bull; {hoveredBattle.year}
              </span>
              {(() => {
                const evType = getBattleEventType(hoveredBattle);
                const evConfig = EVENT_TYPE_CONFIGS[evType];
                return (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#d97706]/20 text-[#fbbf24] border border-[#d97706]/40">
                    {evConfig.label}
                  </span>
                );
              })()}
            </div>
            <span 
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                hoveredBattle.outcome === 'union'
                  ? 'bg-[#2e537d]/40 text-[#93c5fd] border border-[#2e537d]'
                  : hoveredBattle.outcome === 'confederate'
                  ? 'bg-[#8c3b31]/40 text-[#fca5a5] border border-[#8c3b31]'
                  : 'bg-[#b47828]/40 text-[#fde047] border border-[#b47828]'
              }`}
            >
              {hoveredBattle.outcome} Victory
            </span>
          </div>

          <h4 className="font-cinzel font-bold text-base text-[#f5f2ed] mb-1">
            {hoveredBattle.name}
          </h4>

          <div className="text-xs text-[#d1c2ab] mb-2.5">
            {hoveredBattle.date} &bull; {hoveredBattle.location}
          </div>

          <div className="grid grid-cols-2 gap-2 bg-[#1b1714] p-2.5 rounded-xl border border-[#42372e] text-center mb-2.5 shadow-inner">
            <div>
              <div className="text-[10px] text-[#a89985] font-bold uppercase">Union Losses</div>
              <div className="text-xs font-bold text-[#93c5fd]">
                {hoveredBattle.casualties.union.total.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#a89985] font-bold uppercase">Confed. Losses</div>
              <div className="text-xs font-bold text-[#fca5a5]">
                {hoveredBattle.casualties.confederate.total.toLocaleString()}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#c4baaa] line-clamp-2 leading-relaxed">
            {hoveredBattle.summary}
          </p>

          <div className="mt-2.5 pt-2 border-t border-white/10 text-[10px] text-[#d97706] flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Click 3D marker to inspect terrain, leaders & archives</span>
          </div>
        </div>
      )}

      {/* Mandatory Google Maps Attribution on a dedicated separate line */}
      <div className={`absolute right-3 z-30 pointer-events-none text-[10px] text-white/80 font-sans tracking-wide bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs shadow-xs transition-all ${
        selectedBattle ? 'bottom-22 md:bottom-2' : 'bottom-2'
      }`}>
        Google Maps
      </div>

    </div>
  );
};
