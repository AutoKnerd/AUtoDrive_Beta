
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { AisRoleType, CxTrait, FreshUpProfile, FreshUpSandboxConfig, FreshUpTag, Lesson, LessonLog, InteractionSeverity, LessonRole, Ratings } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, ArrowRightToLine } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { conductLesson } from '@/ai/flows/lesson-flow';
import { conductFreshUp } from '@/ai/flows/fresh-up-flow';
import { Spinner } from '../ui/spinner';
import {
  getAdaptiveCoachingRecommendation,
  getConsultantActivity,
  getLessons,
  logLessonCompletion,
  type AdaptiveCoachingRecommendation,
  type LessonCompletionDetails,
} from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';
import { assessBehaviorViolation } from '@/lib/moderation/behavior-violation';
import { ASSISTANT_AVATAR_SRC, ASSISTANT_NAME } from '@/lib/assistant';
import { clampUpMeter, createInitialFreshUpMemory, evaluateFreshUpResponse, FRESH_UP_SESSION_START_METER, formatTraitLabel, getFreshUpProfileById, getProfilePriorityTraits, getStartingEmotion, pickFreshUpProfile, summarizeFreshUpRatings } from '@/lib/fresh-up';
import type { FreshUpEmotionState } from '@/lib/fresh-up-emotion';
import { detectFreshUpEndingFallback, enrichMemoryStateFromOpening, generateFinalCustomerResponse, generateFreshUpOpening, generateSprocketEndingLine } from '@/lib/fresh-up-conversation';
import { getSignatureFreshUpScenarios } from '@/lib/fresh-up-signature';
import { generateProceduralFreshUpCustomer } from '@/lib/fresh-up-procedural';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calculateLevel } from '@/lib/xp';
import { mergeFreshUpValidationResults, validateFreshUpEndingGuardrails, validateFreshUpOpeningGuardrails, type FreshUpContentValidationResult } from '@/lib/fresh-up-guardrails';
import { getFreshUpReleaseState, getFreshUpReleaseVersions, isExperimentalFreshUpVersion, resolveFreshUpToggles, resolveFreshUpVersionForContext, type FreshUpFeatureToggles, type FreshUpReleaseVersion } from '@/lib/fresh-up-release';
import { AIS_ROLE_LANGUAGE_VERSION, adaptFreshUpProfileToRole, getAisInteractionLabel, getAisSummaryLabel, getRoleAwareNextStep, resolveAisRoleTypeFromSandbox } from '@/lib/ais-role-adaptive';
import { getAisScoreBand, interpretAisScore } from '@/lib/ais-score-interpretation';
import { getRoleLabels, resolveRoleLabelKeyFromAisRoleType, resolveRoleLabelKeyFromUserRole } from '@/config/roleLabels';
import { getRoleToneProfile, getRoleTurnTargets } from '@/config/roleToneProfiles';
import { pickConversationTempoProfile } from '@/config/conversationTempoProfiles';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface LessonViewProps {
  lesson: Lesson;
  isRecommended: boolean;
  isFreshUp?: boolean;
  freshUpProfileId?: string | null;
  freshUpSandboxConfig?: FreshUpSandboxConfig;
  freshUpSandboxVersionId?: string | null;
}

interface CxScores {
    empathy: number;
    listening: number;
    trust: number;
    followUp: number;
    closing: number;
    relationshipBuilding: number;
}

type LessonCompletionResponse = {
  trainedTrait?: string;
  xpAwarded?: number;
  coachSummary?: string;
  recommendedNextFocus?: string;
  ratings?: Partial<Ratings>;
  scores?: {
    empathy: number;
    listening: number;
    trust: number;
    relationship: number;
    closing: number;
  };
  upMeter?: {
    start: number;
    peak: number;
    end: number;
  };
  upMeterInsight?: string;
  skillTips?: {
    empathy?: string;
    listening?: string;
    trust?: string;
    relationship?: string;
    closing?: string;
  };
  severity?: InteractionSeverity;
  flags?: string[];
  outcome?: 'successful' | 'mixed' | 'needs-work';
  outcomeTag?: 'Customer Engaged' | 'Trust Established' | 'Appointment Set' | 'Lost Momentum' | 'Conversation Breakdown';
  coachingTag?: FreshUpTag;
  summaryTag?: FreshUpTag;
  sprocketCoachingLine?: string;
  endingEmotionalState?: string;
  finalCustomerResponse?: string;
  endingType?: 'positive_progress' | 'neutral_pause' | 'stalled_conversation' | 'trust_break' | 'appointment_ready';
  recommendedNextStep?: 'discovery_lesson' | 'trust_building_lesson' | 'closing_lesson' | 'relationship_lesson' | 'follow_up_lesson' | 'no_recommendation';
  trustShift?: number;
};

type FinalLessonCompletionResponse = LessonCompletionResponse & {
  trainedTrait: string;
  xpAwarded: number;
  ratings: Ratings;
};

type FreshUpFeedback = {
  scenarioName: string;
  conversationLength: number;
  messagesSent: number;
  aiResponseCount: number;
  outcomeTag: NonNullable<LessonCompletionResponse['outcomeTag']>;
  outcomeMeaning: string;
  upMeter: { start: number; peak: number; end: number };
  upMeterInsight: string;
  scores: { empathy: number; listening: number; trust: number; relationship: number; closing: number };
  skillTips: { empathy: string; listening: string; trust: string; relationship: string; closing: string };
  xpEarned: number;
  statBonuses: { empathy: number; listening: number; trust: number; relationship: number; closing: number };
  finalCustomerResponse?: string;
  sprocketWrapUp?: string;
  debug?: {
    memoryState?: unknown;
    scoringState?: unknown;
    scenarioGenerationDetails?: unknown;
  };
};

function hasValidCompletionRatings(ratings: Partial<Ratings> | undefined): ratings is Ratings {
  if (!ratings) return false;
  return (
    typeof ratings.empathy === 'number' &&
    typeof ratings.listening === 'number' &&
    typeof ratings.trust === 'number' &&
    typeof ratings.followUp === 'number' &&
    typeof ratings.closing === 'number' &&
    typeof ratings.relationship === 'number'
  );
}

function isValidCompletionResponse(payload: LessonCompletionResponse | null): payload is FinalLessonCompletionResponse {
  if (!payload) return false;
  if (typeof payload.xpAwarded !== 'number' || !Number.isFinite(payload.xpAwarded)) return false;
  if (typeof payload.trainedTrait !== 'string' || payload.trainedTrait.trim().length === 0) return false;
  if (!hasValidCompletionRatings(payload.ratings)) return false;
  return true;
}

function parseLessonCompletionResponse(responseText: string): LessonCompletionResponse | null {
  const candidates: string[] = [];
  const trimmed = responseText.trim();

  if (trimmed.length > 0) {
    candidates.push(trimmed);
  }

  const fencedBlocks = responseText.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedBlocks) {
    const block = match[1]?.trim();
    if (block) {
      candidates.push(block);
    }
  }

  const firstBrace = responseText.indexOf('{');
  const lastBrace = responseText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(responseText.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed as LessonCompletionResponse;
      }
    } catch {
      // Ignore and continue trying the next candidate.
    }
  }

  return null;
}

function toFallbackRatings(cxScores: CxScores | null | undefined): Partial<Ratings> | undefined {
  if (!cxScores) return undefined;
  return {
    empathy: cxScores.empathy,
    listening: cxScores.listening,
    trust: cxScores.trust,
    followUp: cxScores.followUp,
    closing: cxScores.closing,
    relationship: cxScores.relationshipBuilding,
  };
}

const STAT_ORDER = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'] as const;
type StatOrderKey = (typeof STAT_ORDER)[number];

const STAT_LABELS: Record<StatOrderKey, string> = {
  empathy: 'Empathy',
  listening: 'Listening',
  trust: 'Trust',
  followUp: 'Follow Up',
  closing: 'Closing',
  relationshipBuilding: 'Relationship Building',
};

