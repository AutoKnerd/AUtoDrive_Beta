import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const TEST_DRIVE_OUTCOMES = [
  'positive',
  'mixed',
  'flat',
  'unclear',
  'negative',
] as const;

export const TEST_DRIVE_ENERGY = [
  'excited',
  'interested',
  'neutral',
  'distant',
] as const;

export const TEST_DRIVE_REACTIONS = [
  'likes vehicle',
  'unsure on fit',
  'worried about payment',
  'comparing options',
  'not opening up',
  'no strong reaction',
] as const;

export const TEST_DRIVE_NEXT_GOALS = [
  'move to numbers',
  'clarify hesitation',
  'confirm fit',
  'create urgency',
  'set next appointment',
] as const;

export type TestDriveOutcome = typeof TEST_DRIVE_OUTCOMES[number];
export type TestDriveEnergy = typeof TEST_DRIVE_ENERGY[number];
export type TestDriveReaction = typeof TEST_DRIVE_REACTIONS[number];
export type TestDriveNextGoal = typeof TEST_DRIVE_NEXT_GOALS[number];

export type TestDriveDebriefInput = {
  outcome: TestDriveOutcome;
  energy: TestDriveEnergy;
  reaction: TestDriveReaction;
  nextGoal?: TestDriveNextGoal;
};

export type TestDriveDebriefPlan = {
  bestDebriefAngle: string;
  sayThis: string;
  askThis: string;
  nextMove: string;
  doNotDoThis: string;
};

export type TestDriveDebriefSprocketEnhancement = {
  likelyMissedSignal: string;
  sharperDebrief: string;
  naturalRewrite: string;
  coaching: string;
};

export type TestDriveDebriefCxEnhancement = {
  tailoredReason: string;
  adjustedDebrief: string;
  focusSkillTag: 'Listening' | 'Pacing' | 'Trust' | 'Confidence';
};

