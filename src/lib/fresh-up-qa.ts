'use client';

import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import type { FreshUpArchetypeCategory, FreshUpEndingType, FreshUpOutcomeTag, FreshUpProfile } from '@/lib/definitions';
import { initializeFirebase } from '@/firebase/init';
import { clampUpMeter, createInitialFreshUpMemory, evaluateFreshUpResponse, getStartingEmotion } from '@/lib/fresh-up';
import { detectFreshUpEndingFallback, enrichMemoryStateFromOpening, generateFinalCustomerResponse, generateFreshUpOpening } from '@/lib/fresh-up-conversation';
import { generateProceduralFreshUpCustomer } from '@/lib/fresh-up-procedural';
import { getSignatureFreshUpScenarios } from '@/lib/fresh-up-signature';
import { mergeFreshUpValidationResults, validateFreshUpEndingGuardrails, validateFreshUpOpeningGuardrails } from '@/lib/fresh-up-guardrails';
import type { FreshUpFeatureToggles } from '@/lib/fresh-up-release';
import { getRoleExchangeTarget } from '@/config/roleToneProfiles';
import { CONVERSATION_TEMPO_PROFILES, pickConversationTempoProfile } from '@/config/conversationTempoProfiles';

export type FreshUpQASimulationConfig = {
  sessionsToRun: number;
  sourceType: 'procedural' | 'signature' | 'mixed';
  difficultyRange: 'easy' | 'medium' | 'hard' | 'mixed';
  vehicleInterestPool: string[];
  primaryConcernPool: string[];
  personalityPool: string[];
  communicationStylePool: string[];
  moodPool: string[];
  tempoPool: string[];
  archetypeCategoryPool: FreshUpArchetypeCategory[];
  freshUpVersionId?: string;
  freshUpVersionName?: string;
  featureToggles?: Partial<FreshUpFeatureToggles>;
};

export type FreshUpQATranscriptLine = {
  speaker: 'sprocket' | 'customer' | 'consultant';
  text: string;
  upMeter: number;
};

export type FreshUpQASessionResult = {
  simulationID: string;
  timestamp: Date;
  customerProfile: FreshUpProfile;
  openingMessage: string;
  conversationTranscript: FreshUpQATranscriptLine[];
  upMeterStart: number;
  upMeterPeak: number;
  upMeterEnd: number;
  endingType: FreshUpEndingType;
  outcomeTag: FreshUpOutcomeTag;
  skillScores: {
    empathy: number;
    listening: number;
    trust: number;
    relationship: number;
    follow_up: number;
    closing: number;
  };
  failureFlags: string[];
  guardrailFlags: string[];
  contentValidationPassed: boolean;
  validationFailureReasons: string[];
  freshUpVersionId?: string;
  freshUpVersionName?: string;
};

export type FreshUpQASummary = {
  runId: string;
  totalSessionsRun: number;
  outcomeDistribution: Record<FreshUpEndingType, number>;
  averageUpMeterPeak: number;
  averageUpMeterChange: number;
  averageSkillScoreImpact: {
    empathy: number;
    listening: number;
    trust: number;
    relationship: number;
    follow_up: number;
    closing: number;
  };
  archetypePerformance: Array<{
    archetypeCategory: FreshUpArchetypeCategory;
    sessions: number;
    averageUpMeterPeak: number;
    trustBreakRate: number;
  }>;
  mostCommonFailureConditions: Array<{ flag: string; count: number }>;
  sessions: FreshUpQASessionResult[];
  flaggedSessions: FreshUpQASessionResult[];
  freshUpVersionId?: string;
  freshUpVersionName?: string;
};

export type FreshUpQAVersionDefinition = {
  versionId: string;
  versionName: string;
  toggles: Partial<FreshUpFeatureToggles>;
};

export type FreshUpQAVersionComparisonResult = {
  left: FreshUpQASummary;
  right: FreshUpQASummary;
  deltas: {
    averageUpMeterPeak: number;
    averageUpMeterChange: number;
    averageSkillScoreImpact: {
      empathy: number;
      listening: number;
      trust: number;
      relationship: number;
      follow_up: number;
      closing: number;
    };
    outcomeDistribution: Record<FreshUpEndingType, number>;
    flaggedSessionDelta: number;
    guardrailFailureDelta: number;
  };
};

