import type { UserRole } from '@/lib/definitions';
import type { RecommendationEvent, RecommendationEventType } from '@/lib/tools/toolbox-storage';
import type { ToolConfig, ToolIntentTag } from '@/lib/tools/toolbox';

export type RecommendationMode = 'BASIC' | 'ACCOUNT' | 'AUTODRIVECX';

export type ToolRecommendation = {
  toolId: string;
  score: number;
  topSignals: string[];
  penalties: string[];
  reasonType: 'intent' | 'role' | 'behavior' | 'skill' | 'fallback';
  reasonText: string;
};

export type RecommendationResult = {
  mode: RecommendationMode;
  intent: ToolIntentTag | null;
  isColdStart: boolean;
  recommendations: ToolRecommendation[];
};

export type RecommendationInput = {
  tools: ToolConfig[];
  accessibleToolIds: string[];
  hasAccount?: boolean;
  hasAutoDriveCX?: boolean;
  role?: UserRole | null;
  selectedIntent?: ToolIntentTag | null;
  recentOpenedToolIds?: string[];
  recentCompletedToolIds?: string[];
  savedToolIds?: string[];
  lastCategoryUsed?: string | null;
  cxSignals?: {
    skillGaps?: string[];
    coachingSignals?: string[];
    performanceWeaknesses?: string[];
  } | null;
  recommendationEvents?: RecommendationEvent[];
  now?: Date;
};

const WEIGHTS = {
  roleFit: 35,
  intentFit: 30,
  skillGapFit: 20,
  recentBehaviorFit: 10,
  freshness: 3,
  novelty: 2,
};

