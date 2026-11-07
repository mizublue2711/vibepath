import mapboxgl from 'mapbox-gl';
import { getStoredThemeConfig } from '../context/ThemeContext';

export type UnifiedMapMode = 'DEM_3D' | 'CAD_3D';

export interface MapModePreset {
  mode: UnifiedMapMode;
  buttonLabel: string;
  hudReadout: string;
  terrainExaggeration: number;
  fog: mapboxgl.FogSpecification;
  buildingColor: string;
  buildingOpacity: number;
  routeGlowWidth: number;
  routeGlowOpacity: number;
  routeGlowBlur: number;
  routeCoreWidth: number;
  routeCoreColor: string;
  cadGridVisible: boolean;
}

export const MAP_MODE_PRESETS: Record<UnifiedMapMode, MapModePreset> = {
  DEM_3D: {
    mode: 'DEM_3D',
    buttonLabel: '3D Terrain',
    hudReadout: '3D Terrain View',
    terrainExaggeration: 1.6,
    fog: {
      color: '#020B14',
      'high-color': '#00E5FF',
      'space-color': '#010408',
      'horizon-blend': 0.08,
      'star-intensity': 0.95,
    },
    buildingColor: '#0D1017',
    buildingOpacity: 0.85,
    routeGlowWidth: 12,
    routeGlowOpacity: 0.24,
    routeGlowBlur: 6,
    routeCoreWidth: 2.5,
    routeCoreColor: '#00E5FF',
    cadGridVisible: false,
  },
  CAD_3D: {
    mode: 'CAD_3D',
    buttonLabel: 'Volumetric CAD',
    hudReadout: 'Volumetric CAD View',
    terrainExaggeration: 1.0,
    fog: {
      color: '#080A0F',
      'high-color': '#1F1F2E',
      'space-color': '#080A0F',
      'horizon-blend': 0.02,
      'star-intensity': 0.25,
    },
    buildingColor: '#101824',
    buildingOpacity: 0.92,
    routeGlowWidth: 8,
    routeGlowOpacity: 0.16,
    routeGlowBlur: 3,
    routeCoreWidth: 2.5,
    routeCoreColor: '#00E5FF',
    cadGridVisible: true,
  },
};

export class MapModeController {
  static getPreset(mode: UnifiedMapMode): MapModePreset {
    return MAP_MODE_PRESETS[mode] || MAP_MODE_PRESETS.DEM_3D;
  }

  static getHudReadout(mode: UnifiedMapMode): string {
    return this.getPreset(mode).hudReadout;
  }

  static updateRouteAccentColor(map: mapboxgl.Map | null, accentColor: string): void {
    if (!map) return;
    const cleanColor = accentColor || '#00E5FF';
    try {
      if (map.getLayer('cyber-route-glow')) {
        map.setPaintProperty('cyber-route-glow', 'line-color', cleanColor);
      }
      if (map.getLayer('cyber-route-core')) {
        map.setPaintProperty('cyber-route-core', 'line-color', cleanColor);
      }
      if (map.getLayer('global-district-fill')) {
        map.setPaintProperty('global-district-fill', 'fill-color', cleanColor);
      }
      if (map.getLayer('global-district-stroke')) {
        map.setPaintProperty('global-district-stroke', 'line-color', cleanColor);
      }
      if (map.getLayer('vibepath-global-adm2-fill')) {
        map.setPaintProperty('vibepath-global-adm2-fill', 'fill-color', cleanColor);
      }
      if (map.getLayer('vibepath-global-adm2-stroke')) {
        map.setPaintProperty('vibepath-global-adm2-stroke', 'line-color', cleanColor);
      }
    } catch (_) {}
  }

  static switchMode(map: mapboxgl.Map | null, newMode: UnifiedMapMode): void {
    if (!map) return;

    const preset = this.getPreset(newMode);
    const activeAccent = getStoredThemeConfig().accentColor || preset.routeCoreColor;

    try {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const currentPitch = map.getPitch();
      const currentBearing = map.getBearing();

      if (map.getSource('mapbox-dem')) {
        map.setTerrain({
          source: 'mapbox-dem',
          exaggeration: preset.terrainExaggeration,
        });
      }

      map.setFog({
        ...preset.fog,
        ...(newMode === 'DEM_3D' ? { 'high-color': activeAccent } : {}),
      });

      if (map.getLayer('3d-buildings')) {
        map.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
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
        ]);
        map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', preset.buildingOpacity);
        try {
          map.setPaintProperty(
            '3d-buildings',
            'fill-extrusion-ambient-occlusion-intensity' as any,
            0.4
          );
        } catch (_) {}
      }

      if (map.getLayer('3d-buildings-cad-wireframe')) {
        map.setLayoutProperty(
          '3d-buildings-cad-wireframe',
          'visibility',
          preset.cadGridVisible ? 'visible' : 'none'
        );
      }

      if (map.getLayer('cyber-route-glow')) {
        map.setPaintProperty('cyber-route-glow', 'line-width', preset.routeGlowWidth);
        map.setPaintProperty('cyber-route-glow', 'line-opacity', preset.routeGlowOpacity);
        map.setPaintProperty('cyber-route-glow', 'line-blur', preset.routeGlowBlur);
        map.setPaintProperty('cyber-route-glow', 'line-color', activeAccent);
      }

      if (map.getLayer('cyber-route-core')) {
        map.setPaintProperty('cyber-route-core', 'line-width', preset.routeCoreWidth);
        map.setPaintProperty('cyber-route-core', 'line-color', activeAccent);
      }

      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        pitch: currentPitch,
        bearing: currentBearing,
      });
    } catch (err) {
      console.warn('[MapModeController] Non-fatal WebGL mode switch warning:', err);
    }
  }
}
