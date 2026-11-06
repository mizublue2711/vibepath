import React from 'react';
import { FeedbackTab, FeedbackTabProps } from './FeedbackTab';

export type FeedbackBugReportTabProps = FeedbackTabProps;

export const FeedbackBugReportTab: React.FC<FeedbackBugReportTabProps> = (props) => {
  return <FeedbackTab {...props} />;
};
