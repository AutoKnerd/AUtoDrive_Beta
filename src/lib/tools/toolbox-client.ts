import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';
import type { ToolboxCapturedRole } from '@/lib/tools/entitlements';
import type { ToolboxEntitlements } from '@/lib/tools/entitlements';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

async function parseApiResponse<T>(response: Response): Promise<ApiResult<T>> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    return {
      ok: false,
      message: String(payload?.message || 'Request failed.'),
      code: payload?.code ? String(payload.code) : undefined,
    };
  }

  return { ok: true, data: payload as T };
}

export async function captureToolboxUnlockEmail(input: { email: string; role: ToolboxCapturedRole }): Promise<ApiResult<{ ok: true }>> {
  const response = await fetch('/api/tools/toolbox-unlocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, role: input.role }),
  });

  return parseApiResponse<{ ok: true }>(response);
}

export async function createToolboxFreeAccount(input: {
  idToken: string;
  localEntries: ToolboxSavedEntry[];
  toolsUsedCount?: number;
  accountProfile?: { email: string; role: ToolboxCapturedRole } | null;
}): Promise<ApiResult<{ tier: 'free' | 'pro'; toolAccessLevel: number; entitlements?: ToolboxEntitlements }>> {
  const response = await fetch('/api/tools/toolbox-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      action: 'bootstrap_free',
      localEntries: input.localEntries,
      toolsUsedCount: input.toolsUsedCount ?? 0,
      accountProfile: input.accountProfile ?? null,
    }),
  });

  return parseApiResponse<{ tier: 'free' | 'pro'; toolAccessLevel: number; entitlements?: ToolboxEntitlements }>(response);
}

export async function syncToolboxPaidStatus(input: {
  idToken: string;
}): Promise<ApiResult<{ tier: 'free' | 'pro'; toolAccessLevel: number; isPaid: boolean; entitlements?: ToolboxEntitlements }>> {
  const response = await fetch('/api/tools/toolbox-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      action: 'sync_paid_status',
    }),
  });

  return parseApiResponse<{ tier: 'free' | 'pro'; toolAccessLevel: number; isPaid: boolean; entitlements?: ToolboxEntitlements }>(response);
}

export async function saveToolboxEntry(input: {
  idToken: string;
  toolId: string;
  content: string;
}): Promise<ApiResult<{ entry: ToolboxSavedEntry }>> {
  const response = await fetch('/api/tools/toolbox-entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      toolId: input.toolId,
      content: input.content,
    }),
  });

  return parseApiResponse<{ entry: ToolboxSavedEntry }>(response);
}

export async function fetchToolboxEntries(input: {
  idToken: string;
  limit?: number;
}): Promise<ApiResult<{ entries: ToolboxSavedEntry[] }>> {
  const query = new URLSearchParams({ limit: String(input.limit || 12) });

  const response = await fetch(`/api/tools/toolbox-entries?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${input.idToken}`,
    },
  });

  return parseApiResponse<{ entries: ToolboxSavedEntry[] }>(response);
}

export async function fetchToolboxEntitlements(input: {
  idToken: string;
}): Promise<ApiResult<{ entitlements: ToolboxEntitlements }>> {
  const response = await fetch('/api/tools/toolbox-entitlements', {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${input.idToken}`,
    },
  });

  return parseApiResponse<{ entitlements: ToolboxEntitlements }>(response);
}

export async function trackRecommendationEventServer(input: {
  idToken: string;
  type: 'recommended_tool_shown' | 'recommended_tool_clicked' | 'recommended_tool_dismissed' | 'recommended_tool_ignored';
  toolId: string;
  role?: string;
  mode?: 'BASIC' | 'ACCOUNT' | 'AUTODRIVECX';
  intent?: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt?: string;
}): Promise<ApiResult<{ ok: true }>> {
  const response = await fetch('/api/tools/recommendation-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse<{ ok: true }>(response);
}
