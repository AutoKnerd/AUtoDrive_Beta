import type { User } from '@/lib/definitions';

export const COACHING_OBSERVED_ISSUES = [
  'weak greeting',
  'poor needs assessment',
  'weak test drive transition',
  'bad number presentation',
  'poor objection handling',
  'weak follow-up',
  'awkward handoff',
  'too much talking',
  'no clear close',
] as const;

export const COACHING_DEAL_STAGES = [
  'early',
  'middle',
  'late',
  'after lost deal',
] as const;

export const COACHING_SEVERITIES = [
  'minor',
  'moderate',
  'major',
] as const;

export const COACHING_REP_EXPERIENCE = [
  'new',
  'developing',
  'experienced',
] as const;

export type CoachingObservedIssue = typeof COACHING_OBSERVED_ISSUES[number];
export type CoachingDealStage = typeof COACHING_DEAL_STAGES[number];
export type CoachingSeverity = typeof COACHING_SEVERITIES[number];
export type CoachingRepExperience = typeof COACHING_REP_EXPERIENCE[number];

export type TeamCoachingInput = {
  observedIssue: CoachingObservedIssue;
  dealStage: CoachingDealStage;
  severity: CoachingSeverity;
  repExperience: CoachingRepExperience;
};

export type TeamCoachingPlan = {
  likelyRootCause: string;
  coachBackMessage: string;
  doThisNextTime: string;
  practiceFocus: string;
  doNotSayThis: string;
};

export type TeamCoachingSprocketEnhancement = {
  likelyBlindSpot: string;
  betterCoachingPhrasing: string;
  developmentalRewrite: string;
  managerDeliveryCoaching: string;
};

export type TeamCoachingCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Coaching' | 'Trust' | 'Tone' | 'Listening';
};

export type TeamCoachingSavedScenario = {
  id: string;
  createdAt: string;
  observedIssue: CoachingObservedIssue;
  dealStage: CoachingDealStage;
  severity: CoachingSeverity;
  repExperience: CoachingRepExperience;
  likelyRootCause: string;
  coachBackMessage: string;
  doThisNextTime: string;
  practiceFocus: string;
  doNotSayThis: string;
  favorite?: boolean;
};