const ALL_VEHICLES = ['SUV', 'truck', 'sedan', 'hybrid', 'EV', 'performance vehicle', 'family vehicle'];
const ALL_PRIMARY_CONCERNS = ['price', 'trade value', 'monthly payment', 'reliability', 'technology confusion', 'fuel economy', 'safety', 'time efficiency'];
const ALL_PERSONALITIES = ['analytical', 'friendly', 'skeptical', 'impatient', 'overwhelmed', 'excited', 'defensive'];
const ALL_COMMUNICATION_STYLES = ['talkative', 'reserved', 'direct', 'sarcastic', 'story-driven', 'cautious', 'rapid-fire questions'];
const ALL_MOODS = ['cautious', 'curious', 'stressed', 'excited', 'guarded', 'frustrated', 'optimistic'];
const ALL_TEMPO_IDS = CONVERSATION_TEMPO_PROFILES.map((profile) => profile.tempoId);
const FAILURE_FLAG_MAP: Record<string, string> = {
  unrealistic_dialogue: 'unrealistic dialogue',
  conversation_dead_end: 'conversation dead end',
  up_meter_collapse: 'up meter collapse',
  memory_failure: 'memory failure',
  looping_behavior: 'looping behavior',
  weak_opening: 'weak opening',
  weak_ending: 'weak ending',
  repeated_unanswered_questions: 'repeated unanswered questions',
  emotional_shift_mismatch: 'emotional shift mismatch',
  customer_frustration_unresolved: 'customer frustration unresolved',
  abrupt_ending: 'abrupt conversation ending',
  unrealistic_opening: 'unrealistic opening',
  unrealistic_ending: 'unrealistic ending',
  repetitive_structure: 'repetitive dialogue structure',
  weak_coaching_value: 'weak coaching value',
  too_absurd: 'humor overreach / too absurd',
  too_hostile: 'excessive hostility',
  low_variety: 'low variety',
  unnatural_tone: 'unnatural tone',
};

function safePool(pool: string[], defaults: string[]): string[] {
  const values = pool.filter((value) => value.trim().length > 0);
  return values.length > 0 ? values : defaults;
}

function chooseBySeed<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length] as T;
}

function hashSeed(value: string): number {
  return [...value].reduce((sum, char) => ((sum << 5) - sum) + char.charCodeAt(0), 0) || 1;
}

function withResolvedTempoProfile(input: {
  profile: FreshUpProfile;
  roleType: FreshUpProfile['roleType'];
  forceTempoIdOrName: string;
  seedInput: string;
}): FreshUpProfile {
  const roleType = input.roleType ?? 'sales';
  const selectedTempo = pickConversationTempoProfile({
    roleType,
    seedInput: input.seedInput,
    personalityType: input.profile.personalityType,
    primaryConcern: input.profile.primaryConcern,
    communicationStyle: input.profile.communicationStyle,
    emotionalState: input.profile.emotionalState,
    forcedTempoIdOrName: input.forceTempoIdOrName,
  });
  return {
    ...input.profile,
    conversationTempoId: selectedTempo.tempoId,
    conversationTempoName: selectedTempo.name,
    roleAdjustedTempoLabel: selectedTempo.roleAdjustedTempoLabel,
    tempoConfidence: selectedTempo.tempoConfidence,
    tempoBehaviorFlags: selectedTempo.tempoBehaviorFlags,
  };
}

function buildBaselineConsultantResponse(input: {
  profile: FreshUpProfile;
  turn: number;
  currentMeter: number;
  concern: string;
}): string {
  const openers = [
    `Thanks for sharing that. If I heard you correctly, your main focus is ${input.concern}.`,
    `I understand. To be transparent, I want to make this easy and clear for you.`,
    `What matters most to you in how you'll use this ${input.profile.vehicleInterest}?`,
    `From what you shared, we can take the next step without pressure.`,
  ];
  const closers = [
    'Would you like to schedule a quick test drive?',
    'If this fits, we can set a clear next step together.',
    'We can move forward at your pace once this feels right.',
  ];

  if (input.turn >= 4 && input.currentMeter >= 65) {
    return `${chooseBySeed(openers, input.turn)} ${chooseBySeed(closers, input.turn + 11)}`;
  }
  return chooseBySeed(openers, input.turn);
}

