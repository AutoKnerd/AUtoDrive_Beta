import type { AisRoleType } from '@/lib/definitions';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';

export type AisMetricName = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';
export type AisScoreBand = 'Needs Immediate Support' | 'Below Standard' | 'Developing' | 'Strong' | 'Excellent';

export type AisScoreInterpretationInput = {
  roleType: AisRoleType;
  metricName: AisMetricName;
  metricValue: number;
  interactionContext?: string;
  coachingSignals?: string[];
  concernCategory?: string;
  archetypeContext?: string;
};

export type AisScoreInterpretationResult = {
  scoreBand: AisScoreBand;
  displayMeaning: string;
  roleSpecificInterpretation: string;
  feedbackLine: string;
  coachingExample: string;
  recommendedImprovementFocus: string;
};

const ROLE_LABEL: Record<AisRoleType, string> = {
  sales: 'Sales',
  service: 'Service',
  parts: 'Parts',
  fi: 'F&I',
};

const METRIC_LABEL: Record<AisMetricName, string> = {
  empathy: 'Empathy',
  listening: 'Listening',
  trust: 'Trust',
  followUp: 'Follow Up',
  closing: 'Closing',
  relationship: 'Relationship',
};

type RoleMetricMapping = {
  displayMeaning: string;
  strongLine: string;
  developingLine: string;
  lowLine: string;
  coachingExample: string;
  improvementFocus: string;
};

