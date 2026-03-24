import type { User } from '@/lib/definitions';

export const WAIT_EXPERIENCE_STAGES = [
  'checked in',
  'waiting on tech',
  'inspection',
  'waiting on parts',
  'repair underway',
  'final check',
] as const;

export const WAIT_EXPERIENCE_MOODS = [
  'calm',
  'mildly frustrated',
  'impatient',
  'upset',
  'anxious',
] as const;

export type WaitExperienceStage = typeof WAIT_EXPERIENCE_STAGES[number];
export type WaitExperienceMood = typeof WAIT_EXPERIENCE_MOODS[number];

export type WaitExperienceInput = {
  tensionLevel: number;
  customerPatience: number;
  loungeFrustration: number;
  progressStage: WaitExperienceStage;
  customerMood?: WaitExperienceMood | null;
};

export type WaitExperiencePlan = {
  bestUpdateApproach: string;
  sayThisNow: string;
  resetExpectationsThisWay: string;
  updateAgainAtThisPoint: string;
  doNotSayThis: string;
};

export type WaitExperienceSprocketEnhancement = {
  likelyEmotionalRisk: string;
  strongerResetLanguage: string;
  naturalRewrite: string;
  updateToneCoaching: string;
};

export type WaitExperienceCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Tone' | 'Follow-Through' | 'Trust' | 'Pacing';
};

