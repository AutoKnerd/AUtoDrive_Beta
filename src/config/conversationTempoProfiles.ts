import type { AisRoleType } from '@/lib/definitions';

export type ConversationTempoProfile = {
  tempoId: string;
  name: string;
  description: string;
  responseLength: 'short' | 'medium' | 'long' | 'variable';
  opennessSpeed: 'slow' | 'moderate' | 'fast' | 'variable';
  topicStability: 'stable' | 'mixed' | 'drifting';
  patienceLevel: 'low' | 'medium' | 'high';
  followUpFrequency: 'low' | 'medium' | 'high';
  interruptionTendency: 'low' | 'medium' | 'high';
  nextStepReadiness: 'slow' | 'moderate' | 'fast';
  trustRampSpeed: 'slow' | 'moderate' | 'fast' | 'volatile';
  driftLikelihood: 'low' | 'medium' | 'high';
  roleHints?: Partial<Record<AisRoleType, string>>;
};

export type RoleAdjustedConversationTempo = ConversationTempoProfile & {
  roleAdjustedTempoLabel: string;
  roleExpressionHint: string;
  tempoBehaviorFlags: string[];
  tempoConfidence: number;
};

function makeTempo(input: ConversationTempoProfile): ConversationTempoProfile {
  return input;
}

export const CONVERSATION_TEMPO_PROFILES: ConversationTempoProfile[] = [
  makeTempo({
    tempoId: 'steady',
    name: 'Steady',
    description: 'Balanced pacing, moderate openness, easy to follow.',
    responseLength: 'medium',
    opennessSpeed: 'moderate',
    topicStability: 'stable',
    patienceLevel: 'medium',
    followUpFrequency: 'medium',
    interruptionTendency: 'low',
    nextStepReadiness: 'moderate',
    trustRampSpeed: 'moderate',
    driftLikelihood: 'low',
    roleHints: {
      sales: 'Balanced shopping rhythm and healthy next-step pacing.',
      service: 'Balanced urgency and clarity expectations.',
      parts: 'Efficient but still conversational at the counter.',
      fi: 'Comfortable measured review pace.',
    },
  }),
  makeTempo({
    tempoId: 'slow-warm-up',
    name: 'Slow Warm-Up',
    description: 'Guarded at first, opens gradually over time.',
    responseLength: 'short',
    opennessSpeed: 'slow',
    topicStability: 'stable',
    patienceLevel: 'medium',
    followUpFrequency: 'low',
    interruptionTendency: 'low',
    nextStepReadiness: 'slow',
    trustRampSpeed: 'slow',
    driftLikelihood: 'low',
  }),
  makeTempo({
    tempoId: 'fast-talker',
    name: 'Fast Talker',
    description: 'Responds quickly, gives more information early, moves fast.',
    responseLength: 'long',
    opennessSpeed: 'fast',
    topicStability: 'mixed',
    patienceLevel: 'medium',
    followUpFrequency: 'high',
    interruptionTendency: 'medium',
    nextStepReadiness: 'fast',
    trustRampSpeed: 'fast',
    driftLikelihood: 'medium',
  }),
  makeTempo({
    tempoId: 'cautious-stop-start',
    name: 'Cautious Stop-Start',
    description: 'Gives partial answers, pauses progress, needs reassurance.',
    responseLength: 'variable',
    opennessSpeed: 'slow',
    topicStability: 'mixed',
    patienceLevel: 'medium',
    followUpFrequency: 'medium',
    interruptionTendency: 'low',
    nextStepReadiness: 'slow',
    trustRampSpeed: 'slow',
    driftLikelihood: 'medium',
  }),
  makeTempo({
    tempoId: 'scattered',
    name: 'Scattered',
    description: 'Jumps topics, provides uneven detail, needs refocusing.',
    responseLength: 'variable',
    opennessSpeed: 'variable',
    topicStability: 'drifting',
    patienceLevel: 'low',
    followUpFrequency: 'high',
    interruptionTendency: 'high',
    nextStepReadiness: 'moderate',
    trustRampSpeed: 'volatile',
    driftLikelihood: 'high',
  }),
  makeTempo({
    tempoId: 'urgent',
    name: 'Urgent',
    description: 'Wants quick progress, low patience, fast next-step movement.',
    responseLength: 'short',
    opennessSpeed: 'fast',
    topicStability: 'stable',
    patienceLevel: 'low',
    followUpFrequency: 'medium',
    interruptionTendency: 'medium',
    nextStepReadiness: 'fast',
    trustRampSpeed: 'fast',
    driftLikelihood: 'low',
  }),
  makeTempo({
    tempoId: 'deliberate',
    name: 'Deliberate',
    description: 'Careful, measured, thoughtful, slow decision movement.',
    responseLength: 'medium',
    opennessSpeed: 'slow',
    topicStability: 'stable',
    patienceLevel: 'high',
    followUpFrequency: 'medium',
    interruptionTendency: 'low',
    nextStepReadiness: 'slow',
    trustRampSpeed: 'moderate',
    driftLikelihood: 'low',
  }),
  makeTempo({
    tempoId: 'emotional-swell',
    name: 'Emotional Swell',
    description: 'Starts controlled but changes pace when emotion rises.',
    responseLength: 'variable',
    opennessSpeed: 'variable',
    topicStability: 'mixed',
    patienceLevel: 'medium',
    followUpFrequency: 'high',
    interruptionTendency: 'medium',
    nextStepReadiness: 'moderate',
    trustRampSpeed: 'volatile',
    driftLikelihood: 'medium',
  }),
];

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