const MAP: Record<AisRoleType, Record<AisMetricName, RoleMetricMapping>> = {
  sales: {
    empathy: {
      displayMeaning: 'How well the consultant reduced pressure and acknowledged buyer emotion.',
      strongLine: 'The buyer felt understood, which kept the conversation comfortable and open.',
      developingLine: 'The buyer stayed somewhat open, but stronger emotional acknowledgment would have lowered pressure earlier.',
      lowLine: 'The conversation felt more transactional than supportive, which increased buyer resistance.',
      coachingExample: 'Acknowledge emotion before pivoting to product details, especially when pressure shows up.',
      improvementFocus: 'Slow down and validate buyer emotion before moving to details.',
    },
    listening: {
      displayMeaning: 'How well the consultant used customer priorities and buying signals.',
      strongLine: 'You kept the conversation connected by building on what the buyer already shared.',
      developingLine: 'You captured some priorities, but stronger recap language would improve flow.',
      lowLine: 'Important buyer priorities were missed, which weakened conversation momentum.',
      coachingExample: 'Repeat back one priority before presenting options.',
      improvementFocus: 'Confirm priorities out loud before recommending.',
    },
    trust: {
      displayMeaning: 'How much confidence the shopper felt in honesty and guidance.',
      strongLine: 'The buyer stayed engaged because your explanations felt steady and credible.',
      developingLine: 'The buyer stayed somewhat open, but stronger confidence-building language would have reduced hesitation.',
      lowLine: 'Buyer confidence dropped when clarity and consistency were missing.',
      coachingExample: 'Reinforce transparency before numbers and check for confidence.',
      improvementFocus: 'Build confidence checkpoints before high-pressure moments.',
    },
    followUp: {
      displayMeaning: 'How well the consultant created a believable path for the next contact or step.',
      strongLine: 'The conversation ended with clear momentum into a realistic next action.',
      developingLine: 'The next step was present, but it could have been clearer and easier to commit to.',
      lowLine: 'The conversation ended without a strong continuation path.',
      coachingExample: 'Lock one specific next contact step before ending.',
      improvementFocus: 'Define one concrete follow-up action every time.',
    },
    closing: {
      displayMeaning: 'How well the consultant guided the buyer toward commitment.',
      strongLine: 'You moved the buyer forward without forcing the pace.',
      developingLine: 'Momentum existed, but clearer commitment language was needed.',
      lowLine: 'The conversation stalled before a confident next-step commitment.',
      coachingExample: 'Ask for a reasonable next step after confirming priorities.',
      improvementFocus: 'Guide a commitment only after trust and discovery are clear.',
    },
    relationship: {
      displayMeaning: 'How well the consultant built comfort, connection, and future relationship potential.',
      strongLine: 'The buyer felt personally connected, which supported momentum and trust.',
      developingLine: 'Rapport was present, but consistency could be stronger through the full interaction.',
      lowLine: 'Connection stayed thin, which limited openness and long-term momentum.',
      coachingExample: 'Add one personal relevance question before transitioning.',
      improvementFocus: 'Strengthen connection before process acceleration.',
    },
  },
  service: {
    empathy: {
      displayMeaning: 'How well the advisor recognized inconvenience, frustration, or concern around repair and timing.',
      strongLine: 'The guest felt acknowledged during a stressful service moment.',
      developingLine: 'The guest was partially reassured, but stronger acknowledgment was needed before process details.',
      lowLine: 'Guest frustration remained high because emotional concerns were not fully addressed.',
      coachingExample: 'Acknowledge inconvenience before discussing repairs or approvals.',
      improvementFocus: 'Lead with reassurance, then move to service steps.',
    },
    listening: {
      displayMeaning: 'How well the advisor used symptoms, concerns, and priorities when explaining next steps.',
      strongLine: 'You reflected the guest’s concerns clearly and kept the service path aligned.',
      developingLine: 'You heard key concerns, but missed opportunities to connect them to the plan.',
      lowLine: 'Guest concerns were not consistently reflected in the service explanation.',
      coachingExample: 'Summarize symptoms and priorities before recommendations.',
      improvementFocus: 'Tie every recommendation back to stated concerns.',
    },
    trust: {
      displayMeaning: 'How much confidence the guest felt in diagnosis, timeline, and explanation.',
      strongLine: 'The guest remained confident because your repair explanation felt clear and believable.',
      developingLine: 'The guest was partially reassured, but stronger clarity around process and timing would have improved confidence.',
      lowLine: 'Trust dropped because diagnosis or timeline communication lacked confidence.',
      coachingExample: 'Clarify diagnosis logic and timeline before asking for approval.',
      improvementFocus: 'Increase clarity on why, how, and when.',
    },
    followUp: {
      displayMeaning: 'How well the advisor reinforced updates, expectations, and continuity.',
      strongLine: 'The guest had a clear update cadence and knew what to expect next.',
      developingLine: 'Update expectations were present, but not yet consistent.',
      lowLine: 'The guest lacked confidence in status continuity and next updates.',
      coachingExample: 'Set explicit update timing before ending the conversation.',
      improvementFocus: 'Commit to clear update timing and ownership.',
    },
    closing: {
      displayMeaning: 'How well the advisor gained approval or commitment to next action.',
      strongLine: 'You guided approval with confidence while keeping the guest comfortable.',
      developingLine: 'Approval movement started, but more confidence checks were needed.',
      lowLine: 'The conversation did not convert into a clear service commitment.',
      coachingExample: 'Confirm comfort with the recommendation before approval ask.',
      improvementFocus: 'Build confidence before asking for commitment.',
    },
    relationship: {
      displayMeaning: 'How well the advisor made the guest feel cared for beyond the transaction.',
      strongLine: 'The guest felt cared for, which improved confidence in the service experience.',
      developingLine: 'Relationship quality was steady, but lacked consistency in key moments.',
      lowLine: 'The interaction felt process-heavy, with limited relational reassurance.',
      coachingExample: 'Use one reassurance statement tied to the guest’s situation.',
      improvementFocus: 'Blend process clarity with guest-centered care language.',
    },
  },
  parts: {
    empathy: {
      displayMeaning: 'How well the counter person acknowledged urgency, confusion, or frustration around availability and fitment.',
      strongLine: 'The customer felt heard even when part constraints were present.',
      developingLine: 'Urgency was recognized, but stronger acknowledgment would reduce tension.',
      lowLine: 'Customer frustration rose because urgency and concern were not fully acknowledged.',
      coachingExample: 'Acknowledge urgency before explaining stock or order constraints.',
      improvementFocus: 'Show urgency alignment before options.',
    },
    listening: {
      displayMeaning: 'How well the counter person responded to the actual request, fitment need, and urgency.',
      strongLine: 'You stayed aligned to the exact request and fitment concern.',
      developingLine: 'Key details were captured, but confirmation could be tighter.',
      lowLine: 'Request details were missed, increasing confusion and rework risk.',
      coachingExample: 'Repeat part need and fitment details before confirming options.',
      improvementFocus: 'Confirm fitment and urgency explicitly.',
    },
    trust: {
      displayMeaning: 'How much confidence the customer felt in parts accuracy, availability, and next-step clarity.',
      strongLine: 'The customer stayed confident because your parts guidance felt accurate and dependable.',
      developingLine: 'Confidence held in parts of the interaction, but stronger certainty language was needed.',
      lowLine: 'Confidence dropped around availability, fitment, or process clarity.',
      coachingExample: 'State what is known clearly, then define next verification step.',
      improvementFocus: 'Increase certainty and transparency around parts process.',
    },
    followUp: {
      displayMeaning: 'How well the counter person set expectations for ETA, pickup, or order status.',
      strongLine: 'The customer had clear expectation of ETA and pickup process.',
      developingLine: 'Follow-up path existed, but timing commitments were not clear enough.',
      lowLine: 'ETA or pickup expectations were vague, reducing confidence.',
      coachingExample: 'Give a concrete ETA update window and contact method.',
      improvementFocus: 'Set precise ETA and status communication cadence.',
    },
    closing: {
      displayMeaning: 'How well the counter person confirmed order, pickup, or action decision.',
      strongLine: 'You finalized the next action cleanly and confidently.',
      developingLine: 'Decision momentum started, but close confirmation was soft.',
      lowLine: 'The interaction ended without a clear order or next-action commitment.',
      coachingExample: 'Confirm order decision and next step before ending.',
      improvementFocus: 'Close with explicit order/pickup confirmation.',
    },
    relationship: {
      displayMeaning: 'How well the counter person created confidence and return-business potential.',
      strongLine: 'The interaction built confidence that supports future return business.',
      developingLine: 'Relationship tone was positive, but consistency can improve.',
      lowLine: 'Interaction felt transactional, limiting repeat-business confidence.',
      coachingExample: 'Add one connection line that reinforces long-term support.',
      improvementFocus: 'Build confidence that extends beyond this transaction.',
    },
  },
  fi: {
    empathy: {
      displayMeaning: 'How well the manager recognized confusion, hesitation, or stress during paperwork and protection discussions.',
      strongLine: 'The buyer felt calmer and more supported during a high-stress decision stage.',
      developingLine: 'The buyer was partially reassured, but stronger emotional acknowledgment would improve comfort.',
      lowLine: 'Buyer tension remained high because concern was not fully acknowledged.',
      coachingExample: 'Acknowledge stress before clarifying product or paperwork options.',
      improvementFocus: 'Lower decision stress through explicit reassurance.',
    },
    listening: {
      displayMeaning: 'How well the manager listened for hesitation, confusion, and decision concerns.',
      strongLine: 'You identified hesitation cues and adapted the explanation effectively.',
      developingLine: 'Some hesitation cues were addressed, but not consistently.',
      lowLine: 'Key hesitation and confusion signals were missed.',
      coachingExample: 'Pause to confirm understanding before moving to the next section.',
      improvementFocus: 'Use active checks for understanding and hesitation.',
    },
    trust: {
      displayMeaning: 'How much confidence the buyer felt in paperwork, explanation, and recommendations.',
      strongLine: 'The buyer stayed more comfortable because your explanation reduced confusion during the decision process.',
      developingLine: 'The buyer remained somewhat open, but more transparency and pacing would build stronger confidence.',
      lowLine: 'Confidence dropped when explanations felt rushed or unclear.',
      coachingExample: 'Clarify purpose and value before requesting signature decisions.',
      improvementFocus: 'Increase transparency and comprehension at each decision point.',
    },
    followUp: {
      displayMeaning: 'How well the manager reinforced what happens next after signing or decision-making.',
      strongLine: 'The buyer left with clear expectations for post-decision steps.',
      developingLine: 'Post-decision path was present, but next-step clarity can improve.',
      lowLine: 'Buyer expectations after decision/signing were unclear.',
      coachingExample: 'Summarize next 1-2 post-signing steps before wrap-up.',
      improvementFocus: 'Make post-decision follow-through explicit and simple.',
    },
    closing: {
      displayMeaning: 'How well the manager guided the buyer through a clear and confident decision.',
      strongLine: 'You advanced the decision clearly without creating pressure.',
      developingLine: 'Decision movement existed, but confidence checks were limited.',
      lowLine: 'The decision process stalled before a confident commitment.',
      coachingExample: 'Check understanding before transitioning to signature or selection.',
      improvementFocus: 'Sequence clarity check, confidence check, then close.',
    },
    relationship: {
      displayMeaning: 'How well the manager reduced tension and built confidence at a sensitive stage.',
      strongLine: 'The buyer felt respected and supported through complex decisions.',
      developingLine: 'Relationship tone was steady, but could be more reassuring in difficult moments.',
      lowLine: 'The conversation felt tense and procedural, reducing buyer comfort.',
      coachingExample: 'Use calm tone and reassurance to keep confidence steady.',
      improvementFocus: 'Strengthen confidence-building presence during high-stress decisions.',
    },
  },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function getAisScoreBand(metricValue: number): AisScoreBand {
  const value = clampScore(metricValue);
  if (value <= 39) return 'Needs Immediate Support';
  if (value <= 54) return 'Below Standard';
  if (value <= 69) return 'Developing';
  if (value <= 84) return 'Strong';
  return 'Excellent';
}

export function interpretAisScore(input: AisScoreInterpretationInput): AisScoreInterpretationResult {
  const metricValue = clampScore(input.metricValue);
  const scoreBand = getAisScoreBand(metricValue);
  const mapping = MAP[input.roleType][input.metricName];
  const feedbackLine = metricValue >= 70
    ? mapping.strongLine
    : (metricValue >= 55 ? mapping.developingLine : mapping.lowLine);

  const roleSpecificInterpretation = `${ROLE_LABEL[input.roleType]} — ${METRIC_LABEL[input.metricName]} — ${scoreBand}`;
  const concernText = input.concernCategory ? ` Concern context: ${input.concernCategory}.` : '';
  const coachingSignals = Array.isArray(input.coachingSignals) && input.coachingSignals.length > 0
    ? ` Signals: ${input.coachingSignals.join(', ')}.`
    : '';

  return {
    scoreBand,
    displayMeaning: mapping.displayMeaning,
    roleSpecificInterpretation,
    feedbackLine: `${METRIC_LABEL[input.metricName]} — ${metricValue}. ${feedbackLine}${concernText}`,
    coachingExample: mapping.coachingExample,
    recommendedImprovementFocus: `${mapping.improvementFocus}${coachingSignals}`.trim(),
  };
}

function normalizeRoleType(value: unknown): AisRoleType | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sales' || normalized === 'service' || normalized === 'parts' || normalized === 'fi') {
    return normalized as AisRoleType;
  }
  return null;
}

