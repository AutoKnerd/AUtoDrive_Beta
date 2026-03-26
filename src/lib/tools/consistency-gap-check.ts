import type { User, UserRole } from '@/lib/definitions';
import { allRoles } from '@/lib/definitions';
import { readCxStatScoreOrNull } from '@/lib/tools/cx-stats';

export const CONSISTENCY_ROLES = allRoles;

export const CONSISTENCY_EVALUATION_BASIS = [
  'Today',
  'This week',
  'Recent deals',
  'Team observation',
] as const;

export type ConsistencyRole = UserRole;
export type ConsistencyEvaluationBasis = typeof CONSISTENCY_EVALUATION_BASIS[number];

export type ConsistencyInputStyle = 'segmented' | 'slider' | 'chips' | 'cards';

export type ConsistencyInputOption = {
  key: string;
  label: string;
  score: 1 | 2 | 3;
};

export type ConsistencyCategory = {
  id: string;
  title: string;
  behaviorLabel: string;
  description: string;
  inputStyle: ConsistencyInputStyle;
  options: readonly ConsistencyInputOption[];
};

export const CONSISTENCY_CATEGORIES = [
  {
    id: 'first_impression',
    title: 'First Impression / Greeting Consistency',
    behaviorLabel: 'Greeting consistency',
    description: 'Are you opening with the same trust-building structure each time?',
    inputStyle: 'segmented',
    options: [
      { key: 'locked_in', label: 'Locked In', score: 3 },
      { key: 'pulling_right', label: 'Pulling Right', score: 2 },
      { key: 'off_track', label: 'Off Track', score: 1 },
    ],
  },
  {
    id: 'discovery_quality',
    title: 'Discovery / Question Quality',
    behaviorLabel: 'Discovery consistency',
    description: 'How consistently are you uncovering actual customer priorities?',
    inputStyle: 'cards',
    options: [
      { key: 'green_light', label: 'Green Light', score: 3 },
      { key: 'yellow_light', label: 'Yellow Light', score: 2 },
      { key: 'red_light', label: 'Red Light', score: 1 },
    ],
  },
  {
    id: 'pace_tone_control',
    title: 'Pace and Tone Control',
    behaviorLabel: 'Pace and tone control',
    description: 'Is your delivery calm, clear, and controlled when pressure rises?',
    inputStyle: 'slider',
    options: [
      { key: 'smooth_drive', label: 'Smooth Drive', score: 3 },
      { key: 'rough_shift', label: 'Rough Shift', score: 2 },
      { key: 'stall', label: 'Stall', score: 1 },
    ],
  },
  {
    id: 'next_step_clarity',
    title: 'Clarity of Next Steps',
    behaviorLabel: 'Next-step clarity',
    description: 'Do customers leave each conversation knowing the exact next action?',
    inputStyle: 'chips',
    options: [
      { key: 'tight_line', label: 'Tight Line', score: 3 },
      { key: 'wide_turn', label: 'Wide Turn', score: 2 },
      { key: 'missed_exit', label: 'Missed Exit', score: 1 },
    ],
  },
  {
    id: 'objection_consistency',
    title: 'Objection Handling Consistency',
    behaviorLabel: 'Objection handling consistency',
    description: 'Are objections handled with a repeatable structure instead of improvising?',
    inputStyle: 'cards',
    options: [
      { key: 'consistent', label: 'Consistent', score: 3 },
      { key: 'mixed', label: 'Mixed', score: 2 },
      { key: 'reactive', label: 'Reactive', score: 1 },
    ],
  },
  {
    id: 'follow_up_discipline',
    title: 'Follow-up Discipline',
    behaviorLabel: 'Follow-up discipline',
    description: 'How reliably are follow-up commitments completed on time?',
    inputStyle: 'slider',
    options: [
      { key: 'on_time', label: 'On Time', score: 3 },
      { key: 'inconsistent', label: 'Inconsistent', score: 2 },
      { key: 'drops_off', label: 'Drops Off', score: 1 },
    ],
  },
  {
    id: 'handoff_consistency',
    title: 'Handoff Consistency',
    behaviorLabel: 'Handoff consistency',
    description: 'When another person joins, does continuity stay intact for the customer?',
    inputStyle: 'chips',
    options: [
      { key: 'clean_handoff', label: 'Clean', score: 3 },
      { key: 'partial_handoff', label: 'Patchy', score: 2 },
      { key: 'broken_handoff', label: 'Broken', score: 1 },
    ],
  },
  {
    id: 'delivery_wrap_up',
    title: 'Delivery / Wrap-up Consistency',
    behaviorLabel: 'Delivery and wrap-up consistency',
    description: 'Is the closeout step reliably complete and confidence-building?',
    inputStyle: 'segmented',
    options: [
      { key: 'complete', label: 'Complete', score: 3 },
      { key: 'rushed', label: 'Rushed', score: 2 },
      { key: 'unfinished', label: 'Unfinished', score: 1 },
    ],
  },
] as const satisfies readonly ConsistencyCategory[];