function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}`;
}

function buildCompletionSummary(
  result: LessonCompletionResponse,
  details?: Pick<LessonCompletionDetails, 'severity' | 'ratingsUsed' | 'statChanges'>,
  displayedXp?: number,
  flags: string[] = []
): string {
  const finalXp = displayedXp ?? result.xpAwarded;
  const lines = [
    'Lesson Complete!',
    '',
    `Focus Area: ${result.trainedTrait}`,
    `XP Awarded: ${finalXp}`,
    `Summary: ${result.coachSummary}`,
    `Next Steps: Focus on ${result.recommendedNextFocus}.`,
  ];

  if (details?.statChanges) {
    lines.push('', 'Score Changes:');
    for (const key of STAT_ORDER) {
      const stat = details.statChanges[key];
      lines.push(
        `${STAT_LABELS[key]}: ${stat.before.toFixed(1)}% -> ${stat.after.toFixed(1)}% (${formatSigned(stat.delta)}) | ${ASSISTANT_NAME} Rating: ${stat.rating.toFixed(0)}`
      );
    }
  }

  if (details) {
    lines.push(
      '',
      `${ASSISTANT_NAME} Ratings Used: Empathy ${details.ratingsUsed.empathy}, Listening ${details.ratingsUsed.listening}, Trust ${details.ratingsUsed.trust}, Follow Up ${details.ratingsUsed.followUp}, Closing ${details.ratingsUsed.closing}, Relationship ${details.ratingsUsed.relationship}`
    );
    lines.push('', `Severity: ${details.severity}`);
    if (details.severity === 'behavior_violation') {
      lines.push('Behavior note: this interaction was flagged as a behavior violation, so XP penalties are allowed.');
      if (typeof finalXp === 'number' && finalXp < 0) {
        lines.push(`XP Penalty Applied: ${finalXp} (penalties are capped at -100 XP).`);
      }
      if (flags.length > 0) {
        lines.push(`Flags: ${flags.join(', ')}`);
      }
    }
    lines.push(`Why this changed: each skill updates independently toward its own ${ASSISTANT_NAME} rating after each lesson.`);
  }

  return lines.join('\n');
}

function upMeterLabel(value: number): string {
  if (value <= 20) return 'Customer guarded';
  if (value <= 40) return 'Customer cautious';
  if (value <= 60) return 'Customer warming up';
  if (value <= 80) return 'Customer comfortable';
  return 'Customer fully engaged';
}

function outcomeMeaning(tag: NonNullable<LessonCompletionResponse['outcomeTag']>): string {
  if (tag === 'Customer Engaged') return 'The customer stayed involved and responsive throughout the conversation.';
  if (tag === 'Trust Established') return 'The customer became comfortable and open during the conversation.';
  if (tag === 'Appointment Set') return 'The conversation advanced naturally toward a clear next step.';
  if (tag === 'Lost Momentum') return 'The customer became less engaged, and the conversation lost flow.';
  return 'The conversation became difficult to recover, and customer confidence dropped.';
}

function buildTempoCoachingLine(roleType: AisRoleType, profile: FreshUpProfile | null): string {
  const tempoId = String(profile?.conversationTempoId || '').toLowerCase();
  if (!tempoId) return '';
  if (tempoId === 'urgent') {
    if (roleType === 'service') return 'This guest needed calm efficiency; tighter timeline clarity would preserve momentum.';
    if (roleType === 'parts') return 'This customer needed quick stock and ETA confirmation to stay confident.';
    if (roleType === 'fi') return 'This buyer needed concise, easy-to-follow explanations to maintain confidence.';
    return 'This customer moved fast; clearer structure early would keep pace without losing direction.';
  }
  if (tempoId === 'slow-warm-up') return 'This customer opened gradually; steady reassurance would unlock stronger momentum later.';
  if (tempoId === 'scattered') return 'This customer drifted between topics; stronger anchoring language would keep progress on track.';
  if (tempoId === 'deliberate') return 'This customer needed measured detail; step-by-step clarity supports confidence.';
  if (tempoId === 'fast-talker') return 'This customer offered a lot quickly; brief recaps help keep direction and trust.';
  if (tempoId === 'cautious-stop-start') return 'This customer needed pause-and-confirm moments before next-step movement.';
  if (tempoId === 'emotional-swell') return 'This customer tempo shifted with emotion; consistent empathy keeps momentum stable.';
  return '';
}

function normalizeLooseValue(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function pickBySeed<T>(items: T[], seedInput: string): T | null {
  if (!items.length) return null;
  const seed = [...seedInput].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return items[Math.abs(seed) % items.length] ?? null;
}

function withResolvedTempoProfile(input: {
  profile: FreshUpProfile;
  roleType: AisRoleType;
  forceTempoIdOrName?: string;
  seedInput: string;
}): FreshUpProfile;
function withResolvedTempoProfile(input: {
  profile: FreshUpProfile | null;
  roleType: AisRoleType;
  forceTempoIdOrName?: string;
  seedInput: string;
}): FreshUpProfile | null {
  if (!input.profile) return null;
  if (input.profile.conversationTempoId && (!input.forceTempoIdOrName || input.forceTempoIdOrName.trim().length === 0)) {
    return input.profile;
  }
  const selectedTempo = pickConversationTempoProfile({
    roleType: input.roleType,
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

function resolveSandboxFreshUpProfile(input: {
  config: FreshUpSandboxConfig;
  userId: string;
  lessonId: string;
  roleType: AisRoleType;
  consultantLevel?: number;
  toggles?: FreshUpFeatureToggles;
}): FreshUpProfile {
  const proceduralEnabled = input.toggles
    ? (input.toggles.enableProceduralGeneration !== false && input.toggles.enableArchetypeLibrary !== false)
    : true;
  const signatureEnabled = input.toggles
    ? input.toggles.enableSignatureScenarios !== false
    : true;
  const effectiveConsultantLevel = input.toggles?.enableDifficultyDistribution === false
    ? undefined
    : input.consultantLevel;
  const signatureScenarios = getSignatureFreshUpScenarios();
  const normalizedForce = normalizeLooseValue(input.config.forceProfileIdOrName);

  if (normalizedForce.length > 0) {
    const forced = signatureScenarios.find((scenario) => (
      normalizeLooseValue(scenario.freshUpId) === normalizedForce
      || normalizeLooseValue(scenario.characterName) === normalizedForce
      || normalizeLooseValue(scenario.scenarioName) === normalizedForce
      || normalizeLooseValue(scenario.customerName) === normalizedForce
    ));
    if (forced) {
      return withResolvedTempoProfile({
        profile: adaptFreshUpProfileToRole(forced, input.roleType),
        roleType: input.roleType,
        forceTempoIdOrName: input.config.forceTempoIdOrName,
        seedInput: `${input.userId}:${input.lessonId}:forced-signature`,
      });
    }
    if (normalizedForce.startsWith('proc-') && proceduralEnabled) {
      return withResolvedTempoProfile({
        profile: generateProceduralFreshUpCustomer(normalizedForce, {
          roleType: input.roleType,
          consultantLevel: effectiveConsultantLevel,
          forceArchetypeIdOrName: input.config.forceArchetypeIdOrName,
          forceTempoIdOrName: input.config.forceTempoIdOrName,
          difficultyLevel: input.config.difficulty !== 'random' ? input.config.difficulty : undefined,
          vehicleInterest: input.config.vehicleInterest !== 'random' ? input.config.vehicleInterest : undefined,
          primaryConcern: input.config.primaryConcern !== 'random' ? input.config.primaryConcern : undefined,
          emotionalState: input.config.startingMood !== 'random' ? input.config.startingMood : undefined,
          personalityType: input.config.personalityType !== 'random' ? input.config.personalityType : undefined,
          communicationStyle: input.config.communicationStyle !== 'random' ? input.config.communicationStyle : undefined,
        }),
        roleType: input.roleType,
        forceTempoIdOrName: input.config.forceTempoIdOrName,
        seedInput: `${input.userId}:${input.lessonId}:forced-procedural`,
      });
    }
  }

  const sourceType = input.config.sourceType === 'random'
    ? ((Date.now() + input.userId.length) % 10 < 7 ? 'procedural' : 'signature')
    : input.config.sourceType;
  const effectiveSourceType = sourceType === 'procedural' && !proceduralEnabled
    ? 'signature'
    : (sourceType === 'signature' && !signatureEnabled ? 'procedural' : sourceType);

  if (effectiveSourceType === 'signature' && signatureEnabled) {
    const filtered = signatureScenarios.filter((scenario) => {
      if (input.config.difficulty !== 'random' && normalizeLooseValue(scenario.difficultyLevel) !== normalizeLooseValue(input.config.difficulty)) return false;
      if (input.config.vehicleInterest !== 'random' && normalizeLooseValue(scenario.vehicleInterest) !== normalizeLooseValue(input.config.vehicleInterest)) return false;
      if (input.config.primaryConcern !== 'random' && normalizeLooseValue(scenario.primaryConcern) !== normalizeLooseValue(input.config.primaryConcern)) return false;
      if (input.config.startingMood !== 'random' && normalizeLooseValue(scenario.emotionalState) !== normalizeLooseValue(input.config.startingMood)) return false;
      if (input.config.personalityType !== 'random' && normalizeLooseValue(scenario.personalityType) !== normalizeLooseValue(input.config.personalityType)) return false;
      if (input.config.communicationStyle !== 'random' && normalizeLooseValue(scenario.communicationStyle) !== normalizeLooseValue(input.config.communicationStyle)) return false;
      if (input.config.forceArchetypeIdOrName && input.config.forceArchetypeIdOrName.trim().length > 0) {
        const needle = normalizeLooseValue(input.config.forceArchetypeIdOrName);
        if (normalizeLooseValue(scenario.archetypeId) !== needle && normalizeLooseValue(scenario.archetypeName) !== needle) return false;
      }
      return true;
    });
    if (filtered.length === 0 && input.config.forceArchetypeIdOrName && input.config.forceArchetypeIdOrName.trim().length > 0) {
      return withResolvedTempoProfile({
        profile: generateProceduralFreshUpCustomer(`${input.userId}:${input.lessonId}:${Date.now()}:forced-archetype-fallback`, {
          roleType: input.roleType,
          consultantLevel: effectiveConsultantLevel,
          forceArchetypeIdOrName: input.config.forceArchetypeIdOrName,
          forceTempoIdOrName: input.config.forceTempoIdOrName,
          difficultyLevel: input.config.difficulty !== 'random' ? input.config.difficulty : undefined,
          vehicleInterest: input.config.vehicleInterest !== 'random' ? input.config.vehicleInterest : undefined,
          primaryConcern: input.config.primaryConcern !== 'random' ? input.config.primaryConcern : undefined,
          emotionalState: input.config.startingMood !== 'random' ? input.config.startingMood : undefined,
          personalityType: input.config.personalityType !== 'random' ? input.config.personalityType : undefined,
          communicationStyle: input.config.communicationStyle !== 'random' ? input.config.communicationStyle : undefined,
        }),
        roleType: input.roleType,
        forceTempoIdOrName: input.config.forceTempoIdOrName,
        seedInput: `${input.userId}:${input.lessonId}:forced-archetype-fallback`,
      });
    }
    const signature = pickBySeed(filtered.length > 0 ? filtered : signatureScenarios, `${input.userId}:${input.lessonId}:${Date.now()}`);
    if (signature) {
      return withResolvedTempoProfile({
        profile: adaptFreshUpProfileToRole(signature, input.roleType),
        roleType: input.roleType,
        forceTempoIdOrName: input.config.forceTempoIdOrName,
        seedInput: `${input.userId}:${input.lessonId}:signature`,
      });
    }
  }

  if (proceduralEnabled) {
    return withResolvedTempoProfile({
      profile: generateProceduralFreshUpCustomer(`${input.userId}:${input.lessonId}:${Date.now()}`, {
        roleType: input.roleType,
        consultantLevel: effectiveConsultantLevel,
        forceArchetypeIdOrName: input.config.forceArchetypeIdOrName,
        forceTempoIdOrName: input.config.forceTempoIdOrName,
        difficultyLevel: input.config.difficulty !== 'random' ? input.config.difficulty : undefined,
        vehicleInterest: input.config.vehicleInterest !== 'random' ? input.config.vehicleInterest : undefined,
        primaryConcern: input.config.primaryConcern !== 'random' ? input.config.primaryConcern : undefined,
        emotionalState: input.config.startingMood !== 'random' ? input.config.startingMood : undefined,
        personalityType: input.config.personalityType !== 'random' ? input.config.personalityType : undefined,
        communicationStyle: input.config.communicationStyle !== 'random' ? input.config.communicationStyle : undefined,
      }),
      roleType: input.roleType,
      forceTempoIdOrName: input.config.forceTempoIdOrName,
      seedInput: `${input.userId}:${input.lessonId}:procedural`,
    });
  }

  const signatures = signatureScenarios.length > 0 ? signatureScenarios : [pickFreshUpProfile(input.userId, [], undefined, input.roleType)];
  return withResolvedTempoProfile({
    profile: adaptFreshUpProfileToRole((signatures[Math.abs(Date.now()) % signatures.length] ?? signatures[0]), input.roleType),
    roleType: input.roleType,
    forceTempoIdOrName: input.config.forceTempoIdOrName,
    seedInput: `${input.userId}:${input.lessonId}:fallback-signature`,
  });
}

async function pickFreshUpProfileWithToggles(input: {
  userId: string;
  lessonId: string;
  roleType: AisRoleType;
  consultantLevel?: number;
  history: LessonLog[];
  toggles: FreshUpFeatureToggles;
}): Promise<FreshUpProfile> {
  const proceduralEnabled = input.toggles.enableProceduralGeneration !== false && input.toggles.enableArchetypeLibrary !== false;
  const signatureEnabled = input.toggles.enableSignatureScenarios !== false;
  const effectiveConsultantLevel = input.toggles.enableDifficultyDistribution === false ? undefined : input.consultantLevel;
  if (proceduralEnabled && !signatureEnabled) {
    return withResolvedTempoProfile({
      profile: generateProceduralFreshUpCustomer(`${input.userId}:${input.lessonId}:${Date.now()}`, {
        roleType: input.roleType,
        consultantLevel: effectiveConsultantLevel,
      }),
      roleType: input.roleType,
      seedInput: `${input.userId}:${input.lessonId}:procedural-only`,
    });
  }
  if (!proceduralEnabled && signatureEnabled) {
    const signatures = getSignatureFreshUpScenarios();
    const seed = [...`${input.userId}:${input.lessonId}:${input.history.length}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return withResolvedTempoProfile({
      profile: adaptFreshUpProfileToRole((signatures[Math.abs(seed % signatures.length)] ?? signatures[0]), input.roleType),
      roleType: input.roleType,
      seedInput: `${input.userId}:${input.lessonId}:signature-only:${seed}`,
    });
  }
  return withResolvedTempoProfile({
    profile: pickFreshUpProfile(input.userId, input.history, effectiveConsultantLevel, input.roleType),
    roleType: input.roleType,
    seedInput: `${input.userId}:${input.lessonId}:mixed:${input.history.length}`,
  });
}