export type WaitExperienceSavedScenario = {
  id: string;
  createdAt: string;
  tensionLevel: number;
  customerPatience: number;
  loungeFrustration: number;
  progressStage: WaitExperienceStage;
  customerMood?: WaitExperienceMood | null;
  bestUpdateApproach: string;
  sayThisNow: string;
  resetExpectationsThisWay: string;
  updateAgainAtThisPoint: string;
  doNotSayThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function updateApproach(input: WaitExperienceInput): string {
  if (input.tensionLevel >= 75 || input.loungeFrustration >= 70) {
    return 'Immediate reassurance update with a clear timeline checkpoint and explicit next touchpoint.';
  }
  if (input.progressStage === 'waiting on parts') {
    return 'Parts-delay transparency update with realistic timing window and contingency language.';
  }
  if (input.progressStage === 'inspection' || input.progressStage === 'waiting on tech') {
    return 'Progress visibility update that explains current status and what unlocks the next step.';
  }
  if (input.progressStage === 'final check') {
    return 'Completion-focused update with pickup readiness framing and final ETA confirmation.';
  }
  return 'Calm status update with concise expectation reset and next-update commitment.';
}

function sayNow(input: WaitExperienceInput): string {
  if (input.customerMood === 'upset') {
    return 'I know the wait is frustrating, and I want to keep this clear. Here is exactly where we are right now.';
  }
  if (input.customerMood === 'impatient') {
    return 'Quick update so you are not left guessing: here is where your vehicle is in the process now.';
  }
  if (input.progressStage === 'waiting on parts') {
    return 'We are currently waiting on parts, and I will keep you updated with exact timing as soon as it changes.';
  }
  return 'Quick update: here is what is done, what is in progress, and what comes next.';
}

function resetExpectations(input: WaitExperienceInput): string {
  if (input.tensionLevel >= 75) {
    return 'Reset around certainty: give a realistic range, explain the dependency, and commit to a proactive update.';
  }
  if (input.customerPatience <= 35) {
    return 'Reset around control: tell them exactly when they will hear from you next and what that update will include.';
  }
  if (input.progressStage === 'final check') {
    return 'Reset around finish line: confirm final verification and provide the next concrete pickup checkpoint.';
  }
  return 'Reset around sequence: current stage, likely next stage, and timing check-in.';
}

function nextUpdatePoint(input: WaitExperienceInput): string {
  if (input.tensionLevel >= 75 || input.customerMood === 'upset') {
    return 'Update again within 10 to 15 minutes, even if status has not changed.';
  }
  if (input.customerPatience <= 35 || input.customerMood === 'impatient') {
    return 'Update again at the next process checkpoint or within 20 minutes, whichever comes first.';
  }
  if (input.progressStage === 'waiting on parts') {
    return 'Update at the next parts ETA confirmation or within 30 minutes.';
  }
  return 'Update at the next stage transition or within 25 to 30 minutes.';
}

function avoidLine(input: WaitExperienceInput): string {
  if (input.customerMood === 'upset' || input.tensionLevel >= 70) {
    return 'Do not say "still waiting" without timeline context and a committed next update.';
  }
  if (input.progressStage === 'waiting on parts') {
    return 'Do not promise exact completion time before parts timing is confirmed.';
  }
  return 'Do not use vague filler updates that provide no clear next expectation.';
}

export function getWaitExperiencePlan(input: WaitExperienceInput): WaitExperiencePlan {
  const normalized: WaitExperienceInput = {
    ...input,
    tensionLevel: clamp(input.tensionLevel),
    customerPatience: clamp(input.customerPatience),
    loungeFrustration: clamp(input.loungeFrustration),
  };

  return {
    bestUpdateApproach: updateApproach(normalized),
    sayThisNow: sayNow(normalized),
    resetExpectationsThisWay: resetExpectations(normalized),
    updateAgainAtThisPoint: nextUpdatePoint(normalized),
    doNotSayThis: avoidLine(normalized),
  };
}

export function getSprocketWaitExperienceEnhancement(
  input: WaitExperienceInput,
  base: WaitExperiencePlan
): WaitExperienceSprocketEnhancement {
  const likelyEmotionalRisk =
    input.customerMood === 'upset'
      ? 'Primary risk is emotional escalation from feeling ignored or deprioritized.'
      : input.customerMood === 'impatient'
        ? 'Primary risk is perceived time uncertainty causing trust erosion.'
        : input.progressStage === 'waiting on parts'
          ? 'Primary risk is confidence drop from unclear dependency timing.'
          : 'Primary risk is ambiguity fatigue from updates that feel non-specific.';

  return {
    likelyEmotionalRisk,
    strongerResetLanguage: `${base.resetExpectationsThisWay} Keep the timing window realistic and explicit.`,
    naturalRewrite: `Try this wording: ${base.sayThisNow}`,
    updateToneCoaching: 'Use calm, ownership-based language. Keep updates brief, specific, and forward-looking.',
  };
}

type SkillSignals = {
  toneLow: boolean;
  followThroughLow: boolean;
  trustLow: boolean;
  pacingLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const tone = Number(stats?.closing ?? 60);
  const followThrough = Number(stats?.followUp ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const pacing = Number(stats?.listening ?? 60);

  return {
    toneLow: tone > 0 && tone < 55,
    followThroughLow: followThrough > 0 && followThrough < 55,
    trustLow: trust > 0 && trust < 55,
    pacingLow: pacing > 0 && pacing < 55,
  };
}

export function getAutoDriveCxWaitExperienceEnhancement(
  _input: WaitExperienceInput,
  _base: WaitExperiencePlan,
  user?: User | null
): WaitExperienceCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.toneLow) {
    return {
      tailoredReason: 'Tone trend suggests calmer, ownership-led language will reduce frustration faster.',
      adjustedApproach: 'Lead with acknowledgement, then provide one clear status and one timing checkpoint.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.followThroughLow) {
    return {
      tailoredReason: 'Follow-through trend suggests update promises may not always be landing consistently.',
      adjustedApproach: 'Commit to explicit update timestamps and deliver on each one.',
      focusSkillTag: 'Follow-Through',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Trust trend indicates specificity and proactive updates should be emphasized.',
      adjustedApproach: 'Use precise timing windows and explain dependencies before customer asks.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Pacing trend suggests update rhythm may be too slow for waiting-customer comfort.',
      adjustedApproach: 'Increase update cadence during stalled stages and keep each message concise.',
      focusSkillTag: 'Pacing',
    };
  }

  return {
    tailoredReason: 'Skill profile suggests biggest gain comes from tighter expectation resets and proactive timing updates.',
    adjustedApproach: 'Provide clear stage, timeline, and next update point in each touch.',
    focusSkillTag: 'Trust',
  };
}