export type ConsistencyCategoryId = typeof CONSISTENCY_CATEGORIES[number]['id'];
export type ConsistencyResponses = Partial<Record<ConsistencyCategoryId, string>>;

export type ConsistencyStatus = 'Strong' | 'Slipping' | 'At Risk';

export type ConsistencyCategoryScore = {
  categoryId: ConsistencyCategoryId;
  title: string;
  behaviorLabel: string;
  selectedLabel: string;
  score: 1 | 2 | 3;
  percent: number;
  status: ConsistencyStatus;
};

export type ConsistencyResult = {
  completed: boolean;
  missingCategoryIds: ConsistencyCategoryId[];
  strongestBehavior: string;
  biggestConsistencyGap: string;
  likelyCustomerImpact: string;
  recommendedNextFix: string;
  nextInteractionMove: string;
  strongestCategoryId: ConsistencyCategoryId;
  weakestCategoryId: ConsistencyCategoryId;
  biggestLeakCategoryId: ConsistencyCategoryId;
  strongestCategoryIds: ConsistencyCategoryId[];
  weakestCategoryIds: ConsistencyCategoryId[];
  overallScore: number;
  categories: ConsistencyCategoryScore[];
  counts: {
    strong: number;
    slipping: number;
    atRisk: number;
  };
};

export type ConsistencySprocketEnhancement = {
  patternDiagnosis: string;
  issueType: 'process drift' | 'confidence drop' | 'tone/pacing issue' | 'discipline inconsistency';
  preciseCorrectiveAction: string;
  coachingCue: string;
  behaviorStandardRewrite?: string;
};

export type ConsistencyCxEnhancement = {
  tailoredPattern: string;
  likelyRepeatedBreakdown: string;
  personalizedFix: string;
  focusAreas: ConsistencyCategoryId[];
  usedSkillData: boolean;
};

const IMPACT_BY_CATEGORY: Record<ConsistencyCategoryId, string> = {
  first_impression: 'Weak trust at the start can lower customer confidence before discovery begins.',
  discovery_quality: 'Poor discovery creates poor fit, missed needs, and weaker recommendation quality.',
  pace_tone_control: 'Unsteady pace or tone can make customers feel rushed or pressured.',
  next_step_clarity: 'Unclear next steps stall momentum and increase no-response risk.',
  objection_consistency: 'Inconsistent objection handling creates avoidable doubt and delayed decisions.',
  follow_up_discipline: 'Inconsistent follow-up increases customer drop-off after initial engagement.',
  handoff_consistency: 'Broken handoffs reduce continuity and confidence in the process.',
  delivery_wrap_up: 'Incomplete wrap-up leaves customers uncertain and weakens final confidence.',
};

const NEXT_FIX_BY_CATEGORY: Record<ConsistencyCategoryId, string> = {
  first_impression: 'Standardize one 20-second greeting opener and use it on every first contact.',
  discovery_quality: 'Use the same three discovery questions before presenting any recommendation.',
  pace_tone_control: 'Insert a two-second pause before each transition to keep pace controlled.',
  next_step_clarity: 'End every interaction by confirming one exact next step, owner, and time.',
  objection_consistency: 'Run one fixed objection sequence: acknowledge, clarify, proof, confirm.',
  follow_up_discipline: 'Set and send the first follow-up checkpoint before ending the current interaction.',
  handoff_consistency: 'Use a 30-second handoff script: context, commitment, next action, owner.',
  delivery_wrap_up: 'Use a closeout checklist that confirms recap, expectation, and next contact.',
};

const NEXT_MOVE_BY_CATEGORY: Record<ConsistencyCategoryId, string> = {
  first_impression: 'On your next customer start, open with your standard greeting before any pricing talk.',
  discovery_quality: 'In your next interaction, ask all three discovery questions before offering options.',
  pace_tone_control: 'In your next objection moment, slow your cadence and confirm understanding first.',
  next_step_clarity: 'Before ending your next conversation, confirm exact follow-up time and method.',
  objection_consistency: 'In your next objection, follow your sequence instead of jumping to discounting.',
  follow_up_discipline: 'Before finishing your next interaction, schedule and send the first follow-up touchpoint.',
  handoff_consistency: 'In your next handoff, state context, promised action, and owner out loud.',
  delivery_wrap_up: 'In your next wrap-up, recap commitments and give the customer one clear contact path.',
};

