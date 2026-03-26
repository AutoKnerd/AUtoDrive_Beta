import { hasActiveSubscriptionStatus } from '@/lib/billing/access';
import type { BillingSubscriptionStatus, UserRole } from '@/lib/definitions';
import { allRoles } from '@/lib/definitions';

export const FREE_TOOL_USAGE_LIMIT = 3;

export const FEATURES = {
  TOOL_ACCESS: 'tool_access',
  SPROCKET: 'sprocket',
  CLOUD_SAVE: 'cloud_save',
  HISTORY: 'history',
  AUTODRIVE_CX: 'autodrive_cx',
} as const;

export type ToolboxFeatureKey = typeof FEATURES[keyof typeof FEATURES];
export type ToolboxGateName = 'none' | 'account' | 'paid' | 'autodrive_cx';
export type ToolboxCapturedRole = UserRole;
export type LegacyToolboxCapturedRole = 'Consultant' | 'Manager' | 'Other';

export type ToolboxAccountProfile = {
  email: string;
  role: ToolboxCapturedRole;
  capturedAt: string;
};

const CANONICAL_ROLE_SET = new Set<UserRole>(allRoles);

export function isCanonicalUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && CANONICAL_ROLE_SET.has(value as UserRole);
}

export function normalizeLegacyToolboxRole(
  value: unknown,
  fallback: UserRole = 'Sales Consultant'
): UserRole {
  if (isCanonicalUserRole(value)) return value;
  if (value === 'Consultant') return 'Sales Consultant';
  if (value === 'Manager') return 'manager';
  if (value === 'Other') return fallback;
  return fallback;
}

export type ToolboxEntitlements = {
  hasAccount: boolean;
  hasPaidAccess: boolean;
  hasAutoDriveCX: boolean;
  usage: {
    toolsUsedCount: number;
  };
  features: Record<ToolboxFeatureKey, boolean>;
};

export type FeatureGateResult = {
  allowed: boolean;
  feature: ToolboxFeatureKey;
  gate: ToolboxGateName;
  trigger:
    | 'none'
    | 'fourth_tool_open'
    | 'first_sprocket_use'
    | 'first_cloud_save'
    | 'first_history_access'
    | 'first_cx_insight';
  message: string;
};

export function resolvePaidAccess(input: {
  tier?: 'free' | 'pro';
  subscriptionStatus?: BillingSubscriptionStatus | null;
  giftedFullAccess?: boolean;
  dealershipSupported?: boolean;
}): boolean {
  if (input.dealershipSupported) return true;
  if (input.giftedFullAccess) return true;
  if (input.tier === 'pro') return true;
  return hasActiveSubscriptionStatus(input.subscriptionStatus ?? null);
}

export function resolveAutoDriveCxAccess(input: {
  hasAutoDriveCX?: boolean;
  giftedFullAccess?: boolean;
  dealershipSupported?: boolean;
}): boolean {
  return Boolean(input.dealershipSupported || input.hasAutoDriveCX || input.giftedFullAccess);
}

export function getUserEntitlements(input: {
  hasAccount: boolean;
  hasPaidAccess: boolean;
  hasAutoDriveCX: boolean;
  toolsUsedCount: number;
}): ToolboxEntitlements {
  const normalizedToolsUsedCount = Math.max(0, Math.floor(input.toolsUsedCount || 0));

  const features: Record<ToolboxFeatureKey, boolean> = {
    [FEATURES.TOOL_ACCESS]: input.hasAccount || normalizedToolsUsedCount < FREE_TOOL_USAGE_LIMIT,
    [FEATURES.SPROCKET]: input.hasAccount && input.hasPaidAccess,
    [FEATURES.CLOUD_SAVE]: input.hasAccount && input.hasPaidAccess,
    [FEATURES.HISTORY]: input.hasAccount && input.hasPaidAccess,
    [FEATURES.AUTODRIVE_CX]: input.hasAccount && input.hasPaidAccess && input.hasAutoDriveCX,
  };

  return {
    hasAccount: input.hasAccount,
    hasPaidAccess: input.hasPaidAccess,
    hasAutoDriveCX: input.hasAutoDriveCX,
    usage: {
      toolsUsedCount: normalizedToolsUsedCount,
    },
    features,
  };
}

export function buildEntitlements(input: {
  isAuthenticated: boolean;
  hasPaidAccess: boolean;
  hasAutoDriveCX: boolean;
  toolsUsedCount: number;
  localAccountProfile: ToolboxAccountProfile | null;
}): ToolboxEntitlements {
  return getUserEntitlements({
    hasAccount: input.isAuthenticated || !!input.localAccountProfile,
    hasPaidAccess: input.hasPaidAccess,
    hasAutoDriveCX: input.hasAutoDriveCX,
    toolsUsedCount: input.toolsUsedCount,
  });
}

export function canAccessFeature(entitlements: ToolboxEntitlements, feature: ToolboxFeatureKey): boolean {
  return entitlements.features[feature] === true;
}

function blocked(feature: ToolboxFeatureKey, gate: ToolboxGateName, trigger: FeatureGateResult['trigger'], message: string): FeatureGateResult {
  return {
    allowed: false,
    feature,
    gate,
    trigger,
    message,
  };
}

function allowed(feature: ToolboxFeatureKey): FeatureGateResult {
  return {
    allowed: true,
    feature,
    gate: 'none',
    trigger: 'none',
    message: '',
  };
}

export function evaluateFeatureGate(entitlements: ToolboxEntitlements, feature: ToolboxFeatureKey): FeatureGateResult {
  if (feature === FEATURES.TOOL_ACCESS) {
    if (canAccessFeature(entitlements, feature)) return allowed(feature);
    return blocked(feature, 'account', 'fourth_tool_open', 'Create your free account to open your 4th tool.');
  }

  if (feature === FEATURES.SPROCKET) {
    if (!entitlements.hasAccount) {
      return blocked(feature, 'account', 'first_sprocket_use', 'Create your free account to continue with Sprocket.');
    }
    if (!canAccessFeature(entitlements, feature)) {
      return blocked(feature, 'paid', 'first_sprocket_use', 'Sprocket is included with paid AutoShop access.');
    }
    return allowed(feature);
  }

  if (feature === FEATURES.CLOUD_SAVE) {
    if (!entitlements.hasAccount) {
      return blocked(feature, 'account', 'first_cloud_save', 'Add your email and role to save your work.');
    }
    if (!canAccessFeature(entitlements, feature)) {
      return blocked(feature, 'paid', 'first_cloud_save', 'Cloud saves require paid AutoShop access.');
    }
    return allowed(feature);
  }

  if (feature === FEATURES.HISTORY) {
    if (!entitlements.hasAccount) {
      return blocked(feature, 'account', 'first_history_access', 'Add your email and role to access history.');
    }
    if (!canAccessFeature(entitlements, feature)) {
      return blocked(feature, 'paid', 'first_history_access', 'Saved history requires paid AutoShop access.');
    }
    return allowed(feature);
  }

  if (!entitlements.hasAccount) {
    return blocked(feature, 'account', 'first_cx_insight', 'Create your free account to continue.');
  }

  if (!entitlements.hasPaidAccess) {
    return blocked(feature, 'paid', 'first_cx_insight', 'Paid AutoShop access is required before CX insights.');
  }

  if (!canAccessFeature(entitlements, feature)) {
    return blocked(feature, 'autodrive_cx', 'first_cx_insight', 'AutoDriveCX subscription required for CX-powered personalization.');
  }

  return allowed(feature);
}
