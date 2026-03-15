import type { AisRoleType } from '@/lib/definitions';

export type RoleToneProfile = {
  tone: string;
  customerMindset: string;
  typicalConcerns: string[];
  languageStyle: string;
  conversationLength: 'short' | 'short-medium' | 'medium' | 'medium-long';
};

export type RoleExchangeTarget = {
  min: number;
  max: number;
};

export const ROLE_TONE_PROFILES: Record<AisRoleType, RoleToneProfile> = {
  sales: {
    tone: 'shopping / exploratory',
    customerMindset: 'curious but cautious',
    typicalConcerns: [
      'price',
      'trade value',
      'vehicle reliability',
      'monthly payment',
      'technology understanding',
    ],
    languageStyle: 'casual conversational',
    conversationLength: 'medium',
  },
  service: {
    tone: 'problem resolution',
    customerMindset: 'time-sensitive and practical',
    typicalConcerns: [
      'repair cost',
      'repair timeline',
      'vehicle safety',
      'service trust',
      'unexpected problems',
    ],
    languageStyle: 'direct and practical',
    conversationLength: 'short-medium',
  },
  parts: {
    tone: 'transactional',
    customerMindset: 'specific need',
    typicalConcerns: [
      'part availability',
      'price',
      'compatibility',
      'installation guidance',
    ],
    languageStyle: 'quick and focused',
    conversationLength: 'short',
  },
  fi: {
    tone: 'decision confirmation',
    customerMindset: 'financial caution',
    typicalConcerns: [
      'budget',
      'protection value',
      'payment clarity',
      'contract understanding',
    ],
    languageStyle: 'analytical but cautious',
    conversationLength: 'medium-long',
  },
};

export const ROLE_EXCHANGE_TARGETS: Record<AisRoleType, RoleExchangeTarget> = {
  sales: { min: 6, max: 8 },
  service: { min: 4, max: 6 },
  parts: { min: 3, max: 4 },
  fi: { min: 6, max: 8 },
};

export function getRoleToneProfile(roleType: AisRoleType): RoleToneProfile {
  return ROLE_TONE_PROFILES[roleType];
}

export function getRoleExchangeTarget(roleType: AisRoleType): RoleExchangeTarget {
  return ROLE_EXCHANGE_TARGETS[roleType];
}

export function getRoleTurnTargets(roleType: AisRoleType): {
  minUserExchanges: number;
  maxUserExchanges: number;
  minTotalTurns: number;
  maxTotalTurns: number;
} {
  const target = getRoleExchangeTarget(roleType);
  return {
    minUserExchanges: target.min,
    maxUserExchanges: target.max,
    minTotalTurns: target.min * 2,
    maxTotalTurns: target.max * 2,
  };
}

