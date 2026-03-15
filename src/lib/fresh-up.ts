import { subDays } from 'date-fns';
import type { CxTrait, FreshUpMemoryState, FreshUpProfile, FreshUpTag, Lesson, LessonLog, LessonRole } from '@/lib/definitions';
import { applyFreshUpEmotionalResponse, normalizeEmotion, type FreshUpEmotionState } from '@/lib/fresh-up-emotion';
import { createFreshUpMemoryState, updateFreshUpMemoryState } from '@/lib/fresh-up-memory';
import { generateProceduralFreshUpCustomer } from '@/lib/fresh-up-procedural';
import { getSignatureFreshUpScenarioById, getSignatureFreshUpScenarios } from '@/lib/fresh-up-signature';

export const FRESH_UP_LESSON_ID = 'fresh-up';
export const FRESH_UP_SKILL_WEIGHT = 1.5;
export const FRESH_UP_MAX_XP = 150;
export const FRESH_UP_MIN_XP = 40;
export const FRESH_UP_SESSION_START_METER = 35;
export const UP_METER_GUARANTEED_THRESHOLD = 100;
export const UP_METER_MODERATE_THRESHOLD = 90;
export const UP_METER_LOW_THRESHOLD = 70;
export const UP_METER_POST_COMPLETION_FLOOR = 25;
export const FRESH_UP_PROCEDURAL_WEIGHT = 0.7;

type UpMeterState = 'Building' | 'Almost Ready' | 'Fresh Up Available';
type MeterCategory = 'empathy' | 'listening' | 'trust' | 'relationship' | 'closing';

export const FRESH_UP_TAG_COPY: Record<FreshUpTag, string> = {
  price_first: 'Moves to numbers too early during price conversations',
  payment_focus: 'Over-centers payment before validating broader customer priorities',
  trust_drop: 'Loses credibility when difficult concerns are raised',
  weak_discovery: 'Needs stronger discovery before presenting solutions',
  knowledge_gap: 'Needs more confident and specific product knowledge in comparison moments',
  strong_empathy: 'Builds emotional comfort well with uncertain customers',
  empathy_builder: 'Builds customer confidence with calm reassurance and supportive tone',
  missed_influence: 'Misses silent decision influencers in multi-buyer conversations',
  feature_confusion: 'Needs clearer feature explanations tied to customer outcomes',
  weak_follow_up: 'Misses opportunities to continue the conversation late',
  trust_pressure: 'Applies pressure before enough trust is established',
  discount_focus: 'Stays in discount mode instead of reinforcing value',
  premature_close: 'Tends to close before enough confidence is built',
  missed_connection: 'Misses opportunities to match customer enthusiasm and connection',
  trust_gap: 'Needs stronger consistency and transparency to maintain trust',
  clarity_needed: 'Needs simpler, clearer structure when customers feel overloaded',
  tech_resistance: 'Needs better framing when customers resist technology-heavy conversations',
  relationship_opportunity: 'Can deepen relationship momentum before moving to transaction steps',
  closing_miss: 'Needs stronger transition from interest to confident commitment',
  needs_alignment: 'Needs to connect recommendations more tightly to stated needs',
  trust_rebuild: 'Needs stronger acknowledgment and repair after prior bad experiences',
  process_efficiency: 'Needs to run a tighter process for time-constrained buyers',
  feature_miss: 'Misses key feature storytelling that supports perceived value',
  comparison_gap: 'Needs better competitive comparison confidence without negative framing',
  loyalty_opportunity: 'Can better leverage repeat-customer loyalty signals',
  negotiation_pressure: 'Needs steadier value protection under negotiation pressure',
  relationship_build: 'Should prioritize long-term relationship development over immediate close pressure',
  strong_relationship: 'Creates strong personal connection during longer conversations',
  trust_builder: 'Builds confidence steadily when the customer is guarded',
  closing_strength: 'Handles the commitment step with clarity and calm',
  needs_listening: 'Needs to slow down and confirm the customer\'s priorities more clearly',
  relationship_builder: 'Strengthens rapport well through longer conversations',
};