const BASE_BY_ISSUE: Record<CoachingObservedIssue, TeamCoachingPlan> = {
  'weak greeting': {
    likelyRootCause: 'Rep is opening with info-dump instead of trust-first connection.',
    coachBackMessage: 'Your first 30 seconds should lower guard, not push process. Start human, then guide.',
    doThisNextTime: 'Lead with one calm rapport line, then ask one relevance question before moving forward.',
    practiceFocus: 'Run 3 greeting reps using one-line opener + one question only.',
    doNotSayThis: 'Do not say: "You need more energy up front."',
  },
  'poor needs assessment': {
    likelyRootCause: 'Rep is collecting facts but missing motive and decision criteria.',
    coachBackMessage: 'You asked questions, but not the ones that uncover buying drivers.',
    doThisNextTime: 'Ask what matters most, what must be true, and what would make this a clear yes.',
    practiceFocus: 'Practice a 4-question discovery sequence focused on priorities, not specs.',
    doNotSayThis: 'Do not say: "You skipped the script."',
  },
  'weak test drive transition': {
    likelyRootCause: 'Rep is not converting experience into an ownership decision moment.',
    coachBackMessage: 'You let momentum flatten after the drive instead of debriefing decisively.',
    doThisNextTime: 'Confirm emotional fit first, then ask for one concern before moving to next step.',
    practiceFocus: 'Practice a post-drive debrief: confirm, clarify, then commit.',
    doNotSayThis: 'Do not say: "You should have closed right after the drive."',
  },
  'bad number presentation': {
    likelyRootCause: 'Rep is presenting numbers too quickly without value framing.',
    coachBackMessage: 'Slow the sequence down: frame value, then structure numbers, then ask for reaction.',
    doThisNextTime: 'Use one clear path and pause for reaction before defending anything.',
    practiceFocus: 'Practice one clean pencil presentation with a forced pause.',
    doNotSayThis: 'Do not say: "You sounded weak on price."',
  },
  'poor objection handling': {
    likelyRootCause: 'Rep is answering the surface objection before diagnosing the real concern.',
    coachBackMessage: 'Treat objections as signals. Clarify first, then respond with precision.',
    doThisNextTime: 'Ask one diagnostic question before giving any explanation or solution.',
    practiceFocus: 'Run objection drills focused on diagnose before defend.',
    doNotSayThis: 'Do not say: "You just need to push harder."',
  },
  'weak follow-up': {
    likelyRootCause: 'Rep lacks cadence discipline and message variation.',
    coachBackMessage: 'Your follow-up needs structure: timing, purpose, and progression.',
    doThisNextTime: 'Set a 5-touch cadence with varied channels and one clear objective per touch.',
    practiceFocus: 'Build and execute one complete follow-up cadence for current leads.',
    doNotSayThis: 'Do not say: "You are bad at follow-up."',
  },
  'awkward handoff': {
    likelyRootCause: 'Rep is introducing the next person without framing customer benefit.',
    coachBackMessage: 'Handoff should feel like support, not escalation or loss of control.',
    doThisNextTime: 'Set expectation, explain benefit, then reinforce continuity in front of customer.',
    practiceFocus: 'Practice a 20-second handoff setup with manager/finance introduction.',
    doNotSayThis: 'Do not say: "Stop making it weird when I come in."',
  },
  'too much talking': {
    likelyRootCause: 'Rep is over-explaining due to uncertainty and missing pause discipline.',
    coachBackMessage: 'Shorter statements and better questions will increase control and trust.',
    doThisNextTime: 'Cut explanation length in half and ask one clear question before continuing.',
    practiceFocus: 'Run two-minute roleplays with a strict talk-time cap and pause checkpoints.',
    doNotSayThis: 'Do not say: "You talk way too much."',
  },
  'no clear close': {
    likelyRootCause: 'Rep is avoiding direct commitment asks after value is established.',
    coachBackMessage: 'You earned the right to ask; now ask clearly and confidently.',
    doThisNextTime: 'Use a single commitment question tied to the customer\'s stated priorities.',
    practiceFocus: 'Practice three clear close asks with calm tone and one fallback step.',
    doNotSayThis: 'Do not say: "You cannot close."',
  },
};

const STAGE_ADJUSTMENTS: Partial<Record<CoachingDealStage, Partial<TeamCoachingPlan>>> = {
  early: {
    likelyRootCause: 'Breakdown happened in foundation behaviors before deal momentum formed.',
  },
  middle: {
    doThisNextTime: 'Reset with one clarifying question, then re-establish a single next step.',
  },
  late: {
    practiceFocus: 'Practice late-stage commitment language with lower pressure and clearer structure.',
  },
  'after lost deal': {
    coachBackMessage: 'Use this as a clean debrief: identify one behavior to keep and one to change immediately.',
    doThisNextTime: 'Run a short post-mortem, then roleplay the missed moment before the next ups.',
  },
};

const SEVERITY_ADJUSTMENTS: Partial<Record<CoachingSeverity, Partial<TeamCoachingPlan>>> = {
  minor: {
    practiceFocus: 'Micro-drill this one behavior for 5 minutes before next customer.',
  },
  moderate: {},
  major: {
    coachBackMessage: 'This needs a hard reset today: simplify process and execute one repeatable structure.',
    doNotSayThis: 'Do not give broad criticism without a concrete fix path.',
  },
};

const EXPERIENCE_ADJUSTMENTS: Partial<Record<CoachingRepExperience, Partial<TeamCoachingPlan>>> = {
  new: {
    doThisNextTime: 'Use a simple checklist version of this behavior until confidence builds.',
    practiceFocus: 'One short live drill now, then immediate repetition on next opportunity.',
  },
  developing: {},
  experienced: {
    coachBackMessage: 'You have the base skills. This is about precision and consistency under pressure.',
    doNotSayThis: 'Do not coach this as a beginner issue; treat it as refinement.',
  },
};

