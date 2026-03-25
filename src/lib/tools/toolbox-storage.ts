import type { ToolboxAccountSession, ToolboxSavedEntry } from '@/lib/tools/toolbox';
import type { ToolboxAccountProfile, ToolboxCapturedRole } from '@/lib/tools/entitlements';
import { isCanonicalUserRole, normalizeLegacyToolboxRole } from '@/lib/tools/entitlements';
import type { UserRole } from '@/lib/definitions';

const LEGACY_UNLOCK_STATE_KEY = 'toolboxUnlockStateV1';
const ACCOUNT_PROFILE_KEY = 'toolboxAccountProfileV1';
const ACCOUNT_SESSION_KEY = 'toolboxAccountSessionV1';
const TOOL_USAGE_KEY = 'toolboxToolUsageV1';
const TEMP_DRAFTS_KEY = 'toolboxTempDraftsV1';
const FULL_TOOL_HANDOFF_KEY = 'toolboxFullToolHandoffV1';
const RECOMMENDATION_EVENTS_KEY = 'toolboxRecommendationEventsV1';

type LegacyUnlockState = {
  userState: 'email_unlocked';
  email: string;
  unlockedAt: string;
};

type ToolUsageState = {
  toolIds: string[];
  updatedAt: string;
};

type TempDrafts = Record<string, { content: string; createdAt: string }>;
type FullToolHandoff = Record<string, { payload: unknown; createdAt: string }>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isCapturedRole(value: unknown): value is ToolboxCapturedRole {
  return isCanonicalUserRole(value);
}

function readLegacyUnlockState(): LegacyUnlockState | null {
  if (!canUseStorage()) return null;
  return parseJson<LegacyUnlockState>(localStorage.getItem(LEGACY_UNLOCK_STATE_KEY));
}

export function readAccountProfile(): ToolboxAccountProfile | null {
  if (!canUseStorage()) return null;

  const profile = parseJson<ToolboxAccountProfile>(localStorage.getItem(ACCOUNT_PROFILE_KEY));
  if (profile?.email) {
    return {
      email: normalizeEmail(profile.email),
      role: normalizeLegacyToolboxRole(profile.role),
      capturedAt: profile.capturedAt || new Date().toISOString(),
    };
  }

  const legacy = readLegacyUnlockState();
  if (!legacy?.email) return null;

  const migrated: ToolboxAccountProfile = {
    email: normalizeEmail(legacy.email),
    role: 'Sales Consultant',
    capturedAt: legacy.unlockedAt || new Date().toISOString(),
  };

  localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(migrated));
  localStorage.removeItem(LEGACY_UNLOCK_STATE_KEY);
  return migrated;
}

export function writeAccountProfile(input: { email: string; role: ToolboxCapturedRole }): ToolboxAccountProfile | null {
  if (!canUseStorage()) return null;

  const email = normalizeEmail(input.email);
  if (!email) return null;
  const normalizedRole = normalizeLegacyToolboxRole(input.role);
  if (!isCapturedRole(normalizedRole)) return null;

  const payload: ToolboxAccountProfile = {
    email,
    role: normalizedRole,
    capturedAt: new Date().toISOString(),
  };

  localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearAccountProfile(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCOUNT_PROFILE_KEY);
  localStorage.removeItem(LEGACY_UNLOCK_STATE_KEY);
}

function readToolUsageState(): ToolUsageState {
  if (!canUseStorage()) return { toolIds: [], updatedAt: new Date().toISOString() };
  const parsed = parseJson<ToolUsageState>(localStorage.getItem(TOOL_USAGE_KEY));
  if (!parsed || !Array.isArray(parsed.toolIds)) {
    return { toolIds: [], updatedAt: new Date().toISOString() };
  }

  const deduped = Array.from(new Set(parsed.toolIds.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)));
  return {
    toolIds: deduped,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

function writeToolUsageState(state: ToolUsageState): void {
  if (!canUseStorage()) return;
  localStorage.setItem(TOOL_USAGE_KEY, JSON.stringify(state));
}

export function getUsedToolIds(): string[] {
  return readToolUsageState().toolIds;
}

export function getToolsUsedCount(): number {
  return readToolUsageState().toolIds.length;
}

export function markToolUsed(toolId: string): number {
  const trimmedToolId = String(toolId || '').trim();
  if (!trimmedToolId) return getToolsUsedCount();

  const current = readToolUsageState();
  if (current.toolIds.includes(trimmedToolId)) return current.toolIds.length;

  const next: ToolUsageState = {
    toolIds: [...current.toolIds, trimmedToolId],
    updatedAt: new Date().toISOString(),
  };
  writeToolUsageState(next);
  return next.toolIds.length;
}

export function clearToolUsage(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOOL_USAGE_KEY);
}

