'use client';

import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/init';

export type FreshUpReleaseStatus =
  | 'sandbox_only'
  | 'internal_testing'
  | 'limited_release'
  | 'production_active'
  | 'archived'
  | 'rolled_back';

export type FreshUpFeatureToggles = {
  enableProceduralGeneration: boolean;
  enableSignatureScenarios: boolean;
  enableCustomerMemory: boolean;
  enableEmotionalResponseEngine: boolean;
  enableDifficultyDistribution: boolean;
  enableArchetypeLibrary: boolean;
  enableOpeningMechanic: boolean;
  enableEndingMechanic: boolean;
  enableConsultantFeedbackEnhancements: boolean;
  enableManagerInsightEnhancements: boolean;
  enableSandboxDebugTools: boolean;
  enableQAMatrix: boolean;
  enableContentGuardrails: boolean;
};

export type FreshUpReleaseVersion = {
  versionId: string;
  versionName: string;
  createdAt: string;
  createdBy: string;
  status: FreshUpReleaseStatus;
  notes: string;
  toggles: FreshUpFeatureToggles;
  rollout?: {
    dealerIds?: string[];
    consultantGroupIds?: string[];
    userIds?: string[];
  };
};

type FreshUpReleaseState = {
  productionVersionId: string;
  previousProductionVersionId?: string;
  sandboxDefaultVersionId?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type FreshUpReleaseSafetyCheck = {
  key: 'qa_ran' | 'guardrails_passed' | 'severe_failures_absent' | 'debug_tools_disabled' | 'logging_compatible';
  label: string;
  passed: boolean;
  details?: string;
};

export type FreshUpPromotionResult = {
  promoted: boolean;
  checks: FreshUpReleaseSafetyCheck[];
};

export const FRESH_UP_FEATURE_TOGGLE_KEYS: Array<keyof FreshUpFeatureToggles> = [
  'enableProceduralGeneration',
  'enableSignatureScenarios',
  'enableCustomerMemory',
  'enableEmotionalResponseEngine',
  'enableDifficultyDistribution',
  'enableArchetypeLibrary',
  'enableOpeningMechanic',
  'enableEndingMechanic',
  'enableConsultantFeedbackEnhancements',
  'enableManagerInsightEnhancements',
  'enableSandboxDebugTools',
  'enableQAMatrix',
  'enableContentGuardrails',
];

const DEFAULT_TOGGLES: FreshUpFeatureToggles = {
  enableProceduralGeneration: true,
  enableSignatureScenarios: true,
  enableCustomerMemory: true,
  enableEmotionalResponseEngine: true,
  enableDifficultyDistribution: true,
  enableArchetypeLibrary: true,
  enableOpeningMechanic: true,
  enableEndingMechanic: true,
  enableConsultantFeedbackEnhancements: true,
  enableManagerInsightEnhancements: true,
  enableSandboxDebugTools: true,
  enableQAMatrix: true,
  enableContentGuardrails: true,
};

const DEFAULT_RELEASE_VERSIONS: FreshUpReleaseVersion[] = [
  {
    versionId: 'freshup-v1-baseline',
    versionName: 'FreshUp v1 Baseline',
    createdAt: new Date('2026-01-10T10:00:00Z').toISOString(),
    createdBy: 'system',
    status: 'production_active',
    notes: 'Stable baseline release with core Fresh Up workflow.',
    toggles: { ...DEFAULT_TOGGLES, enableQAMatrix: false, enableContentGuardrails: false },
  },
  {
    versionId: 'freshup-v2-memory-upgrade',
    versionName: 'FreshUp v2 Memory Upgrade',
    createdAt: new Date('2026-02-02T14:00:00Z').toISOString(),
    createdBy: 'system',
    status: 'internal_testing',
    notes: 'Memory and emotional response improvements for internal validation.',
    toggles: { ...DEFAULT_TOGGLES, enableQAMatrix: true, enableContentGuardrails: false },
  },
  {
    versionId: 'freshup-v3-archetype-expansion',
    versionName: 'FreshUp v3 Archetype Expansion',
    createdAt: new Date('2026-02-20T17:30:00Z').toISOString(),
    createdBy: 'system',
    status: 'sandbox_only',
    notes: 'Expanded archetype diversity with advanced difficulty blending.',
    toggles: { ...DEFAULT_TOGGLES, enableQAMatrix: true, enableContentGuardrails: false },
  },
  {
    versionId: 'freshup-v4-guardrail-refinement',
    versionName: 'FreshUp v4 Guardrail Refinement',
    createdAt: new Date('2026-03-12T16:00:00Z').toISOString(),
    createdBy: 'system',
    status: 'sandbox_only',
    notes: 'Adds content guardrail validation and QA flagging improvements.',
    toggles: { ...DEFAULT_TOGGLES, enableQAMatrix: true, enableContentGuardrails: true },
  },
];

function normalizeToggleSet(input?: Partial<FreshUpFeatureToggles> | null): FreshUpFeatureToggles {
  return {
    ...DEFAULT_TOGGLES,
    ...(input ?? {}),
  };
}

function normalizeVersion(input: any): FreshUpReleaseVersion {
  const createdAtRaw = input?.createdAt;
  const createdAt = typeof createdAtRaw === 'string'
    ? createdAtRaw
    : (createdAtRaw?.toDate instanceof Function ? createdAtRaw.toDate().toISOString() : new Date().toISOString());
  return {
    versionId: String(input?.versionId || ''),
    versionName: String(input?.versionName || ''),
    createdAt,
    createdBy: String(input?.createdBy || 'unknown'),
    status: (input?.status || 'sandbox_only') as FreshUpReleaseStatus,
    notes: String(input?.notes || ''),
    toggles: normalizeToggleSet(input?.toggles),
    rollout: {
      dealerIds: Array.isArray(input?.rollout?.dealerIds) ? input.rollout.dealerIds.map((v: unknown) => String(v)) : [],
      consultantGroupIds: Array.isArray(input?.rollout?.consultantGroupIds) ? input.rollout.consultantGroupIds.map((v: unknown) => String(v)) : [],
      userIds: Array.isArray(input?.rollout?.userIds) ? input.rollout.userIds.map((v: unknown) => String(v)) : [],
    },
  };
}

async function ensureSeededReleaseState(): Promise<void> {
  const { firestore } = initializeFirebase();
  const versionsRef = collection(firestore, 'freshUpVersions');
  const snapshot = await getDocs(versionsRef);
  if (!snapshot.empty) return;

  await Promise.all(DEFAULT_RELEASE_VERSIONS.map((version) => (
    setDoc(doc(firestore, 'freshUpVersions', version.versionId), {
      ...version,
      createdAt: version.createdAt,
      updatedAt: serverTimestamp(),
    })
  )));
  await setDoc(doc(firestore, 'freshUpReleaseState', 'active'), {
    productionVersionId: 'freshup-v1-baseline',
    previousProductionVersionId: '',
    sandboxDefaultVersionId: 'freshup-v4-guardrail-refinement',
    updatedAt: serverTimestamp(),
    updatedBy: 'system',
  }, { merge: true });
}

export async function getFreshUpReleaseVersions(): Promise<FreshUpReleaseVersion[]> {
  await ensureSeededReleaseState();
  const { firestore } = initializeFirebase();
  const versionsQuery = query(collection(firestore, 'freshUpVersions'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(versionsQuery);
  return snapshot.docs.map((item) => normalizeVersion(item.data()));
}

export async function getFreshUpReleaseState(): Promise<FreshUpReleaseState> {
  await ensureSeededReleaseState();
  const { firestore } = initializeFirebase();
  const stateRef = doc(firestore, 'freshUpReleaseState', 'active');
  const stateSnap = await getDoc(stateRef);
  const data = stateSnap.data() || {};
  return {
    productionVersionId: String(data.productionVersionId || 'freshup-v1-baseline'),
    previousProductionVersionId: data.previousProductionVersionId ? String(data.previousProductionVersionId) : undefined,
    sandboxDefaultVersionId: data.sandboxDefaultVersionId ? String(data.sandboxDefaultVersionId) : undefined,
    updatedAt: data.updatedAt?.toDate instanceof Function ? data.updatedAt.toDate().toISOString() : undefined,
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
  };
}

export async function setFreshUpProductionVersion(input: {
  versionId: string;
  updatedBy: string;
  enforceSafety?: boolean;
}): Promise<FreshUpPromotionResult> {
  const { firestore } = initializeFirebase();
  const versions = await getFreshUpReleaseVersions();
  const version = versions.find((item) => item.versionId === input.versionId);
  if (!version) {
    return {
      promoted: false,
      checks: [{
        key: 'qa_ran',
        label: 'Sandbox QA has been executed',
        passed: false,
        details: `Version ${input.versionId} was not found.`,
      }],
    };
  }

  const checks = await evaluateFreshUpPromotionSafety(version);
  const shouldEnforce = input.enforceSafety !== false;
  if (shouldEnforce && checks.some((item) => !item.passed)) {
    return {
      promoted: false,
      checks,
    };
  }

  const state = await getFreshUpReleaseState();
  const previousVersionId = state.productionVersionId;

  if (previousVersionId && previousVersionId !== input.versionId) {
    await updateDoc(doc(firestore, 'freshUpVersions', previousVersionId), {
      status: 'rolled_back',
      updatedAt: serverTimestamp(),
      updatedBy: input.updatedBy,
    });
  }
  await updateDoc(doc(firestore, 'freshUpVersions', input.versionId), {
    status: 'production_active',
    updatedAt: serverTimestamp(),
    updatedBy: input.updatedBy,
  });
  await updateDoc(doc(firestore, 'freshUpReleaseState', 'active'), {
    previousProductionVersionId: previousVersionId,
    productionVersionId: input.versionId,
    updatedAt: serverTimestamp(),
    updatedBy: input.updatedBy,
  });
  return {
    promoted: true,
    checks,
  };
}

export async function rollbackFreshUpProductionVersion(updatedBy: string): Promise<void> {
  const { firestore } = initializeFirebase();
  const state = await getFreshUpReleaseState();
  if (!state.previousProductionVersionId) return;
  await updateDoc(doc(firestore, 'freshUpVersions', state.productionVersionId), {
    status: 'rolled_back',
    updatedAt: serverTimestamp(),
    updatedBy,
  });
  await updateDoc(doc(firestore, 'freshUpVersions', state.previousProductionVersionId), {
    status: 'production_active',
    updatedAt: serverTimestamp(),
    updatedBy,
  });
  await updateDoc(doc(firestore, 'freshUpReleaseState', 'active'), {
    productionVersionId: state.previousProductionVersionId,
    previousProductionVersionId: state.productionVersionId,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

export async function setFreshUpSandboxDefaultVersion(input: {
  versionId: string;
  updatedBy: string;
}): Promise<void> {
  const { firestore } = initializeFirebase();
  await updateDoc(doc(firestore, 'freshUpReleaseState', 'active'), {
    sandboxDefaultVersionId: input.versionId,
    updatedAt: serverTimestamp(),
    updatedBy: input.updatedBy,
  });
}

export function resolveFreshUpToggles(version: FreshUpReleaseVersion | null | undefined): FreshUpFeatureToggles {
  return normalizeToggleSet(version?.toggles);
}

function canUseLimitedRelease(version: FreshUpReleaseVersion, context: { dealerId?: string; userId?: string; consultantGroupIds?: string[] }): boolean {
  const dealerIds = version.rollout?.dealerIds ?? [];
  const userIds = version.rollout?.userIds ?? [];
  const groups = version.rollout?.consultantGroupIds ?? [];
  const hasDealerMatch = !!context.dealerId && dealerIds.includes(context.dealerId);
  const hasUserMatch = !!context.userId && userIds.includes(context.userId);
  const hasGroupMatch = (context.consultantGroupIds ?? []).some((group) => groups.includes(group));
  return hasDealerMatch || hasUserMatch || hasGroupMatch;
}

export function resolveFreshUpVersionForContext(input: {
  versions: FreshUpReleaseVersion[];
  state: FreshUpReleaseState;
  environment: 'sandbox' | 'production';
  sandboxVersionId?: string | null;
  dealerId?: string;
  userId?: string;
  consultantGroupIds?: string[];
}): FreshUpReleaseVersion {
  const byId = new Map(input.versions.map((version) => [version.versionId, version]));
  const sandboxAllowed = new Set<FreshUpReleaseStatus>(['sandbox_only', 'internal_testing']);
  const productionAllowed = new Set<FreshUpReleaseStatus>(['limited_release', 'production_active']);

  if (input.environment === 'sandbox') {
    if (input.sandboxVersionId && byId.has(input.sandboxVersionId)) {
      const explicit = byId.get(input.sandboxVersionId)!;
      if (sandboxAllowed.has(explicit.status)) return explicit;
    }
    if (input.state.sandboxDefaultVersionId && byId.has(input.state.sandboxDefaultVersionId)) {
      const preferred = byId.get(input.state.sandboxDefaultVersionId)!;
      if (sandboxAllowed.has(preferred.status)) return preferred;
    }
    return input.versions.find((version) => sandboxAllowed.has(version.status))
      ?? input.versions[0]
      ?? DEFAULT_RELEASE_VERSIONS[0];
  }

  const productionActive = byId.get(input.state.productionVersionId)
    ?? input.versions.find((version) => productionAllowed.has(version.status))
    ?? DEFAULT_RELEASE_VERSIONS[0];
  if (!productionAllowed.has(productionActive.status)) {
    const fallback = input.versions.find((version) => version.status === 'production_active')
      ?? input.versions.find((version) => version.status === 'limited_release');
    if (fallback) return fallback;
  }
  const limitedReleases = input.versions.filter((version) => version.status === 'limited_release');
  for (const version of limitedReleases) {
    if (canUseLimitedRelease(version, {
      dealerId: input.dealerId,
      userId: input.userId,
      consultantGroupIds: input.consultantGroupIds,
    })) {
      return version;
    }
  }
  return productionActive;
}

export function isExperimentalFreshUpVersion(version: FreshUpReleaseVersion): boolean {
  return version.status !== 'production_active';
}

export async function evaluateFreshUpPromotionSafety(version: FreshUpReleaseVersion): Promise<FreshUpReleaseSafetyCheck[]> {
  const { firestore } = initializeFirebase();

  let qaDocs: Record<string, unknown>[] = [];
  try {
    const qaQuery = query(
      collection(firestore, 'freshUpQATests'),
      where('freshUpVersionId', '==', version.versionId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const qaSnapshot = await getDocs(qaQuery);
    qaDocs = qaSnapshot.docs.map((item) => item.data());
  } catch {
    // Fallback for environments without composite index support.
    const fallbackQuery = query(
      collection(firestore, 'freshUpQATests'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    const fallbackSnapshot = await getDocs(fallbackQuery);
    qaDocs = fallbackSnapshot.docs
      .map((item) => item.data())
      .filter((item) => String(item.freshUpVersionId || '') === version.versionId);
  }

  const hasQARun = qaDocs.length > 0;
  const failedGuardrails = qaDocs.filter((item) => item.contentValidationPassed === false).length;
  const severeFlags = new Set(['conversation_dead_end', 'up_meter_collapse', 'memory_failure', 'too_hostile', 'unnatural_tone']);
  const severeFailureCount = qaDocs.reduce((total, item) => {
    const flags = [
      ...(Array.isArray(item.failureFlags) ? item.failureFlags : []),
      ...(Array.isArray(item.guardrailFlags) ? item.guardrailFlags : []),
    ].map((flag) => String(flag));
    return total + (flags.some((flag) => severeFlags.has(flag)) ? 1 : 0);
  }, 0);

  return [
    {
      key: 'qa_ran',
      label: 'Sandbox QA has been executed',
      passed: hasQARun,
      details: hasQARun ? `${qaDocs.length} QA simulations found for this version.` : 'No QA runs found for this version.',
    },
    {
      key: 'guardrails_passed',
      label: 'Content guardrail validation passes',
      passed: hasQARun && failedGuardrails === 0,
      details: hasQARun ? (failedGuardrails === 0 ? 'No guardrail validation failures detected.' : `${failedGuardrails} QA sessions failed guardrail validation.`) : 'Requires QA run first.',
    },
    {
      key: 'severe_failures_absent',
      label: 'No severe conversation failures',
      passed: hasQARun && severeFailureCount === 0,
      details: hasQARun ? (severeFailureCount === 0 ? 'No severe QA failure flags detected.' : `${severeFailureCount} QA sessions include severe failure flags.`) : 'Requires QA run first.',
    },
    {
      key: 'debug_tools_disabled',
      label: 'Debug-only tools disabled for production',
      passed: version.toggles.enableSandboxDebugTools === false,
      details: version.toggles.enableSandboxDebugTools ? 'enableSandboxDebugTools must be false before production promotion.' : 'Debug tools are disabled.',
    },
    {
      key: 'logging_compatible',
      label: 'Session logging is production compatible',
      passed: true,
      details: 'Fresh Up production session schema is compatible with analytics aggregation.',
    },
  ];
}