export function getTeamCoachingPlan(input: TeamCoachingInput): TeamCoachingPlan {
  const base = BASE_BY_ISSUE[input.observedIssue];
  const stage = STAGE_ADJUSTMENTS[input.dealStage];
  const severity = SEVERITY_ADJUSTMENTS[input.severity];
  const experience = EXPERIENCE_ADJUSTMENTS[input.repExperience];

  return {
    likelyRootCause: severity?.likelyRootCause || stage?.likelyRootCause || experience?.likelyRootCause || base.likelyRootCause,
    coachBackMessage: severity?.coachBackMessage || stage?.coachBackMessage || experience?.coachBackMessage || base.coachBackMessage,
    doThisNextTime: severity?.doThisNextTime || stage?.doThisNextTime || experience?.doThisNextTime || base.doThisNextTime,
    practiceFocus: severity?.practiceFocus || stage?.practiceFocus || experience?.practiceFocus || base.practiceFocus,
    doNotSayThis: severity?.doNotSayThis || stage?.doNotSayThis || experience?.doNotSayThis || base.doNotSayThis,
  };
}

export function getSprocketTeamCoachingEnhancement(
  input: TeamCoachingInput,
  base: TeamCoachingPlan
): TeamCoachingSprocketEnhancement {
  const likelyBlindSpot =
    input.observedIssue === 'too much talking'
      ? 'Rep may be using extra talk to avoid uncertainty and silence.'
      : input.observedIssue === 'poor objection handling'
        ? 'Rep is likely treating objections as attacks instead of data.'
        : input.severity === 'major'
          ? 'Rep is likely overloaded and defaulting to habit instead of process.'
          : 'Rep may lack a repeatable structure for this moment.';

  return {
    likelyBlindSpot,
    betterCoachingPhrasing: `${base.coachBackMessage} Keep feedback behavior-specific and future-focused.`,
    developmentalRewrite: `Try this coach-back: ${base.coachBackMessage}`,
    managerDeliveryCoaching: 'Lead with one observed behavior, one impact, one next rep. Keep tone calm and specific.',
  };
}

type SkillSignals = {
  coachingLow: boolean;
  trustLow: boolean;
  toneLow: boolean;
  listeningLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const coaching = Number(stats?.followUp ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const tone = Number(stats?.closing ?? 60);
  const listening = Number(stats?.listening ?? 60);

  return {
    coachingLow: coaching > 0 && coaching < 55,
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    listeningLow: listening > 0 && listening < 55,
  };
}

export function getAutoDriveCxTeamCoachingEnhancement(
  _input: TeamCoachingInput,
  _base: TeamCoachingPlan,
  user?: User | null
): TeamCoachingCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.coachingLow) {
    return {
      tailoredReason: 'Tailored to your coaching consistency pattern: tighter structure improves adoption.',
      adjustedApproach: 'Deliver coaching with a 60-second frame: observation, correction, immediate rep.',
      focusSkillTag: 'Coaching',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust-building trend: constructive wording increases rep receptivity.',
      adjustedApproach: 'Open with acknowledgement, then pivot to one actionable adjustment.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored to listening trend: asking the rep to self-diagnose improves retention.',
      adjustedApproach: 'Start with "What did you notice there?" before giving correction.',
      focusSkillTag: 'Listening',
    };
  }

  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: calm, shorter coaching language reduces defensiveness.',
      adjustedApproach: 'Use shorter sentences and one key correction per coaching moment.',
      focusSkillTag: 'Tone',
    };
  }

  return {
    tailoredReason: 'Tailored from your current skill profile: keep coaching specific and repeatable.',
    adjustedApproach: 'Stay behavior-specific, then end with one immediate practice rep.',
    focusSkillTag: 'Coaching',
  };
}