export function readAccountSession(): ToolboxAccountSession | null {
  if (!canUseStorage()) return null;
  return parseJson<ToolboxAccountSession>(localStorage.getItem(ACCOUNT_SESSION_KEY));
}

export function writeAccountSession(session: ToolboxAccountSession): void {
  if (!canUseStorage()) return;
  localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(session));
}

export function clearAccountSession(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCOUNT_SESSION_KEY);
}

export function readTempDrafts(): TempDrafts {
  if (!canUseStorage()) return {};
  return parseJson<TempDrafts>(localStorage.getItem(TEMP_DRAFTS_KEY)) || {};
}

export function getTempDraft(toolId: string): string {
  const drafts = readTempDrafts();
  return drafts[toolId]?.content || '';
}

export function writeTempDraft(toolId: string, content: string): void {
  if (!canUseStorage()) return;
  const drafts = readTempDrafts();
  const trimmed = content.trim();

  if (!trimmed) {
    delete drafts[toolId];
  } else {
    drafts[toolId] = {
      content,
      createdAt: drafts[toolId]?.createdAt || new Date().toISOString(),
    };
  }

  localStorage.setItem(TEMP_DRAFTS_KEY, JSON.stringify(drafts));
}

export function clearTempDrafts(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(TEMP_DRAFTS_KEY);
}

export function exportTempDraftsAsEntries(): ToolboxSavedEntry[] {
  const drafts = readTempDrafts();
  return Object.entries(drafts).map(([toolId, value]) => ({
    id: `${toolId}-${value.createdAt}`,
    toolId,
    content: value.content,
    createdAt: value.createdAt,
  }));
}

export function writeFullToolHandoff(toolId: string, payload: unknown): void {
  if (!canUseStorage()) return;
  const handoff = parseJson<FullToolHandoff>(localStorage.getItem(FULL_TOOL_HANDOFF_KEY)) || {};
  handoff[toolId] = {
    payload,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(FULL_TOOL_HANDOFF_KEY, JSON.stringify(handoff));
}

export function readFullToolHandoff<T = unknown>(toolId: string): T | null {
  if (!canUseStorage()) return null;
  const handoff = parseJson<FullToolHandoff>(localStorage.getItem(FULL_TOOL_HANDOFF_KEY)) || {};
  const row = handoff[toolId];
  if (!row) return null;
  return (row.payload as T) || null;
}

export function clearFullToolHandoff(toolId: string): void {
  if (!canUseStorage()) return;
  const handoff = parseJson<FullToolHandoff>(localStorage.getItem(FULL_TOOL_HANDOFF_KEY)) || {};
  if (!handoff[toolId]) return;
  delete handoff[toolId];
  localStorage.setItem(FULL_TOOL_HANDOFF_KEY, JSON.stringify(handoff));
}

export type RecommendationEventType =
  | 'recommended_tool_shown'
  | 'recommended_tool_clicked'
  | 'recommended_tool_dismissed'
  | 'recommended_tool_ignored';

export type RecommendationEvent = {
  id: string;
  type: RecommendationEventType;
  toolId: string;
  role?: UserRole;
  mode?: 'BASIC' | 'ACCOUNT' | 'AUTODRIVECX';
  intent?: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
};

function readRecommendationEvents(): RecommendationEvent[] {
  if (!canUseStorage()) return [];
  const rows = parseJson<RecommendationEvent[]>(localStorage.getItem(RECOMMENDATION_EVENTS_KEY));
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row.type === 'string' && typeof row.toolId === 'string' && typeof row.createdAt === 'string');
}

function writeRecommendationEvents(rows: RecommendationEvent[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(RECOMMENDATION_EVENTS_KEY, JSON.stringify(rows.slice(-300)));
}

export function listRecommendationEvents(): RecommendationEvent[] {
  return readRecommendationEvents();
}

export function trackRecommendationEvent(
  input: Omit<RecommendationEvent, 'id' | 'createdAt'>
): RecommendationEvent | null {
  if (!input.toolId || !input.type) return null;
  const event: RecommendationEvent = {
    ...input,
    id: `${input.type}:${input.toolId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const rows = readRecommendationEvents();
  rows.push(event);
  writeRecommendationEvents(rows);
  return event;
}

export function clearRecommendationEvents(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(RECOMMENDATION_EVENTS_KEY);
}
