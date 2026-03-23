import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';

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

export async function captureToolboxUnlockEmail(email: string): Promise<ApiResult<{ ok: true }>> {
  const response = await fetch('/api/tools/toolbox-unlocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  return parseApiResponse<{ ok: true }>(response);
}

export async function createToolboxFreeAccount(input: {
  idToken: string;
  localEntries: ToolboxSavedEntry[];
}): Promise<ApiResult<{ tier: 'free' | 'pro'; toolAccessLevel: number }>> {
  const response = await fetch('/api/tools/toolbox-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      action: 'bootstrap_free',
      localEntries: input.localEntries,
    }),
  });

  return parseApiResponse<{ tier: 'free' | 'pro'; toolAccessLevel: number }>(response);
}

export async function syncToolboxPaidStatus(input: {
  idToken: string;
}): Promise<ApiResult<{ tier: 'free' | 'pro'; toolAccessLevel: number; isPaid: boolean }>> {
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

  return parseApiResponse<{ tier: 'free' | 'pro'; toolAccessLevel: number; isPaid: boolean }>(response);
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
