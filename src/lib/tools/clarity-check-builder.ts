import type { User } from '@/lib/definitions';

export const CLARITY_CHECK_STAGES = [
  'greeting',
  'vehicle selection',
  'test drive',
  'numbers',
  'trade',
  'manager handoff',
  'f&i handoff',
  'delivery',
] as const;

export const CLARITY_CONFUSION_AREAS = [
  'pricing',
  'process',
  'timing',
  'trade',
  'financing',
  'general uncertainty',
] as const;

export type ClarityCheckStage = typeof CLARITY_CHECK_STAGES[number];
export type ClarityConfusionArea = typeof CLARITY_CONFUSION_AREAS[number];

export type ClarityCheckInput = {
  currentJourneyStage: ClarityCheckStage;
  confusionRisk: number;
  infoDepthPreference: number;
  likelyConfusionArea: ClarityConfusionArea;
};

export type ClarityCheckPlan = {
  bestNextStepExplanation: string;
  sayThisClearly: string;
  askThisClarityCheck: string;
  whatToSimplify: string;
  doNotDoThis: string;
};

export type ClarityCheckSprocketEnhancement = {
  likelySourceOfConfusion: string;
  sharperSimplification: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type ClarityCheckCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Listening' | 'Clarity' | 'Pacing' | 'Explanation Discipline';
};

