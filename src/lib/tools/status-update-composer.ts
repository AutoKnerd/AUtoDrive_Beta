import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const STATUS_JOB_STATES = [
  'vehicle checked in',
  'inspection in progress',
  'waiting on technician',
  'waiting on parts',
  'repair underway',
  'completed',
  'delayed',
  'additional work found',
] as const;

export const STATUS_REASONS = [
  'routine update',
  'delay',
  'extra repair approval',
  'pickup ready',
  'timeline changed',
] as const;

export const STATUS_SENSITIVITY = [
  'calm',
  'anxious',
  'upset',
  'rushed',
  'high-maintenance',
] as const;

export const STATUS_CHANNELS = [
  'text',
  'call',
  'voicemail',
  'email',
] as const;

export type StatusJobState = typeof STATUS_JOB_STATES[number];
export type StatusReason = typeof STATUS_REASONS[number];
export type StatusSensitivity = typeof STATUS_SENSITIVITY[number];
export type StatusChannel = typeof STATUS_CHANNELS[number];

export type StatusUpdateInput = {
  jobStatus: StatusJobState;
  reason: StatusReason;
  customerSensitivity: StatusSensitivity;
  channel: StatusChannel;
};

export type StatusUpdatePlan = {
  bestUpdateStructure: string;
  sayThis: string;
  setThisExpectation: string;
  nextStep: string;
  doNotSayThis: string;
};

export type StatusUpdateSprocketEnhancement = {
  betterTone: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  likelyReactionPrep: string;
};

export type StatusUpdateCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Pacing' | 'Consistency';
};

export type StatusUpdateSavedScenario = {
  id: string;
  createdAt: string;
  jobStatus: StatusJobState;
  reason: StatusReason;
  customerSensitivity: StatusSensitivity;
  channel: StatusChannel;
  bestUpdateStructure: string;
  sayThis: string;
  setThisExpectation: string;
  nextStep: string;
  doNotSayThis: string;
  favorite?: boolean;
};

const BASE_BY_REASON: Record<StatusReason, StatusUpdatePlan> = {
  'routine update': {
    bestUpdateStructure: 'Current status -> what is happening now -> clear next timestamp.',
    sayThis: 'Quick update: your vehicle is currently in progress, and we are moving through the planned service steps.',
    setThisExpectation: 'I will send your next update by [time] even if there is no major change.',
    nextStep: 'Confirm next checkpoint time and keep update cadence consistent.',
    doNotSayThis: 'Do not send vague updates like "still working on it."',
  },
  delay: {
    bestUpdateStructure: 'Acknowledge delay -> explain reason plainly -> give revised timing.',
    sayThis: 'I want to keep you updated right away: we hit a delay, and here is what changed.',
    setThisExpectation: 'Revised estimate is [time], and I will update you again by [next time].',
    nextStep: 'Offer one practical option if delay extends.',
    doNotSayThis: 'Do not hide delays until the customer asks.',
  },
  'extra repair approval': {
    bestUpdateStructure: 'State finding -> why it matters now -> approval request with clear options.',
    sayThis: 'During service, we found an additional item that may need approval before we continue.',
    setThisExpectation: 'If approved now, completion stays close to schedule; if not, we can proceed with original scope.',
    nextStep: 'Ask for decision and confirm impact on timeline.',
    doNotSayThis: 'Do not ask for approval without explaining consequence.',
  },
  'pickup ready': {
    bestUpdateStructure: 'Confirm completion -> summarize what was done -> set pickup logistics.',
    sayThis: 'Good news, your vehicle is ready for pickup.',
    setThisExpectation: 'Pickup window is [time range], and we will review completed work at handoff.',
    nextStep: 'Confirm pickup ETA and any remaining customer questions.',
    doNotSayThis: 'Do not send "done" without pickup details.',
  },
  'timeline changed': {
    bestUpdateStructure: 'Explain what changed -> why it changed -> new timeline and next check-in.',
    sayThis: 'I want to keep this clear: the timeline changed, and I want to walk you through it quickly.',
    setThisExpectation: 'New completion target is [time], with next update by [checkpoint].',
    nextStep: 'Reconfirm customer schedule constraints and adjust if needed.',
    doNotSayThis: 'Do not overpromise recovery timing you cannot control.',
  },
};

const STATUS_ADJUSTMENTS: Partial<Record<StatusJobState, Partial<StatusUpdatePlan>>> = {
  'waiting on parts': {
    sayThis: 'Your vehicle is paused while we wait on parts, and I want to keep you fully informed.',
    nextStep: 'Share part ETA and next confirmation point.',
  },
  delayed: {
    bestUpdateStructure: 'Acknowledge delay quickly -> clarify cause -> reset expectation.',
  },
  'additional work found': {
    askThis: undefined as never, // no-op placeholder; handled via reason adjustments
  },
  completed: {
    setThisExpectation: 'Vehicle is complete and ready. I can confirm pickup details now.',
  },
};