function buildSimulatedCustomerReply(input: {
  profile: FreshUpProfile;
  turn: number;
  meter: number;
  emotion: string;
}): string {
  if (input.turn >= 5 && input.meter >= 78) {
    return 'That helps. I feel better about this and can look at the next step.';
  }
  if (input.meter <= 30) {
    return 'I still feel like we are missing what I asked about.';
  }
  if (input.emotion.includes('frustrated') || input.emotion.includes('resistant')) {
    return 'I need clearer answers before I can trust this process.';
  }
  return `Okay, that gives me a better feel for it. I still care most about ${input.profile.primaryConcern}.`;
}

function detectFailureFlags(input: {
  openingMessage: string;
  transcript: FreshUpQATranscriptLine[];
  upMeterStart: number;
  upMeterPeak: number;
  upMeterEnd: number;
  endingType: FreshUpEndingType;
  finalEmotion: string;
  rememberedConcerns: string[];
  acknowledgedConcerns: string[];
  repeatedQuestions: number;
  trustBreaks: number;
}): string[] {
  const flags: string[] = [];
  const transcriptText = input.transcript.map((line) => line.text).join(' ').toLowerCase();
  const consultantTurns = input.transcript.filter((line) => line.speaker === 'consultant').map((line) => line.text.toLowerCase());
  const uniqueConsultantTurns = new Set(consultantTurns);

  if (input.openingMessage.trim().length < 35) flags.push('weak_opening');
  if (input.openingMessage.toLowerCase().split(' ').length > 55) flags.push('unrealistic_dialogue');
  if (input.upMeterPeak - input.upMeterEnd >= 30 || input.upMeterEnd <= 20) flags.push('up_meter_collapse');
  if (input.repeatedQuestions >= 3) flags.push('repeated_unanswered_questions');
  if (input.trustBreaks >= 2 || (input.finalEmotion.includes('frustrated') && input.upMeterEnd < input.upMeterStart)) flags.push('customer_frustration_unresolved');
  if (input.endingType === 'stalled_conversation' || input.endingType === 'trust_break') flags.push('conversation_dead_end');
  if (input.endingType === 'neutral_pause' && input.upMeterEnd < 45) flags.push('weak_ending');
  if (consultantTurns.length >= 4 && uniqueConsultantTurns.size <= Math.max(1, consultantTurns.length - 3)) flags.push('looping_behavior');
  if (input.rememberedConcerns.length > 0 && input.acknowledgedConcerns.length === 0) flags.push('memory_failure');
  if (input.transcript.length < 10) flags.push('abrupt_ending');
  if (transcriptText.includes('as an ai') || transcriptText.includes('{') || transcriptText.includes('[')) flags.push('unrealistic_dialogue');
  if (input.upMeterEnd >= 75 && (input.endingType === 'trust_break' || input.endingType === 'stalled_conversation')) flags.push('emotional_shift_mismatch');
  return Array.from(new Set(flags));
}

