'use client';

import { useEffect } from 'react';
import { type ReactNode } from 'react';
import { useFeatureGate } from '@/hooks/use-entitlements';
import type { FeatureGateResult, ToolboxEntitlements, ToolboxFeatureKey } from '@/lib/tools/entitlements';

type FeatureGateProps = {
  feature: ToolboxFeatureKey;
  entitlements: ToolboxEntitlements;
  fallback?: ReactNode | ((gate: FeatureGateResult) => ReactNode);
  onBlocked?: (gate: FeatureGateResult) => void;
  onAccountGate?: () => ReactNode;
  onPaidGate?: () => ReactNode;
  onAutoDriveCxGate?: () => ReactNode;
  children: ReactNode;
};

export function FeatureGate({
  feature,
  entitlements,
  fallback = null,
  onBlocked,
  onAccountGate,
  onPaidGate,
  onAutoDriveCxGate,
  children,
}: FeatureGateProps) {
  const gate = useFeatureGate(feature, entitlements);

  useEffect(() => {
    if (gate.allowed || !onBlocked) return;
    onBlocked(gate);
  }, [gate, onBlocked]);

  if (gate.allowed) return <>{children}</>;

  if (gate.gate === 'account' && onAccountGate) return <>{onAccountGate()}</>;
  if (gate.gate === 'paid' && onPaidGate) return <>{onPaidGate()}</>;
  if (gate.gate === 'autodrive_cx' && onAutoDriveCxGate) return <>{onAutoDriveCxGate()}</>;

  if (typeof fallback === 'function') {
    return <>{fallback(gate)}</>;
  }

  return <>{fallback}</>;
}
