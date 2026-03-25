import type { AisRoleType } from '@/lib/definitions';

export type CustomerArchetype = {
  archetypeId: string;
  name: string;
  description: string;
  defaultTone: string;
  communicationStyle: string;
  trustStyle: string;
  pacingStyle: string;
  commonConcerns: string[];
  preferredResponseStyle: string;
  riskFactors: string[];
  positiveSignals: string[];
  personalityHints?: string[];
};

export type RoleAdjustedArchetype = CustomerArchetype & {
  roleAdjustedArchetypeLabel: string;
  roleConcernFocus: string[];
  roleVocabulary: string[];
  archetypeBehaviorFlags: string[];
  archetypeConfidence: number;
};

const ROLE_EXPRESSION: Record<string, Record<AisRoleType, { concernFocus: string[]; vocabulary: string[] }>> = {
  skeptic: {
    sales: { concernFocus: ['pricing clarity', 'promise consistency', 'trade transparency'], vocabulary: ['pricing', 'deal', 'value'] },
    service: { concernFocus: ['diagnosis confidence', 'timeline trust', 'repair necessity'], vocabulary: ['diagnosis', 'repair', 'timeline'] },
    parts: { concernFocus: ['fitment confidence', 'availability truth', 'order timing'], vocabulary: ['fitment', 'in stock', 'ETA'] },
    fi: { concernFocus: ['contract clarity', 'product necessity', 'term transparency'], vocabulary: ['contract', 'terms', 'coverage'] },
  },
  over_researcher: {
    sales: { concernFocus: ['vehicle comparison', 'online pricing alignment'], vocabulary: ['compare', 'specs', 'MSRP'] },
    service: { concernFocus: ['maintenance evidence', 'forum alignment'], vocabulary: ['TSB', 'forum', 'recommended service'] },
    parts: { concernFocus: ['compatibility precision', 'part-number confidence'], vocabulary: ['part number', 'compatibility', 'OEM'] },
    fi: { concernFocus: ['rate detail', 'term structure', 'product value math'], vocabulary: ['APR', 'term', 'coverage value'] },
  },
};

function makeArchetype(input: CustomerArchetype): CustomerArchetype {
  return input;
}