function generateProfileForSimulation(input: {
  config: FreshUpQASimulationConfig;
  index: number;
  runId: string;
}): FreshUpProfile {
  const seed = hashSeed(`${input.runId}:${input.index}`);
  const vehicles = safePool(input.config.vehicleInterestPool.filter((v) => v.toLowerCase() !== 'random'), ALL_VEHICLES);
  const concerns = safePool(input.config.primaryConcernPool, ALL_PRIMARY_CONCERNS);
  const personalities = safePool(input.config.personalityPool, ALL_PERSONALITIES);
  const styles = safePool(input.config.communicationStylePool, ALL_COMMUNICATION_STYLES);
  const moods = safePool(input.config.moodPool, ALL_MOODS);
  const tempos = safePool(input.config.tempoPool, ALL_TEMPO_IDS);
  const archetypeCategories = (input.config.archetypeCategoryPool?.length ?? 0) > 0 ? input.config.archetypeCategoryPool : undefined;
  const tempoId = chooseBySeed(tempos, seed + 6);
  const difficulty = input.config.difficultyRange === 'mixed'
    ? chooseBySeed(['easy', 'medium', 'hard'], seed + 7)
    : input.config.difficultyRange;
  const toggles = resolveQAToggles(input.config.featureToggles);
  const proceduralAllowed = toggles.enableProceduralGeneration && toggles.enableArchetypeLibrary;
  const signatureAllowed = toggles.enableSignatureScenarios;
  const sourceType = input.config.sourceType === 'mixed'
    ? (seed % 10 < 7 ? 'procedural' : 'signature')
    : input.config.sourceType;
  const effectiveSourceType = sourceType === 'procedural' && !proceduralAllowed
    ? 'signature'
    : (sourceType === 'signature' && !signatureAllowed ? 'procedural' : sourceType);

  if (effectiveSourceType === 'signature' && signatureAllowed) {
    const candidates = getSignatureFreshUpScenarios().filter((scenario) => {
      if (input.config.difficultyRange !== 'mixed' && scenario.difficultyLevel !== input.config.difficultyRange) return false;
      if (!vehicles.includes(scenario.vehicleInterest)) return false;
      if (!concerns.includes(scenario.primaryConcern)) return false;
      if (!personalities.includes(scenario.personalityType)) return false;
      if (!styles.includes(scenario.communicationStyle)) return false;
      if (!moods.includes(scenario.emotionalState)) return false;
      if (archetypeCategories && !archetypeCategories.includes(scenario.archetypeCategory)) return false;
      return true;
    });
    const signaturePool = candidates.length > 0 ? candidates : getSignatureFreshUpScenarios();
    const selectedSignature = chooseBySeed(signaturePool, seed + 13);
    return withResolvedTempoProfile({
      profile: selectedSignature,
      roleType: selectedSignature.roleType ?? 'sales',
      forceTempoIdOrName: tempoId,
      seedInput: `${input.runId}:${input.index}:signature-tempo`,
    });
  }

  const procedural = generateProceduralFreshUpCustomer(`${input.runId}:${input.index}`, {
    difficultyLevel: difficulty as 'easy' | 'medium' | 'hard',
    vehicleInterest: chooseBySeed(vehicles, seed + 1),
    primaryConcern: chooseBySeed(concerns, seed + 2),
    personalityType: chooseBySeed(personalities, seed + 3),
    communicationStyle: chooseBySeed(styles, seed + 4),
    emotionalState: chooseBySeed(moods, seed + 5),
    forceTempoIdOrName: tempoId,
    archetypeCategoryFilter: archetypeCategories,
  });
  return withResolvedTempoProfile({
    profile: procedural,
    roleType: procedural.roleType ?? 'sales',
    forceTempoIdOrName: tempoId,
    seedInput: `${input.runId}:${input.index}:procedural-tempo`,
  });
}

function resolveQAToggles(input?: Partial<FreshUpFeatureToggles>): FreshUpFeatureToggles {
  return {
    enableProceduralGeneration: input?.enableProceduralGeneration !== false,
    enableSignatureScenarios: input?.enableSignatureScenarios !== false,
    enableCustomerMemory: input?.enableCustomerMemory !== false,
    enableEmotionalResponseEngine: input?.enableEmotionalResponseEngine !== false,
    enableDifficultyDistribution: input?.enableDifficultyDistribution !== false,
    enableArchetypeLibrary: input?.enableArchetypeLibrary !== false,
    enableOpeningMechanic: input?.enableOpeningMechanic !== false,
    enableEndingMechanic: input?.enableEndingMechanic !== false,
    enableConsultantFeedbackEnhancements: input?.enableConsultantFeedbackEnhancements !== false,
    enableManagerInsightEnhancements: input?.enableManagerInsightEnhancements !== false,
    enableSandboxDebugTools: input?.enableSandboxDebugTools !== false,
    enableQAMatrix: input?.enableQAMatrix !== false,
    enableContentGuardrails: input?.enableContentGuardrails !== false,
  };
}

