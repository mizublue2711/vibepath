import React from 'react';
import { LiveTelemetryView, LiveTelemetryViewProps } from './LiveTelemetryView';

export type VloggerFieldTabProps = LiveTelemetryViewProps;

export const VloggerFieldTab: React.FC<VloggerFieldTabProps> = (props) => {
  return <LiveTelemetryView {...props} />;
};
