import { evaluateFeatureGate, FEATURES, type ToolboxEntitlements } from '@/lib/tools/entitlements';
import type { UserRole } from '@/lib/definitions';

export type ToolboxUserState = 'visitor' | 'email_unlocked' | 'free_account' | 'paid_account';

export type ToolAccessTier = 'free' | 'premium';
export type ToolIntentTag =
  | 'Move a deal forward'
  | 'Handle an objection'
  | 'Follow up'
  | 'Present numbers'
  | 'Recover a stalled deal'
  | 'Improve consistency'
  | 'Coach the team';

export const TOOL_INTENT_OPTIONS: ToolIntentTag[] = [
  'Move a deal forward',
  'Handle an objection',
  'Follow up',
  'Present numbers',
  'Recover a stalled deal',
  'Improve consistency',
  'Coach the team',
];

export type ToolRecommendationMetadata = {
  title: string;
  category: string;
  primaryRoles: UserRole[];
  secondaryRoles: UserRole[];
  skillTags: string[];
  intentTags: ToolIntentTag[];
  isFree: boolean;
  isPremium: boolean;
  isNew: boolean;
  estimatedTime: number;
  recommendedWhen: string[];
  notRecommendedWhen: string[];
};

export type ToolConfig = {
  id: string;
  name: string;
  description: string;
  access: ToolAccessTier;
  hasFullVersion: boolean;
  isFeatured: boolean;
  createdAt: string;
} & ToolRecommendationMetadata;

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

type ToolSeed = {
  id: string;
  name: string;
  description: string;
  access: ToolAccessTier;
  hasFullVersion: boolean;
  createdAt: string;
};

const SALES_ROLES: UserRole[] = ['Sales Consultant', 'BDC'];
const SERVICE_ROLES: UserRole[] = ['Service Writer', 'Service Manager'];
const PARTS_ROLES: UserRole[] = ['Parts Consultant', 'Parts Manager'];
const MANAGER_ROLES: UserRole[] = ['manager', 'General Manager', 'Owner', 'Trainer', 'Admin', 'Developer', 'Finance Manager'];

function uniqueRoles(roles: UserRole[]): UserRole[] {
  return Array.from(new Set(roles));
}