const MAX_REPEAT_PENALTY = 25;
const REPEAT_PENALTY_BY_EVENT: Record<RecommendationEventType, number> = {
  recommended_tool_shown: 6,
  recommended_tool_clicked: 12,
  recommended_tool_dismissed: 25,
  recommended_tool_ignored: 10,
};
const GENERAL_UTILITY_TOOL_IDS = new Set([
  'next-move-engine',
  'objection-reframe',
  'follow-up-cadence',
  'price-presentation',
  'commitment-ladder',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRoleFit(tool: ToolConfig, role?: UserRole | null): number {
  if (!role) return 0;
  if (tool.primaryRoles.includes(role)) return 1;
  if (tool.secondaryRoles.includes(role)) return 0.6;
  return 0;
}

function toIntentFit(tool: ToolConfig, intent?: ToolIntentTag | null): number {
  if (!intent) return 0;
  if (tool.intentTags.includes(intent)) return 1;
  return 0;
}

function toSkillGapFit(tool: ToolConfig, input: RecommendationInput): number {
  if (!input.cxSignals) return 0;
  const signals = [
    ...(input.cxSignals.skillGaps || []),
    ...(input.cxSignals.coachingSignals || []),
    ...(input.cxSignals.performanceWeaknesses || []),
  ].map((value) => value.toLowerCase());
  if (!signals.length) return 0;

  const tagHits = tool.skillTags.filter((tag) => signals.some((signal) => signal.includes(tag.toLowerCase()))).length;
  if (!tagHits) return 0;
  return clamp(tagHits / Math.max(1, tool.skillTags.length), 0, 1);
}

function getMatchedSkillTag(tool: ToolConfig, input: RecommendationInput): string | null {
  if (!input.cxSignals) return null;
  const signals = [
    ...(input.cxSignals.skillGaps || []),
    ...(input.cxSignals.coachingSignals || []),
    ...(input.cxSignals.performanceWeaknesses || []),
  ].map((value) => value.toLowerCase());
  if (!signals.length) return null;
  const match = tool.skillTags.find((tag) => signals.some((signal) => signal.includes(tag.toLowerCase())));
  return match || null;
}

function toRecentBehaviorFit(tool: ToolConfig, input: RecommendationInput): number {
  const opened = new Set(input.recentOpenedToolIds || []);
  const completed = new Set(input.recentCompletedToolIds || []);

  const usedIds = new Set([...opened, ...completed]);
  if (!usedIds.size) return 0;

  if ((input.lastCategoryUsed || '').trim() && tool.category === input.lastCategoryUsed) return 1;
  if (opened.has(tool.id) || completed.has(tool.id)) return 0;
  return 0.4;
}

function toFreshness(tool: ToolConfig): number {
  return tool.isNew ? 1 : 0;
}

function toNovelty(tool: ToolConfig, input: RecommendationInput): number {
  const recent = new Set([...(input.recentOpenedToolIds || []), ...(input.recentCompletedToolIds || [])]);
  return recent.has(tool.id) ? 0 : 1;
}

function hoursBetween(now: Date, thenIso: string): number {
  const then = new Date(thenIso);
  if (Number.isNaN(then.getTime())) return 9999;
  return Math.max(0, (now.getTime() - then.getTime()) / (1000 * 60 * 60));
}

function decayedPenalty(base: number, ageHours: number): number {
  // Exponential decay to reduce repeat penalty over time.
  return base * Math.exp(-ageHours / 36);
}

function computeRepeatPenalty(tool: ToolConfig, input: RecommendationInput, isColdStart: boolean): { score: number; reasons: string[] } {
  if (isColdStart) return { score: 0, reasons: [] };
  const now = input.now || new Date();
  const reasons: string[] = [];
  let totalPenalty = 0;

  if ((input.recentOpenedToolIds || []).includes(tool.id)) {
    totalPenalty += decayedPenalty(10, 1);
    reasons.push('Recently opened');
  }
  if ((input.recentCompletedToolIds || []).includes(tool.id)) {
    totalPenalty += decayedPenalty(8, 1);
    reasons.push('Recently completed');
  }

  const relevantEvents = (input.recommendationEvents || []).filter((event) => event.toolId === tool.id);
  relevantEvents.forEach((event) => {
    const base = REPEAT_PENALTY_BY_EVENT[event.type] || 0;
    if (!base) return;
    const hours = hoursBetween(now, event.createdAt);
    const penalty = decayedPenalty(base, hours);
    if (penalty > 0.5) {
      totalPenalty += penalty;
      if (event.type === 'recommended_tool_dismissed') reasons.push('Recently dismissed');
      if (event.type === 'recommended_tool_shown') reasons.push('Recently recommended');
      if (event.type === 'recommended_tool_ignored') reasons.push('Recently ignored');
      if (event.type === 'recommended_tool_clicked') reasons.push('Recently clicked');
    }
  });

  return {
    score: -clamp(totalPenalty, 0, MAX_REPEAT_PENALTY),
    reasons: Array.from(new Set(reasons)),
  };
}

function resolveMode(input: RecommendationInput): RecommendationMode {
  const hasRole = Boolean(input.role);
  const hasUsage = (input.recentOpenedToolIds || []).length > 0 || (input.recentCompletedToolIds || []).length > 0 || (input.savedToolIds || []).length > 0 || Boolean(input.lastCategoryUsed);
  const hasCx = Boolean(
    input.cxSignals
    && ((input.cxSignals.skillGaps || []).length > 0 || (input.cxSignals.coachingSignals || []).length > 0 || (input.cxSignals.performanceWeaknesses || []).length > 0)
  );
  if ((input.hasAutoDriveCX || false) && hasRole && hasCx) return 'AUTODRIVECX';
  if ((input.hasAccount || false) && hasRole) return 'ACCOUNT';
  if (hasRole && hasUsage && hasCx) return 'AUTODRIVECX';
  if (hasRole && hasUsage) return 'ACCOUNT';
  return 'BASIC';
}

function formatRoleLabel(role: UserRole): string {
  return role === 'manager' ? 'Sales Manager' : role;
}

type ReasonCandidate = {
  type: 'intent' | 'role' | 'behavior' | 'skill' | 'fallback';
  text: string;
};

function reasonCandidatesForTool(input: {
  role?: UserRole | null;
  selectedIntent?: ToolIntentTag | null;
  roleFitRaw: number;
  intentFitRaw: number;
  behaviorFitRaw: number;
  skillGapFitRaw: number;
  matchedSkillTag: string | null;
  mostRecentToolName: string | null;
}): ReasonCandidate[] {
  const candidates: ReasonCandidate[] = [];
  if (input.intentFitRaw > 0 && input.selectedIntent) {
    candidates.push({
      type: 'intent',
      text: `Matches your current focus on ${input.selectedIntent.toLowerCase()}`,
    });
  }
  if (input.roleFitRaw >= 0.6 && input.role) {
    candidates.push({
      type: 'role',
      text: `Designed for ${formatRoleLabel(input.role)} workflows`,
    });
  }
  if (input.behaviorFitRaw > 0) {
    if (input.mostRecentToolName) {
      candidates.push({
        type: 'behavior',
        text: `Strong next step after ${input.mostRecentToolName}`,
      });
    } else {
      candidates.push({
        type: 'behavior',
        text: 'Builds on your recent activity',
      });
    }
  }
  if (input.skillGapFitRaw > 0) {
    if (input.matchedSkillTag) {
      candidates.push({
        type: 'skill',
        text: `Targets a gap in ${input.matchedSkillTag}`,
      });
    } else {
      candidates.push({
        type: 'skill',
        text: 'Helps improve a CX skill based on your data',
      });
    }
  }

  candidates.push({
    type: 'fallback',
    text: 'A strong tool for your current workflow',
  });

  return candidates;
}

function chooseReason(
  candidates: ReasonCandidate[],
  usedTypes: Set<ReasonCandidate['type']>
): ReasonCandidate {
  const unique = candidates.find((candidate) => !usedTypes.has(candidate.type));
  return unique || candidates[0];
}

export function getRecommendedTools(input: RecommendationInput): RecommendationResult {
  const mode = resolveMode(input);
  const accessibleSet = new Set(input.accessibleToolIds);
  const eligibleTools = input.tools.filter((tool) => accessibleSet.has(tool.id));
  const hasInteractionData = (input.recentOpenedToolIds || []).length > 0 || (input.recentCompletedToolIds || []).length > 0 || (input.savedToolIds || []).length > 0 || (input.recommendationEvents || []).length > 0;
  const hasCxData = Boolean(input.cxSignals && (
    (input.cxSignals.skillGaps || []).length > 0
    || (input.cxSignals.coachingSignals || []).length > 0
    || (input.cxSignals.performanceWeaknesses || []).length > 0
  ));
  const isColdStart = !hasInteractionData && !hasCxData;

  const scored = eligibleTools.map((tool) => {
    const roleFitRaw = toRoleFit(tool, input.role);
    const intentFitRaw = toIntentFit(tool, input.selectedIntent);
    const skillGapFitRaw = mode === 'AUTODRIVECX' ? toSkillGapFit(tool, input) : 0;
    const behaviorFitRaw = mode === 'BASIC' ? 0 : toRecentBehaviorFit(tool, input);
    const freshnessRaw = toFreshness(tool);
    const noveltyRaw = toNovelty(tool, input);
    const repeatPenalty = computeRepeatPenalty(tool, input, isColdStart);
    const mostRecentToolId = [...(input.recentOpenedToolIds || []), ...(input.recentCompletedToolIds || [])].reverse()[0] || null;
    const mostRecentToolName = mostRecentToolId
      ? (input.tools.find((row) => row.id === mostRecentToolId)?.name || null)
      : null;
    const matchedSkillTag = mode === 'AUTODRIVECX' ? getMatchedSkillTag(tool, input) : null;

    // Freshness/novelty can never overpower role/intent.
    const relevanceAnchor = roleFitRaw + intentFitRaw;
    const freshnessMultiplier = relevanceAnchor > 0 ? 1 : 0.1;

    const positiveScore = (
      (roleFitRaw * WEIGHTS.roleFit)
      + (intentFitRaw * WEIGHTS.intentFit)
      + (skillGapFitRaw * WEIGHTS.skillGapFit)
      + (behaviorFitRaw * WEIGHTS.recentBehaviorFit)
      + ((freshnessRaw * WEIGHTS.freshness) * freshnessMultiplier)
      + ((noveltyRaw * WEIGHTS.novelty) * freshnessMultiplier)
      + (isColdStart && GENERAL_UTILITY_TOOL_IDS.has(tool.id) ? 6 : 0)
    );
    const finalScore = positiveScore + repeatPenalty.score;

    const topSignals: string[] = [];
    if (roleFitRaw > 0) topSignals.push('role');
    if (intentFitRaw > 0) topSignals.push('intent');
    if (skillGapFitRaw > 0) topSignals.push('skill_gap');
    if (behaviorFitRaw > 0) topSignals.push('recent_behavior');
    if (freshnessRaw > 0) topSignals.push('freshness');
    if (noveltyRaw > 0) topSignals.push('novelty');

    return {
      tool,
      score: round(finalScore),
      topSignals,
      penalties: repeatPenalty.reasons,
      reasonCandidates: reasonCandidatesForTool({
        role: input.role,
        selectedIntent: input.selectedIntent,
        roleFitRaw,
        intentFitRaw,
        behaviorFitRaw,
        skillGapFitRaw,
        matchedSkillTag,
        mostRecentToolName,
      }),
    };
  });

  const ranked = scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.tool.createdAt).getTime() - new Date(a.tool.createdAt).getTime();
    })
    .slice(0, 3);

  const usedReasonTypes = new Set<ReasonCandidate['type']>();
  const recommendations = ranked.map((row) => {
    const chosenReason = chooseReason(row.reasonCandidates, usedReasonTypes);
    usedReasonTypes.add(chosenReason.type);
    return {
      toolId: row.tool.id,
      score: row.score,
      topSignals: row.topSignals,
      penalties: row.penalties,
      reasonType: chosenReason.type,
      reasonText: chosenReason.text,
    };
  });

  return {
    mode,
    intent: input.selectedIntent || null,
    isColdStart,
    recommendations,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