const LEAK_PRIORITY: ConsistencyCategoryId[] = [
  'follow_up_discipline',
  'next_step_clarity',
  'discovery_quality',
  'handoff_consistency',
  'objection_consistency',
  'first_impression',
  'pace_tone_control',
  'delivery_wrap_up',
];

const ISSUE_TYPE_BY_CATEGORY: Record<ConsistencyCategoryId, ConsistencySprocketEnhancement['issueType']> = {
  first_impression: 'confidence drop',
  discovery_quality: 'process drift',
  pace_tone_control: 'tone/pacing issue',
  next_step_clarity: 'process drift',
  objection_consistency: 'confidence drop',
  follow_up_discipline: 'discipline inconsistency',
  handoff_consistency: 'discipline inconsistency',
  delivery_wrap_up: 'process drift',
};

const CATEGORY_MAP = new Map(CONSISTENCY_CATEGORIES.map((category) => [category.id, category]));

function asCategoryId(value: string): ConsistencyCategoryId {
  return value as ConsistencyCategoryId;
}

function optionFor(categoryId: ConsistencyCategoryId, optionKey: string | undefined): ConsistencyInputOption | null {
  if (!optionKey) return null;
  const category = CATEGORY_MAP.get(categoryId);
  if (!category) return null;
  return category.options.find((option) => option.key === optionKey) ?? null;
}

function statusFromScore(score: 1 | 2 | 3): ConsistencyStatus {
  if (score === 3) return 'Strong';
  if (score === 2) return 'Slipping';
  return 'At Risk';
}

function percentFromScore(score: 1 | 2 | 3): number {
  if (score === 3) return 100;
  if (score === 2) return 67;
  return 33;
}

function findTiedCategoryIds(categories: ConsistencyCategoryScore[], score: 1 | 2 | 3): ConsistencyCategoryId[] {
  return categories.filter((category) => category.score === score).map((category) => category.categoryId);
}

function pickPrimaryLeak(ids: ConsistencyCategoryId[]): ConsistencyCategoryId {
  for (const id of LEAK_PRIORITY) {
    if (ids.includes(id)) return id;
  }
  return ids[0] ?? 'next_step_clarity';
}

function formatBehaviorTieText(primaryId: ConsistencyCategoryId, tiedIds: ConsistencyCategoryId[]): string {
  const primaryLabel = CATEGORY_MAP.get(primaryId)?.behaviorLabel ?? 'Execution behavior';
  if (tiedIds.length <= 1) return primaryLabel;

  const otherLabel = CATEGORY_MAP.get(tiedIds.find((id) => id !== primaryId) ?? primaryId)?.behaviorLabel ?? primaryLabel;
  return `${primaryLabel} (tied with ${otherLabel})`;
}

function buildStrongestBehaviorText(primaryId: ConsistencyCategoryId, strongestIds: ConsistencyCategoryId[], strongestScore: 1 | 2 | 3): string {
  if (strongestScore === 1) {
    return 'No stable strong behavior yet; all categories are currently at risk.';
  }

  return formatBehaviorTieText(primaryId, strongestIds);
}

function buildBiggestGapText(leakId: ConsistencyCategoryId, weakestIds: ConsistencyCategoryId[], weakestScore: 1 | 2 | 3): string {
  const leakLabel = CATEGORY_MAP.get(leakId)?.behaviorLabel ?? 'Execution behavior';

  if (weakestScore === 3) {
    return `No critical gap detected. Lowest category to protect is ${leakLabel}.`;
  }

  if (weakestIds.length > 1) {
    return `${leakLabel} is the primary leak (tie on lowest score across multiple categories).`;
  }

  return `${leakLabel} is inconsistent in live execution.`;
}

