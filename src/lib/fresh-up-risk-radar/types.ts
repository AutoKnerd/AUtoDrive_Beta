export type FreshUpRiskType =
  | 'trust_risk'
  | 'engagement_risk'
  | 'archetype_risk'
  | 'concern_risk'
  | 'skill_decline_risk'
  | 'breakdown_risk'
  | 'adoption_risk'
  | 'version_stability_risk'
  | 'goal_failure_risk'
  | 'coaching_delay_risk';

export type FreshUpRiskEntityType =
  | 'consultant'
  | 'dealer'
  | 'platform'
  | 'version'
  | 'archetype'
  | 'concern'
  | 'goal'
  | 'segment';

export type FreshUpRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FreshUpRiskConfidence = 'low' | 'medium' | 'high';

export type FreshUpRiskRecord = {
  riskId: string;
  riskType: FreshUpRiskType;
  entityType: FreshUpRiskEntityType;
  entityId: string;
  entityName: string;
  riskLevel: FreshUpRiskLevel;
  confidenceLevel: FreshUpRiskConfidence;
  timeRange: string;
  message: string;
  recommendedAction: string;
  supportingMetrics: Record<string, number | string | boolean>;
  createdAt: Date;
  resolvedAt?: Date;
  isActive: boolean;
  environment: 'sandbox' | 'production';
};

export type FreshUpRiskRadarGenerationInput = {
  includeSandboxData?: boolean;
  environment?: 'sandbox' | 'production';
};

export type FreshUpRiskRadarFilterInput = {
  riskLevel?: FreshUpRiskLevel;
  riskType?: FreshUpRiskType;
  dealerId?: string;
  consultantId?: string;
  archetype?: string;
  concern?: string;
  version?: string;
  dateFrom?: string;
  dateTo?: string;
  isActive?: boolean;
  environment?: 'sandbox' | 'production';
};

