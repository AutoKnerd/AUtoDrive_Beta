import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';

export type CoachingPriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export type CoachingEntityType = 'consultant' | 'dealer' | 'team' | 'platform';

export type CoachingTopic =
  | 'Discovery and Needs Assessment'
  | 'Trust Building'
  | 'Active Listening'
  | 'Handling Price Conversations'
  | 'Handling Trade Conversations'
  | 'Handling Payment Conversations'
  | 'Guiding the Next Step'
  | 'Relationship Building'
  | 'Technology Explanation'
  | 'Handling Skeptical Buyers'
  | 'Handling Analytical Buyers'
  | 'Handling Time-Pressed Buyers';

export type CoachingInsightRecord = {
  coachingId: string;
  entityType: CoachingEntityType;
  entityId: string;
  entityName: string;
  priorityLevel: CoachingPriorityLevel;
  priorityScore: number;
  coachingTopic: CoachingTopic;
  message: string;
  supportingEvidence: string;
  recommendedPractice: string;
  suggestedAutoForgeModule: string;
  createdAt: Date;
  resolvedAt?: Date;
  environment: 'sandbox' | 'production';
  sourceSignals: {
    weakestSkill: string;
    weakestSkillScore: number;
    repeatedCoachingTag: string;
    archetypeFriction: string;
    concernFriction: string;
    negativeOutcomeRate: number;
    trustAverage: number;
    upMeterPeakAverage: number;
    goalSignals: number;
    riskSignals: number;
    alertSignals: number;
    sessionsAnalyzed: number;
  };
};

export type CoachingSignalContext = {
  currentRows: FreshUpNormalizedSession[];
  previousRows: FreshUpNormalizedSession[];
  riskSignals?: Array<{ riskType: string; riskLevel?: string; message?: string }>;
  alertSignals?: Array<{ alertType: string; severity?: string; message?: string }>;
  goalSignals?: Array<{ metric?: string; status?: string; goalTitle?: string }>;
};

export type CoachingEngineRunOptions = {
  includeSandboxData?: boolean;
  environment?: 'sandbox' | 'production';
  entityType?: CoachingEntityType;
  entityId?: string;
};