export function getConversationTempoByIdOrName(value: string | null | undefined): ConversationTempoProfile | null {
  if (!value) return null;
  const needle = normalize(value);
  return CONVERSATION_TEMPO_PROFILES.find((item) => (
    normalize(item.tempoId) === needle || normalize(item.name) === needle
  )) ?? null;
}

function tempoScore(profile: ConversationTempoProfile, input: {
  personalityType: string;
  primaryConcern: string;
  communicationStyle: string;
  emotionalState: string;
}): number {
  const personality = input.personalityType.toLowerCase();
  const concern = input.primaryConcern.toLowerCase();
  const style = input.communicationStyle.toLowerCase();
  const emotion = input.emotionalState.toLowerCase();
  let score = 0;
  if (profile.tempoId === 'slow-warm-up' && (personality.includes('skeptical') || emotion.includes('guarded'))) score += 3;
  if (profile.tempoId === 'fast-talker' && (style.includes('talkative') || style.includes('rapid-fire'))) score += 3;
  if (profile.tempoId === 'cautious-stop-start' && (emotion.includes('cautious') || personality.includes('overwhelmed'))) score += 2;
  if (profile.tempoId === 'scattered' && (style.includes('story-driven') || personality.includes('overwhelmed'))) score += 2;
  if (profile.tempoId === 'urgent' && (concern.includes('time') || concern.includes('timeline') || concern.includes('availability'))) score += 3;
  if (profile.tempoId === 'deliberate' && (personality.includes('analytical') || concern.includes('contract') || concern.includes('fitment'))) score += 2;
  if (profile.tempoId === 'emotional-swell' && (emotion.includes('stressed') || emotion.includes('frustrated'))) score += 3;
  if (profile.tempoId === 'steady') score += 1;
  return score;
}

