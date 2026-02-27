import type { UserRole } from '@/lib/definitions';

export type PppLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type PppRoleContext = 'sales' | 'service' | 'parts' | 'finance' | 'manager' | 'gm';

export type PppStageId =
  | 'arrival_safety'
  | 'discovery_understanding'
  | 'alignment_precision'
  | 'experience_excitement'
  | 'commitment_confirmation'
  | 'numbers_regulation'
  | 'delivery_pride';

export type PppLessonTemplate = {
  lessonId: string;
  level: PppLevel;
  levelTitle: string;
  stageId: PppStageId;
  stageTitle: string;
  stageShortTitle: string;
  skill: string;
  title: string;
  sequence: number;
  scenario: string;
};

export const PPP_LEVEL_MIN: PppLevel = 1;
export const PPP_LEVEL_MAX: PppLevel = 10;
export const PPP_TOUR_UNLOCKED_LESSON_COUNT = 2;
export const PPP_DAILY_PASS_LIMIT = 5;
export const PPP_BASE_XP = 100;
export const PPP_TIER_INCREMENT_XP = 15;

export const PPP_LEVELS: Array<{ level: PppLevel; title: string }> = [
  { level: 1, title: 'Regulation Foundations' },
  { level: 2, title: 'Structured Discovery' },
  { level: 3, title: 'Alignment Precision' },
  { level: 4, title: 'Objection Stability' },
  { level: 5, title: 'Negotiation Control' },
  { level: 6, title: 'Decision Leadership' },
  { level: 7, title: 'Emotional Intelligence Under Pressure' },
  { level: 8, title: 'Cross-Department Mastery' },
  { level: 9, title: 'Strategic Profit Protection' },
  { level: 10, title: 'Institutional Mastery' },
];

type StageTemplate = {
  id: PppStageId;
  stageTitle: string;
  stageShortTitle: string;
  skills: string[];
};

const PPP_STAGE_TEMPLATES: StageTemplate[] = [
  {
    id: 'arrival_safety',
    stageTitle: 'Arrival - Safety',
    stageShortTitle: 'Arrival',
    skills: [
      'Set emotional safety and time expectations in the first 30 seconds.',
      'Establish a clear, collaborative agenda before advancing the conversation.',
    ],
  },
  {
    id: 'discovery_understanding',
    stageTitle: 'Discovery - Understanding',
    stageShortTitle: 'Discovery',
    skills: [
      'Use layered discovery questions to uncover both practical and emotional needs.',
      'Summarize customer priorities and confirm understanding before proposing direction.',
    ],
  },
  {
    id: 'alignment_precision',
    stageTitle: 'Alignment - Precision',
    stageShortTitle: 'Alignment',
    skills: [
      'Map recommendations directly to stated priorities without overexplaining.',
      'Gain explicit alignment checkpoints before transitioning to the next step.',
    ],
  },
  {
    id: 'experience_excitement',
    stageTitle: 'Experience - Excitement',
    stageShortTitle: 'Experience',
    skills: [
      'Create controlled excitement while preserving pacing and customer confidence.',
      'Use silence and confirmation prompts to reinforce customer ownership.',
    ],
  },
  {
    id: 'commitment_confirmation',
    stageTitle: 'Commitment - Confirmation before numbers',
    stageShortTitle: 'Commitment',
    skills: [
      'Secure decision criteria and commitment intent before discussing pricing.',
      'Confirm readiness and risk concerns before entering the numbers stage.',
    ],
  },
  {
    id: 'numbers_regulation',
    stageTitle: 'Numbers - Regulation under pricing',
    stageShortTitle: 'Numbers',
    skills: [
      'Maintain verbal certainty and pacing control through pricing pressure.',
      'Regulate objections by clarifying, confirming, and advancing without defensiveness.',
    ],
  },
  {
    id: 'delivery_pride',
    stageTitle: 'Delivery - Pride and reinforcement',
    stageShortTitle: 'Delivery',
    skills: [
      'Reinforce purchase confidence with pride-based delivery language.',
      'Set follow-through expectations that protect trust after handoff.',
    ],
  },
];