function simulateSingleSession(runId: string, index: number, config: FreshUpQASimulationConfig): FreshUpQASessionResult {
  const toggles = resolveQAToggles(config.featureToggles);
  let profile = generateProfileForSimulation({ config, index, runId });
  const simulationID = `${runId}-${String(index + 1).padStart(3, '0')}`;
  let opening = toggles.enableOpeningMechanic
    ? generateFreshUpOpening(profile, profile.roleType ?? 'sales')
    : {
      sprocketLine: 'Fresh up on the floor. Stay curious and customer-first.',
      customerOpening: `I am looking at this ${profile.vehicleInterest} and I want to make the right decision.`,
    };
  let openingValidation = toggles.enableContentGuardrails
    ? validateFreshUpOpeningGuardrails({
      profile,
      openingMessage: opening.customerOpening,
    })
    : { contentValidationPassed: true, validationFailureReasons: [], guardrailFlags: [] };
  for (let attempt = 0; attempt < 2 && !openingValidation.contentValidationPassed; attempt += 1) {
    profile = generateProfileForSimulation({ config, index: index + attempt + 17, runId: `${runId}-regen` });
    opening = toggles.enableOpeningMechanic
      ? generateFreshUpOpening(profile, profile.roleType ?? 'sales')
      : {
        sprocketLine: 'Fresh up on the floor. Stay curious and customer-first.',
        customerOpening: `I am looking at this ${profile.vehicleInterest} and I want to make the right decision.`,
      };
    openingValidation = toggles.enableContentGuardrails
      ? validateFreshUpOpeningGuardrails({
        profile,
        openingMessage: opening.customerOpening,
      })
      : { contentValidationPassed: true, validationFailureReasons: [], guardrailFlags: [] };
  }
  let memoryState = enrichMemoryStateFromOpening(createInitialFreshUpMemory(profile), opening.customerOpening);
  let emotion = getStartingEmotion(profile);
  let meter = 35;
  let peak = meter;
  let scores = { empathy: 60, listening: 60, trust: 60, relationship: 60, closing: 60 };
  const transcript: FreshUpQATranscriptLine[] = [
    { speaker: 'sprocket', text: opening.sprocketLine, upMeter: meter },
    { speaker: 'customer', text: opening.customerOpening, upMeter: meter },
  ];

  const exchangeTarget = getRoleExchangeTarget(profile.roleType ?? 'sales');
  const turns = exchangeTarget.min + (Math.abs(hashSeed(simulationID)) % Math.max(1, exchangeTarget.max - exchangeTarget.min + 1));
  for (let turn = 0; turn < turns; turn += 1) {
    const consultantMessage = buildBaselineConsultantResponse({
      profile,
      turn,
      currentMeter: meter,
      concern: profile.primaryConcern,
    });
    transcript.push({ speaker: 'consultant', text: consultantMessage, upMeter: meter });

    const evaluated = evaluateFreshUpResponse({
      message: consultantMessage,
      currentMeter: meter,
      profile,
      memoryState,
      currentEmotion: emotion,
      enableCustomerMemory: toggles.enableCustomerMemory,
      enableEmotionalResponseEngine: toggles.enableEmotionalResponseEngine,
    });
    meter = evaluated.nextMeter;
    peak = Math.max(peak, meter);
    if (evaluated.nextMemoryState) memoryState = evaluated.nextMemoryState;
    if (evaluated.nextEmotion) emotion = evaluated.nextEmotion;
    scores = {
      empathy: clampUpMeter(scores.empathy + evaluated.categoryDeltas.empathy),
      listening: clampUpMeter(scores.listening + evaluated.categoryDeltas.listening),
      trust: clampUpMeter(scores.trust + evaluated.categoryDeltas.trust),
      relationship: clampUpMeter(scores.relationship + evaluated.categoryDeltas.relationship),
      closing: clampUpMeter(scores.closing + evaluated.categoryDeltas.closing),
    };

    const customerReply = buildSimulatedCustomerReply({
      profile,
      turn,
      meter,
      emotion: String(emotion),
    });
    transcript.push({ speaker: 'customer', text: customerReply, upMeter: meter });
  }

  const ending = toggles.enableEndingMechanic
    ? detectFreshUpEndingFallback({
      trustScore: scores.trust,
      upMeterStart: 35,
      upMeterEnd: meter,
      upMeterPeak: peak,
      endingEmotion: String(emotion),
      memoryState,
    })
    : {
      endingType: 'neutral_pause' as FreshUpEndingType,
      outcomeTag: 'Customer Engaged' as FreshUpOutcomeTag,
      trustShift: 0,
      recommendedNextStep: 'no_recommendation',
    };
  const finalCustomerResponse = generateFinalCustomerResponse({
    endingType: ending.endingType,
    endingEmotion: String(emotion),
    memoryState,
  });
  transcript.push({ speaker: 'customer', text: finalCustomerResponse, upMeter: meter });
  const endingValidation = toggles.enableContentGuardrails
    ? validateFreshUpEndingGuardrails({
      profile,
      endingType: ending.endingType,
      outcomeTag: ending.outcomeTag,
      finalCustomerResponse,
      trustShift: ending.trustShift,
    })
    : { contentValidationPassed: true, validationFailureReasons: [], guardrailFlags: [] };
  const mergedValidation = mergeFreshUpValidationResults([openingValidation, endingValidation]);

  const failureFlags = detectFailureFlags({
    openingMessage: opening.customerOpening,
    transcript,
    upMeterStart: 35,
    upMeterPeak: peak,
    upMeterEnd: meter,
    endingType: ending.endingType,
    finalEmotion: String(emotion),
    rememberedConcerns: memoryState.rememberedConcerns,
    acknowledgedConcerns: memoryState.acknowledgedConcerns,
    repeatedQuestions: memoryState.repeatedQuestions,
    trustBreaks: memoryState.trustBreaks,
  });
  const guardrailFlags = Array.from(new Set([...failureFlags, ...mergedValidation.guardrailFlags]));

  return {
    simulationID,
    timestamp: new Date(),
    customerProfile: profile,
    openingMessage: opening.customerOpening,
    conversationTranscript: transcript,
    upMeterStart: 35,
    upMeterPeak: peak,
    upMeterEnd: meter,
    endingType: ending.endingType,
    outcomeTag: ending.outcomeTag,
    skillScores: {
      empathy: scores.empathy,
      listening: scores.listening,
      trust: scores.trust,
      relationship: scores.relationship,
      follow_up: clampUpMeter((scores.listening + scores.trust) / 2),
      closing: scores.closing,
    },
    failureFlags,
    guardrailFlags,
    contentValidationPassed: mergedValidation.contentValidationPassed,
    validationFailureReasons: mergedValidation.validationFailureReasons,
    freshUpVersionId: config.freshUpVersionId,
    freshUpVersionName: config.freshUpVersionName,
  };
}

