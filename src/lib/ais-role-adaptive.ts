import type { AisRoleType, FreshUpProfile, UserRole } from '@/lib/definitions';

export const AIS_ROLE_LANGUAGE_VERSION = '2026.03.role-adaptive.v1';

type AisRoleConfig = {
  roleType: AisRoleType;
  interactionLabel: string;
  insightLabel: string;
  summaryLabel: string;
  prebriefLabel: string;
  concerns: string[];
  stages: string[];
  nextStepByRecommended: Record<string, string>;
  customScenario: string;
};

const SALES_CONCERNS = ['price', 'trade value', 'monthly payment', 'reliability', 'technology confusion', 'safety', 'fuel economy'];
const SERVICE_CONCERNS = ['repair cost', 'repair timeline', 'urgency', 'warranty coverage', 'trust in diagnosis', 'transportation disruption', 'service clarity'];
const PARTS_CONCERNS = ['availability', 'backorder delay', 'price', 'fitment confidence', 'installation timing', 'special order trust'];
const FI_CONCERNS = ['payment structure', 'product value', 'contract clarity', 'lender approval', 'paperwork stress', 'protection plan trust'];

const ROLE_CONFIG: Record<AisRoleType, AisRoleConfig> = {
  sales: {
    roleType: 'sales',
    interactionLabel: 'Fresh Up',
    insightLabel: 'Fresh Up Insight',
    summaryLabel: 'Fresh Up Summary',
    prebriefLabel: 'Fresh Up!',
    concerns: SALES_CONCERNS,
    stages: ['just browsing', 'comparing models', 'trade-in evaluation', 'payment discussion', 'ready to buy'],
    nextStepByRecommended: {
      discovery_lesson: 'discovery_lesson',
      trust_building_lesson: 'trust_building_lesson',
      closing_lesson: 'closing_lesson',
      relationship_lesson: 'relationship_lesson',
      follow_up_lesson: 'follow_up_lesson',
      no_recommendation: 'no_recommendation',
    },
    customScenario: 'A higher-level customer just entered the showroom. This conversation will require stronger listening, trust building, and clarity.',
  },
  service: {
    roleType: 'service',
    interactionLabel: 'Service Interaction',
    insightLabel: 'Service Interaction Insight',
    summaryLabel: 'Service Interaction Summary',
    prebriefLabel: 'Service Interaction',
    concerns: SERVICE_CONCERNS,
    stages: ['appointment check-in', 'diagnosis review', 'repair authorization', 'timeline update', 'ready for pickup'],
    nextStepByRecommended: {
      discovery_lesson: 'write_up_clarity',
      trust_building_lesson: 'repair_trust_language',
      closing_lesson: 'approval_clarity',
      relationship_lesson: 'guest_reassurance',
      follow_up_lesson: 'status_follow_up',
      no_recommendation: 'no_recommendation',
    },
    customScenario: 'A service guest needs clear guidance and confidence in the next repair step. Keep the conversation calm, transparent, and customer-centered.',
  },
  parts: {
    roleType: 'parts',
    interactionLabel: 'Counter Interaction',
    insightLabel: 'Counter Interaction Insight',
    summaryLabel: 'Counter Interaction Summary',
    prebriefLabel: 'Counter Interaction',
    concerns: PARTS_CONCERNS,
    stages: ['availability request', 'fitment confirmation', 'special-order discussion', 'eta update', 'pickup-ready confirmation'],
    nextStepByRecommended: {
      discovery_lesson: 'fitment_discovery',
      trust_building_lesson: 'availability_transparency',
      closing_lesson: 'order_confirmation',
      relationship_lesson: 'counter_rapport',
      follow_up_lesson: 'eta_follow_up',
      no_recommendation: 'no_recommendation',
    },
    customScenario: 'A counter guest needs confidence on fitment, timing, and next steps. Keep explanations clear and set realistic expectations.',
  },
  fi: {
    roleType: 'fi',
    interactionLabel: 'Buyer Review',
    insightLabel: 'Buyer Review Insight',
    summaryLabel: 'Buyer Review Summary',
    prebriefLabel: 'Buyer Review',
    concerns: FI_CONCERNS,
    stages: ['menu discussion', 'payment structure review', 'lender approval discussion', 'paperwork review', 'signing readiness'],
    nextStepByRecommended: {
      discovery_lesson: 'buyer_needs_review',
      trust_building_lesson: 'finance_transparency',
      closing_lesson: 'signing_confidence',
      relationship_lesson: 'delivery_reassurance',
      follow_up_lesson: 'post_delivery_follow_up',
      no_recommendation: 'no_recommendation',
    },
    customScenario: 'A buyer needs clarity and confidence before signing. Slow down the explanation, check understanding, and guide the next step with trust.',
  },
};