function buildMetadataForTool(seed: ToolSeed, allSeeds: ToolSeed[]): ToolRecommendationMetadata {
  const rolePrimary = [...SALES_ROLES];
  const roleSecondary = [...SERVICE_ROLES, ...PARTS_ROLES, ...MANAGER_ROLES];
  let category = 'Deal Flow';
  let skillTags = ['trust', 'listening'];
  let intentTags: ToolIntentTag[] = ['Move a deal forward', 'Handle an objection'];
  let recommendedWhen = ['Need a clear next move right now'];
  let notRecommendedWhen = ['Tool was just completed and context has not changed'];
  let estimatedTime = 8;

  const id = seed.id;
  if (id.includes('service') || id.includes('repair') || id.includes('mpi') || id.includes('waiter') || id.includes('declined-work') || id.includes('status-update') || id.includes('parts') || id.includes('inventory-substitution')) {
    category = 'CX / Process';
    skillTags = ['clarity', 'trust', 'tone'];
    intentTags = ['Handle an objection', 'Follow up', 'Improve consistency'];
    recommendedWhen = ['Customer needs service or parts decision clarity'];
    rolePrimary.splice(0, rolePrimary.length, ...uniqueRoles([...SERVICE_ROLES, ...PARTS_ROLES]));
    roleSecondary.splice(0, roleSecondary.length, ...uniqueRoles([...SALES_ROLES, ...MANAGER_ROLES]));
  }

  if (id.includes('team-coaching') || id.includes('desk-conversation') || id.includes('consistency-gap-check')) {
    category = 'Manager Tools';
    skillTags = ['coaching', 'leadership', 'consistency'];
    intentTags = ['Coach the team', 'Improve consistency', 'Recover a stalled deal'];
    recommendedWhen = ['Need to coach a rep or tighten execution consistency'];
    estimatedTime = 10;
    rolePrimary.splice(0, rolePrimary.length, ...uniqueRoles([...MANAGER_ROLES, 'Service Manager', 'Parts Manager']));
    roleSecondary.splice(0, roleSecondary.length, ...uniqueRoles([...SALES_ROLES, ...SERVICE_ROLES]));
  }

  if (id.includes('follow-up') || id.includes('be-back') || id.includes('deal-recovery') || id.includes('loyalty-loop') || id.includes('buyer-temperature')) {
    category = 'Follow-Up';
    skillTags = ['follow-up', 'trust', 'pacing'];
    intentTags = ['Follow up', 'Recover a stalled deal', 'Move a deal forward'];
    recommendedWhen = ['Momentum dropped and next touch needs structure'];
    estimatedTime = 9;
  }

  if (id.includes('price-presentation') || id.includes('payment') || id.includes('gross') || id.includes('trade-value') || id.includes('next-move') || id.includes('objection') || id.includes('commitment') || id.includes('fee-transparency')) {
    category = 'Pricing';
    skillTags = ['objection control', 'trust', 'closing'];
    intentTags = ['Present numbers', 'Handle an objection', 'Move a deal forward'];
    recommendedWhen = ['Customer is hesitating around price, payment, or commitment'];
    estimatedTime = 7;
  }

  const createdAtTs = new Date(seed.createdAt).getTime();
  const sorted = [...allSeeds].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const isNew = sorted.slice(0, 3).some((entry) => entry.id === seed.id) || (Date.now() - createdAtTs) < (1000 * 60 * 60 * 24 * 10);

  if (id.includes('first-impression') || id.includes('walkaround')) {
    skillTags = ['tone', 'pacing', 'listening'];
    intentTags = ['Move a deal forward', 'Improve consistency'];
    category = 'Deal Flow';
  }

  if (id.includes('what-happens-next')) {
    category = 'Deal Flow';
    skillTags = ['clarity', 'timing', 'trust'];
    intentTags = ['Move a deal forward', 'Follow up', 'Improve consistency'];
    recommendedWhen = ['The customer needs a clear explanation of the next step'];
    notRecommendedWhen = ['The next step is already obvious and does not need explanation'];
    estimatedTime = 5;
  }

  if (id.includes('clarity-check')) {
    skillTags = ['clarity', 'pacing', 'listening'];
    intentTags = ['Improve consistency', 'Move a deal forward'];
    category = 'Deal Flow';
    recommendedWhen = ['Customer seems unclear about what happens next'];
  }

  if (id.includes('pressure-drop')) {
    skillTags = ['trust', 'tone', 'pacing'];
    intentTags = ['Recover a stalled deal', 'Handle an objection', 'Move a deal forward'];
    category = 'Deal Flow';
    recommendedWhen = ['Customer tension rises and momentum starts to feel forced'];
  }

  if (id.includes('wait-experience-coach')) {
    skillTags = ['clarity', 'tone', 'follow-up'];
    intentTags = ['Improve consistency', 'Move a deal forward'];
    category = 'CX / Process';
    recommendedWhen = ['Waiting customer tension is rising and updates need stronger structure'];
    rolePrimary.splice(0, rolePrimary.length, ...uniqueRoles([...SERVICE_ROLES, 'Service Manager']));
    roleSecondary.splice(0, roleSecondary.length, ...uniqueRoles([...SALES_ROLES, ...MANAGER_ROLES]));
  }

  if (id.includes('first-90-second-trust-test')) {
    category = 'Deal Flow';
    skillTags = ['empathy', 'pacing', 'trust'];
    intentTags = ['Move a deal forward', 'Handle an objection', 'Follow up'];
    recommendedWhen = ['Need the right opening line for a guarded customer'];
    notRecommendedWhen = ['You already have rapport and are past the first exchange'];
    estimatedTime = 5;
  }

  if (id.includes('repair-trust-builder')) {
    skillTags = ['trust', 'clarity', 'objection control'];
    intentTags = ['Handle an objection', 'Improve consistency'];
    category = 'CX / Process';
    recommendedWhen = ['Customer skepticism is high on recommended repair work'];
    rolePrimary.splice(0, rolePrimary.length, ...uniqueRoles([...SERVICE_ROLES, 'Service Manager']));
    roleSecondary.splice(0, roleSecondary.length, ...uniqueRoles([...SALES_ROLES, ...MANAGER_ROLES]));
  }

  if (id.includes('pickup-experience-designer')) {
    skillTags = ['clarity', 'follow-up', 'trust'];
    intentTags = ['Improve consistency', 'Move a deal forward'];
    category = 'CX / Process';
    recommendedWhen = ['Pickup needs stronger recap structure and clearer next-step ownership'];
    rolePrimary.splice(0, rolePrimary.length, ...uniqueRoles([...SERVICE_ROLES, 'Service Manager']));
    roleSecondary.splice(0, roleSecondary.length, ...uniqueRoles([...SALES_ROLES, ...MANAGER_ROLES]));
  }

  if (id.includes('objection') || id.includes('reframe') || id.includes('defuser')) {
    category = 'Objections';
  }

  if (id.includes('special-order') || id.includes('inventory-substitution')) {
    notRecommendedWhen = ['Customer request is resolved and no substitution or special-order context remains'];
  }

  return {
    title: seed.name,
    category,
    primaryRoles: uniqueRoles(rolePrimary),
    secondaryRoles: uniqueRoles(roleSecondary),
    skillTags,
    intentTags,
    isFree: seed.access === 'free',
    isPremium: seed.access === 'premium',
    isNew,
    estimatedTime,
    recommendedWhen,
    notRecommendedWhen,
  };
}