function buildDefaultResult(input: {
  missingCategoryIds: ConsistencyCategoryId[];
}): ConsistencyResult {
  const fallbackId = 'next_step_clarity' as ConsistencyCategoryId;

  return {
    completed: false,
    missingCategoryIds: input.missingCategoryIds,
    strongestBehavior: 'Complete all categories to identify your strongest behavior.',
    biggestConsistencyGap: 'Complete all categories to identify the biggest consistency gap.',
    likelyCustomerImpact: IMPACT_BY_CATEGORY[fallbackId],
    recommendedNextFix: NEXT_FIX_BY_CATEGORY[fallbackId],
    nextInteractionMove: NEXT_MOVE_BY_CATEGORY[fallbackId],
    strongestCategoryId: fallbackId,
    weakestCategoryId: fallbackId,
    biggestLeakCategoryId: fallbackId,
    strongestCategoryIds: [fallbackId],
    weakestCategoryIds: [fallbackId],
    overallScore: 0,
    categories: [],
    counts: {
      strong: 0,
      slipping: 0,
      atRisk: 0,
    },
  };
}

export function getRoleDisplayLabel(role: ConsistencyRole): string {
  return role === 'manager' ? 'Sales Manager' : role;
}

export function scoreConsistencyGapCheck(input: {
  role: ConsistencyRole;
  evaluationBasis: ConsistencyEvaluationBasis;
  responses: ConsistencyResponses;
}): ConsistencyResult {
  void input.role;
  void input.evaluationBasis;

  const missingCategoryIds = CONSISTENCY_CATEGORIES
    .map((category) => asCategoryId(category.id))
    .filter((categoryId) => !optionFor(categoryId, input.responses[categoryId]));

  if (missingCategoryIds.length > 0) {
    return buildDefaultResult({ missingCategoryIds });
  }

  const categories: ConsistencyCategoryScore[] = CONSISTENCY_CATEGORIES.map((category) => {
    const categoryId = asCategoryId(category.id);
    const selected = optionFor(categoryId, input.responses[categoryId]) ?? category.options[1] ?? category.options[0];

    return {
      categoryId,
      title: category.title,
      behaviorLabel: category.behaviorLabel,
      selectedLabel: selected.label,
      score: selected.score,
      percent: percentFromScore(selected.score),
      status: statusFromScore(selected.score),
    };
  });

  const scoreValues = categories.map((category) => category.score);
  const strongestScore = Math.max(...scoreValues) as 1 | 2 | 3;
  const weakestScore = Math.min(...scoreValues) as 1 | 2 | 3;

  const strongestCategoryIds = findTiedCategoryIds(categories, strongestScore);
  const weakestCategoryIds = findTiedCategoryIds(categories, weakestScore);

  const strongestCategoryId = pickPrimaryLeak([...strongestCategoryIds].reverse());
  const weakestCategoryId = pickPrimaryLeak(weakestCategoryIds);
  const biggestLeakCategoryId = weakestCategoryId;

  const average = categories.reduce((sum, category) => sum + category.score, 0) / categories.length;
  const overallScore = Math.round(((average - 1) / 2) * 100);

  const counts = {
    strong: categories.filter((category) => category.status === 'Strong').length,
    slipping: categories.filter((category) => category.status === 'Slipping').length,
    atRisk: categories.filter((category) => category.status === 'At Risk').length,
  };

  const sortedCategories = [...categories].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return LEAK_PRIORITY.indexOf(a.categoryId) - LEAK_PRIORITY.indexOf(b.categoryId);
  });

  return {
    completed: true,
    missingCategoryIds: [],
    strongestBehavior: buildStrongestBehaviorText(strongestCategoryId, strongestCategoryIds, strongestScore),
    biggestConsistencyGap: buildBiggestGapText(biggestLeakCategoryId, weakestCategoryIds, weakestScore),
    likelyCustomerImpact: IMPACT_BY_CATEGORY[biggestLeakCategoryId],
    recommendedNextFix: NEXT_FIX_BY_CATEGORY[biggestLeakCategoryId],
    nextInteractionMove: NEXT_MOVE_BY_CATEGORY[biggestLeakCategoryId],
    strongestCategoryId,
    weakestCategoryId,
    biggestLeakCategoryId,
    strongestCategoryIds,
    weakestCategoryIds,
    overallScore,
    categories: sortedCategories,
    counts,
  };
}

