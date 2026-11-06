import React from 'react';
import { CulinaryNode, RouteWaypoint, LanguageCode } from '../data/vibePathData';
import { MapboxGlobePlayer } from './MapboxGlobePlayer';
import { TelemetryPoint, FoodPOI } from '../services/schema-validator';

export interface POILocation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  rating?: number;
  note?: string;
  noteEn?: string;
}
export type CameraStage = 'GLOBE' | 'CITY' | 'STREET_POI';

interface EarthToPoiMapProps {
  targetPoi: POILocation;
  allNodes?: CulinaryNode[];
  waypoints?: RouteWaypoint[];
  onSelectNode?: (node: CulinaryNode) => void;
  onPickCoordinate?: (lat: number, lng: number) => void;
  language?: LanguageCode;
  autoTriggerKey?: number;
  compactMode?: boolean;
  onOpenSettings?: () => void;
}

export const EarthToPoiMap: React.FC<EarthToPoiMapProps> = ({
  targetPoi,
  allNodes = [],
  waypoints = [],
  onSelectNode,
  onPickCoordinate,
  language = 'vi',
  autoTriggerKey = 0,
  compactMode = false,
  onOpenSettings,
}) => {
  const telemetryData: TelemetryPoint[] = waypoints.map((w) => ({
    latitude: w.lat,
    longitude: w.lng,
    altitude: 12.0,
    speed_kmh: w.speedKmh,
    heading: 30,
    timestamp: w.timestamp,
  }));

  const foodPois: FoodPOI[] = allNodes.map((n) => ({
    poi_id: n.id,
    name: n.name,
    latitude: n.latitude,
    longitude: n.longitude,
    rating: n.rating,
    note: language === 'en' ? n.noteEn : n.note,
    timestamp: n.timestamp,
    images: n.images,
  }));

  const activePoi: FoodPOI = {
    poi_id: targetPoi.id || 'poi-target',
    name: targetPoi.name,
    latitude: targetPoi.latitude,
    longitude: targetPoi.longitude,
    rating: targetPoi.rating || 5,
    note: language === 'en' ? targetPoi.noteEn || targetPoi.note : targetPoi.note,
    timestamp: new Date().toISOString(),
  };

  return (
    <MapboxGlobePlayer
      telemetryData={telemetryData}
      foodPois={foodPois}
      activePoi={activePoi}
      allNodes={allNodes}
      waypoints={waypoints}
      onSelectNode={onSelectNode}
      onPickCoordinate={onPickCoordinate}
      language={language}
      autoTriggerKey={autoTriggerKey}
      compactMode={compactMode}
      onOpenSettings={onOpenSettings}
    />
  );
};
