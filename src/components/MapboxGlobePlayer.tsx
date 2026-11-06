import React from 'react';
import { CyberGlobe3D, CyberGlobe3DProps } from './CyberGlobe3D';

export type MapboxGlobePlayerProps = CyberGlobe3DProps;

export const MapboxGlobePlayer: React.FC<MapboxGlobePlayerProps> = (props) => {
  return <CyberGlobe3D {...props} />;
};