const ROLE_CONTEXT_COPY: Record<PppRoleContext, Record<PppStageId, string>> = {
  sales: {
    arrival_safety: 'customer arriving to review vehicle options',
    discovery_understanding: 'vehicle fit and budget tradeoff discussion',
    alignment_precision: 'matching vehicle/trim/package to stated priorities',
    experience_excitement: 'walkaround and product demonstration',
    commitment_confirmation: 'confirming purchase intent before quote details',
    numbers_regulation: 'pricing, trade, and monthly payment negotiation',
    delivery_pride: 'vehicle delivery and ownership confidence reinforcement',
  },
  service: {
    arrival_safety: 'service lane write-up and concern intake',
    discovery_understanding: 'clarifying concern, urgency, and usage impact',
    alignment_precision: 'aligning recommended work to customer priorities',
    experience_excitement: 'building confidence in the repair plan and timeline',
    commitment_confirmation: 'confirming authorization readiness before estimate details',
    numbers_regulation: 'estimate approval and scope/value objections',
    delivery_pride: 'post-repair handoff with confidence and follow-up clarity',
  },
  parts: {
    arrival_safety: 'parts counter intake and order context setup',
    discovery_understanding: 'fitment, availability, and urgency discovery',
    alignment_precision: 'aligning parts recommendation to use case and timeline',
    experience_excitement: 'building confidence in part choice and compatibility',
    commitment_confirmation: 'confirming intent before quoting final totals',
    numbers_regulation: 'price/lead-time objections and alternatives discussion',
    delivery_pride: 'order confirmation and pickup/delivery expectation reset',
  },
  finance: {
    arrival_safety: 'finance office handoff and expectation framing',
    discovery_understanding: 'coverage priorities and risk tolerance discovery',
    alignment_precision: 'aligning menu path to stated ownership priorities',
    experience_excitement: 'maintaining confidence while reviewing protections',
    commitment_confirmation: 'confirming decision framing before final numbers',
    numbers_regulation: 'payment and value objections under time pressure',
    delivery_pride: 'agreement completion and long-term confidence reinforcement',
  },
  manager: {
    arrival_safety: 'desk/coaching intervention during an active customer situation',
    discovery_understanding: 'coaching discovery quality and team decision logic',
    alignment_precision: 'aligning consultant actions with customer priorities',
    experience_excitement: 'maintaining momentum while stabilizing team execution',
    commitment_confirmation: 'coaching commitment checkpoints before pricing',
    numbers_regulation: 'supporting objection regulation under desk pressure',
    delivery_pride: 'reinforcing consultant behavior and customer confidence post-close',
  },
  gm: {
    arrival_safety: 'executive-level escalation and customer confidence recovery',
    discovery_understanding: 'cross-department discovery and strategic context',
    alignment_precision: 'ensuring precision alignment across teams and process',
    experience_excitement: 'sustaining controlled confidence across the full journey',
    commitment_confirmation: 'institutional confirmation checkpoints before financial terms',
    numbers_regulation: 'high-stakes pricing regulation across stakeholders',
    delivery_pride: 'institutional reinforcement, advocacy, and long-term retention framing',
  },
};

function toRoleContext(role: UserRole): PppRoleContext {
  switch (role) {
    case 'Sales Consultant':
      return 'sales';
    case 'Service Writer':
    case 'Service Manager':
      return 'service';
    case 'Parts Consultant':
    case 'Parts Manager':
      return 'parts';
    case 'Finance Manager':
      return 'finance';
    case 'manager':
      return 'manager';
    case 'General Manager':
    case 'Owner':
    case 'Trainer':
    case 'Admin':
    case 'Developer':
      return 'gm';
    default:
      return 'manager';
  }
}

function complexityDescriptor(level: PppLevel): string {
  if (level <= 2) return 'base-complexity, cooperative customer behavior';
  if (level <= 4) return 'moderate complexity with mild resistance';
  if (level <= 6) return 'high complexity with layered objections';
  if (level <= 8) return 'cross-functional complexity and time pressure';
  return 'executive complexity with strategic and emotional pressure';
}

function getLevelTitle(level: PppLevel): string {
  return PPP_LEVELS.find((entry) => entry.level === level)?.title ?? PPP_LEVELS[0].title;
}

export function getPppLevelTitle(level: number): string {
  const safeLevel = clampPppLevel(level);
  return getLevelTitle(safeLevel);
}

export function clampPppLevel(level: number): PppLevel {
  if (!Number.isFinite(level)) return PPP_LEVEL_MIN;
  const rounded = Math.round(level);
  if (rounded <= PPP_LEVEL_MIN) return PPP_LEVEL_MIN;
  if (rounded >= PPP_LEVEL_MAX) return PPP_LEVEL_MAX;
  return rounded as PppLevel;
}

export function getPppLevelXp(level: number): number {
  const safeLevel = clampPppLevel(level);
  return PPP_BASE_XP + (safeLevel - 1) * PPP_TIER_INCREMENT_XP;
}

export function getPppLessonsForLevel(level: number, role: UserRole): PppLessonTemplate[] {
  const safeLevel = clampPppLevel(level);
  const levelTitle = getLevelTitle(safeLevel);
  const roleContext = toRoleContext(role);
  const complexity = complexityDescriptor(safeLevel);

  const lessons: PppLessonTemplate[] = [];
  let sequence = 0;

  for (const stage of PPP_STAGE_TEMPLATES) {
    for (let index = 0; index < stage.skills.length; index += 1) {
      const skill = stage.skills[index];
      sequence += 1;

      lessons.push({
        lessonId: `ppp-l${safeLevel}-${stage.id}-${index + 1}`,
        level: safeLevel,
        levelTitle,
        stageId: stage.id,
        stageTitle: stage.stageTitle,
        stageShortTitle: stage.stageShortTitle,
        skill,
        title: `${stage.stageShortTitle}: ${skill}`,
        sequence,
        scenario: [
          `PPP ${levelTitle}.`,
          `Role context: ${roleContext}.`,
          `Stage context: ${ROLE_CONTEXT_COPY[roleContext][stage.id]}.`,
          `Complexity: ${complexity}.`,
        ].join(' '),
      });
    }
  }

  return lessons;
}

export function getPppLevelBadge(level: number, certified: boolean): string {
  if (certified) return 'ppp-lvl-10-black-gold';
  return `ppp-lvl-${clampPppLevel(level)}`;
}
