export type ToolboxUserState = 'visitor' | 'email_unlocked' | 'free_account' | 'paid_account';

export type ToolAccessTier = 'free' | 'premium';

export type ToolConfig = {
  id: string;
  name: string;
  description: string;
  access: ToolAccessTier;
  hasFullVersion: boolean;
  isFeatured: boolean;
  createdAt: string;
};

export type ToolboxSavedEntry = {
  id: string;
  toolId: string;
  content: string;
  createdAt: string;
};

export type ToolboxAccountSession = {
  email: string;
  authToken: string;
  userState: Extract<ToolboxUserState, 'free_account' | 'paid_account'>;
};

export const FREE_ACCOUNT_SAVE_LIMIT = 20;

const TOOL_SEED: Omit<ToolConfig, 'isFeatured'>[] = [
  {
    id: 'signal-mapper',
    name: 'Signal Mapper',
    description: 'Hear what they mean, then turn it into a close.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-20T09:00:00.000Z',
  },
  {
    id: 'objection-reframe',
    name: 'Objection Reframe',
    description: 'Turn hesitation into a clear next step. Fast.',
    access: 'free',
    hasFullVersion: false,
    createdAt: '2026-03-13T09:00:00.000Z',
  },
  {
    id: 'follow-up-cadence',
    name: 'Follow-Up Cadence Builder',
    description: 'Turn one conversation into a 7-day follow-up plan.',
    access: 'free',
    hasFullVersion: false,
    createdAt: '2026-03-06T09:00:00.000Z',
  },
  {
    id: 'handoff-script',
    name: 'Handoff Script Optimizer',
    description: 'Create smooth handoffs with zero drop-off.',
    access: 'premium',
    hasFullVersion: false,
    createdAt: '2026-02-27T09:00:00.000Z',
  },
  {
    id: 'deal-recovery',
    name: 'Deal Recovery Planner',
    description: 'Restart stalled deals with a clear re-engagement plan.',
    access: 'premium',
    hasFullVersion: false,
    createdAt: '2026-02-20T09:00:00.000Z',
  },
  {
    id: 'loyalty-loop',
    name: 'Loyalty Loop Designer',
    description: 'Design post-sale moments that keep them coming back.',
    access: 'premium',
    hasFullVersion: false,
    createdAt: '2026-02-13T09:00:00.000Z',
  },
];

export const TOOLBOX_TOOLS: ToolConfig[] = buildToolConfig(TOOL_SEED);

export function buildToolConfig(seed: Omit<ToolConfig, 'isFeatured'>[]): ToolConfig[] {
  const sorted = [...seed].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const featuredId = sorted[0]?.id;

  return sorted.map((tool) => ({
    ...tool,
    isFeatured: tool.id === featuredId,
  }));
}

export function getFeaturedTool(tools: ToolConfig[]): ToolConfig {
  const fromFlag = tools.find((tool) => tool.isFeatured);
  if (fromFlag) return fromFlag;

  return [...tools].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export function isRecentTool(tool: ToolConfig, tools: ToolConfig[], recentCount = 3): boolean {
  const recentIds = [...tools]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, recentCount)
    .map((entry) => entry.id);

  return recentIds.includes(tool.id);
}

export function canAccessTool(userState: ToolboxUserState, tool: ToolConfig, tools: ToolConfig[]): boolean {
  if (userState === 'paid_account') return true;
  if (userState === 'visitor') return false;

  if (userState === 'email_unlocked') {
    return tool.isFeatured === true;
  }

  if (userState === 'free_account') {
    if (tool.access === 'premium') return false;

    const sortedByDate = [...tools].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const toolIndex = sortedByDate.findIndex((entry) => entry.id === tool.id);
    return toolIndex >= 0 && toolIndex < 3;
  }

  return false;
}

export function ctaForFeaturedTool(userState: ToolboxUserState): string {
  return 'Open Tool';
}

export function ctaForToolCard(tool: ToolConfig, canAccess: boolean): string {
  if (tool.access === 'free') return 'Open Tool';
  return canAccess ? 'Open Tool' : 'Unlock Toolbox';
}