export function resolveAisRoleType(userRole: UserRole | null | undefined): AisRoleType {
  if (userRole === 'Service Writer' || userRole === 'Service Manager') return 'service';
  if (userRole === 'Parts Consultant' || userRole === 'Parts Manager') return 'parts';
  if (userRole === 'Finance Manager') return 'fi';
  return 'sales';
}

export function resolveAisRoleTypeFromSandbox(
  requested: AisRoleType | 'random' | undefined,
  fallbackRole: UserRole | null | undefined
): AisRoleType {
  if (requested && requested !== 'random') return requested;
  return resolveAisRoleType(fallbackRole);
}

export function getAisRoleConfig(roleType: AisRoleType): AisRoleConfig {
  return ROLE_CONFIG[roleType];
}

export function getAisInteractionLabel(roleType: AisRoleType): string {
  return getAisRoleConfig(roleType).interactionLabel;
}

export function getAisInsightLabel(roleType: AisRoleType): string {
  return getAisRoleConfig(roleType).insightLabel;
}

export function getAisSummaryLabel(roleType: AisRoleType): string {
  return getAisRoleConfig(roleType).summaryLabel;
}

export function getRoleAwareConcernPool(roleType: AisRoleType): string[] {
  return [...getAisRoleConfig(roleType).concerns];
}

export function getRoleAwareStagePool(roleType: AisRoleType): string[] {
  return [...getAisRoleConfig(roleType).stages];
}

export function getRoleAwareNextStep(roleType: AisRoleType, recommendedNextStep: string | null | undefined): string {
  const config = getAisRoleConfig(roleType);
  if (!recommendedNextStep) return config.nextStepByRecommended.no_recommendation;
  return config.nextStepByRecommended[recommendedNextStep] ?? recommendedNextStep;
}

export function getRoleAwareCustomScenario(roleType: AisRoleType): string {
  return getAisRoleConfig(roleType).customScenario;
}

function withFallbackConcern(roleType: AisRoleType, concern: string): string {
  if (!concern || concern.trim().length === 0) return getAisRoleConfig(roleType).concerns[0];
  return concern;
}

export function adaptFreshUpProfileToRole(profile: FreshUpProfile, roleType: AisRoleType): FreshUpProfile {
  const interaction = getAisInteractionLabel(roleType);
  return {
    ...profile,
    scenarioName: profile.scenarioName || `${interaction} Scenario`,
    primaryConcern: withFallbackConcern(roleType, profile.primaryConcern),
    conversationPrompt: `${profile.conversationPrompt} Role context: ${interaction}. Keep language natural for ${roleType.toUpperCase()} conversations.`,
    scenarioPrompt: `${profile.scenarioPrompt || profile.conversationPrompt} Role context: ${interaction}.`,
  };
}

export function getRoleAwareSprocketOpeners(roleType: AisRoleType): string[] {
  if (roleType === 'service') {
    return [
      'Service guest up. Clarify first, then guide the process.',
      'This guest wants confidence. Lead with calm, clear next steps.',
    ];
  }
  if (roleType === 'parts') {
    return [
      'Counter guest up. Confirm fitment and timing before options.',
      'Keep this tight and clear. Set expectations early.',
    ];
  }
  if (roleType === 'fi') {
    return [
      'Buyer review up. Clarity and confidence before signatures.',
      'Slow the explanation down. Make each step easy to follow.',
    ];
  }
  return [
    'Fresh up on the floor. Read the room before you read the brochure.',
    'New up. Tone first, details second.',
  ];
}