export function runFreshUpQAMatrix(config: FreshUpQASimulationConfig): FreshUpQASummary {
  const runId = `qa-${Date.now().toString(36)}`;
  const sessionsToRun = Math.max(5, Math.min(200, Math.round(config.sessionsToRun)));
  const sessions = Array.from({ length: sessionsToRun }).map((_, index) => simulateSingleSession(runId, index, config));
  const outcomeDistribution: Record<FreshUpEndingType, number> = {
    positive_progress: 0,
    neutral_pause: 0,
    stalled_conversation: 0,
    trust_break: 0,
    appointment_ready: 0,
  };
  const skillTotals = { empathy: 0, listening: 0, trust: 0, relationship: 0, follow_up: 0, closing: 0 };
  let upMeterDeltaTotal = 0;
  let upMeterPeakTotal = 0;
  const failureMap = new Map<string, number>();
  const archetypeMap = new Map<FreshUpArchetypeCategory, { sessions: number; peakTotal: number; trustBreaks: number }>();

  for (const session of sessions) {
    outcomeDistribution[session.endingType] += 1;
    upMeterDeltaTotal += (session.upMeterEnd - session.upMeterStart);
    upMeterPeakTotal += session.upMeterPeak;
    skillTotals.empathy += (session.skillScores.empathy - 60);
    skillTotals.listening += (session.skillScores.listening - 60);
    skillTotals.trust += (session.skillScores.trust - 60);
    skillTotals.relationship += (session.skillScores.relationship - 60);
    skillTotals.follow_up += (session.skillScores.follow_up - 60);
    skillTotals.closing += (session.skillScores.closing - 60);
    for (const flag of Array.from(new Set([...(session.failureFlags || []), ...(session.guardrailFlags || [])]))) {
      failureMap.set(flag, (failureMap.get(flag) ?? 0) + 1);
    }
    const category = session.customerProfile.archetypeCategory;
    const bucket = archetypeMap.get(category) ?? { sessions: 0, peakTotal: 0, trustBreaks: 0 };
    bucket.sessions += 1;
    bucket.peakTotal += session.upMeterPeak;
    if (session.endingType === 'trust_break') bucket.trustBreaks += 1;
    archetypeMap.set(category, bucket);
  }

  const mostCommonFailureConditions = Array.from(failureMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([flag, count]) => ({ flag: FAILURE_FLAG_MAP[flag] ?? flag, count }));
  const flaggedSessions = sessions.filter((session) => session.failureFlags.length > 0 || session.guardrailFlags.length > 0 || !session.contentValidationPassed);
  const archetypePerformance = Array.from(archetypeMap.entries()).map(([archetypeCategory, stats]) => ({
    archetypeCategory,
    sessions: stats.sessions,
    averageUpMeterPeak: Number((stats.peakTotal / Math.max(1, stats.sessions)).toFixed(1)),
    trustBreakRate: Number(((stats.trustBreaks / Math.max(1, stats.sessions)) * 100).toFixed(1)),
  })).sort((a, b) => b.sessions - a.sessions);

  return {
    runId,
    totalSessionsRun: sessions.length,
    outcomeDistribution,
    averageUpMeterPeak: sessions.length ? Number((upMeterPeakTotal / sessions.length).toFixed(1)) : 0,
    averageUpMeterChange: sessions.length ? Number((upMeterDeltaTotal / sessions.length).toFixed(1)) : 0,
    averageSkillScoreImpact: {
      empathy: sessions.length ? Number((skillTotals.empathy / sessions.length).toFixed(1)) : 0,
      listening: sessions.length ? Number((skillTotals.listening / sessions.length).toFixed(1)) : 0,
      trust: sessions.length ? Number((skillTotals.trust / sessions.length).toFixed(1)) : 0,
      relationship: sessions.length ? Number((skillTotals.relationship / sessions.length).toFixed(1)) : 0,
      follow_up: sessions.length ? Number((skillTotals.follow_up / sessions.length).toFixed(1)) : 0,
      closing: sessions.length ? Number((skillTotals.closing / sessions.length).toFixed(1)) : 0,
    },
    archetypePerformance,
    mostCommonFailureConditions,
    sessions,
    flaggedSessions,
    freshUpVersionId: config.freshUpVersionId,
    freshUpVersionName: config.freshUpVersionName,
  };
}

