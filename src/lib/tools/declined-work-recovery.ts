import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const DECLINED_WORK_TYPES = [
  'maintenance',
  'safety item',
  'wear item',
  'diagnostic recommendation',
  'bundled work',
] as const;

export const DECLINED_WORK_TIMING = [
  'same visit',
  '1 to 7 days',
  '2 to 4 weeks',
  'months later',
] as const;

export const DECLINED_WORK_URGENCY = [
  'low',
  'medium',
  'high',
  'safety concern',
] as const;

export const DECLINED_WORK_ATTITUDE = [
  'price-sensitive',
  'skeptical',
  'neutral',
  'trusting',
  'annoyed',
] as const;

export type DeclinedWorkType = typeof DECLINED_WORK_TYPES[number];
export type DeclinedWorkTiming = typeof DECLINED_WORK_TIMING[number];
export type DeclinedWorkUrgency = typeof DECLINED_WORK_URGENCY[number];
export type DeclinedWorkAttitude = typeof DECLINED_WORK_ATTITUDE[number];

export type DeclinedWorkRecoveryInput = {
  workType: DeclinedWorkType;
  timeSinceDecline: DeclinedWorkTiming;
  urgency: DeclinedWorkUrgency;
  customerAttitude: DeclinedWorkAttitude;
};

export type DeclinedWorkRecoveryPlan = {
  bestReEntryAngle: string;
  sayThis: string;
  askThis: string;
  whyNow: string;
  doNotDoThis: string;
};

export type DeclinedWorkRecoverySprocketEnhancement = {
  likelyDeclineReason: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  strongerRecoveryFraming: string;
};

export type DeclinedWorkRecoveryCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Objection Handling' | 'Follow-Up';
};

