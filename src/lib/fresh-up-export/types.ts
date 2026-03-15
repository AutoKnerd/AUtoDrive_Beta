export type FreshUpExportType =
  | 'raw_sessions'
  | 'dealer_summary'
  | 'consultant_trends'
  | 'manager_coaching'
  | 'autoforge_triggers'
  | 'marketing_insights'
  | 'benchmarks'
  | 'weekly_digest'
  | 'risk_radar'
  | 'command_center';

export type FreshUpExportFormat = 'csv' | 'json' | 'structured';

export type FreshUpExportFilters = {
  dateFrom?: string;
  dateTo?: string;
  dealerId?: string;
  userId?: string;
  freshUpVersionId?: string;
  environment?: 'sandbox' | 'production';
  sourceType?: 'procedural' | 'signature';
  difficultyLevel?: string;
  archetypeCategory?: string;
  primaryConcern?: string;
  buyingStage?: string;
  personalityType?: string;
  outcomeTag?: string;
  coachingTag?: string;
  isSandbox?: boolean;
  includeSandboxData?: boolean;
};

export type FreshUpNormalizedSession = {
  sessionId: string;
  userId: string;
  dealerId: string;
  timestamp: Date;
  freshUpVersionId: string;
  freshUpVersionName: string;
  environment: 'sandbox' | 'production';
  isSandbox: boolean;
  sourceType: 'procedural' | 'signature' | '';
  roleType: string;
  interactionDisplayLabel: string;
  concernCategoryRoleSpecific: string;
  nextStepType: string;
  interpretationVersion: string;
  customerName: string;
  vehicleInterest: string;
  buyingStage: string;
  personalityType: string;
  communicationStyle: string;
  difficultyLevel: string;
  primaryConcern: string;
  secondaryConcern: string;
  startingMood: string;
  endingEmotionalState: string;
  archetypeId: string;
  archetypeName: string;
  archetypeCategory: string;
  humorLevel: number;
  openingMessage: string;
  finalCustomerResponse: string;
  endingType: string;
  outcomeTag: string;
  recommendedNextStep: string;
  upMeterStart: number;
  upMeterPeak: number;
  upMeterEnd: number;
  trustShift: number;
  empathyDelta: number;
  listeningDelta: number;
  trustDelta: number;
  followUpDelta: number;
  closingDelta: number;
  relationshipDelta: number;
  coachingTag: string;
  summaryTag: string;
  conversationLength: number;
  messagesSent: number;
  xpAwarded: number;
  guardrailFlags: string[];
  contentValidationPassed: boolean;
  validationFailureReasons: string[];
  scores: {
    empathy: number;
    listening: number;
    trust: number;
    followUp: number;
    closing: number;
    relationship: number;
  };
};

export type FreshUpExportBundle = {
  fileName: string;
  mimeType: string;
  content: string;
  preview: string;
  rowCount: number;
};