export type ClarityCheckSavedScenario = {
  id: string;
  createdAt: string;
  currentJourneyStage: ClarityCheckStage;
  confusionRisk: number;
  infoDepthPreference: number;
  likelyConfusionArea: ClarityConfusionArea;
  bestNextStepExplanation: string;
  sayThisClearly: string;
  askThisClarityCheck: string;
  whatToSimplify: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function stageExplanation(stage: ClarityCheckStage): string {
  if (stage === 'greeting') return 'Set the immediate process path in one sentence before asking discovery questions.';
  if (stage === 'vehicle selection') return 'Clarify how options will be narrowed and what decision point comes next.';
  if (stage === 'test drive') return 'Explain what will happen immediately after the drive before leaving the lot.';
  if (stage === 'numbers') return 'State the order of numbers clearly: where payment, trade, and total will be addressed.';
  if (stage === 'trade') return 'Explain appraisal flow and how trade value affects the overall structure.';
  if (stage === 'manager handoff') return 'Frame the handoff as support, explain purpose, and define what decision it helps.';
  if (stage === 'f&i handoff') return 'Set expectations for paperwork flow, options review, and timing.';
  return 'Explain delivery sequence, timing checkpoints, and where final questions will be handled.';
}

function clearLine(input: ClarityCheckInput): string {
  if (input.currentJourneyStage === 'numbers') {
    return 'Next, I will walk this in a clean order so you can react to each part clearly before we move on.';
  }
  if (input.currentJourneyStage === 'manager handoff') {
    return 'Next, I will bring in my manager to support this step so we can keep your options clear and efficient.';
  }
  if (input.currentJourneyStage === 'f&i handoff') {
    return 'Next, we will transition to finance, and I will quickly outline exactly what happens there before we start.';
  }
  if (input.confusionRisk >= 70) {
    return 'Let me simplify the next step in one clear path so nothing feels unclear or rushed.';
  }
  return 'Here is exactly what happens next, and then we will confirm it together before moving forward.';
}

function clarityQuestion(input: ClarityCheckInput): string {
  if (input.confusionRisk >= 70) {
    return 'Before we continue, what part feels least clear right now?';
  }
  if (input.likelyConfusionArea === 'timing') {
    return 'Does the timing of the next step feel clear and workable for you?';
  }
  if (input.likelyConfusionArea === 'pricing' || input.likelyConfusionArea === 'trade' || input.likelyConfusionArea === 'financing') {
    return 'On these numbers, which part would you like me to clarify first?';
  }
  return 'Would it help if I quickly recap the next step before we move forward?';
}

function simplifyGuidance(input: ClarityCheckInput): string {
  if (input.infoDepthPreference <= 30) {
    return 'Use one-step-at-a-time explanation and remove secondary details until after confirmation.';
  }
  if (input.infoDepthPreference >= 75) {
    return 'Keep detail structured in checkpoints: what happens, why it matters, then confirm understanding.';
  }
  if (input.likelyConfusionArea === 'process') {
    return 'Simplify sequencing language so they know exactly who does what and in what order.';
  }
  return 'Simplify by focusing on immediate next action, timeline, and decision point only.';
}

function avoidPattern(input: ClarityCheckInput): string {
  if (input.confusionRisk >= 70) {
    return 'Do not stack explanations without pausing to confirm understanding.';
  }
  if (input.currentJourneyStage === 'manager handoff' || input.currentJourneyStage === 'f&i handoff') {
    return 'Do not initiate handoff without explaining purpose and what the customer should expect.';
  }
  return 'Do not assume understanding because the customer nodded once.';
}

export function getClarityCheckPlan(input: ClarityCheckInput): ClarityCheckPlan {
  const normalized: ClarityCheckInput = {
    ...input,
    confusionRisk: clamp(input.confusionRisk),
    infoDepthPreference: clamp(input.infoDepthPreference),
  };

  return {
    bestNextStepExplanation: stageExplanation(normalized.currentJourneyStage),
    sayThisClearly: clearLine(normalized),
    askThisClarityCheck: clarityQuestion(normalized),
    whatToSimplify: simplifyGuidance(normalized),
    doNotDoThis: avoidPattern(normalized),
  };
}

export function getSprocketClarityCheckEnhancement(
  input: ClarityCheckInput,
  base: ClarityCheckPlan
): ClarityCheckSprocketEnhancement {
  const likelySourceOfConfusion =
    input.likelyConfusionArea === 'process'
      ? 'Likely confusion source is sequence ambiguity, not resistance to moving forward.'
      : input.likelyConfusionArea === 'timing'
        ? 'Likely confusion source is unclear timeline and when commitments are expected.'
        : input.likelyConfusionArea === 'pricing' || input.likelyConfusionArea === 'trade' || input.likelyConfusionArea === 'financing'
          ? 'Likely confusion source is number structure, not just price sensitivity.'
          : 'Likely confusion source is broad uncertainty about what happens next.';

  return {
    likelySourceOfConfusion,
    sharperSimplification: `${base.whatToSimplify} Keep the explanation to one path, then confirm clarity before adding detail.`,
    naturalRewrite: `Try this line: ${base.sayThisClearly}`,
    deliveryCoaching: 'Explain in 10-15 second chunks, pause, confirm, then continue. Do not stack multiple next steps.',
  };
}

type SkillSignals = {
  listeningLow: boolean;
  clarityLow: boolean;
  pacingLow: boolean;
  explanationDisciplineLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const listening = Number(stats?.listening ?? 60);
  const clarity = Number(stats?.trust ?? 60);
  const pacing = Number(stats?.followUp ?? 60);
  const explanationDiscipline = Number(stats?.closing ?? 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    clarityLow: clarity > 0 && clarity < 55,
    pacingLow: pacing > 0 && pacing < 55,
    explanationDisciplineLow: explanationDiscipline > 0 && explanationDiscipline < 55,
  };
}

export function getAutoDriveCxClarityCheckEnhancement(
  _input: ClarityCheckInput,
  _base: ClarityCheckPlan,
  user?: User | null
): ClarityCheckCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Listening trend suggests confusion drops when the first check question comes earlier.',
      adjustedApproach: 'Ask a short understanding-check question before giving additional detail.',
      focusSkillTag: 'Listening',
    };
  }
  if (signal.clarityLow) {
    return {
      tailoredReason: 'Clarity trend suggests process framing needs simpler structure and tighter sequencing.',
      adjustedApproach: 'Use one-step language with explicit transitions and no implied assumptions.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Pacing trend indicates information density may be outrunning customer processing speed.',
      adjustedApproach: 'Shorten explanation blocks and add a pause/checkpoint every major transition.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.explanationDisciplineLow) {
    return {
      tailoredReason: 'Explanation discipline trend suggests too many details are being front-loaded.',
      adjustedApproach: 'Lead with immediate next step only, then add detail after confirmation.',
      focusSkillTag: 'Explanation Discipline',
    };
  }

  return {
    tailoredReason: 'Skill profile suggests strongest gains come from cleaner sequencing and active clarity checks.',
    adjustedApproach: 'State next step, ask one confirmation question, then proceed in order.',
    focusSkillTag: 'Clarity',
  };
}