export const CUSTOMER_ARCHETYPES: CustomerArchetype[] = [
  makeArchetype({
    archetypeId: 'skeptic',
    name: 'The Skeptic',
    description: 'Questions motives, slow to trust, watches for inconsistency.',
    defaultTone: 'guarded',
    communicationStyle: 'direct but cautious',
    trustStyle: 'earned slowly through consistency',
    pacingStyle: 'slow open, medium close',
    commonConcerns: ['honesty', 'clarity', 'value'],
    preferredResponseStyle: 'steady transparency and proof-first guidance',
    riskFactors: ['defensive reactions', 'vague claims', 'pressure language'],
    positiveSignals: ['clear explanations', 'acknowledged concerns', 'consistent follow-through'],
    personalityHints: ['skeptical', 'defensive'],
  }),
  makeArchetype({
    archetypeId: 'over-researcher',
    name: 'The Over-Researcher',
    description: 'Has read everything online, asks detailed questions, wants precision.',
    defaultTone: 'analytical',
    communicationStyle: 'detail-heavy and comparison-driven',
    trustStyle: 'builds with precision',
    pacingStyle: 'slow-medium with frequent verification',
    commonConcerns: ['spec comparison', 'long-term value', 'data alignment'],
    preferredResponseStyle: 'structured, precise, and evidence-based responses',
    riskFactors: ['generalized statements', 'hand-wavy comparisons'],
    positiveSignals: ['specific data points', 'clear assumptions', 'confident detail'],
    personalityHints: ['analytical'],
  }),
  makeArchetype({
    archetypeId: 'budget-hawk',
    name: 'The Budget Hawk',
    description: 'Focused on cost, value, affordability, and financial downside.',
    defaultTone: 'practical',
    communicationStyle: 'price-centric and repetitive',
    trustStyle: 'value proof first',
    pacingStyle: 'fast concern loops',
    commonConcerns: ['price', 'payment', 'ownership cost'],
    preferredResponseStyle: 'practical value framing with transparent numbers',
    riskFactors: ['avoiding cost questions', 'rushing to close'],
    positiveSignals: ['clear ranges', 'value framing', 'cost transparency'],
    personalityHints: ['impatient', 'analytical'],
  }),
  makeArchetype({
    archetypeId: 'friendly-talker',
    name: 'The Friendly Talker',
    description: 'Warm, open, chatty, easy to connect with but can drift off topic.',
    defaultTone: 'warm',
    communicationStyle: 'chatty and relational',
    trustStyle: 'builds quickly through rapport',
    pacingStyle: 'slow-medium with side paths',
    commonConcerns: ['comfort', 'fit', 'experience quality'],
    preferredResponseStyle: 'warm connection plus gentle refocusing',
    riskFactors: ['conversation drift', 'missed commitment moments'],
    positiveSignals: ['rapport balance', 'clear recaps', 'friendly structure'],
    personalityHints: ['friendly', 'excited'],
  }),
  makeArchetype({
    archetypeId: 'silent-analyzer',
    name: 'The Silent Analyzer',
    description: 'Says little, observes carefully, makes decisions slowly.',
    defaultTone: 'reserved',
    communicationStyle: 'short and sparse',
    trustStyle: 'builds quietly over time',
    pacingStyle: 'slow and deliberate',
    commonConcerns: ['confidence', 'accuracy', 'stability'],
    preferredResponseStyle: 'patient pacing, concise clarity, and check-ins',
    riskFactors: ['over-talking', 'assuming agreement'],
    positiveSignals: ['clean confirmations', 'space to think', 'respectful pauses'],
    personalityHints: ['reserved', 'analytical'],
  }),
  makeArchetype({
    archetypeId: 'rushed-parent',
    name: 'The Rushed Parent',
    description: 'Short on time, balancing responsibilities, wants efficiency and clarity.',
    defaultTone: 'stressed',
    communicationStyle: 'brief and urgency-driven',
    trustStyle: 'builds with fast clarity',
    pacingStyle: 'fast start, practical close',
    commonConcerns: ['time efficiency', 'safety', 'reliability'],
    preferredResponseStyle: 'concise, practical, and organized guidance',
    riskFactors: ['extra detail overload', 'slow process'],
    positiveSignals: ['timeline clarity', 'priority-first responses'],
    personalityHints: ['stressed', 'overwhelmed'],
  }),
  makeArchetype({
    archetypeId: 'optimist',
    name: 'The Optimist',
    description: 'Positive, hopeful, excited, easier to guide if trust is maintained.',
    defaultTone: 'upbeat',
    communicationStyle: 'open and enthusiastic',
    trustStyle: 'starts high, drops fast if inconsistency appears',
    pacingStyle: 'medium-fast',
    commonConcerns: ['good fit', 'confidence', 'next steps'],
    preferredResponseStyle: 'match energy, keep credibility, guide gently',
    riskFactors: ['overpromising', 'inconsistent answers'],
    positiveSignals: ['positive momentum', 'clear commitments'],
    personalityHints: ['excited', 'friendly'],
  }),
  makeArchetype({
    archetypeId: 'burned-buyer',
    name: 'The Burned Buyer',
    description: 'Had a bad prior experience and expects frustration or disappointment.',
    defaultTone: 'guarded-frustrated',
    communicationStyle: 'defensive and test-oriented',
    trustStyle: 'very slow rebuild',
    pacingStyle: 'slow and emotional',
    commonConcerns: ['trust', 'fair treatment', 'follow-through'],
    preferredResponseStyle: 'acknowledge history, stay calm, prove consistency',
    riskFactors: ['dismissing prior experience', 'hard closes'],
    positiveSignals: ['validation language', 'transparent next steps'],
    personalityHints: ['defensive', 'frustrated'],
  }),
  makeArchetype({
    archetypeId: 'joke-machine',
    name: 'The Joke Machine',
    description: 'Uses humor constantly, keeps things light, may avoid seriousness.',
    defaultTone: 'playful',
    communicationStyle: 'banter-heavy',
    trustStyle: 'builds through tone safety',
    pacingStyle: 'variable',
    commonConcerns: ['comfort', 'value', 'not feeling pressured'],
    preferredResponseStyle: 'match warmth, hold structure, move toward clarity',
    riskFactors: ['losing focus', 'dodging decision moments'],
    positiveSignals: ['tone control', 'playful but clear direction'],
    personalityHints: ['friendly', 'excited'],
  }),
  makeArchetype({
    archetypeId: 'confused-first-timer',
    name: 'The Confused First-Timer',
    description: 'Inexperienced, unsure, needs reassurance and simple explanations.',
    defaultTone: 'uncertain',
    communicationStyle: 'question-heavy and tentative',
    trustStyle: 'builds with reassurance',
    pacingStyle: 'slow-medium',
    commonConcerns: ['making mistakes', 'understanding process', 'budget safety'],
    preferredResponseStyle: 'simple, calm, and confidence-building language',
    riskFactors: ['jargon overload', 'rushed transitions'],
    positiveSignals: ['plain-language recaps', 'reassurance checks'],
    personalityHints: ['overwhelmed', 'cautious'],
  }),
  makeArchetype({
    archetypeId: 'assertive-negotiator',
    name: 'The Assertive Negotiator',
    description: 'Confident, direct, wants control of the interaction.',
    defaultTone: 'confident',
    communicationStyle: 'firm and direct',
    trustStyle: 'builds with competence',
    pacingStyle: 'fast and decisive',
    commonConcerns: ['deal quality', 'control', 'time'],
    preferredResponseStyle: 'professional firmness with value framing',
    riskFactors: ['caving too fast', 'defensive pushback'],
    positiveSignals: ['clear boundaries', 'composed responses'],
    personalityHints: ['impatient', 'skeptical'],
  }),
  makeArchetype({
    archetypeId: 'feature-fanatic',
    name: 'The Feature Fanatic',
    description: 'Gets excited about details, options, and product capabilities.',
    defaultTone: 'curious-excited',
    communicationStyle: 'feature-rich and exploratory',
    trustStyle: 'builds with demonstration quality',
    pacingStyle: 'medium with deep dives',
    commonConcerns: ['capabilities', 'packages', 'real-world use'],
    preferredResponseStyle: 'clear demos and practical feature translation',
    riskFactors: ['shallow feature talk', 'rushing through details'],
    positiveSignals: ['hands-on clarity', 'use-case examples'],
    personalityHints: ['curious', 'excited'],
  }),
  makeArchetype({
    archetypeId: 'validation-seeker',
    name: 'The Validation Seeker',
    description: 'Needs reassurance before making decisions, wants confidence from staff.',
    defaultTone: 'cautious',
    communicationStyle: 'reassurance-seeking',
    trustStyle: 'builds through repeated confirmation',
    pacingStyle: 'slow-medium',
    commonConcerns: ['decision confidence', 'risk reduction', 'support'],
    preferredResponseStyle: 'affirmation plus concrete clarity',
    riskFactors: ['abrupt pressure', 'unclear next steps'],
    positiveSignals: ['confidence checks', 'supportive recaps'],
    personalityHints: ['cautious', 'friendly'],
  }),
  makeArchetype({
    archetypeId: 'practical-realist',
    name: 'The Practical Realist',
    description: 'Wants straightforward answers, no drama, no fluff.',
    defaultTone: 'neutral-direct',
    communicationStyle: 'concise and practical',
    trustStyle: 'builds with clarity and efficiency',
    pacingStyle: 'medium-fast',
    commonConcerns: ['clarity', 'efficiency', 'value'],
    preferredResponseStyle: 'straight answers with minimal filler',
    riskFactors: ['rambling', 'overly emotional framing'],
    positiveSignals: ['direct answers', 'clear outcomes'],
    personalityHints: ['direct', 'analytical'],
  }),
  makeArchetype({
    archetypeId: 'stress-carrier',
    name: 'The Stress Carrier',
    description: 'Brings outside stress into the interaction, reacts strongly to friction.',
    defaultTone: 'tense',
    communicationStyle: 'emotionally reactive',
    trustStyle: 'fragile unless de-escalated',
    pacingStyle: 'erratic',
    commonConcerns: ['time pressure', 'cost shock', 'certainty'],
    preferredResponseStyle: 'calm de-escalation and step-by-step clarity',
    riskFactors: ['pressure tone', 'missed acknowledgment', 'topic jumps'],
    positiveSignals: ['calm empathy', 'structured reassurance'],
    personalityHints: ['stressed', 'frustrated', 'defensive'],
  }),
];

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