export const FRESH_UP_MANAGER_COACHING: Record<FreshUpTag, string> = {
  price_first: 'Coach this consultant on slowing down early price conversations and asking one more discovery question before discussing numbers.',
  payment_focus: 'Coach them to re-anchor around customer priorities before discussing payment structure.',
  trust_drop: 'Coach calm acknowledgment language and consistent follow-through when trust is challenged.',
  weak_discovery: 'Coach for stronger discovery sequencing before presenting options so recommendations are tied to stated needs.',
  knowledge_gap: 'Coach deeper product confidence using side-by-side value explanations tied to customer goals.',
  strong_empathy: 'Reinforce this strength by encouraging them to pair empathy with clearer next-step commitment language.',
  empathy_builder: 'Encourage them to keep empathy high while tightening the path to commitment.',
  missed_influence: 'Coach them to intentionally include all stakeholders, especially quiet decision influencers.',
  feature_confusion: 'Coach concise feature demonstrations connected to real customer outcomes.',
  weak_follow_up: 'Encourage stronger follow-up questions that keep the conversation moving toward commitment.',
  trust_pressure: 'Coach them to earn trust checkpoints before applying closing pressure.',
  discount_focus: 'Coach value framing before discounts so gross and trust are both protected.',
  premature_close: 'Work on building more trust before transitioning into closing language.',
  missed_connection: 'Coach active mirroring of customer energy and interests to improve rapport quality.',
  trust_gap: 'Coach transparent language and consistency in answers to reduce trust erosion.',
  clarity_needed: 'Coach simpler, step-by-step communication with frequent understanding checks.',
  tech_resistance: 'Coach practical, benefit-led tech explanations rather than feature-heavy pitches.',
  relationship_opportunity: 'Coach one extra relationship-building question before pivoting to transaction details.',
  closing_miss: 'Coach explicit trial-close checkpoints to convert momentum into commitment.',
  needs_alignment: 'Coach tighter alignment between discovered needs and recommendation rationale.',
  trust_rebuild: 'Coach acknowledgment-first responses to rebuild trust after past negative experiences.',
  process_efficiency: 'Coach a faster, cleaner process structure for time-sensitive customers.',
  feature_miss: 'Coach consistent feature storytelling that links capability to customer value.',
  comparison_gap: 'Coach confident, respectful comparisons focused on fit and long-term ownership value.',
  loyalty_opportunity: 'Coach loyalty reinforcement language that turns repeat visits into stronger commitments.',
  negotiation_pressure: 'Coach discipline under negotiation pressure while protecting value and professionalism.',
  relationship_build: 'Coach long-game follow-up and relationship cadence instead of pushing immediate close.',
  strong_relationship: 'Leverage this strength and coach them to convert rapport into confident follow-through.',
  trust_builder: 'Keep coaching consistency and transparency language to turn trust into smoother progress.',
  closing_strength: 'Build on closing confidence while protecting pacing and customer comfort.',
  needs_listening: 'Coach for slower pacing and explicit recap checks before moving to solutions.',
  relationship_builder: 'Encourage them to maintain relationship depth while tightening structure toward decisions.',
};

export function getFreshUpProfileLibrary(): FreshUpProfile[] {
  return getSignatureFreshUpScenarios();
}

export function buildFreshUpLesson(role: LessonRole): Lesson {
  return {
    lessonId: FRESH_UP_LESSON_ID,
    title: 'Fresh Up!',
    role,
    category: 'Sales - Meet and Greet',
    associatedTrait: 'relationshipBuilding',
    lessonType: 'fresh-up',
    customScenario: 'A higher-level customer just entered the showroom. This conversation will require stronger listening, trust building, and clarity.',
  };
}

export function getFreshUpProfileById(profileId: string | null | undefined): FreshUpProfile | null {
  if (!profileId) return null;
  if (profileId.startsWith('proc-')) {
    return generateProceduralFreshUpCustomer(profileId);
  }
  return getSignatureFreshUpScenarioById(profileId) ?? generateProceduralFreshUpCustomer(`proc-${profileId}`);
}