export type DeclinedWorkRecoverySavedScenario = {
  id: string;
  createdAt: string;
  workType: DeclinedWorkType;
  timeSinceDecline: DeclinedWorkTiming;
  urgency: DeclinedWorkUrgency;
  customerAttitude: DeclinedWorkAttitude;
  bestReEntryAngle: string;
  sayThis: string;
  askThis: string;
  whyNow: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_WORK_TYPE: Record<DeclinedWorkType, DeclinedWorkRecoveryPlan> = {
  maintenance: {
    bestReEntryAngle: 'Re-enter with prevention framing and ownership convenience.',
    sayThis: 'When we last saw your vehicle, this maintenance was deferred. I wanted to reconnect before it becomes a larger issue.',
    askThis: 'Would you like to handle this while it is still straightforward and predictable?',
    whyNow: 'Routine items are typically lower-cost and simpler before they escalate.',
    doNotDoThis: 'Do not treat maintenance follow-up like a hard sales ask.',
  },
  'safety item': {
    bestReEntryAngle: 'Lead with safety impact in plain language and immediate clarity.',
    sayThis: 'This item was previously declined, and it affects safe operation, so I wanted to check in right away.',
    askThis: 'Can we revisit this now so the vehicle stays safe for you and your family?',
    whyNow: 'Safety-related concerns can worsen quickly and raise risk.',
    doNotDoThis: 'Do not downplay safety concern urgency.',
  },
  'wear item': {
    bestReEntryAngle: 'Show progression risk without pressure or guilt.',
    sayThis: 'This wear item was deferred, and I want to help you avoid a higher-cost outcome if it progresses.',
    askThis: 'Would it help to review where this currently stands and what delay could change?',
    whyNow: 'Wear items usually cost less to address before failure.',
    doNotDoThis: 'Do not use fear-based language.',
  },
  'diagnostic recommendation': {
    bestReEntryAngle: 'Position as clarity step, not immediate spend commitment.',
    sayThis: 'We previously recommended diagnostics so you could get a clear answer before deciding next repair steps.',
    askThis: 'Are you open to diagnostics first so we avoid guessing and repeated visits?',
    whyNow: 'Diagnosis early reduces misrepair risk and wasted time.',
    doNotDoThis: 'Do not imply final repair cost certainty before diagnostics.',
  },
  'bundled work': {
    bestReEntryAngle: 'Break bundle into priorities and practical sequencing.',
    sayThis: 'When this was declined, it was grouped together. We can revisit it in a simpler priority order.',
    askThis: 'Would you like to start with the highest-impact item and stage the rest?',
    whyNow: 'Phased planning improves affordability while still reducing risk.',
    doNotDoThis: 'Do not insist on all-or-nothing bundle approval.',
  },
};

const TIMING_ADJUSTMENTS: Partial<Record<DeclinedWorkTiming, Partial<DeclinedWorkRecoveryPlan>>> = {
  'same visit': {
    bestReEntryAngle: 'Use low-pressure same-visit clarity while context is fresh.',
  },
  '1 to 7 days': {
    sayThis: 'Quick follow-up while your recent visit details are still fresh.',
  },
  '2 to 4 weeks': {
    bestReEntryAngle: 'Re-enter with practical update and ownership-support tone.',
  },
  'months later': {
    bestReEntryAngle: 'Use respectful reactivation framing with current-condition check.',
    askThis: 'Would you like a fresh check so you can decide based on current condition?',
  },
};

const URGENCY_ADJUSTMENTS: Partial<Record<DeclinedWorkUrgency, Partial<DeclinedWorkRecoveryPlan>>> = {
  low: {},
  medium: {
    whyNow: 'Addressing this sooner usually avoids added cost and downtime.',
  },
  high: {
    bestReEntryAngle: 'Balance urgency with calm, practical explanation.',
    sayThis: 'This item is moving toward a bigger issue, so this is the best time to revisit it.',
  },
  'safety concern': {
    bestReEntryAngle: 'Prioritize safety and immediate risk reduction.',
    askThis: 'Can we prioritize this now so your vehicle remains safe to drive?',
    doNotDoThis: 'Do not frame safety concerns as optional convenience.',
  },
};

const ATTITUDE_ADJUSTMENTS: Partial<Record<DeclinedWorkAttitude, Partial<DeclinedWorkRecoveryPlan>>> = {
  'price-sensitive': {
    askThis: 'Would a phased plan help, starting with the highest-priority item first?',
    doNotDoThis: 'Do not lead with total cost before value and consequence.',
  },
  skeptical: {
    bestReEntryAngle: 'Use transparent evidence-first language.',
    askThis: 'Would you like to review exactly what changed so you can decide confidently?',
  },
  neutral: {},
  trusting: {
    askThis: 'Would you like us to take care of this now while your vehicle is here?',
  },
  annoyed: {
    bestReEntryAngle: 'Acknowledge frustration and keep message concise and respectful.',
    sayThis: 'I want to keep this simple and helpful. This follow-up is just to avoid a bigger inconvenience later.',
    doNotDoThis: 'Do not sound scripted or pushy.',
  },
};

export function getDeclinedWorkRecoveryPlan(input: DeclinedWorkRecoveryInput): DeclinedWorkRecoveryPlan {
  const base = BASE_BY_WORK_TYPE[input.workType];
  const timing = TIMING_ADJUSTMENTS[input.timeSinceDecline];
  const urgency = URGENCY_ADJUSTMENTS[input.urgency];
  const attitude = ATTITUDE_ADJUSTMENTS[input.customerAttitude];

  return {
    bestReEntryAngle: attitude?.bestReEntryAngle || urgency?.bestReEntryAngle || timing?.bestReEntryAngle || base.bestReEntryAngle,
    sayThis: attitude?.sayThis || urgency?.sayThis || timing?.sayThis || base.sayThis,
    askThis: attitude?.askThis || urgency?.askThis || timing?.askThis || base.askThis,
    whyNow: attitude?.whyNow || urgency?.whyNow || timing?.whyNow || base.whyNow,
    doNotDoThis: attitude?.doNotDoThis || urgency?.doNotDoThis || timing?.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketDeclinedWorkRecoveryEnhancement(
  input: DeclinedWorkRecoveryInput,
  base: DeclinedWorkRecoveryPlan
): DeclinedWorkRecoverySprocketEnhancement {
  const likelyDeclineReason =
    input.customerAttitude === 'price-sensitive'
      ? 'The prior decline was likely affordability uncertainty, not complete rejection.'
      : input.customerAttitude === 'skeptical'
        ? 'The prior decline likely came from low confidence in necessity.'
        : input.timeSinceDecline === 'months later'
          ? 'Momentum faded and the item was deprioritized over time.'
          : 'The prior decline likely came from timing friction, not total refusal.';

  return {
    likelyDeclineReason,
    naturalRewrite: `Try this: ${base.sayThis}`,
    deliveryCoaching: 'Open with one clear context line, then one why-now line, then one question. Pause for response.',
    strongerRecoveryFraming: `${base.bestReEntryAngle} Keep the tone advisory and helpful, not persuasive-heavy.`,
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  objectionLow: boolean;
  followUpLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const objection = readCxStatScore(stats?.closing, 60);
  const followUp = readCxStatScore(stats?.followUp, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    objectionLow: objection > 0 && objection < 55,
    followUpLow: followUp > 0 && followUp < 55,
  };
}

export function getAutoDriveCxDeclinedWorkRecoveryEnhancement(
  input: DeclinedWorkRecoveryInput,
  base: DeclinedWorkRecoveryPlan,
  user?: User | null
): DeclinedWorkRecoveryCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: transparency-first recovery improves acceptance.',
      adjustedApproach: 'Lead with what changed since decline, then provide one clear recommendation.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: lower-pressure wording improves customer receptiveness.',
      adjustedApproach: 'Use short, calm language and avoid urgency stacking.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.objectionLow) {
    return {
      tailoredReason: 'Tailored for your objection-handling trend: clearer structure prevents defensive back-and-forth.',
      adjustedApproach: 'Use issue -> consequence -> choice format before asking for approval.',
      focusSkillTag: 'Objection Handling',
    };
  }
  if (signal.followUpLow) {
    return {
      tailoredReason: 'Tailored for your follow-up consistency trend: predictable cadence improves recovery outcomes.',
      adjustedApproach: 'Set one specific follow-up checkpoint in every declined-work outreach.',
      focusSkillTag: 'Follow-Up',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced, low-pressure re-entry is recommended.',
    adjustedApproach: base.bestReEntryAngle,
    focusSkillTag: 'Follow-Up',
  };
}