export function pickConversationTempoProfile(input: {
  roleType: AisRoleType;
  seedInput: string;
  personalityType: string;
  primaryConcern: string;
  communicationStyle: string;
  emotionalState: string;
  forcedTempoIdOrName?: string;
}): RoleAdjustedConversationTempo {
  const forced = getConversationTempoByIdOrName(input.forcedTempoIdOrName);
  const candidates = forced ? [forced] : CONVERSATION_TEMPO_PROFILES;
  const seed = [...input.seedInput].reduce((sum, char) => ((sum << 5) - sum) + char.charCodeAt(0), 0) || 1;

  let selected = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const scored = tempoScore(candidate, input);
    const tieBreaker = Math.abs((seed + index * 17) % 7) / 10;
    const total = scored + tieBreaker;
    if (total > bestScore) {
      bestScore = total;
      selected = candidate;
    }
  }

  const roleExpressionHint = selected.roleHints?.[input.roleType]
    ?? `${selected.name} pacing adapted for ${input.roleType.toUpperCase()} interactions.`;
  const tempoBehaviorFlags = [
    `tempo:${normalize(selected.responseLength)}`,
    `openness:${normalize(selected.opennessSpeed)}`,
    `stability:${normalize(selected.topicStability)}`,
    `patience:${normalize(selected.patienceLevel)}`,
    `readiness:${normalize(selected.nextStepReadiness)}`,
  ];

  return {
    ...selected,
    roleAdjustedTempoLabel: `${selected.name} (${input.roleType.toUpperCase()} Context)`,
    roleExpressionHint,
    tempoBehaviorFlags,
    tempoConfidence: forced ? 1 : Math.max(0.55, Math.min(0.95, 0.58 + Math.max(0, bestScore) * 0.08)),
  };
}

export function applyTempoMeterAdjustment(input: {
  tempoId?: string | null;
  roleType?: AisRoleType | null;
  currentMeter: number;
  baseDelta: number;
  trustHit: boolean;
  empathyHit: boolean;
  listeningHit: boolean;
  closingHit: boolean;
  strongDiscovery: boolean;
  trustBreakthrough: boolean;
  minorMistake: boolean;
  majorTrustBreak: boolean;
  clarityHit: boolean;
  anchorHit: boolean;
  vagueHit: boolean;
}): number {
  const tempo = normalize(input.tempoId || 'steady');
  const early = input.currentMeter < 55;
  const late = input.currentMeter >= 70;
  let adjustment = 0;

  if (tempo === 'slow-warm-up') {
    if (early && input.baseDelta > 0) adjustment -= 2;
    if (late && (input.trustHit || input.empathyHit || input.listeningHit) && input.baseDelta > 0) adjustment += 3;
  } else if (tempo === 'fast-talker') {
    if (input.baseDelta > 0 && (input.strongDiscovery || input.closingHit)) adjustment += 2;
    if (input.baseDelta < 0 && (input.minorMistake || input.vagueHit)) adjustment -= 2;
  } else if (tempo === 'cautious-stop-start') {
    if (input.baseDelta > 0 && (input.trustHit || input.empathyHit)) adjustment += 1;
    if (!(input.trustHit || input.listeningHit || input.empathyHit)) adjustment -= 2;
  } else if (tempo === 'scattered') {
    if (input.anchorHit || input.listeningHit) adjustment += 2;
    if (input.vagueHit || input.minorMistake) adjustment -= 3;
  } else if (tempo === 'urgent') {
    if (input.clarityHit || input.closingHit || input.trustBreakthrough) adjustment += 3;
    if (input.vagueHit || input.minorMistake) adjustment -= 4;
  } else if (tempo === 'deliberate') {
    if (input.clarityHit || input.strongDiscovery) adjustment += 2;
    if (input.vagueHit || input.minorMistake) adjustment -= 3;
  } else if (tempo === 'emotional-swell') {
    if ((input.empathyHit || input.trustHit) && input.baseDelta > 0) adjustment += 2;
    if (input.majorTrustBreak) adjustment -= 4;
  }

  // Role-sensitive tuning keeps tempo behavior role-native.
  if (input.roleType === 'service' && tempo === 'urgent' && input.clarityHit) adjustment += 1;
  if (input.roleType === 'parts' && tempo === 'urgent' && !input.clarityHit) adjustment -= 1;
  if (input.roleType === 'fi' && tempo === 'deliberate' && input.clarityHit) adjustment += 1;
  if (input.roleType === 'sales' && tempo === 'fast-talker' && late && input.closingHit) adjustment += 1;

  return adjustment;
}