const SENSITIVITY_ADJUSTMENTS: Partial<Record<StatusSensitivity, Partial<StatusUpdatePlan>>> = {
  calm: {},
  anxious: {
    sayThis: 'I want to make this easy to follow, so here is exactly where things stand right now.',
    setThisExpectation: 'You will hear from me again by [time], even if status is unchanged.',
  },
  upset: {
    bestUpdateStructure: 'Acknowledge frustration -> clarify facts -> set concrete next expectation.',
    doNotSayThis: 'Do not sound defensive or dismissive.',
  },
  rushed: {
    sayThis: 'Quick headline update: here is current status and the next exact time you will hear from me.',
  },
  'high-maintenance': {
    setThisExpectation: 'I will send proactive checkpoints at defined times to keep this predictable.',
  },
};

const CHANNEL_ADJUSTMENTS: Record<StatusChannel, Partial<StatusUpdatePlan>> = {
  text: {
    bestUpdateStructure: '2-3 short lines: status, impact, next timestamp.',
  },
  call: {
    bestUpdateStructure: 'Open with status headline, explain change, confirm customer understanding.',
  },
  voicemail: {
    bestUpdateStructure: 'Single concise message: status, action needed, callback or next update time.',
  },
  email: {
    bestUpdateStructure: 'Subject + clear bullet summary + explicit next step.',
  },
};

export function getStatusUpdatePlan(input: StatusUpdateInput): StatusUpdatePlan {
  const base = BASE_BY_REASON[input.reason];
  const status = STATUS_ADJUSTMENTS[input.jobStatus];
  const sensitivity = SENSITIVITY_ADJUSTMENTS[input.customerSensitivity];
  const channel = CHANNEL_ADJUSTMENTS[input.channel];

  return {
    bestUpdateStructure: channel.bestUpdateStructure || sensitivity?.bestUpdateStructure || status?.bestUpdateStructure || base.bestUpdateStructure,
    sayThis: sensitivity?.sayThis || status?.sayThis || channel.sayThis || base.sayThis,
    setThisExpectation: sensitivity?.setThisExpectation || status?.setThisExpectation || channel.setThisExpectation || base.setThisExpectation,
    nextStep: sensitivity?.nextStep || status?.nextStep || channel.nextStep || base.nextStep,
    doNotSayThis: sensitivity?.doNotSayThis || status?.doNotSayThis || channel.doNotSayThis || base.doNotSayThis,
  };
}

export function getSprocketStatusUpdateEnhancement(
  input: StatusUpdateInput,
  base: StatusUpdatePlan
): StatusUpdateSprocketEnhancement {
  const betterTone =
    input.customerSensitivity === 'upset' || input.customerSensitivity === 'anxious'
      ? 'Use calm, accountability-forward wording with clear timing.'
      : 'Keep updates concise, specific, and action-oriented.';

  const likelyReactionPrep =
    input.reason === 'delay' || input.reason === 'timeline changed'
      ? 'Customer may challenge timing reliability; be ready with next confirmed checkpoint.'
      : input.reason === 'extra repair approval'
        ? 'Customer may resist added cost; be ready to explain risk and options simply.'
        : 'Customer likely wants clarity on what happens next.';

  return {
    betterTone,
    naturalRewrite: `Try this: ${base.sayThis}`,
    deliveryCoaching: 'Lead with status in first sentence. Keep technical terms minimal and always end with next expectation.',
    likelyReactionPrep,
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  pacingLow: boolean;
  consistencyLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const pacing = readCxStatScore(stats?.followUp, 60);
  const consistency = readCxStatScore(stats?.followUp, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    pacingLow: pacing > 0 && pacing < 55,
    consistencyLow: consistency > 0 && consistency < 55,
  };
}

export function getAutoDriveCxStatusUpdateEnhancement(
  input: StatusUpdateInput,
  base: StatusUpdatePlan,
  user?: User | null
): StatusUpdateCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: proactive timing commitments improve reliability perception.',
      adjustedApproach: `${base.setThisExpectation} Keep each checkpoint explicit and on time.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: softer, customer-centered language reduces frustration.',
      adjustedApproach: 'Use calm wording, acknowledge inconvenience, then provide concrete next step.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored for your pacing trend: shorter updates with fixed checkpoints improve clarity.',
      adjustedApproach: 'Keep each update brief and avoid stacking multiple explanations in one message.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.consistencyLow) {
    return {
      tailoredReason: 'Tailored for your consistency trend: predictable update rhythm increases confidence.',
      adjustedApproach: 'Set and keep the next update time in every message.',
      focusSkillTag: 'Consistency',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced, predictable updates are recommended.',
    adjustedApproach: base.bestUpdateStructure,
    focusSkillTag: 'Consistency',
  };
}