function concernRoleFallback(concern: string): AisRoleType {
  const normalized = concern.trim().toLowerCase();
  if (normalized.includes('repair') || normalized.includes('warranty') || normalized.includes('service')) return 'service';
  if (normalized.includes('backorder') || normalized.includes('fitment') || normalized.includes('availability') || normalized.includes('special order')) return 'parts';
  if (normalized.includes('contract') || normalized.includes('lender') || normalized.includes('paperwork') || normalized.includes('protection')) return 'fi';
  return 'sales';
}

export function inferAisRoleTypeFromSessions(rows: Array<Pick<FreshUpNormalizedSession, 'roleType' | 'primaryConcern'>>): AisRoleType {
  if (!rows.length) return 'sales';
  const roleCounts = new Map<AisRoleType, number>();
  rows.forEach((row) => {
    const explicit = normalizeRoleType(row.roleType);
    const resolved = explicit ?? concernRoleFallback(row.primaryConcern || '');
    roleCounts.set(resolved, (roleCounts.get(resolved) ?? 0) + 1);
  });
  let winner: AisRoleType = 'sales';
  let max = -1;
  roleCounts.forEach((count, role) => {
    if (count > max) {
      winner = role;
      max = count;
    }
  });
  return winner;
}

export function buildRoleAdaptiveWeaknessLine(input: {
  roleType: AisRoleType;
  metricName: AisMetricName;
  concernCategory?: string;
}): string {
  const concern = input.concernCategory || 'priority conversations';
  if (input.metricName === 'trust') {
    if (input.roleType === 'service') return `Trust remained the weakest area in estimate and timeline conversations (${concern}).`;
    if (input.roleType === 'parts') return `Trust remained the weakest area in availability and order-status conversations (${concern}).`;
    if (input.roleType === 'fi') return `Trust remained the weakest area in menu and paperwork clarification conversations (${concern}).`;
    return `Trust remained the weakest area in price-first buyer conversations (${concern}).`;
  }
  const metricLabel = METRIC_LABEL[input.metricName];
  return `${metricLabel} remained the primary growth area in ${concern}.`;
}