export type TestDriveDebriefSavedScenario = {
  id: string;
  createdAt: string;
  outcome: TestDriveOutcome;
  energy: TestDriveEnergy;
  reaction: TestDriveReaction;
  nextGoal: TestDriveNextGoal;
  bestDebriefAngle: string;
  sayThis: string;
  askThis: string;
  nextMove: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_OUTCOME: Record<TestDriveOutcome, TestDriveDebriefPlan> = {
  positive: {
    bestDebriefAngle: 'Capture emotional buy-in, then connect it to practical next step.',
    sayThis: 'Great drive. Let us lock in what felt strongest so your next step stays clear.',
    askThis: 'What stood out most in a way that matters to your daily driving?',
    nextMove: 'Bridge to numbers with one confidence-confirming checkpoint.',
    doNotDoThis: 'Do not skip recap and rush straight into hard close language.',
  },
  mixed: {
    bestDebriefAngle: 'Validate positives and isolate one unresolved concern.',
    sayThis: 'Sounds like parts felt right and one piece still feels open. Let us isolate that first.',
    askThis: 'If we solve one thing now, what would make this a stronger fit?',
    nextMove: 'Clarify blocker, then choose whether to move to numbers or compare alternatives.',
    doNotDoThis: 'Do not defend objections before confirming what feels off.',
  },
  flat: {
    bestDebriefAngle: 'Rebuild engagement with specific discovery before pushing forward.',
    sayThis: 'No pressure, let us quickly check whether this is close or we should adjust direction.',
    askThis: 'What did you expect to feel in the drive that did not show up yet?',
    nextMove: 'Run a fit reset and decide on next vehicle or adjusted path.',
    doNotDoThis: 'Do not assume silence means agreement.',
  },
  unclear: {
    bestDebriefAngle: 'Use concise diagnostic questions to uncover real reaction.',
    sayThis: 'Let us keep this simple and make sure we are clear before the next step.',
    askThis: 'Are you closer to yes, closer to no, or still missing one key piece?',
    nextMove: 'Diagnose true stance, then bridge accordingly.',
    doNotDoThis: 'Do not move to numbers without clarity on reaction.',
  },
  negative: {
    bestDebriefAngle: 'Lower pressure, acknowledge miss, and recover trust quickly.',
    sayThis: 'I appreciate the honest reaction. Let us use it to get you to a better fit.',
    askThis: 'What felt most wrong so we can avoid repeating it?',
    nextMove: 'Pivot to alternative fit path or low-pressure next appointment.',
    doNotDoThis: 'Do not try to force momentum on a poor-fit response.',
  },
};

const ENERGY_ADJUSTMENTS: Record<TestDriveEnergy, Partial<TestDriveDebriefPlan>> = {
  excited: {
    nextMove: 'Convert momentum while excitement is real by confirming fit then moving to numbers.',
  },
  interested: {},
  neutral: {
    askThis: 'What would you need to see next to feel confident about moving forward?',
  },
  distant: {
    bestDebriefAngle: 'Use low-pressure debrief to reopen engagement before any ask.',
    sayThis: 'No rush at all. I just want to understand what felt off for you.',
    doNotDoThis: 'Do not push a commitment ask while customer remains distant.',
  },
};

const REACTION_ADJUSTMENTS: Partial<Record<TestDriveReaction, Partial<TestDriveDebriefPlan>>> = {
  'likes vehicle': {
    nextMove: 'Confirm fit and move to numbers with confidence.',
  },
  'unsure on fit': {
    bestDebriefAngle: 'Clarify fit uncertainty before discussing structure.',
    askThis: 'Which part of fit still feels uncertain right now?',
  },
  'worried about payment': {
    askThis: 'Would you like to define a comfortable payment range before reviewing options?',
    nextMove: 'Bridge to payment-fit conversation without defending too early.',
  },
  'comparing options': {
    bestDebriefAngle: 'Guide comparison criteria and keep decision path structured.',
    askThis: 'What top two criteria should we compare against your other option?',
  },
  'not opening up': {
    sayThis: 'I can keep this to one quick question so we do not overcomplicate it.',
    askThis: 'What is the one thing you are still evaluating before deciding next step?',
  },
  'no strong reaction': {
    bestDebriefAngle: 'Create a clear reaction checkpoint to avoid drifting momentum.',
  },
};

const GOAL_ADJUSTMENTS: Partial<Record<TestDriveNextGoal, Partial<TestDriveDebriefPlan>>> = {
  'move to numbers': {
    nextMove: 'Transition to numbers after one explicit fit confirmation.',
  },
  'clarify hesitation': {
    askThis: 'What specific hesitation should we solve first so this gets easier?',
  },
  'confirm fit': {
    bestDebriefAngle: 'Reconfirm must-haves and map them to what they just experienced.',
  },
  'create urgency': {
    nextMove: 'Use low-pressure urgency tied to relevance, not fear-based pushing.',
    doNotDoThis: 'Do not force urgency before confirming buy-in.',
  },
  'set next appointment': {
    nextMove: 'Offer two short follow-up times and confirm one.',
  },
};

export function getTestDriveDebriefPlan(input: TestDriveDebriefInput): TestDriveDebriefPlan {
  const base = BASE_BY_OUTCOME[input.outcome];
  const energy = ENERGY_ADJUSTMENTS[input.energy];
  const reaction = REACTION_ADJUSTMENTS[input.reaction];
  const goal = input.nextGoal ? GOAL_ADJUSTMENTS[input.nextGoal] : undefined;

  return {
    bestDebriefAngle: goal?.bestDebriefAngle || reaction?.bestDebriefAngle || energy.bestDebriefAngle || base.bestDebriefAngle,
    sayThis: goal?.sayThis || reaction?.sayThis || energy.sayThis || base.sayThis,
    askThis: goal?.askThis || reaction?.askThis || energy.askThis || base.askThis,
    nextMove: goal?.nextMove || reaction?.nextMove || energy.nextMove || base.nextMove,
    doNotDoThis: goal?.doNotDoThis || reaction?.doNotDoThis || energy.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketTestDriveDebriefEnhancement(
  input: TestDriveDebriefInput,
  base: TestDriveDebriefPlan
): TestDriveDebriefSprocketEnhancement {
  const likelyMissedSignal =
    input.reaction === 'not opening up' || input.outcome === 'unclear'
      ? 'Customer signals were weak because they were not asked a clear diagnostic question fast enough.'
      : input.reaction === 'worried about payment'
        ? 'Payment concern surfaced before value confidence was fully confirmed.'
        : 'Momentum risk is likely tied to insufficient post-drive clarity before moving forward.';

  return {
    likelyMissedSignal,
    sharperDebrief: `${base.bestDebriefAngle} Keep the debrief to one statement and one question.`,
    naturalRewrite: `Try this: ${base.sayThis}`,
    coaching: 'Pause for 2-3 seconds after your question. Let them speak first before any explanation.',
  };
}

type SkillSignals = {
  listeningLow: boolean;
  pacingLow: boolean;
  trustLow: boolean;
  confidenceLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const listening = readCxStatScore(stats?.listening, 60);
  const pacing = readCxStatScore(stats?.followUp, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const confidence = readCxStatScore(stats?.closing, 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    pacingLow: pacing > 0 && pacing < 55,
    trustLow: trust > 0 && trust < 55,
    confidenceLow: confidence > 0 && confidence < 55,
  };
}

export function getAutoDriveCxTestDriveDebriefEnhancement(
  input: TestDriveDebriefInput,
  base: TestDriveDebriefPlan,
  user?: User | null
): TestDriveDebriefCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored for your listening trend: question-first debriefs improve signal quality.',
      adjustedDebrief: 'Ask one concise diagnostic question before suggesting any next move.',
      focusSkillTag: 'Listening',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored for your pacing trend: slower debrief sequencing increases response depth.',
      adjustedDebrief: 'Use statement -> pause -> question -> pause to prevent rushing into the next step.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: transparency language lowers post-drive resistance.',
      adjustedDebrief: `${base.sayThis} Add a line confirming they stay in control of the decision pace.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.confidenceLow) {
    return {
      tailoredReason: 'Tailored for your confidence trend: clear framing helps move to the next step without sounding tentative.',
      adjustedDebrief: 'Use direct next-step framing after confirming reaction in one sentence.',
      focusSkillTag: 'Confidence',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced clarity-first debrief flow is recommended.',
    adjustedDebrief: base.bestDebriefAngle,
    focusSkillTag: 'Pacing',
  };
}
