import React from 'react';
import { WebStudioView, WebStudioViewProps } from './WebStudioView';

export type EditorStudioTabProps = WebStudioViewProps;

export const EditorStudioTab: React.FC<EditorStudioTabProps> = (props) => {
  return <WebStudioView {...props} />;
};