export function runFreshUpQAVersionComparison(input: {
  baseConfig: FreshUpQASimulationConfig;
  leftVersion: FreshUpQAVersionDefinition;
  rightVersion: FreshUpQAVersionDefinition;
}): FreshUpQAVersionComparisonResult {
  const left = runFreshUpQAMatrix({
    ...input.baseConfig,
    freshUpVersionId: input.leftVersion.versionId,
    freshUpVersionName: input.leftVersion.versionName,
    featureToggles: input.leftVersion.toggles,
  });
  const right = runFreshUpQAMatrix({
    ...input.baseConfig,
    freshUpVersionId: input.rightVersion.versionId,
    freshUpVersionName: input.rightVersion.versionName,
    featureToggles: input.rightVersion.toggles,
  });
  return {
    left,
    right,
    deltas: {
      averageUpMeterPeak: Number((right.averageUpMeterPeak - left.averageUpMeterPeak).toFixed(1)),
      averageUpMeterChange: Number((right.averageUpMeterChange - left.averageUpMeterChange).toFixed(1)),
      averageSkillScoreImpact: {
        empathy: Number((right.averageSkillScoreImpact.empathy - left.averageSkillScoreImpact.empathy).toFixed(1)),
        listening: Number((right.averageSkillScoreImpact.listening - left.averageSkillScoreImpact.listening).toFixed(1)),
        trust: Number((right.averageSkillScoreImpact.trust - left.averageSkillScoreImpact.trust).toFixed(1)),
        relationship: Number((right.averageSkillScoreImpact.relationship - left.averageSkillScoreImpact.relationship).toFixed(1)),
        follow_up: Number((right.averageSkillScoreImpact.follow_up - left.averageSkillScoreImpact.follow_up).toFixed(1)),
        closing: Number((right.averageSkillScoreImpact.closing - left.averageSkillScoreImpact.closing).toFixed(1)),
      },
      outcomeDistribution: {
        positive_progress: right.outcomeDistribution.positive_progress - left.outcomeDistribution.positive_progress,
        neutral_pause: right.outcomeDistribution.neutral_pause - left.outcomeDistribution.neutral_pause,
        stalled_conversation: right.outcomeDistribution.stalled_conversation - left.outcomeDistribution.stalled_conversation,
        trust_break: right.outcomeDistribution.trust_break - left.outcomeDistribution.trust_break,
        appointment_ready: right.outcomeDistribution.appointment_ready - left.outcomeDistribution.appointment_ready,
      },
      flaggedSessionDelta: right.flaggedSessions.length - left.flaggedSessions.length,
      guardrailFailureDelta: right.sessions.filter((session) => session.contentValidationPassed === false).length
        - left.sessions.filter((session) => session.contentValidationPassed === false).length,
    },
  };
}