export function getSprocketConsistencyEnhancement(result: ConsistencyResult): ConsistencySprocketEnhancement {
  const leakId = result.biggestLeakCategoryId;
  const issueType = ISSUE_TYPE_BY_CATEGORY[leakId];
  const leakLabel = CATEGORY_MAP.get(leakId)?.behaviorLabel ?? 'execution behavior';

  const patternDiagnosis =
    result.counts.atRisk >= 3
      ? `Multiple at-risk categories suggest broad ${issueType}, with ${leakLabel} as the highest-leverage correction.`
      : `${leakLabel} appears to be the primary breakdown point, and it is likely driving downstream inconsistency.`;

  const preciseCorrectiveAction =
    issueType === 'discipline inconsistency'
      ? 'Add one non-negotiable checkpoint per interaction and verify completion before moving to the next deal.'
      : issueType === 'tone/pacing issue'
        ? 'Use a controlled transition script and pace reset in every pressure moment for the next five interactions.'
        : issueType === 'confidence drop'
          ? 'Use one pre-planned response structure so objections and first-contact moments are not improvised.'
          : 'Lock one repeatable process step and measure it interaction-by-interaction for one week.';

  const coachingCue = `Coaching cue: "Today we tighten ${leakLabel} first. We do not widen focus until this step is repeatable."`;

  const behaviorStandardRewrite = `Behavior standard: In every interaction, execute ${leakLabel} before advancing. If it is skipped, reset immediately.`;

  return {
    patternDiagnosis,
    issueType,
    preciseCorrectiveAction,
    coachingCue,
    behaviorStandardRewrite,
  };
}

export function getAutoDriveCxConsistencyEnhancement(
  result: ConsistencyResult,
  user?: User | null
): ConsistencyCxEnhancement {
  const listening = readCxStatScoreOrNull(user?.stats?.listening);
  const followUp = readCxStatScoreOrNull(user?.stats?.followUp);
  const trust = readCxStatScoreOrNull(user?.stats?.trust);
  const closing = readCxStatScoreOrNull(user?.stats?.closing);

  const hasSkillData = [listening, followUp, trust, closing].some((value) => value !== null);

  if (!hasSkillData) {
    return {
      tailoredPattern: 'Skill data is unavailable, so this recommendation uses your live execution pattern only.',
      likelyRepeatedBreakdown: `Repeated drift is most likely around ${CATEGORY_MAP.get(result.biggestLeakCategoryId)?.behaviorLabel ?? 'execution consistency'}.`,
      personalizedFix: result.recommendedNextFix,
      focusAreas: [result.biggestLeakCategoryId],
      usedSkillData: false,
    };
  }

  if (followUp !== null && followUp < 55) {
    return {
      tailoredPattern: 'Follow-up skill trend is low and aligns with execution drop-off risk after initial contact.',
      likelyRepeatedBreakdown: 'Customers likely disengage after early momentum because follow-up cadence is inconsistent.',
      personalizedFix: 'Prioritize follow-up discipline first: set same-day follow-up before ending each interaction.',
      focusAreas: ['follow_up_discipline', 'next_step_clarity'],
      usedSkillData: true,
    };
  }

  if (listening !== null && listening < 55) {
    return {
      tailoredPattern: 'Listening trend suggests discovery inconsistency is likely driving mismatched recommendations.',
      likelyRepeatedBreakdown: 'Need-fit confidence likely drops when discovery depth varies between interactions.',
      personalizedFix: 'Prioritize discovery consistency first: lock three discovery questions before any recommendation.',
      focusAreas: ['discovery_quality', 'next_step_clarity'],
      usedSkillData: true,
    };
  }

  if (trust !== null && trust < 55) {
    return {
      tailoredPattern: 'Trust trend suggests early interaction consistency is not stable enough to anchor confidence.',
      likelyRepeatedBreakdown: 'Confidence likely dips during greeting and transition moments.',
      personalizedFix: 'Prioritize greeting consistency and next-step clarity in every first interaction.',
      focusAreas: ['first_impression', 'next_step_clarity'],
      usedSkillData: true,
    };
  }

  if (closing !== null && closing < 55) {
    return {
      tailoredPattern: 'Closing trend suggests pace and wrap-up consistency are likely weakening final commitment.',
      likelyRepeatedBreakdown: 'Momentum likely drops late when transitions are rushed or incomplete.',
      personalizedFix: 'Prioritize pace control and wrap-up checklist completion before introducing new asks.',
      focusAreas: ['pace_tone_control', 'delivery_wrap_up'],
      usedSkillData: true,
    };
  }

  return {
    tailoredPattern: 'Current skill trends are stable; your biggest gain remains fixing the single weakest execution category first.',
    likelyRepeatedBreakdown: `Most repeated breakdown risk is still ${CATEGORY_MAP.get(result.biggestLeakCategoryId)?.behaviorLabel ?? 'execution drift'}.`,
    personalizedFix: result.recommendedNextFix,
    focusAreas: [result.biggestLeakCategoryId, result.weakestCategoryId],
    usedSkillData: true,
  };
}
