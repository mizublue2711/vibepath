import mapboxgl from 'mapbox-gl';

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
    buttonLabel: '[ MAPBOX DEM 3D ]',
    hudReadout: '[ 3D DEM 1.6x // OLED CYBERPUNK / SLATE • CYAN HALO ]',
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
    routeGlowOpacity: 0.2,
    routeGlowBlur: 6,
    routeCoreWidth: 2.5,
    routeCoreColor: '#00E5FF',
    cadGridVisible: false,
  },
  CAD_3D: {
    mode: 'CAD_3D',
    buttonLabel: '[ VOLUMETRIC CAD 3D ]',
    hudReadout: '[ 3D CAD 1.0x // TACTICAL WIREFRAME • FLAT GRID ]',
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
    routeGlowOpacity: 0.14,
    routeGlowBlur: 3,
    routeCoreWidth: 2.5,
    routeCoreColor: '#00E5FF',
    cadGridVisible: true,
  },
};

/**
 * Unified Map Mode Controller
 * Switches between DEM_3D and CAD_3D in-place (< 5ms) on a single persistent Mapbox GL v3 instance
 * without re-mounting the canvas, reloading the style, or resetting camera metrics (center, zoom, pitch, bearing).
 */
export class MapModeController {
  static getPreset(mode: UnifiedMapMode): MapModePreset {
    return MAP_MODE_PRESETS[mode] || MAP_MODE_PRESETS.DEM_3D;
  }

  static getHudReadout(mode: UnifiedMapMode): string {
    return this.getPreset(mode).hudReadout;
  }

  static switchMode(map: mapboxgl.Map | null, newMode: UnifiedMapMode): void {
    if (!map) return;

    const preset = this.getPreset(newMode);

    try {
      // Preserve exact camera state (center, zoom, pitch, bearing) during in-place WebGL mutation
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const currentPitch = map.getPitch();
      const currentBearing = map.getBearing();

      // 1. Update DEM Terrain Exaggeration in-place (1.6x vs 1.0x)
      if (map.getSource('mapbox-dem')) {
        map.setTerrain({
          source: 'mapbox-dem',
          exaggeration: preset.terrainExaggeration,
        });
      }

      // 2. Update Atmospheric Shader / Fog Halo in-place
      map.setFog(preset.fog);

      // 3. Update 3D Extruded Buildings paint properties in-place
      if (map.getLayer('3d-buildings')) {
        map.setPaintProperty('3d-buildings', 'fill-extrusion-color', preset.buildingColor);
        map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', preset.buildingOpacity);
      }

      // 4. Toggle Tactical CAD Wireframe Outline Layer visibility if present
      if (map.getLayer('3d-buildings-cad-wireframe')) {
        map.setLayoutProperty(
          '3d-buildings-cad-wireframe',
          'visibility',
          preset.cadGridVisible ? 'visible' : 'none'
        );
      }

      // 5. Update Coaxial Laser Route (#00E5FF) paint properties in-place
      if (map.getLayer('cyber-route-glow')) {
        map.setPaintProperty('cyber-route-glow', 'line-width', preset.routeGlowWidth);
        map.setPaintProperty('cyber-route-glow', 'line-opacity', preset.routeGlowOpacity);
        map.setPaintProperty('cyber-route-glow', 'line-blur', preset.routeGlowBlur);
        map.setPaintProperty('cyber-route-glow', 'line-color', preset.routeCoreColor);
      }

      if (map.getLayer('cyber-route-core')) {
        map.setPaintProperty('cyber-route-core', 'line-width', preset.routeCoreWidth);
        map.setPaintProperty('cyber-route-core', 'line-color', preset.routeCoreColor);
      }

      // Guarantee camera remains pinned at exact coordinates & pitch
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