const TOOL_SEED: ToolSeed[] = [
  {
    id: 'fee-transparency-coach',
    name: 'Fee Transparency Coach',
    description: 'Handle fee objections with clear explanations, better de-escalation, and stronger trust protection.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-25T09:00:00.000Z',
  },
  {
    id: 'pickup-experience-designer',
    name: 'Pickup Experience Designer',
    description: 'Design a clearer, more satisfying pickup flow with stronger recap and ownership next steps.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-24T09:00:00.000Z',
  },
  {
    id: 'repair-trust-builder',
    name: 'Repair Trust Builder',
    description: 'Present repairs with clear proof and trust-first language that reduces skepticism.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-23T09:00:00.000Z',
  },
  {
    id: 'wait-experience-coach',
    name: 'Wait Experience Coach',
    description: 'Improve waiting-customer comfort with clearer updates and expectation resets.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-22T09:00:00.000Z',
  },
  {
    id: 'pressure-drop-planner',
    name: 'Pressure Drop Planner',
    description: 'Lower customer tension with calmer language and a safer next step.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-21T09:00:00.000Z',
  },
  {
    id: 'clarity-check-builder',
    name: 'Clarity Check Builder',
    description: 'Explain next steps clearly, confirm understanding, and reduce customer confusion.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-20T09:00:00.000Z',
  },
  {
    id: 'what-happens-next',
    name: 'What Happens Next... Then What Happens Next',
    description: 'Explain the next dealership step clearly with a simple time estimate and reassuring language.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-26T09:00:00.000Z',
  },
  {
    id: 'first-90-second-trust-test',
    name: 'First 90-Second Trust Test',
    description: 'Pick the safest opening, pressure-drop language, and next move for a guarded customer.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-20T12:00:00.000Z',
  },
  {
    id: 'first-impression-calibrator',
    name: 'First Impression Calibrator',
    description: 'Calibrate the first 2 minutes with better warmth, pace, and opening language.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-19T09:00:00.000Z',
  },
  {
    id: 'consistency-gap-check',
    name: 'Consistency Gap Check',
    description: 'Run a fast mobile diagnostic to see where trained behaviors are sticking or fading.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-18T09:00:00.000Z',
  },
  {
    id: 'inventory-substitution-guide',
    name: 'Inventory Substitution Guide',
    description: 'Recommend part substitutions with clearer tradeoffs and stronger customer confidence.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-17T09:00:00.000Z',
  },
  {
    id: 'special-order-confidence-builder',
    name: 'Special Order Confidence Builder',
    description: 'Improve special-order commitment with clearer timing checkpoints and lower ghosting risk.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-16T09:00:00.000Z',
  },
  {
    id: 'parts-objection-defuser',
    name: 'Parts Objection Defuser',
    description: 'Handle parts price, availability, and OEM-vs-aftermarket objections with clearer confidence.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-15T09:00:00.000Z',
  },
  {
    id: 'mpi-conversation-designer',
    name: 'MPI Conversation Designer',
    description: 'Organize MPI findings into a clearer customer conversation with smarter urgency framing.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-14T09:00:00.000Z',
  },
  {
    id: 'upsell-timing-advisor',
    name: 'Upsell Timing Advisor',
    description: 'Assess readiness and timing to introduce additional work with better approval odds.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-13T09:00:00.000Z',
  },
  {
    id: 'waiter-update-flow',
    name: 'Waiter Update Flow',
    description: 'Guide clearer waiting-customer updates with better timing and expectation resets.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-12T09:00:00.000Z',
  },
  {
    id: 'be-back-conversion-planner',
    name: 'Be-Back Conversion Planner',
    description: 'Map return likelihood and timing to convert more be-backs into active re-engagement.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-11T09:00:00.000Z',
  },
  {
    id: 'walkaround-path-builder',
    name: 'Walkaround Path Builder',
    description: 'Create a customer-centered walkaround sequence with clearer feature-to-benefit transitions.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-10T09:00:00.000Z',
  },
  {
    id: 'payment-comfort-mapper',
    name: 'Payment Comfort Mapper',
    description: 'Map payment tolerance and reaction points to guide cleaner payment conversations.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-09T09:00:00.000Z',
  },
  {
    id: 'buyer-temperature-tracker',
    name: 'Buyer Temperature Tracker',
    description: 'Read deal momentum quickly and choose the right next move before it cools.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-08T09:00:00.000Z',
  },
  {
    id: 'gross-protection-strategist',
    name: 'Gross Protection Strategist',
    description: 'Protect gross with disciplined concessions, clearer value framing, and better deal control.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-07T09:00:00.000Z',
  },
  {
    id: 'team-coaching-converter',
    name: 'Team Coaching Converter',
    description: 'Turn live deal observations into short, actionable coaching plans for reps.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-06T09:00:00.000Z',
  },
  {
    id: 'desk-conversation',
    name: 'Desk Conversation Planner',
    description: 'Help sales managers enter live deals with clearer strategy and salesperson continuity.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-05T09:00:00.000Z',
  },
  {
    id: 'declined-work-recovery',
    name: 'Declined Work Recovery',
    description: 'Revisit previously declined work with lower pressure and clearer value framing.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-04T09:00:00.000Z',
  },
  {
    id: 'status-update',
    name: 'Status Update Composer',
    description: 'Create clear, trust-building service updates with stronger next-step expectations.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-03T09:00:00.000Z',
  },
  {
    id: 'repair-approval',
    name: 'Repair Approval Coach',
    description: 'Help service advisors explain needed work clearly and improve approval confidence.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'test-drive-debrief',
    name: 'Test Drive Debrief Builder',
    description: 'Turn post-test-drive reactions into clear next steps and momentum.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-04-01T09:00:00.000Z',
  },
  {
    id: 'trade-value-bridge',
    name: 'Trade Value Bridge',
    description: 'Handle trade-value friction and bridge back to the full deal without defensiveness.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-31T09:00:00.000Z',
  },
  {
    id: 'commitment-ladder',
    name: 'Commitment Ladder',
    description: 'Pick the right micro-commitment step to move deals forward without pressure spikes.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-30T09:00:00.000Z',
  },
  {
    id: 'next-move-engine',
    name: 'Next Move Engine',
    description: 'Get the exact next line, question, and move to avoid in live deals.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-26T09:00:00.000Z',
  },
  {
    id: 'objection-reframe',
    name: 'Objection Reframe',
    description: 'Turn hesitation into a clear next step. Fast.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-13T09:00:00.000Z',
  },
  {
    id: 'follow-up-cadence',
    name: 'Follow-Up Cadence Builder',
    description: 'Turn one conversation into a 7-day follow-up plan.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-06T09:00:00.000Z',
  },
  {
    id: 'consistency-leak-finder',
    name: 'Consistency Leak Finder',
    description: 'Find process gaps and standardize your next customer interaction.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-25T09:00:00.000Z',
  },
  {
    id: 'price-presentation',
    name: 'Price Presentation Planner',
    description: 'Structure your price presentation before approaching the customer.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-24T09:00:00.000Z',
  },
  {
    id: 'handoff-script',
    name: 'Handoff Script Optimizer',
    description: 'Make manager, finance, and specialist handoffs feel smooth and confident.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-27T09:00:00.000Z',
  },
  {
    id: 'deal-recovery',
    name: 'Deal Recovery Planner',
    description: 'Diagnose stalled deals and choose the cleanest recovery path fast.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-28T09:00:00.000Z',
  },
  {
    id: 'loyalty-loop',
    name: 'Loyalty Loop Designer',
    description: 'Design a repeatable retention loop for referrals, service, and long-term loyalty.',
    access: 'free',
    hasFullVersion: true,
    createdAt: '2026-03-29T09:00:00.000Z',
  },
];

const WEEKLY_FEATURED_TOOL_ID = 'what-happens-next';
export const TOOLBOX_TOOLS: ToolConfig[] = buildToolConfig(TOOL_SEED);

export function buildToolConfig(seed: ToolSeed[]): ToolConfig[] {
  const sorted = [...seed].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const featuredId = seed.some((tool) => tool.id === WEEKLY_FEATURED_TOOL_ID)
    ? WEEKLY_FEATURED_TOOL_ID
    : sorted[0]?.id;
  const seedById = new Map(seed.map((tool) => [tool.id, tool]));

  return sorted.map((tool) => ({
    ...tool,
    isFeatured: tool.id === featuredId,
    ...buildMetadataForTool(seedById.get(tool.id) as ToolSeed, seed as ToolSeed[]),
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

export function canAccessTool(entitlements: ToolboxEntitlements): boolean {
  return evaluateFeatureGate(entitlements, FEATURES.TOOL_ACCESS).allowed;
}

export function ctaForFeaturedTool(): string {
  return 'Open Tool';
}

export function ctaForToolCard(canAccess: boolean): string {
  return canAccess ? 'Open Tool' : 'Create Free Account';
}
