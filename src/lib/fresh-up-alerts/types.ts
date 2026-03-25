export type FreshUpAlertType =
  | 'dealer_skill_drop'
  | 'dealer_skill_improvement'
  | 'consultant_coaching_opportunity'
  | 'archetype_friction'
  | 'concern_based_friction'
  | 'engagement_drop'
  | 'version_regression'
  | 'autoforge_recommendation'
  | 'usage_drop'
  | 'outcome_breakdown_increase';

export type FreshUpAlertEntityType =
  | 'consultant'
  | 'dealer'
  | 'platform'
  | 'version'
  | 'segment';

export type FreshUpAlertSeverity = 'positive' | 'low' | 'medium' | 'high' | 'critical';

export type FreshUpAlertRecord = {
  alertId: string;
  alertType: FreshUpAlertType;
  entityType: FreshUpAlertEntityType;
  entityId: string;
  entityName: string;
  timeRange: string;
  metricName: string;
  currentValue: number;
  comparisonValue: number;
  difference: number;
  differencePercent: number;
  severity: FreshUpAlertSeverity;
  message: string;
  recommendedAction: string;
  relatedSkill?: string;
  relatedArchetype?: string;
  relatedConcern?: string;
  relatedVersion?: string;
  createdAt: Date;
  isRead: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  environment: 'sandbox' | 'production';
};

export type FreshUpAlertGenerationInput = {
  includeSandboxData?: boolean;
  environment?: 'sandbox' | 'production';
};

export type FreshUpAlertFilterInput = {
  severity?: FreshUpAlertSeverity;
  alertType?: FreshUpAlertType;
  dealerId?: string;
  consultantId?: string;
  version?: string;
  dateFrom?: string;
  dateTo?: string;
  isRead?: boolean;
  includeResolved?: boolean;
  environment?: 'sandbox' | 'production';
};

