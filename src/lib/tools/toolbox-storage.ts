import type { ToolboxAccountSession, ToolboxSavedEntry, ToolboxUserState } from '@/lib/tools/toolbox';

const UNLOCK_STATE_KEY = 'toolboxUnlockStateV1';
const ACCOUNT_SESSION_KEY = 'toolboxAccountSessionV1';
const TEMP_DRAFTS_KEY = 'toolboxTempDraftsV1';
const FULL_TOOL_HANDOFF_KEY = 'toolboxFullToolHandoffV1';

type UnlockState = {
  userState: Extract<ToolboxUserState, 'email_unlocked'>;
  email: string;
  unlockedAt: string;
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

export function readUnlockState(): UnlockState | null {
  if (!canUseStorage()) return null;
  return parseJson<UnlockState>(localStorage.getItem(UNLOCK_STATE_KEY));
}

export function writeUnlockState(email: string): void {
  if (!canUseStorage()) return;
  const payload: UnlockState = {
    userState: 'email_unlocked',
    email,
    unlockedAt: new Date().toISOString(),
  };
  localStorage.setItem(UNLOCK_STATE_KEY, JSON.stringify(payload));
}

export function clearUnlockState(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(UNLOCK_STATE_KEY);
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