function scoreArchetype(archetype: CustomerArchetype, input: {
  roleType: AisRoleType;
  personalityType: string;
  primaryConcern: string;
}): number {
  let score = 0;
  const personality = input.personalityType.toLowerCase();
  const concern = input.primaryConcern.toLowerCase();
  if (archetype.personalityHints?.some((hint) => personality.includes(hint))) score += 2;
  if (archetype.commonConcerns.some((item) => concern.includes(item.toLowerCase()) || item.toLowerCase().includes(concern))) score += 2;
  if (archetype.archetypeId === 'skeptic' && input.roleType === 'fi') score += 1;
  if (archetype.archetypeId === 'over-researcher' && input.roleType !== 'parts') score += 1;
  return score;
}

export function getCustomerArchetypeByIdOrName(value: string | null | undefined): CustomerArchetype | null {
  if (!value) return null;
  const needle = normalize(value);
  return CUSTOMER_ARCHETYPES.find((item) => (
    normalize(item.archetypeId) === needle || normalize(item.name) === needle
  )) ?? null;
}

export function pickCustomerArchetype(input: {
  roleType: AisRoleType;
  seedInput: string;
  personalityType: string;
  primaryConcern: string;
  forcedArchetypeIdOrName?: string;
}): RoleAdjustedArchetype {
  const forced = getCustomerArchetypeByIdOrName(input.forcedArchetypeIdOrName);
  const candidates = forced ? [forced] : CUSTOMER_ARCHETYPES;
  const seed = [...input.seedInput].reduce((sum, char) => ((sum << 5) - sum) + char.charCodeAt(0), 0) || 1;

  let chosen = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const matchScore = scoreArchetype(candidate, input);
    const tieBreaker = Math.abs((seed + index * 11) % 5) / 10;
    const total = matchScore + tieBreaker;
    if (total > bestScore) {
      bestScore = total;
      chosen = candidate;
    }
  }

  const expressionKey = chosen.archetypeId.replace(/-/g, '_');
  const expression = ROLE_EXPRESSION[expressionKey]?.[input.roleType];
  const roleConcernFocus = expression?.concernFocus ?? [`${input.roleType} clarity`, ...chosen.commonConcerns.slice(0, 2)];
  const roleVocabulary = expression?.vocabulary ?? [input.roleType, ...chosen.commonConcerns.slice(0, 2)];
  const archetypeBehaviorFlags = Array.from(new Set([
    ...chosen.riskFactors.slice(0, 2).map((item) => `risk:${normalize(item)}`),
    ...chosen.positiveSignals.slice(0, 2).map((item) => `signal:${normalize(item)}`),
  ]));

  return {
    ...chosen,
    roleAdjustedArchetypeLabel: `${chosen.name} (${input.roleType.toUpperCase()} Context)`,
    roleConcernFocus,
    roleVocabulary,
    archetypeBehaviorFlags,
    archetypeConfidence: forced ? 1 : Math.max(0.55, Math.min(0.95, 0.6 + Math.max(0, bestScore) * 0.08)),
  };
}