function hasDebugAccess(input: {
  isFreshUpSandboxMode: boolean;
  sandboxConfig?: FreshUpSandboxConfig;
  toggles: FreshUpFeatureToggles;
}): boolean {
  return Boolean(
    input.isFreshUpSandboxMode
    && input.sandboxConfig?.enabled
    && input.toggles.enableSandboxDebugTools !== false
  );
}

function buildDisabledEndingFallback(): {
  endingType: NonNullable<LessonCompletionResponse['endingType']>;
  recommendedNextStep: NonNullable<LessonCompletionResponse['recommendedNextStep']>;
  outcomeTag: NonNullable<LessonCompletionResponse['outcomeTag']>;
  trustShift: number;
} {
  return {
    endingType: 'neutral_pause',
    recommendedNextStep: 'no_recommendation',
    outcomeTag: 'Customer Engaged',
    trustShift: 0,
  };
}

export function LessonView({ lesson, isRecommended, isFreshUp = false, freshUpProfileId = null, freshUpSandboxConfig, freshUpSandboxVersionId = null }: LessonViewProps) {
  const { user, setUser, isTouring } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [cxScores, setCxScores] = useState<CxScores | null>(null);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [freshUpStarted, setFreshUpStarted] = useState(!isFreshUp);
  const [freshUpFeedback, setFreshUpFeedback] = useState<FreshUpFeedback | null>(null);
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState<AdaptiveCoachingRecommendation | null>(null);
  const lessonStarted = useRef(false);
  const finalizingLesson = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const promptLessonRole = lesson.role === 'global' && user?.role ? user.role : lesson.role;
  const aisRoleType = useMemo(
    () => resolveAisRoleTypeFromSandbox(freshUpSandboxConfig?.roleType, user?.role),
    [freshUpSandboxConfig?.roleType, user?.role]
  );
  const roleLabelKey = useMemo(() => {
    if (freshUpSandboxConfig?.roleLabelKey && freshUpSandboxConfig.roleLabelKey !== 'random') {
      return freshUpSandboxConfig.roleLabelKey;
    }
    if (freshUpSandboxConfig?.roleType && freshUpSandboxConfig.roleType !== 'random') {
      return resolveRoleLabelKeyFromAisRoleType(freshUpSandboxConfig.roleType);
    }
    return resolveRoleLabelKeyFromUserRole(user?.role);
  }, [freshUpSandboxConfig?.roleLabelKey, freshUpSandboxConfig?.roleType, user?.role]);
  const meterDisplayLabel = useMemo(() => getRoleLabels(roleLabelKey).meterLabel, [roleLabelKey]);
  const defaultInteractionDisplayLabel = useMemo(() => getRoleLabels(roleLabelKey).interactionLabel, [roleLabelKey]);
  const interactionDisplayLabel = useMemo(
    () => freshUpSandboxConfig?.interactionDisplayLabel || defaultInteractionDisplayLabel || getAisInteractionLabel(aisRoleType),
    [freshUpSandboxConfig?.interactionDisplayLabel, defaultInteractionDisplayLabel, aisRoleType]
  );
  const summaryDisplayLabel = useMemo(() => getAisSummaryLabel(aisRoleType), [aisRoleType]);
  const roleToneProfile = useMemo(() => getRoleToneProfile(aisRoleType), [aisRoleType]);
  const targetTurnRange = useMemo(() => getRoleTurnTargets(aisRoleType), [aisRoleType]);
  const consultantLevel = useMemo(() => calculateLevel(user?.xp ?? 0).level, [user?.xp]);
  const isFreshUpSandboxMode = Boolean(isFreshUp && freshUpSandboxConfig?.enabled);
  const configuredStartMeter = Number(freshUpSandboxConfig?.startingUpMeter ?? FRESH_UP_SESSION_START_METER);
  const sessionStartMeter = isFreshUpSandboxMode
    ? (Number.isFinite(configuredStartMeter) ? clampUpMeter(configuredStartMeter) : FRESH_UP_SESSION_START_METER)
    : FRESH_UP_SESSION_START_METER;
  const sessionOpeningRef = useRef<string>('');
  const freshUpProfile = useRef<FreshUpProfile | null>(withResolvedTempoProfile({
    profile: getFreshUpProfileById(freshUpProfileId, aisRoleType),
    roleType: aisRoleType,
    forceTempoIdOrName: freshUpSandboxConfig?.forceTempoIdOrName,
    seedInput: `${lesson.lessonId}:${freshUpProfileId || 'default'}:${aisRoleType}:initial`,
  }));
  const startedAtRef = useRef<Date | null>(null);
  const freshUpMeterRef = useRef<{ start: number; current: number; peak: number }>({
    start: sessionStartMeter,
    current: sessionStartMeter,
    peak: sessionStartMeter,
  });
  const freshUpScoreRef = useRef<{ empathy: number; listening: number; trust: number; relationship: number; closing: number }>({
    empathy: 60,
    listening: 60,
    trust: 60,
    relationship: 60,
    closing: 60,
  });
  const initialProfile = freshUpProfile.current ?? pickFreshUpProfile(user?.userId || 'guest', [], consultantLevel, aisRoleType);
  const freshUpMemoryRef = useRef(createInitialFreshUpMemory(initialProfile));
  const freshUpEmotionRef = useRef<FreshUpEmotionState>(getStartingEmotion(initialProfile));
  const freshUpGuardrailRef = useRef<FreshUpContentValidationResult>({
    contentValidationPassed: true,
    validationFailureReasons: [],
    guardrailFlags: [],
  });
  const freshUpReleaseVersionRef = useRef<FreshUpReleaseVersion | null>(null);
  const freshUpToggleRef = useRef<FreshUpFeatureToggles>({
    enableProceduralGeneration: true,
    enableSignatureScenarios: true,
    enableCustomerMemory: true,
    enableEmotionalResponseEngine: true,
    enableDifficultyDistribution: true,
    enableArchetypeLibrary: true,
    enableOpeningMechanic: true,
    enableEndingMechanic: true,
    enableConsultantFeedbackEnhancements: true,
    enableManagerInsightEnhancements: true,
    enableSandboxDebugTools: true,
    enableQAMatrix: true,
    enableContentGuardrails: true,
  });

  useEffect(() => {
    setFreshUpStarted(!isFreshUp);
  }, [isFreshUp, lesson.lessonId]);

  useEffect(() => {
    let active = true;
    async function ensureFreshUpProfile() {
      if (!isFreshUp || freshUpProfile.current || !user) return;
      if (freshUpSandboxConfig?.enabled) {
        freshUpProfile.current = resolveSandboxFreshUpProfile({
          config: freshUpSandboxConfig,
          userId: user.userId,
          lessonId: lesson.lessonId,
          roleType: aisRoleType,
          consultantLevel,
          toggles: freshUpToggleRef.current,
        });
        freshUpMemoryRef.current = createInitialFreshUpMemory(freshUpProfile.current);
        freshUpEmotionRef.current = getStartingEmotion(freshUpProfile.current);
        return;
      }
      const history = await getConsultantActivity(user.userId);
      if (!active) return;
      freshUpProfile.current = await pickFreshUpProfileWithToggles({
        userId: user.userId,
        lessonId: lesson.lessonId,
        roleType: aisRoleType,
        consultantLevel,
        history,
        toggles: freshUpToggleRef.current,
      });
      freshUpMemoryRef.current = createInitialFreshUpMemory(freshUpProfile.current);
      freshUpEmotionRef.current = getStartingEmotion(freshUpProfile.current);
    }
    void ensureFreshUpProfile();
    return () => { active = false; };
  }, [isFreshUp, user, freshUpSandboxConfig, lesson.lessonId, consultantLevel, aisRoleType]);

  useEffect(() => {
    let active = true;
    async function loadFreshUpReleaseVersion() {
      if (!isFreshUp || !user) return;
      try {
        const [versions, state] = await Promise.all([
          getFreshUpReleaseVersions(),
          getFreshUpReleaseState(),
        ]);
        if (!active) return;
        const resolvedVersion = resolveFreshUpVersionForContext({
          versions,
          state,
          environment: isFreshUpSandboxMode ? 'sandbox' : 'production',
          sandboxVersionId: freshUpSandboxVersionId,
          dealerId: user.selfDeclaredDealershipId || user.dealershipIds?.[0],
          userId: user.userId,
        });
        freshUpReleaseVersionRef.current = resolvedVersion;
        freshUpToggleRef.current = resolveFreshUpToggles(resolvedVersion);
      } catch {
        // Keep safe defaults if release config load fails.
      }
    }
    void loadFreshUpReleaseVersion();
    return () => { active = false; };
  }, [isFreshUp, isFreshUpSandboxMode, freshUpSandboxVersionId, user]);

  const buildDefaultSkillTip = (metricName: 'empathy' | 'listening' | 'trust' | 'relationship' | 'closing', score: number): string => {
    const interpretation = interpretAisScore({
      roleType: aisRoleType,
      metricName: metricName === 'relationship' ? 'relationship' : metricName,
      metricValue: score,
      concernCategory: freshUpProfile.current?.primaryConcern,
      archetypeContext: freshUpProfile.current?.archetypeCategory,
    });
    const tempoLine = buildTempoCoachingLine(aisRoleType, freshUpProfile.current);
    return `${interpretation.feedbackLine} ${interpretation.coachingExample}${tempoLine ? ` ${tempoLine}` : ''}`;
  };

  function buildFreshUpCompletionSummary(
    result: LessonCompletionResponse,
    profile: FreshUpProfile | null,
    ratings: Ratings | undefined
  ): string {
    const prioritizedTraits: CxTrait[] = profile
      ? getProfilePriorityTraits(profile)
      : ['empathy', 'listening', 'trust', 'closing'];
    const ratingSummary = ratings
      ? summarizeFreshUpRatings({
          empathy: ratings.empathy,
          listening: ratings.listening,
          trust: ratings.trust,
          followUp: ratings.followUp,
          closing: ratings.closing,
          relationshipBuilding: ratings.relationship,
        }, prioritizedTraits)
      : [];

    const lines = [summaryDisplayLabel];
    ratingSummary.forEach((item) => {
      lines.push(`- ${item.label}: ${item.value}`);
    });
    lines.push('');
    lines.push(result.sprocketCoachingLine || result.coachSummary || `Keep pacing the ${interactionDisplayLabel.toLowerCase()} and earning the next step.`);
    return lines.join('\n');
  }

  async function requestLessonResponse(history: Message[], userMessage: string) {
    if (!freshUpProfile.current && isFreshUp) {
      freshUpProfile.current = withResolvedTempoProfile({
        profile: getFreshUpProfileById(freshUpProfileId, aisRoleType),
        roleType: aisRoleType,
        forceTempoIdOrName: freshUpSandboxConfig?.forceTempoIdOrName,
        seedInput: `${lesson.lessonId}:${freshUpProfileId || 'default'}:${aisRoleType}:request`,
      });
      if (!freshUpProfile.current && user && freshUpSandboxConfig?.enabled) {
        freshUpProfile.current = resolveSandboxFreshUpProfile({
          config: freshUpSandboxConfig,
          userId: user.userId,
          lessonId: lesson.lessonId,
          roleType: aisRoleType,
          consultantLevel,
          toggles: freshUpToggleRef.current,
        });
      }
      if (!freshUpProfile.current && user) {
        const activity = await getConsultantActivity(user.userId);
        freshUpProfile.current = await pickFreshUpProfileWithToggles({
          userId: user.userId,
          lessonId: lesson.lessonId,
          roleType: aisRoleType,
          consultantLevel,
          history: activity,
          toggles: freshUpToggleRef.current,
        });
      }
      if (freshUpProfile.current) {
        freshUpMemoryRef.current = createInitialFreshUpMemory(freshUpProfile.current);
        freshUpEmotionRef.current = getStartingEmotion(freshUpProfile.current);
      }
    }
    if (isFreshUp && freshUpProfile.current && cxScores) {
      return conductFreshUp({
        lessonId: lesson.lessonId,
        lessonTitle: lesson.title,
        lessonRole: promptLessonRole,
        lessonCategory: lesson.category,
        roleType: aisRoleType,
        roleToneProfile,
        targetTurnRange,
        profile: freshUpProfile.current,
        upMeterCurrent: freshUpMeterRef.current.current,
        memoryState: freshUpMemoryRef.current,
        currentEmotion: freshUpEmotionRef.current,
        history,
        userMessage,
        cxScores,
      });
    }

    return conductLesson({
      lessonId: lesson.lessonId,
      lessonTitle: lesson.title,
      lessonRole: promptLessonRole,
      lessonCategory: lesson.category,
      lessonAssociatedTrait: lesson.associatedTrait,
      isRecommendedLesson: isRecommended,
      customScenario: lesson.customScenario,
      history,
      userMessage,
      cxScores: cxScores!,
    });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    async function fetchScores() {
      if (!user) return;
      const rollingStats = user.stats;
      const empathy = rollingStats?.empathy?.score;
      const listening = rollingStats?.listening?.score;
      const trust = rollingStats?.trust?.score;
      const followUp = rollingStats?.followUp?.score;
      const closing = rollingStats?.closing?.score;
      const relationship = rollingStats?.relationship?.score;

      const hasValidRollingScores = [
        empathy,
        listening,
        trust,
        followUp,
        closing,
        relationship,
      ].every((value) => typeof value === 'number' && Number.isFinite(value));

      if (hasValidRollingScores) {
        setCxScores({
          empathy: Math.round(empathy as number),
          listening: Math.round(listening as number),
          trust: Math.round(trust as number),
          followUp: Math.round(followUp as number),
          closing: Math.round(closing as number),
          relationshipBuilding: Math.round(relationship as number),
        });
        return;
      }

      try {
        const activity = await getConsultantActivity(user.userId);
        if (!activity.length) {
          // Provide some default scores if no history, ensuring one is lowest.
          setCxScores({ empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85 });
          return;
        }
        const total = activity.reduce((acc, log) => {
          acc.empathy += log.empathy || 0;
          acc.listening += log.listening || 0;
          acc.trust += log.trust || 0;
          acc.followUp += log.followUp || 0;
          acc.closing += log.closing || 0;
          acc.relationshipBuilding += log.relationshipBuilding || 0;
          return acc;
        }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

        const count = activity.length;
        setCxScores({
          empathy: Math.round(total.empathy / count),
          listening: Math.round(total.listening / count),
          trust: Math.round(total.trust / count),
          followUp: Math.round(total.followUp / count),
          closing: Math.round(total.closing / count),
          relationshipBuilding: Math.round(total.relationshipBuilding / count),
        });
      } catch (error: any) {
        console.error('Failed to load CX scores, falling back to defaults.', error);
        setCxScores({ empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85 });
        toast({
          variant: 'destructive',
          title: 'Could not load score history',
          description: 'Using baseline scores for this lesson.',
        });
      }
    }
    fetchScores();
  }, [user, toast]);

  const handleAiResponse = async (responseText: string, conversationHistory?: Message[]) => {
    const result = parseLessonCompletionResponse(responseText);

    if (isValidCompletionResponse(result)) {
      if (finalizingLesson.current || isCompleted) return;
      finalizingLesson.current = true;
      let completionDetails: Pick<LessonCompletionDetails, 'severity' | 'ratingsUsed' | 'statChanges'> | undefined;
      let displayedXp = result.xpAwarded;
      let mergedFlags = result.flags ?? [];

      if (user) {
        const fallbackRatings = isFreshUp
          ? {
              empathy: freshUpScoreRef.current.empathy,
              listening: freshUpScoreRef.current.listening,
              trust: freshUpScoreRef.current.trust,
              followUp: Math.round((freshUpScoreRef.current.listening + freshUpScoreRef.current.trust) / 2),
              closing: freshUpScoreRef.current.closing,
              relationship: freshUpScoreRef.current.relationship,
            }
          : toFallbackRatings(cxScores);
        const aiScoresAsRatings = result.scores ? {
          empathy: result.scores.empathy,
          listening: result.scores.listening,
          trust: result.scores.trust,
          followUp: Math.round((result.scores.listening + result.scores.trust) / 2),
          closing: result.scores.closing,
          relationship: result.scores.relationship,
        } : undefined;
        const userMessages = (conversationHistory ?? messages)
          .filter(message => message.sender === 'user')
          .map(message => message.text);
        const moderation = assessBehaviorViolation({
          userMessages,
          ratings: result.ratings ?? aiScoresAsRatings ?? fallbackRatings,
          xpAwarded: result.xpAwarded,
        });
        mergedFlags = Array.from(new Set([...(result.flags ?? []), ...moderation.flags]));
        const effectiveSeverity: InteractionSeverity =
          moderation.violated ? 'behavior_violation' : (result.severity ?? 'normal');
        const effectiveRatings = moderation.adjustedRatings ?? result.ratings ?? aiScoresAsRatings ?? fallbackRatings;
        const rawEffectiveXpAwarded = moderation.adjustedXpAwarded ?? result.xpAwarded;
        const effectiveXpAwarded = effectiveSeverity === 'normal'
          ? Math.max(isFreshUp ? 40 : 10, Math.min(isFreshUp ? 150 : 100, Math.round(rawEffectiveXpAwarded)))
          : Math.max(-100, Math.min(0, Math.round(rawEffectiveXpAwarded)));
        displayedXp = effectiveXpAwarded;

        try {
          const messageHistory = (conversationHistory ?? messages);
          const userMessageCount = messageHistory.filter((entry) => entry.sender === 'user').length;
          const aiMessageCount = messageHistory.filter((entry) => entry.sender === 'ai').length + 1;
          const resolvedUpMeter = {
            start: clampUpMeter(freshUpMeterRef.current.start),
            peak: clampUpMeter(result.upMeter?.peak ?? freshUpMeterRef.current.peak),
            end: clampUpMeter(result.upMeter?.end ?? freshUpMeterRef.current.current),
          };
          const activeToggles = freshUpToggleRef.current;
          const debugAccess = hasDebugAccess({
            isFreshUpSandboxMode,
            sandboxConfig: freshUpSandboxConfig,
            toggles: activeToggles,
          });
          const endingEmotionalState = result.endingEmotionalState ?? freshUpEmotionRef.current;
          const endingFallback = activeToggles.enableEndingMechanic === false
            ? buildDisabledEndingFallback()
            : detectFreshUpEndingFallback({
              trustScore: Number(result.scores?.trust ?? effectiveRatings.trust ?? 0),
              upMeterStart: resolvedUpMeter.start,
              upMeterEnd: resolvedUpMeter.end,
              upMeterPeak: resolvedUpMeter.peak,
              endingEmotion: endingEmotionalState,
              memoryState: freshUpMemoryRef.current,
            });
          const endingType = result.endingType ?? endingFallback.endingType;
          const recommendedNextStep = result.recommendedNextStep ?? endingFallback.recommendedNextStep;
          const resolvedOutcomeTag: NonNullable<LessonCompletionResponse['outcomeTag']> =
            result.outcomeTag ?? endingFallback.outcomeTag;
          const trustShift = typeof result.trustShift === 'number' ? result.trustShift : endingFallback.trustShift;
          const finalCustomerResponse = result.finalCustomerResponse
            ?? generateFinalCustomerResponse({
              endingType,
              endingEmotion: endingEmotionalState,
              memoryState: freshUpMemoryRef.current,
              roleType: aisRoleType,
            });
          const sprocketWrapUp = result.sprocketCoachingLine
            ?? generateSprocketEndingLine({ endingType, trustShift });
          const resolvedScores = {
            empathy: clampUpMeter(Number(result.scores?.empathy ?? effectiveRatings.empathy)),
            listening: clampUpMeter(Number(result.scores?.listening ?? effectiveRatings.listening)),
            trust: clampUpMeter(Number(result.scores?.trust ?? effectiveRatings.trust)),
            relationship: clampUpMeter(Number(result.scores?.relationship ?? effectiveRatings.relationship)),
            closing: clampUpMeter(Number(result.scores?.closing ?? effectiveRatings.closing)),
          };
          const endingValidation = (activeToggles.enableContentGuardrails !== false && freshUpProfile.current)
            ? validateFreshUpEndingGuardrails({
              profile: freshUpProfile.current,
              endingType,
              outcomeTag: resolvedOutcomeTag,
              finalCustomerResponse,
              trustShift,
            })
            : { contentValidationPassed: true, validationFailureReasons: [], guardrailFlags: [] };
          const mergedGuardrails = mergeFreshUpValidationResults([freshUpGuardrailRef.current, endingValidation]);

          const completion = await logLessonCompletion({
            userId: user.userId,
            lessonId: lesson.lessonId,
            xpGained: effectiveXpAwarded,
            isRecommended,
            ratings: effectiveRatings,
            severity: effectiveSeverity,
            flags: mergedFlags,
            scores: cxScores ?? undefined,
            trainedTrait: result.trainedTrait,
            coachSummary: result.coachSummary,
            recommendedNextFocus: result.recommendedNextFocus,
            activitySource: isFreshUp ? 'fresh-up' : 'core',
            startedAt: startedAtRef.current ?? undefined,
            completionStatus: 'completed',
            conversationLength: messageHistory.length + 1,
            messagesSent: userMessageCount,
            aiResponseCount: aiMessageCount,
            outcome: result.outcome,
            outcomeTag: resolvedOutcomeTag,
            upMeterStart: isFreshUp ? resolvedUpMeter.start : undefined,
            upMeterPeak: isFreshUp ? resolvedUpMeter.peak : undefined,
            upMeterEnd: isFreshUp ? resolvedUpMeter.end : undefined,
            freshUpId: freshUpProfile.current?.freshUpId,
            characterName: freshUpProfile.current?.characterName,
            coachingTag: result.coachingTag ?? freshUpProfile.current?.coachingTag,
            summaryTag: result.summaryTag ?? result.coachingTag ?? freshUpProfile.current?.coachingTag,
            difficulty: freshUpProfile.current?.difficultyLevel === 'hard' ? 3 : (freshUpProfile.current?.difficultyLevel === 'medium' ? 2 : 1),
            sourceType: freshUpProfile.current?.sourceType,
            personalityType: freshUpProfile.current?.personalityType,
            buyingStage: freshUpProfile.current?.buyingStage,
            primaryConcern: freshUpProfile.current?.primaryConcern,
            secondaryConcern: freshUpProfile.current?.secondaryConcern,
            communicationStyle: freshUpProfile.current?.communicationStyle,
            vehicleInterest: freshUpProfile.current?.vehicleInterest,
            difficultyLevel: freshUpProfile.current?.difficultyLevel,
            startingEmotionalState: freshUpProfile.current?.emotionalState,
            archetypeId: freshUpProfile.current?.archetypeId,
            archetypeName: freshUpProfile.current?.archetypeName,
            archetypeCategory: freshUpProfile.current?.archetypeCategory,
            humorLevel: freshUpProfile.current?.humorLevel,
            customerArchetypeId: freshUpProfile.current?.customerArchetypeId,
            customerArchetypeName: freshUpProfile.current?.customerArchetypeName,
            roleAdjustedArchetypeLabel: freshUpProfile.current?.roleAdjustedArchetypeLabel,
            archetypeConfidence: freshUpProfile.current?.archetypeConfidence,
            archetypeBehaviorFlags: freshUpProfile.current?.archetypeBehaviorFlags,
            conversationTempoId: freshUpProfile.current?.conversationTempoId,
            conversationTempoName: freshUpProfile.current?.conversationTempoName,
            roleAdjustedTempoLabel: freshUpProfile.current?.roleAdjustedTempoLabel,
            tempoConfidence: freshUpProfile.current?.tempoConfidence,
            tempoBehaviorFlags: freshUpProfile.current?.tempoBehaviorFlags,
            guardrailFlags: mergedGuardrails.guardrailFlags,
            contentValidationPassed: mergedGuardrails.contentValidationPassed,
            validationFailureReasons: mergedGuardrails.validationFailureReasons,
            endingEmotionalState,
            finalCustomerResponse,
            endingType,
            recommendedNextStep,
            nextStepType: getRoleAwareNextStep(aisRoleType, recommendedNextStep),
            trustShift,
            sprocketCoachingLine: sprocketWrapUp,
            roleType: aisRoleType,
            scoreBand: getAisScoreBand(resolvedScores.trust),
            interactionDisplayLabel,
            concernCategoryRoleSpecific: freshUpProfile.current?.primaryConcern,
            roleLanguageVersion: AIS_ROLE_LANGUAGE_VERSION,
            sandboxMode: isFreshUpSandboxMode,
            saveSessionToLiveAnalytics: freshUpSandboxConfig?.saveSessionToLiveAnalytics,
            freshUpVersionId: freshUpReleaseVersionRef.current?.versionId,
            freshUpVersionName: freshUpReleaseVersionRef.current?.versionName,
            isExperimental: freshUpReleaseVersionRef.current ? isExperimentalFreshUpVersion(freshUpReleaseVersionRef.current) : undefined,
            environment: isFreshUpSandboxMode ? 'sandbox' : 'production',
            memoryDebugState: debugAccess && freshUpSandboxConfig?.memoryDebugMode ? freshUpMemoryRef.current : undefined,
            scoringDebugState: debugAccess && freshUpSandboxConfig?.scoringDebugMode ? {
              empathyMovement: resolvedScores.empathy - 60,
              listeningMovement: resolvedScores.listening - 60,
              trustMovement: resolvedScores.trust - 60,
              relationshipMovement: resolvedScores.relationship - 60,
              closingMovement: resolvedScores.closing - 60,
              upMeterStart: resolvedUpMeter.start,
              upMeterPeak: resolvedUpMeter.peak,
              upMeterEnd: resolvedUpMeter.end,
              outcomeTag: resolvedOutcomeTag,
              coachingTag: result.coachingTag ?? freshUpProfile.current?.coachingTag ?? null,
            } : undefined,
            scenarioGenerationDetails: debugAccess ? {
              roleType: aisRoleType,
              interactionDisplayLabel,
              sourceType: freshUpProfile.current?.sourceType,
              selectedScenarioId: freshUpProfile.current?.scenarioId ?? freshUpProfile.current?.freshUpId,
              selectedScenarioName: freshUpProfile.current?.scenarioName ?? freshUpProfile.current?.characterName,
                generatedCustomerTraits: freshUpProfile.current ? {
                  archetypeId: freshUpProfile.current.archetypeId,
                  archetypeName: freshUpProfile.current.archetypeName,
                  archetypeCategory: freshUpProfile.current.archetypeCategory,
                  humorLevel: freshUpProfile.current.humorLevel,
                  customerArchetypeId: freshUpProfile.current.customerArchetypeId,
                  customerArchetypeName: freshUpProfile.current.customerArchetypeName,
                  roleAdjustedArchetypeLabel: freshUpProfile.current.roleAdjustedArchetypeLabel,
                  archetypeConfidence: freshUpProfile.current.archetypeConfidence,
                  archetypeBehaviorFlags: freshUpProfile.current.archetypeBehaviorFlags,
                  conversationTempoId: freshUpProfile.current.conversationTempoId,
                  conversationTempoName: freshUpProfile.current.conversationTempoName,
                  roleAdjustedTempoLabel: freshUpProfile.current.roleAdjustedTempoLabel,
                  tempoConfidence: freshUpProfile.current.tempoConfidence,
                  tempoBehaviorFlags: freshUpProfile.current.tempoBehaviorFlags,
                  personalityType: freshUpProfile.current.personalityType,
                  buyingStage: freshUpProfile.current.buyingStage,
                primaryConcern: freshUpProfile.current.primaryConcern,
                secondaryConcern: freshUpProfile.current.secondaryConcern,
                communicationStyle: freshUpProfile.current.communicationStyle,
                vehicleInterest: freshUpProfile.current.vehicleInterest,
                difficultyLevel: freshUpProfile.current.difficultyLevel,
                startingEmotionalState: freshUpProfile.current.emotionalState,
              } : null,
              openingMessage: sessionOpeningRef.current,
              endingType,
              endingEmotionalState,
              contentValidationPassed: mergedGuardrails.contentValidationPassed,
              validationFailureReasons: mergedGuardrails.validationFailureReasons,
              guardrailFlags: mergedGuardrails.guardrailFlags,
            } : undefined,
          });
          setUser(completion.updatedUser);
          if (isFreshUp && completion.freshUpSessionStored) {
            toast({
              title: `${interactionDisplayLabel} Saved`,
              description: `Session ${completion.freshUpSessionId || ''} has been recorded.`,
            });
          }
          completionDetails = {
            severity: completion.severity,
            ratingsUsed: completion.ratingsUsed,
            statChanges: completion.statChanges,
          };

          if (isFreshUp) {
            setFreshUpFeedback({
              scenarioName: freshUpProfile.current?.characterName || `${interactionDisplayLabel} Scenario`,
              conversationLength: messageHistory.length + 1,
              messagesSent: userMessageCount,
              aiResponseCount: aiMessageCount,
              outcomeTag: resolvedOutcomeTag,
              outcomeMeaning: outcomeMeaning(resolvedOutcomeTag),
              upMeter: resolvedUpMeter,
              upMeterInsight: result.upMeterInsight || sprocketWrapUp || `The ${interactionDisplayLabel.toLowerCase()} improved when you stayed curious and acknowledged customer concerns.`,
              scores: resolvedScores,
              skillTips: {
                empathy: `${buildDefaultSkillTip('empathy', resolvedScores.empathy)} ${result.skillTips?.empathy || ''}`.trim(),
                listening: `${buildDefaultSkillTip('listening', resolvedScores.listening)} ${result.skillTips?.listening || ''}`.trim(),
                trust: `${buildDefaultSkillTip('trust', resolvedScores.trust)} ${result.skillTips?.trust || ''}`.trim(),
                relationship: `${buildDefaultSkillTip('relationship', resolvedScores.relationship)} ${result.skillTips?.relationship || ''}`.trim(),
                closing: `${buildDefaultSkillTip('closing', resolvedScores.closing)} ${result.skillTips?.closing || ''}`.trim(),
              },
              xpEarned: effectiveXpAwarded,
              statBonuses: {
                empathy: completion.statChanges?.empathy?.delta ?? 0,
                listening: completion.statChanges?.listening?.delta ?? 0,
                trust: completion.statChanges?.trust?.delta ?? 0,
                relationship: completion.statChanges?.relationshipBuilding?.delta ?? 0,
                closing: completion.statChanges?.closing?.delta ?? 0,
              },
              finalCustomerResponse,
              sprocketWrapUp,
              debug: isFreshUpSandboxMode ? {
                memoryState: debugAccess && freshUpSandboxConfig?.memoryDebugMode ? freshUpMemoryRef.current : undefined,
                scoringState: debugAccess && freshUpSandboxConfig?.scoringDebugMode ? {
                  empathyMovement: resolvedScores.empathy - 60,
                  listeningMovement: resolvedScores.listening - 60,
                  trustMovement: resolvedScores.trust - 60,
                  relationshipMovement: resolvedScores.relationship - 60,
                  closingMovement: resolvedScores.closing - 60,
                  upMeterStart: resolvedUpMeter.start,
                  upMeterPeak: resolvedUpMeter.peak,
                  upMeterEnd: resolvedUpMeter.end,
                  outcomeTag: resolvedOutcomeTag,
                  coachingTag: result.coachingTag ?? freshUpProfile.current?.coachingTag ?? null,
                } : undefined,
                scenarioGenerationDetails: debugAccess ? {
                  roleType: aisRoleType,
                  interactionDisplayLabel,
                  sourceType: freshUpProfile.current?.sourceType,
                  selectedScenarioId: freshUpProfile.current?.scenarioId ?? freshUpProfile.current?.freshUpId,
                  selectedScenarioName: freshUpProfile.current?.scenarioName ?? freshUpProfile.current?.characterName,
                  generatedCustomerTraits: freshUpProfile.current ? {
                    archetypeId: freshUpProfile.current.archetypeId,
                    archetypeName: freshUpProfile.current.archetypeName,
                    archetypeCategory: freshUpProfile.current.archetypeCategory,
                    humorLevel: freshUpProfile.current.humorLevel,
                    customerArchetypeId: freshUpProfile.current.customerArchetypeId,
                    customerArchetypeName: freshUpProfile.current.customerArchetypeName,
                    roleAdjustedArchetypeLabel: freshUpProfile.current.roleAdjustedArchetypeLabel,
                    archetypeConfidence: freshUpProfile.current.archetypeConfidence,
                    archetypeBehaviorFlags: freshUpProfile.current.archetypeBehaviorFlags,
                    conversationTempoId: freshUpProfile.current.conversationTempoId,
                    conversationTempoName: freshUpProfile.current.conversationTempoName,
                    roleAdjustedTempoLabel: freshUpProfile.current.roleAdjustedTempoLabel,
                    tempoConfidence: freshUpProfile.current.tempoConfidence,
                    tempoBehaviorFlags: freshUpProfile.current.tempoBehaviorFlags,
                    personalityType: freshUpProfile.current.personalityType,
                    buyingStage: freshUpProfile.current.buyingStage,
                    primaryConcern: freshUpProfile.current.primaryConcern,
                    secondaryConcern: freshUpProfile.current.secondaryConcern,
                    communicationStyle: freshUpProfile.current.communicationStyle,
                    vehicleInterest: freshUpProfile.current.vehicleInterest,
                    difficultyLevel: freshUpProfile.current.difficultyLevel,
                    startingEmotionalState: freshUpProfile.current.emotionalState,
                  } : null,
                  openingMessage: sessionOpeningRef.current,
                  endingType,
                  endingEmotionalState,
                  contentValidationPassed: mergedGuardrails.contentValidationPassed,
                  validationFailureReasons: mergedGuardrails.validationFailureReasons,
                  guardrailFlags: mergedGuardrails.guardrailFlags,
                } : undefined,
              } : undefined,
            });

            if (freshUpToggleRef.current.enableConsultantFeedbackEnhancements !== false) {
              const adaptive = await getAdaptiveCoachingRecommendation(user.userId);
              setAdaptiveRecommendation(adaptive);
            } else {
              setAdaptiveRecommendation(null);
            }
          }

          completion.newBadges.forEach((badge, index) => {
            setTimeout(() => {
              toast({
                title: `Badge Unlocked: ${badge.name}!`,
                description: badge.description,
              });
            }, index * 1200);
          });
        } catch (error: any) {
          console.error('Failed to save lesson completion details:', error);
          toast({
            variant: 'destructive',
            title: 'Saved with limited details',
            description: error?.message || 'We could not calculate score deltas for this lesson.',
          });
        }
      }

      const summaryText = isFreshUp
        ? buildFreshUpCompletionSummary(result, freshUpProfile.current, result.ratings)
        : buildCompletionSummary(result, completionDetails, displayedXp, mergedFlags);
      if (!isFreshUp) {
        const finalMessage: Message = { sender: 'ai', text: summaryText };
        setMessages(prev => [...prev, finalMessage]);
      }
      setInputDisabled(true);
      setIsCompleted(true);
      return;
    }

    const aiMessage: Message = { sender: 'ai', text: responseText };
    setMessages(prev => [...prev, aiMessage]);
  };

  useEffect(() => {
    async function startLesson() {
      if (lessonStarted.current || !cxScores) return;
      if (isFreshUp && !freshUpStarted) return;
      lessonStarted.current = true;
      startedAtRef.current = new Date();
      if (isFreshUp) {
        const history = user ? await getConsultantActivity(user.userId) : [];
        const recentProfiles = history
          .filter((log) => log.activitySource === 'fresh-up')
          .slice(0, 5)
          .map((log) => ({
            archetypeId: log.archetypeId || '',
            archetypeCategory: log.archetypeCategory || 'friendly',
            primaryConcern: log.primaryConcern || '',
          }));
        if (!freshUpProfile.current) {
          if (user && freshUpSandboxConfig?.enabled) {
            freshUpProfile.current = resolveSandboxFreshUpProfile({
              config: freshUpSandboxConfig,
              userId: user.userId,
              lessonId: lesson.lessonId,
              roleType: aisRoleType,
              consultantLevel,
              toggles: freshUpToggleRef.current,
            });
          } else {
            freshUpProfile.current = await pickFreshUpProfileWithToggles({
              userId: user?.userId || 'guest',
              lessonId: lesson.lessonId,
              roleType: aisRoleType,
              consultantLevel,
              history,
              toggles: freshUpToggleRef.current,
            });
          }
        }
        freshUpMeterRef.current = {
          start: sessionStartMeter,
          current: sessionStartMeter,
          peak: sessionStartMeter,
        };
        freshUpScoreRef.current = {
          empathy: 60,
          listening: 60,
          trust: 60,
          relationship: 60,
          closing: 60,
        };
        if (freshUpProfile.current) {
          let selectedProfile = freshUpProfile.current;
          const openingEnabled = freshUpToggleRef.current.enableOpeningMechanic !== false;
          let opening = openingEnabled
            ? generateFreshUpOpening(selectedProfile, aisRoleType)
            : {
              sprocketLine: `${interactionDisplayLabel} is live. Keep it clear and customer-first.`,
              customerOpening: `${selectedProfile.customerName}: I am looking at this ${selectedProfile.vehicleInterest} and I want to make the right decision.`,
            };
          let openingValidation = freshUpToggleRef.current.enableContentGuardrails
            ? validateFreshUpOpeningGuardrails({
              profile: selectedProfile,
              openingMessage: opening.customerOpening,
              recentProfiles,
            })
            : { contentValidationPassed: true, validationFailureReasons: [], guardrailFlags: [] };
          for (let attempt = 0; attempt < 2 && !openingValidation.contentValidationPassed; attempt += 1) {
            if (user && freshUpSandboxConfig?.enabled) {
              selectedProfile = resolveSandboxFreshUpProfile({
                config: freshUpSandboxConfig,
                userId: user.userId,
                lessonId: `${lesson.lessonId}:${attempt}:${Date.now()}`,
                roleType: aisRoleType,
                consultantLevel,
                toggles: freshUpToggleRef.current,
              });
            } else {
              selectedProfile = await pickFreshUpProfileWithToggles({
                userId: user?.userId || 'guest',
                lessonId: `${lesson.lessonId}:${attempt}:${Date.now()}`,
                roleType: aisRoleType,
                consultantLevel,
                history,
                toggles: freshUpToggleRef.current,
              });
            }
            opening = openingEnabled
              ? generateFreshUpOpening(selectedProfile, aisRoleType)
              : {
                sprocketLine: `${interactionDisplayLabel} is live. Keep it clear and customer-first.`,
                customerOpening: `${selectedProfile.customerName}: I am looking at this ${selectedProfile.vehicleInterest} and I want to make the right decision.`,
              };
            openingValidation = freshUpToggleRef.current.enableContentGuardrails
              ? validateFreshUpOpeningGuardrails({
                profile: selectedProfile,
                openingMessage: opening.customerOpening,
                recentProfiles,
              })
              : { contentValidationPassed: true, validationFailureReasons: [], guardrailFlags: [] };
          }
          freshUpProfile.current = selectedProfile;
          freshUpGuardrailRef.current = openingValidation;
          freshUpMemoryRef.current = createInitialFreshUpMemory(selectedProfile);
          freshUpEmotionRef.current = getStartingEmotion(selectedProfile);
          sessionOpeningRef.current = opening.customerOpening;
          freshUpMemoryRef.current = enrichMemoryStateFromOpening(freshUpMemoryRef.current, opening.customerOpening);
          setMessages([
            { sender: 'ai', text: `Sprocket: ${opening.sprocketLine}` },
            { sender: 'ai', text: `${selectedProfile.customerName}: ${opening.customerOpening}` },
          ]);
          setIsLoading(false);
          return;
        }
      }
      setIsLoading(true);
      try {
        const initialResponse = await requestLessonResponse([], 'Start the lesson.');

        await handleAiResponse(initialResponse, []);
      } catch (error: any) {
        console.error('Failed to start lesson:', error);
        toast({
          variant: 'destructive',
          title: 'Lesson failed to start',
          description: error?.message || 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    startLesson();
  }, [cxScores, lesson.lessonId, lesson.title, lesson.role, lesson.category, lesson.associatedTrait, lesson.customScenario, isRecommended, toast, promptLessonRole, isFreshUp, freshUpProfileId, freshUpStarted, user, freshUpSandboxConfig, sessionStartMeter, consultantLevel, aisRoleType, roleToneProfile, targetTurnRange]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || inputDisabled || !cxScores || (isFreshUp && !freshUpStarted)) return;

    const currentInput = input;
    if (isFreshUp) {
      const evaluated = evaluateFreshUpResponse({
        message: currentInput,
        currentMeter: freshUpMeterRef.current.current,
        profile: freshUpProfile.current,
        memoryState: freshUpMemoryRef.current,
        currentEmotion: freshUpEmotionRef.current,
        enableCustomerMemory: freshUpToggleRef.current.enableCustomerMemory !== false,
        enableEmotionalResponseEngine: freshUpToggleRef.current.enableEmotionalResponseEngine !== false,
      });
      freshUpMeterRef.current.current = evaluated.nextMeter;
      freshUpMeterRef.current.peak = Math.max(freshUpMeterRef.current.peak, evaluated.nextMeter);
      if (evaluated.nextMemoryState) {
        freshUpMemoryRef.current = evaluated.nextMemoryState;
      }
      if (evaluated.nextEmotion) {
        freshUpEmotionRef.current = evaluated.nextEmotion;
      }
      freshUpScoreRef.current.empathy = clampUpMeter(freshUpScoreRef.current.empathy + evaluated.categoryDeltas.empathy);
      freshUpScoreRef.current.listening = clampUpMeter(freshUpScoreRef.current.listening + evaluated.categoryDeltas.listening);
      freshUpScoreRef.current.trust = clampUpMeter(freshUpScoreRef.current.trust + evaluated.categoryDeltas.trust);
      freshUpScoreRef.current.relationship = clampUpMeter(freshUpScoreRef.current.relationship + evaluated.categoryDeltas.relationship);
      freshUpScoreRef.current.closing = clampUpMeter(freshUpScoreRef.current.closing + evaluated.categoryDeltas.closing);
    }
    const userMessage: Message = { sender: 'user', text: currentInput };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await requestLessonResponse(newMessages, currentInput);
      
      await handleAiResponse(response, newMessages);
    } catch (error: any) {
      console.error('Failed to continue lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Lesson response failed',
        description: error?.message || 'Please try sending again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSkipLesson = async () => {
    if (isLoading || inputDisabled || !cxScores || (isFreshUp && !freshUpStarted)) return;
    
    setIsLoading(true);
    setInput(''); 

    try {
      const response = await requestLessonResponse(messages, '@skip_lesson');
      
      await handleAiResponse(response, messages);
    } catch (error: any) {
      console.error('Failed to skip lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Skip failed',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAnotherFreshUp = async () => {
    if (!user || !isFreshUp) return;
    if (isFreshUpSandboxMode && freshUpSandboxConfig?.enabled) {
      const params = new URLSearchParams();
      params.set('freshUp', 'true');
      params.set('sandboxFreshUp', 'true');
      params.set('sandboxRoleType', aisRoleType);
      params.set('sandboxRoleLabelKey', roleLabelKey);
      params.set('sandboxInteractionLabel', interactionDisplayLabel);
      params.set('sandboxSourceType', freshUpSandboxConfig.sourceType);
      params.set('sandboxDifficulty', freshUpSandboxConfig.difficulty);
      params.set('sandboxVehicleInterest', freshUpSandboxConfig.vehicleInterest);
      params.set('sandboxPrimaryConcern', freshUpSandboxConfig.primaryConcern);
      params.set('sandboxStartingMood', freshUpSandboxConfig.startingMood);
      params.set('sandboxPersonalityType', freshUpSandboxConfig.personalityType);
      params.set('sandboxCommunicationStyle', freshUpSandboxConfig.communicationStyle);
      params.set('sandboxStartingUpMeter', String(clampUpMeter(Number(freshUpSandboxConfig.startingUpMeter ?? 35))));
      params.set('sandboxMemoryDebug', freshUpSandboxConfig.memoryDebugMode ? 'true' : 'false');
      params.set('sandboxScoringDebug', freshUpSandboxConfig.scoringDebugMode ? 'true' : 'false');
      params.set('sandboxSaveLive', freshUpSandboxConfig.saveSessionToLiveAnalytics ? 'true' : 'false');
      if (freshUpSandboxVersionId) {
        params.set('sandboxVersionId', freshUpSandboxVersionId);
      }
      if (freshUpSandboxConfig.forceProfileIdOrName && freshUpSandboxConfig.forceProfileIdOrName.trim().length > 0) {
        params.set('sandboxForceProfile', freshUpSandboxConfig.forceProfileIdOrName.trim());
      }
      if (freshUpSandboxConfig.forceArchetypeIdOrName && freshUpSandboxConfig.forceArchetypeIdOrName.trim().length > 0) {
        params.set('sandboxForceArchetype', freshUpSandboxConfig.forceArchetypeIdOrName.trim());
      }
      if (freshUpSandboxConfig.forceTempoIdOrName && freshUpSandboxConfig.forceTempoIdOrName.trim().length > 0) {
        params.set('sandboxForceTempo', freshUpSandboxConfig.forceTempoIdOrName.trim());
      }
      router.push(`/lesson/${lesson.lessonId}?${params.toString()}`);
      return;
    }
    try {
      const activity = await getConsultantActivity(user.userId);
      const nextProfile = await pickFreshUpProfileWithToggles({
        userId: user.userId,
        lessonId: lesson.lessonId,
        roleType: aisRoleType,
        consultantLevel,
        history: activity,
        toggles: freshUpToggleRef.current,
      });
      router.push(`/lesson/${lesson.lessonId}?freshUp=true&profileId=${encodeURIComponent(nextProfile.freshUpId)}`);
    } catch {
      router.push(`/lesson/${lesson.lessonId}?freshUp=true`);
    }
  };

  const handleStartFreshUp = async () => {
    if (!isFreshUp) return;
    if (!freshUpProfile.current && user && freshUpSandboxConfig?.enabled) {
      freshUpProfile.current = resolveSandboxFreshUpProfile({
        config: freshUpSandboxConfig,
        userId: user.userId,
        lessonId: lesson.lessonId,
        roleType: aisRoleType,
        consultantLevel,
        toggles: freshUpToggleRef.current,
      });
    }
    if (!freshUpProfile.current && user) {
      const activity = await getConsultantActivity(user.userId);
      freshUpProfile.current = await pickFreshUpProfileWithToggles({
        userId: user.userId,
        lessonId: lesson.lessonId,
        roleType: aisRoleType,
        consultantLevel,
        history: activity,
        toggles: freshUpToggleRef.current,
      });
    }
    lessonStarted.current = false;
    setMessages([]);
    setFreshUpStarted(true);
  };

  const handleStartAdaptiveLesson = async () => {
    if (!user || !adaptiveRecommendation) return;
    try {
      const lessonRole: LessonRole = user.role === 'Owner' || user.role === 'Admin' ? 'global' : user.role;
      const availableLessons = await getLessons(lessonRole, user.userId);
      const scoped = availableLessons.filter((candidate) => candidate.associatedTrait === adaptiveRecommendation.associatedTrait);
      const target = scoped.find((candidate) => candidate.role === user.role)
        || scoped.find((candidate) => candidate.role === 'global')
        || scoped[0];
      if (!target) {
        toast({
          variant: 'destructive',
          title: 'Lesson unavailable',
          description: 'No lesson is currently available for this coaching focus.',
        });
        return;
      }
      router.push(`/lesson/${target.lessonId}`);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Lesson unavailable',
        description: 'Unable to load recommendation lesson right now.',
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8">
        <Card className="w-full max-w-3xl h-full flex flex-col bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>{isFreshUp ? interactionDisplayLabel : lesson.title}</CardTitle>
                {isFreshUp && freshUpProfile.current ? (
                  <p className="text-sm text-muted-foreground">
                    {freshUpProfile.current.characterName} · {freshUpProfile.current.customerType} · Skills in focus: {getProfilePriorityTraits(freshUpProfile.current).map(formatTraitLabel).join(', ')}
                  </p>
                ) : null}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                {isFreshUp && !freshUpStarted ? (
                  <div className="h-full flex items-center justify-center">
                    {freshUpProfile.current ? (
                      <div className="w-full max-w-lg rounded-lg border p-5 space-y-4">
                        <h3 className="text-lg font-semibold">{interactionDisplayLabel}</h3>
                        <div className="space-y-2 text-sm">
                          <p><span className="text-muted-foreground">Customer:</span> {freshUpProfile.current.customerName}</p>
                          <p><span className="text-muted-foreground">Vehicle Interest:</span> {freshUpProfile.current.vehicleInterest}</p>
                          <p><span className="text-muted-foreground">Mood:</span> {freshUpProfile.current.emotionalState}</p>
                          <p><span className="text-muted-foreground">Primary Concern:</span> {freshUpProfile.current.primaryConcern}</p>
                        </div>
                        <Button type="button" className="w-full" onClick={handleStartFreshUp}>
                          Start {interactionDisplayLabel}
                        </Button>
                      </div>
                    ) : (
                      <Spinner size="lg" />
                    )}
                  </div>
                ) : isCompleted && isFreshUp && freshUpFeedback ? (
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4">
                      <div className="rounded-lg border p-4">
                        <h3 className="text-base font-semibold">Conversation Summary</h3>
                        <p className="text-sm text-muted-foreground mt-1">Scenario: {freshUpFeedback.scenarioName}</p>
                        <p className="text-sm text-muted-foreground">Conversation Length: {freshUpFeedback.conversationLength}</p>
                        <p className="text-sm text-muted-foreground">Messages Sent: {freshUpFeedback.messagesSent}</p>
                        <p className="text-sm text-muted-foreground">AI Responses: {freshUpFeedback.aiResponseCount}</p>
                        <p className="text-sm font-semibold mt-2">{freshUpFeedback.outcomeTag}</p>
                        <p className="text-sm text-muted-foreground">{freshUpFeedback.outcomeMeaning}</p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <h3 className="text-base font-semibold">{`${meterDisplayLabel} Journey`}</h3>
                        <div className="mt-2 space-y-2">
                          {[{ label: 'Start', value: freshUpFeedback.upMeter.start }, { label: 'Peak', value: freshUpFeedback.upMeter.peak }, { label: 'End', value: freshUpFeedback.upMeter.end }].map((item) => (
                            <div key={item.label} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>{item.label}</span>
                                <span>{item.value} · {upMeterLabel(item.value)}</span>
                              </div>
                              <div className="h-2 w-full rounded bg-muted">
                                <div className="h-2 rounded bg-primary" style={{ width: `${item.value}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{freshUpFeedback.upMeterInsight}</p>
                      </div>

                      <div className="rounded-lg border p-4">
                        <h3 className="text-base font-semibold">Conversation Skill Breakdown</h3>
                        <div className="mt-2 space-y-3">
                          {[
                            { label: 'Empathy', score: freshUpFeedback.scores.empathy, tip: freshUpFeedback.skillTips.empathy },
                            { label: 'Listening', score: freshUpFeedback.scores.listening, tip: freshUpFeedback.skillTips.listening },
                            { label: 'Trust Building', score: freshUpFeedback.scores.trust, tip: freshUpFeedback.skillTips.trust },
                            { label: 'Relationship Building', score: freshUpFeedback.scores.relationship, tip: freshUpFeedback.skillTips.relationship },
                            { label: 'Closing Ability', score: freshUpFeedback.scores.closing, tip: freshUpFeedback.skillTips.closing },
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex items-center justify-between text-sm">
                                <span>{item.label}</span>
                                <span>{item.score}</span>
                              </div>
                              <div className="h-2 w-full rounded bg-muted mt-1">
                                <div className="h-2 rounded bg-primary" style={{ width: `${item.score}%` }} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{item.tip}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border p-4">
                        <h3 className="text-base font-semibold">XP and Stat Gains</h3>
                        <p className="text-sm text-muted-foreground mt-1">XP Earned: <span className="font-semibold text-foreground">{freshUpFeedback.xpEarned}</span></p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <p>Empathy {formatSigned(freshUpFeedback.statBonuses.empathy)}</p>
                          <p>Listening {formatSigned(freshUpFeedback.statBonuses.listening)}</p>
                          <p>Trust {formatSigned(freshUpFeedback.statBonuses.trust)}</p>
                          <p>Relationship {formatSigned(freshUpFeedback.statBonuses.relationship)}</p>
                          <p>Closing {formatSigned(freshUpFeedback.statBonuses.closing)}</p>
                        </div>
                      </div>

                      {(freshUpFeedback.finalCustomerResponse || freshUpFeedback.sprocketWrapUp) && (
                        <div className="rounded-lg border p-4">
                          <h3 className="text-base font-semibold">Conversation Wrap-Up</h3>
                          {freshUpFeedback.finalCustomerResponse && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <span className="font-medium text-foreground">Customer:</span> {freshUpFeedback.finalCustomerResponse}
                            </p>
                          )}
                          {freshUpFeedback.sprocketWrapUp && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <span className="font-medium text-foreground">Sprocket:</span> {freshUpFeedback.sprocketWrapUp}
                            </p>
                          )}
                        </div>
                      )}

                      {Boolean(freshUpFeedback.debug?.memoryState) && (
                        <Collapsible className="rounded-lg border p-4">
                          <CollapsibleTrigger className="w-full text-left text-base font-semibold">
                            Memory State (Debug)
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
                              {JSON.stringify(freshUpFeedback.debug?.memoryState ?? {}, null, 2)}
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {Boolean(freshUpFeedback.debug?.scoringState) && (
                        <Collapsible className="rounded-lg border p-4">
                          <CollapsibleTrigger className="w-full text-left text-base font-semibold">
                            Scoring State (Debug)
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
                              {JSON.stringify(freshUpFeedback.debug?.scoringState ?? {}, null, 2)}
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {Boolean(freshUpFeedback.debug?.scenarioGenerationDetails) && (
                        <Collapsible className="rounded-lg border p-4">
                          <CollapsibleTrigger className="w-full text-left text-base font-semibold">
                            Scenario Generation Details (Debug)
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
                              {JSON.stringify(freshUpFeedback.debug?.scenarioGenerationDetails ?? {}, null, 2)}
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {adaptiveRecommendation && (
                        <div className="rounded-lg border p-4">
                          <h3 className="text-base font-semibold">Coaching Opportunity</h3>
                          <p className="text-sm text-muted-foreground mt-1">{adaptiveRecommendation.coachingMessage}</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Recommended Lesson: <span className="font-medium text-foreground">{adaptiveRecommendation.recommendedLessonTitle}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Estimated Time: <span className="font-medium text-foreground">{adaptiveRecommendation.estimatedMinutes} minutes</span>
                          </p>
                          <Button type="button" className="mt-3 w-full" onClick={handleStartAdaptiveLesson}>
                            Start Lesson
                          </Button>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <ScrollArea className="h-full pr-4">
                      <div className="space-y-4">
                          {isLoading && messages.length === 0 && (
                              <div className="flex h-full w-full items-center justify-center">
                                  <Spinner size="lg" />
                              </div>
                          )}
                          {messages.map((message, index) => (
                          <div key={index} className={`flex items-start gap-4 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                              {message.sender === 'ai' && (
                                  <Avatar className="h-8 w-8">
                                      <Image src={ASSISTANT_AVATAR_SRC} alt={ASSISTANT_NAME} width={32} height={32} />
                                  </Avatar>
                              )}
                              <div className={`rounded-lg p-3 text-sm max-w-[80%] ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                  <p style={{whiteSpace: 'pre-wrap'}}>{message.text}</p>
                              </div>
                              {message.sender === 'user' && user && (
                                  <Avatar className="h-8 w-8">
                                      <AvatarImage src={user.avatarUrl} />
                                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                              )}
                          </div>
                          ))}
                          {isLoading && messages.length > 0 && messages[messages.length-1].sender === 'user' && (
                              <div className="flex items-start gap-4">
                                  <Avatar className="h-8 w-8 animate-spin">
                                      <Image src={ASSISTANT_AVATAR_SRC} alt={`${ASSISTANT_NAME} is thinking...`} width={32} height={32} />
                                  </Avatar>
                              </div>
                          )}
                          <div ref={messagesEndRef} />
                      </div>
                  </ScrollArea>
                )}
            </CardContent>
            <CardFooter>
                {isFreshUp && !freshUpStarted ? (
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                ) : isCompleted && isFreshUp ? (
                    <div className="w-full space-y-2">
                      <Button type="button" className="w-full" onClick={handleTryAnotherFreshUp}>
                        {interactionDisplayLabel}
                      </Button>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/">
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back to Dashboard
                        </Link>
                      </Button>
                    </div>
                ) : isCompleted ? (
                    <Button asChild className="w-full">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
                        <Input
                            id="message"
                            placeholder="Type your response..."
                            className="flex-1"
                            autoComplete="off"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading || inputDisabled || (isFreshUp && !freshUpStarted)}
                        />
                        <Button type="submit" size="icon" disabled={isLoading || inputDisabled || (isFreshUp && !freshUpStarted)}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                         {isTouring && (
                             <Button type="button" variant="outline" size="icon" onClick={handleSkipLesson} disabled={isLoading || inputDisabled} title="Skip to Results">
                                <ArrowRightToLine className="h-4 w-4" />
                                <span className="sr-only">Skip to Results</span>
                            </Button>
                        )}
                    </form>
                )}
            </CardFooter>
        </Card>
    </div>
  );
}