export async function storeFreshUpQATestRun(input: {
  runId: string;
  dealerId?: string;
  sessions: FreshUpQASessionResult[];
}): Promise<number> {
  const { firestore } = initializeFirebase();
  await Promise.all(input.sessions.map(async (session) => {
    const recordRef = doc(collection(firestore, 'freshUpQATests'));
    await setDoc(recordRef, {
      runId: input.runId,
      simulationID: session.simulationID,
      timestamp: Timestamp.fromDate(session.timestamp),
      dealerId: input.dealerId ?? null,
      customerProfile: session.customerProfile,
      archetypeId: session.customerProfile.archetypeId,
      archetypeName: session.customerProfile.archetypeName,
      archetypeCategory: session.customerProfile.archetypeCategory,
      humorLevel: session.customerProfile.humorLevel,
      conversationTempoId: session.customerProfile.conversationTempoId ?? '',
      conversationTempoName: session.customerProfile.conversationTempoName ?? '',
      roleAdjustedTempoLabel: session.customerProfile.roleAdjustedTempoLabel ?? '',
      tempoConfidence: session.customerProfile.tempoConfidence ?? 0,
      tempoBehaviorFlags: Array.isArray(session.customerProfile.tempoBehaviorFlags) ? session.customerProfile.tempoBehaviorFlags : [],
      openingMessage: session.openingMessage,
      conversationTranscript: session.conversationTranscript,
      upMeterStart: session.upMeterStart,
      upMeterPeak: session.upMeterPeak,
      upMeterEnd: session.upMeterEnd,
      endingType: session.endingType,
      outcomeTag: session.outcomeTag,
      skillScores: session.skillScores,
      failureFlags: session.failureFlags,
      guardrailFlags: session.guardrailFlags,
      contentValidationPassed: session.contentValidationPassed,
      validationFailureReasons: session.validationFailureReasons,
      freshUpVersionId: session.freshUpVersionId ?? '',
      freshUpVersionName: session.freshUpVersionName ?? '',
      isSandbox: true,
      qaMode: true,
    });
  }));
  return input.sessions.length;
}
