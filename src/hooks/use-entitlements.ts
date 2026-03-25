'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  buildEntitlements,
  canAccessFeature as canAccessFeatureByKey,
  getUserEntitlements,
  evaluateFeatureGate,
  type FeatureGateResult,
  type ToolboxAccountProfile,
  type ToolboxCapturedRole,
  type ToolboxEntitlements,
  type ToolboxFeatureKey,
} from '@/lib/tools/entitlements';
import {
  clearAccountProfile,
  clearToolUsage,
  getUsedToolIds,
  getToolsUsedCount,
  markToolUsed,
  readAccountProfile,
  writeAccountProfile,
} from '@/lib/tools/toolbox-storage';

type UseEntitlementsInput = {
  isAuthenticated: boolean;
  hasPaidAccess: boolean;
  hasAutoDriveCX: boolean;
};

export function useEntitlements(input: UseEntitlementsInput): {
  entitlements: ToolboxEntitlements;
  setServerEntitlements: (next: ToolboxEntitlements | null) => void;
  accountProfile: ToolboxAccountProfile | null;
  usedToolIds: string[];
  setLocalAccountProfile: (profile: { email: string; role: ToolboxCapturedRole }) => ToolboxAccountProfile | null;
  registerToolUsage: (toolId: string) => number;
  refreshLocalEntitlements: () => void;
  clearLocalEntitlements: () => void;
  checkFeature: (feature: ToolboxFeatureKey) => FeatureGateResult;
  canAccessFeature: (feature: ToolboxFeatureKey) => boolean;
} {
  const { firebaseUser } = useAuth();
  const [accountProfile, setAccountProfile] = useState<ToolboxAccountProfile | null>(null);
  const [toolsUsedCount, setToolsUsedCount] = useState(0);
  const [usedToolIds, setUsedToolIds] = useState<string[]>([]);
  const [serverEntitlements, setServerEntitlements] = useState<ToolboxEntitlements | null>(null);

  const refreshLocalEntitlements = useCallback(() => {
    setAccountProfile(readAccountProfile());
    setToolsUsedCount(getToolsUsedCount());
    setUsedToolIds(getUsedToolIds());
  }, []);

  useEffect(() => {
    refreshLocalEntitlements();
  }, [refreshLocalEntitlements]);

  useEffect(() => {
    if (input.isAuthenticated) return;
    setServerEntitlements(null);
  }, [input.isAuthenticated]);

  useEffect(() => {
    if (!input.isAuthenticated || !firebaseUser) return;
    let cancelled = false;

    async function syncServerEntitlements() {
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch('/api/tools/toolbox-entitlements', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.entitlements) return;
        if (!cancelled) {
          setServerEntitlements(payload.entitlements as ToolboxEntitlements);
        }
      } catch {
        // Best effort sync. Local entitlements still provide fallback behavior.
      }
    }

    void syncServerEntitlements();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, input.hasAutoDriveCX, input.hasPaidAccess, input.isAuthenticated]);

  const entitlements = useMemo(
    () => {
      if (!input.isAuthenticated) {
        return buildEntitlements({
          isAuthenticated: false,
          hasPaidAccess: false,
          hasAutoDriveCX: false,
          toolsUsedCount,
          localAccountProfile: accountProfile,
        });
      }

      return getUserEntitlements({
        hasAccount: true,
        hasPaidAccess: serverEntitlements?.hasPaidAccess ?? input.hasPaidAccess,
        hasAutoDriveCX: serverEntitlements?.hasAutoDriveCX ?? input.hasAutoDriveCX,
        toolsUsedCount: Math.max(
          toolsUsedCount,
          serverEntitlements?.usage.toolsUsedCount ?? 0
        ),
      });
    },
    [accountProfile, input.hasAutoDriveCX, input.hasPaidAccess, input.isAuthenticated, serverEntitlements, toolsUsedCount]
  );

  const registerToolUsage = useCallback((toolId: string): number => {
    const count = markToolUsed(toolId);
    setToolsUsedCount(count);
    setUsedToolIds(getUsedToolIds());
    return count;
  }, []);

  const setLocalAccountProfile = useCallback((profile: { email: string; role: ToolboxCapturedRole }): ToolboxAccountProfile | null => {
    const next = writeAccountProfile(profile);
    setAccountProfile(next);
    return next;
  }, []);

  const clearLocalEntitlements = useCallback(() => {
    clearAccountProfile();
    clearToolUsage();
    setAccountProfile(null);
    setToolsUsedCount(0);
    setUsedToolIds([]);
  }, []);

  const checkFeature = useCallback((feature: ToolboxFeatureKey): FeatureGateResult => {
    return evaluateFeatureGate(entitlements, feature);
  }, [entitlements]);

  const canAccessFeature = useCallback((feature: ToolboxFeatureKey): boolean => {
    return canAccessFeatureByKey(entitlements, feature);
  }, [entitlements]);

  return {
    entitlements,
    setServerEntitlements,
    accountProfile,
    usedToolIds,
    setLocalAccountProfile,
    registerToolUsage,
    refreshLocalEntitlements,
    clearLocalEntitlements,
    checkFeature,
    canAccessFeature,
  };
}

export function useFeatureGate(feature: ToolboxFeatureKey, entitlements: ToolboxEntitlements): FeatureGateResult {
  return useMemo(() => evaluateFeatureGate(entitlements, feature), [entitlements, feature]);
}