export function pickFreshUpProfile(userId: string, logs: LessonLog[] = [], consultantLevel?: number): FreshUpProfile {
  const completedFreshUps = logs.filter((log) => log.activitySource === 'fresh-up');
  const completedIds = new Set(completedFreshUps.map((log) => log.freshUpId).filter(Boolean));
  const sequence = completedFreshUps.length + 1;
  const selectorSeed = [...`${userId}:${sequence}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const selector = (selectorSeed % 100) / 100;

  if (selector < FRESH_UP_PROCEDURAL_WEIGHT) {
    return generateProceduralFreshUpCustomer(`proc-${userId}-${sequence}-${selectorSeed}`, { consultantLevel });
  }

  const signatures = getSignatureFreshUpScenarios();
  const unseen = signatures.filter((profile) => !completedIds.has(profile.freshUpId));
  const signaturePool = unseen.length > 0 ? unseen : signatures;
  if (!signaturePool.length) {
    return generateProceduralFreshUpCustomer(`proc-${userId}-${sequence}-${selectorSeed}-fallback`, { consultantLevel });
  }
  return signaturePool[selectorSeed % signaturePool.length];
}

export function formatTraitLabel(trait: CxTrait): string {
  return trait
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (value) => value.toUpperCase());
}

function parseSkillToTrait(skill: string): CxTrait[] {
  const normalized = skill.trim().toLowerCase();
  if (normalized === 'empathy') return ['empathy'];
  if (normalized === 'listening') return ['listening'];
  if (normalized === 'trust') return ['trust'];
  if (normalized === 'follow up' || normalized === 'follow_up' || normalized === 'followup') return ['followUp'];
  if (normalized === 'closing') return ['closing'];
  if (normalized === 'relationship' || normalized === 'relationship building') return ['relationshipBuilding'];
  if (normalized === 'discovery') return ['listening', 'trust'];
  if (normalized === 'clarity') return ['listening', 'followUp'];
  return [];
}

export function getProfilePriorityTraits(profile: FreshUpProfile): CxTrait[] {
  const mapped = profile.skillsTested.flatMap(parseSkillToTrait);
  const deduped = Array.from(new Set(mapped));
  return deduped.length > 0 ? deduped : ['empathy', 'listening', 'trust', 'closing'];
}

export function summarizeFreshUpRatings(
  ratings: Partial<Record<CxTrait, number>>,
  prioritizedTraits: CxTrait[]
): Array<{ label: string; value: string }> {
  return prioritizedTraits.slice(0, 4).map((trait) => {
    const raw = Number(ratings[trait] ?? 0);
    const value = raw >= 85 ? 'Strong' : raw >= 75 ? 'Solid' : raw >= 65 ? 'Improving' : 'Growth Area';
    return {
      label: formatTraitLabel(trait),
      value,
    };
  });
}

export function getFreshUpInsightCopy(tag: FreshUpTag | null | undefined): string {
  if (!tag) return 'Not enough Fresh Up activity yet';
  return FRESH_UP_TAG_COPY[tag] ?? 'Not enough Fresh Up activity yet';
}

export function getFreshUpManagerRecommendation(tag: FreshUpTag | null | undefined): string {
  if (!tag) return 'Have the consultant complete at least one more Fresh Up to generate a coaching recommendation.';
  return FRESH_UP_MANAGER_COACHING[tag] ?? 'Have the consultant complete at least one more Fresh Up to generate a coaching recommendation.';
}

export function computeUpMeterIncrement(ratingsAverage: number, streakBonus: number = 0): number {
  const base = ratingsAverage >= 85 ? 18 : ratingsAverage <= 65 ? 12 : 15;
  return base + streakBonus;
}

export function evaluateUpMeterState(meter: number, alreadyAvailable: boolean): UpMeterState {
  if (alreadyAvailable || meter >= UP_METER_GUARANTEED_THRESHOLD) return 'Fresh Up Available';
  if (meter >= UP_METER_LOW_THRESHOLD) return 'Almost Ready';
  return 'Building';
}

export function maybeUnlockFreshUp(currentMeter: number): boolean {
  if (currentMeter >= UP_METER_GUARANTEED_THRESHOLD) return true;
  if (currentMeter >= UP_METER_MODERATE_THRESHOLD) return Math.random() < 0.5;
  if (currentMeter >= UP_METER_LOW_THRESHOLD) return Math.random() < 0.2;
  return false;
}

export function getUpMeterProgress(meter: number): number {
  return Math.max(0, Math.min(100, Math.round((meter / UP_METER_GUARANTEED_THRESHOLD) * 100)));
}

export function resetUpMeterAfterFreshUp(currentMeter: number): number {
  return Math.max(UP_METER_POST_COMPLETION_FLOOR, currentMeter - UP_METER_GUARANTEED_THRESHOLD);
}

function getRecentFreshUps(logs: LessonLog[]): LessonLog[] {
  // Insight engine lookback: recent completed Fresh Ups within 30 days,
  // capped to the latest 5 sessions to keep manager signals concise.
  const cutoff = subDays(new Date(), 30);
  const completedFreshUps = logs
    .filter((log) => log.activitySource === 'fresh-up' && log.completionStatus === 'completed')
    .filter((log) => log.timestamp >= cutoff)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);
  return completedFreshUps;
}

export function getFreshUpSummaryTag(logs: LessonLog[]): FreshUpTag | null {
  const recentFreshUps = getRecentFreshUps(logs);
  if (recentFreshUps.length < 2) return null;

  const tagCounts = new Map<FreshUpTag, number>();
  for (const log of recentFreshUps) {
    const tag = log.summaryTag ?? log.coachingTag;
    if (!tag) continue;
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  let winner: FreshUpTag | null = null;
  let highest = 0;
  tagCounts.forEach((count, tag) => {
    if (count > highest) {
      highest = count;
      winner = tag;
    }
  });
  return winner;
}

export function computeWeightedTraitSummary(logs: LessonLog[]): {
  topStrength: CxTrait | null;
  areaForImprovement: CxTrait | null;
} {
  // Dealer Critical Summary uses weighted movement, with Fresh Ups carrying stronger signal.
  const relevantLogs = logs.filter((log) => log.completionStatus !== 'abandoned');
  if (!relevantLogs.length) {
    return { topStrength: null, areaForImprovement: null };
  }

  const totals: Record<CxTrait, number> = {
    empathy: 0,
    listening: 0,
    trust: 0,
    followUp: 0,
    closing: 0,
    relationshipBuilding: 0,
  };
  const weights: Record<CxTrait, number> = {
    empathy: 0,
    listening: 0,
    trust: 0,
    followUp: 0,
    closing: 0,
    relationshipBuilding: 0,
  };

  for (const log of relevantLogs) {
    const weight = log.skillWeightMultiplier ?? (log.activitySource === 'fresh-up' ? FRESH_UP_SKILL_WEIGHT : 1);
    const values: Record<CxTrait, number> = {
      empathy: Number(log.ratings?.empathy ?? log.empathy ?? 0),
      listening: Number(log.ratings?.listening ?? log.listening ?? 0),
      trust: Number(log.ratings?.trust ?? log.trust ?? 0),
      followUp: Number(log.ratings?.followUp ?? log.followUp ?? 0),
      closing: Number(log.ratings?.closing ?? log.closing ?? 0),
      relationshipBuilding: Number(log.ratings?.relationship ?? log.relationshipBuilding ?? 0),
    };

    (Object.keys(values) as CxTrait[]).forEach((trait) => {
      totals[trait] += values[trait] * weight;
      weights[trait] += weight;
    });
  }

  const averages = (Object.keys(totals) as CxTrait[]).map((trait) => ({
    trait,
    score: weights[trait] > 0 ? totals[trait] / weights[trait] : 0,
  }));
  averages.sort((a, b) => b.score - a.score);

  return {
    topStrength: averages[0]?.trait ?? null,
    areaForImprovement: averages[averages.length - 1]?.trait ?? null,
  };
}

function hasAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function clampUpMeter(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createInitialFreshUpMemory(profile: FreshUpProfile): FreshUpMemoryState {
  return createFreshUpMemoryState(profile);
}

export function getStartingEmotion(profile: FreshUpProfile): FreshUpEmotionState {
  return normalizeEmotion(profile.emotionalState);
}

export function evaluateFreshUpResponse(input: {
  message: string;
  currentMeter: number;
  profile?: FreshUpProfile | null;
  memoryState?: FreshUpMemoryState | null;
  currentEmotion?: FreshUpEmotionState | string | null;
  enableCustomerMemory?: boolean;
  enableEmotionalResponseEngine?: boolean;
}): {
  meterDelta: number;
  nextMeter: number;
  categoryDeltas: Record<MeterCategory, number>;
  nextMemoryState?: FreshUpMemoryState;
  nextEmotion?: FreshUpEmotionState;
} {
  const text = input.message.trim().toLowerCase();
  const categoryDeltas: Record<MeterCategory, number> = {
    empathy: 0,
    listening: 0,
    trust: 0,
    relationship: 0,
    closing: 0,
  };

  const empathyHit = hasAny(text, [
    'i understand',
    'that makes sense',
    'i hear you',
    'i can see',
    'i appreciate',
    'i get why',
  ]);
  const listeningHit = hasAny(text, [
    'you mentioned',
    'you said',
    'from what you shared',
    'earlier you',
    'if i heard you correctly',
  ]);
  const trustHit = hasAny(text, [
    'to be transparent',
    'to be clear',
    'honestly',
    'no pressure',
    'here is exactly',
    'let me be upfront',
  ]);
  const relationshipHit = hasAny(text, [
    'what matters most to you',
    'how will you use',
    'for your family',
    'for your day to day',
    'for you personally',
  ]);
  const closingHit = hasAny(text, [
    'next step',
    'would you like to',
    'we can set',
    'schedule',
    'appointment',
    'test drive',
    'move forward',
  ]);

  if (empathyHit) categoryDeltas.empathy += 6;
  if (listeningHit) categoryDeltas.listening += 6;
  if (trustHit) categoryDeltas.trust += 6;
  if (relationshipHit) categoryDeltas.relationship += 6;
  if (closingHit) categoryDeltas.closing += 5;

  const openQuestion = /\b(what|how|which|when|tell me|walk me through)\b/.test(text) && text.includes('?');
  const multiQuestion = (text.match(/\?/g) || []).length >= 2;
  const strongDiscovery = openQuestion && multiQuestion;
  const trustBreakthrough = trustHit && (empathyHit || listeningHit) && openQuestion;

  const majorTrustBreak = hasAny(text, [
    'sign now',
    'this is your only option',
    'doesn\'t matter',
    'just trust me',
    'if you don\'t buy today',
  ]);
  const minorMistake = hasAny(text, [
    'anyway',
    'let\'s move on',
    'that doesn\'t matter',
    'you should just',
  ]) || (!text.includes('?') && !empathyHit && !listeningHit && !trustHit && !relationshipHit);

  let meterDelta = 0;
  if (majorTrustBreak) {
    meterDelta = -15;
    categoryDeltas.trust -= 12;
    categoryDeltas.relationship -= 6;
  } else if (trustBreakthrough) {
    meterDelta = 12;
    categoryDeltas.trust += 10;
    categoryDeltas.listening += 4;
  } else if (strongDiscovery) {
    meterDelta = 8;
    categoryDeltas.listening += 6;
    categoryDeltas.relationship += 4;
  } else if (minorMistake) {
    meterDelta = -4;
    categoryDeltas.listening -= 4;
  } else {
    const positives = [empathyHit, listeningHit, trustHit, relationshipHit, closingHit].filter(Boolean).length;
    meterDelta = positives > 0 ? 3 : 0;
  }

  let nextMemoryState: FreshUpMemoryState | undefined;
  let momentumDelta = meterDelta;

  if (input.enableCustomerMemory !== false && input.profile && input.memoryState) {
    const memoryResult = updateFreshUpMemoryState({
      state: input.memoryState,
      userMessage: input.message,
      profile: input.profile,
    });
    nextMemoryState = memoryResult.nextState;
    momentumDelta += memoryResult.momentumDelta;
  }

  const baseMeter = clampUpMeter(input.currentMeter + momentumDelta);
  if (input.enableEmotionalResponseEngine === false) {
    return {
      meterDelta: momentumDelta,
      nextMeter: baseMeter,
      categoryDeltas,
      nextMemoryState,
      nextEmotion: normalizeEmotion(input.currentEmotion ?? input.profile?.emotionalState),
    };
  }

  const currentEmotion = normalizeEmotion(input.currentEmotion ?? input.profile?.emotionalState);
  const emotionResult = applyFreshUpEmotionalResponse({
    currentEmotion,
    currentMeter: baseMeter,
    momentumDelta,
  });
  const nextMeter = clampUpMeter(baseMeter + emotionResult.meterAdjustment);

  if (nextMemoryState && emotionResult.shiftLabel) {
    nextMemoryState = {
      ...nextMemoryState,
      emotionalShifts: [...nextMemoryState.emotionalShifts, emotionResult.shiftLabel].slice(-12),
    };
  }

  return {
    meterDelta: momentumDelta + emotionResult.meterAdjustment,
    nextMeter,
    categoryDeltas,
    nextMemoryState,
    nextEmotion: emotionResult.nextEmotion,
  };
}
