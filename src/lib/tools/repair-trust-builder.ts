import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const REPAIR_TRUST_URGENCY = [
  'low',
  'medium',
  'high',
  'safety-critical',
] as const;

export const REPAIR_TRUST_PROOF_POINTS = [
  'technician findings',
  'safety impact',
  'wear evidence',
  'future risk',
  'manufacturer guidance',
] as const;

export const REPAIR_TRUST_TYPES = [
  'maintenance',
  'safety',
  'wear item',
  'diagnostic',
  'unexpected repair',
] as const;

export type RepairTrustUrgency = typeof REPAIR_TRUST_URGENCY[number];
export type RepairTrustProofPoint = typeof REPAIR_TRUST_PROOF_POINTS[number];
export type RepairTrustType = typeof REPAIR_TRUST_TYPES[number];

export type RepairTrustInput = {
  trustLevel: number;
  urgency: RepairTrustUrgency;
  skepticismLevel: number;
  selectedProofPoints: RepairTrustProofPoint[];
  repairType?: RepairTrustType | null;
};

export type RepairTrustPlan = {
  bestTrustFirstExplanation: string;
  showExplainThisFirst: string;
  sayThis: string;
  askThis: string;
  doNotDoThis: string;
};

export type RepairTrustSprocketEnhancement = {
  likelyTrustBarrier: string;
  sharperProofSequence: string;
  naturalRewrite: string;
  confidenceWithoutPressureCoaching: string;
};

export type RepairTrustCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Clarity' | 'Tone' | 'Objection Control';
};

export type RepairTrustSavedScenario = {
  id: string;
  createdAt: string;
  trustLevel: number;
  urgency: RepairTrustUrgency;
  skepticismLevel: number;
  selectedProofPoints: RepairTrustProofPoint[];
  repairType?: RepairTrustType | null;
  bestTrustFirstExplanation: string;
  showExplainThisFirst: string;
  sayThis: string;
  askThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function containsProof(input: RepairTrustInput, proof: RepairTrustProofPoint): boolean {
  return input.selectedProofPoints.includes(proof);
}

function trustFirstExplanation(input: RepairTrustInput): string {
  if (input.urgency === 'safety-critical') {
    return 'Lead with safety transparency first, then show objective evidence and timeline options.';
  }
  if (input.skepticismLevel >= 70) {
    return 'Start with evidence and choice framing so the customer feels informed, not pressured.';
  }
  if (input.trustLevel <= 35) {
    return 'Use a transparency-first explanation that separates findings, urgency, and options clearly.';
  }
  return 'Anchor on customer care and clear facts, then walk through urgency in plain language.';
}

function showFirst(input: RepairTrustInput): string {
  if (containsProof(input, 'technician findings')) {
    return 'Show technician findings first and translate them into plain customer language.';
  }
  if (containsProof(input, 'safety impact')) {
    return 'Show safety impact first, then explain what changes if work is delayed.';
  }
  if (containsProof(input, 'wear evidence')) {
    return 'Show wear evidence first so the recommendation feels observable and concrete.';
  }
  if (containsProof(input, 'manufacturer guidance')) {
    return 'Show manufacturer guidance first to anchor credibility and consistency.';
  }
  return 'Show the clearest objective proof first, then explain urgency and options.';
}

function sayLine(input: RepairTrustInput): string {
  if (input.urgency === 'safety-critical') {
    return 'I want to be fully transparent: this one is safety-related, and I want to show you exactly why before we decide anything.';
  }
  if (input.skepticismLevel >= 70) {
    return 'Let me show you the finding first so you can see exactly what we are basing this recommendation on.';
  }
  if (input.repairType === 'unexpected repair') {
    return 'I know this was unexpected, so I will keep it clear and show what matters most first.';
  }
  return 'I will walk you through what we found, why it matters, and your options in a clear order.';
}

function askLine(input: RepairTrustInput): string {
  if (input.skepticismLevel >= 70) {
    return 'Before we go further, what would help you feel most confident in this recommendation?';
  }
  if (input.urgency === 'low') {
    return 'Would it help if we compare doing this now versus scheduling it soon?';
  }
  if (input.urgency === 'high' || input.urgency === 'safety-critical') {
    return 'Does this explanation make sense so far, and is there any part you want me to clarify first?';
  }
  return 'What part of this recommendation would you like me to break down first?';
}

function avoidLine(input: RepairTrustInput): string {
  if (input.skepticismLevel >= 70) {
    return 'Do not jump straight to price before showing evidence and purpose.';
  }
  if (input.urgency === 'safety-critical') {
    return 'Do not soften safety risk language so much that urgency becomes unclear.';
  }
  return 'Do not present recommendations as a push; present them as transparent guidance with options.';
}

export function getRepairTrustPlan(input: RepairTrustInput): RepairTrustPlan {
  const normalized: RepairTrustInput = {
    ...input,
    trustLevel: clamp(input.trustLevel),
    skepticismLevel: clamp(input.skepticismLevel),
  };

  return {
    bestTrustFirstExplanation: trustFirstExplanation(normalized),
    showExplainThisFirst: showFirst(normalized),
    sayThis: sayLine(normalized),
    askThis: askLine(normalized),
    doNotDoThis: avoidLine(normalized),
  };
}

export function getSprocketRepairTrustEnhancement(
  input: RepairTrustInput,
  base: RepairTrustPlan
): RepairTrustSprocketEnhancement {
  const likelyTrustBarrier =
    input.skepticismLevel >= 70
      ? 'Primary barrier is confidence in recommendation intent, not only cost.'
      : input.trustLevel <= 35
        ? 'Primary barrier is low trust baseline and fear of being sold rather than advised.'
        : input.repairType === 'unexpected repair'
          ? 'Primary barrier is surprise and uncertainty around why this appeared now.'
          : 'Primary barrier is low clarity in how urgency and value were framed.';

  const proofOrder = [
    containsProof(input, 'technician findings') ? 'technician findings' : null,
    containsProof(input, 'wear evidence') ? 'wear evidence' : null,
    containsProof(input, 'safety impact') ? 'safety impact' : null,
    containsProof(input, 'future risk') ? 'future risk' : null,
    containsProof(input, 'manufacturer guidance') ? 'manufacturer guidance' : null,
  ].filter(Boolean).join(' -> ') || 'finding -> impact -> options';

  return {
    likelyTrustBarrier,
    sharperProofSequence: `Recommended proof sequence: ${proofOrder}. Then confirm understanding before quoting.`,
    naturalRewrite: `Try this wording: ${base.sayThis}`,
    confidenceWithoutPressureCoaching: 'Use calm certainty, show evidence first, then offer options without urgency stacking.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  clarityLow: boolean;
  toneLow: boolean;
  objectionControlLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const clarity = readCxStatScore(stats?.listening, 60);
  const tone = readCxStatScore(stats?.closing, 60);
  const objection = readCxStatScore(stats?.followUp, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    clarityLow: clarity > 0 && clarity < 55,
    toneLow: tone > 0 && tone < 55,
    objectionControlLow: objection > 0 && objection < 55,
  };
}

export function getAutoDriveCxRepairTrustEnhancement(
  _input: RepairTrustInput,
  _base: RepairTrustPlan,
  user?: User | null
): RepairTrustCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Trust trend indicates repair recommendations land better when evidence is shown before urgency language.',
      adjustedApproach: 'Open with objective finding, then ask for reaction before discussing options.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.clarityLow) {
    return {
      tailoredReason: 'Clarity trend suggests recommendations need tighter structure and simpler sequencing.',
      adjustedApproach: 'Use a three-part flow: what we found, why it matters, what options they have.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tone trend suggests calmer phrasing will reduce skepticism and defensiveness.',
      adjustedApproach: 'Lower intensity, keep wording concise, and avoid urgency stacking.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.objectionControlLow) {
    return {
      tailoredReason: 'Objection-handling trend suggests early confirmation checks will improve recommendation acceptance.',
      adjustedApproach: 'After each proof point, ask one confirmation question before advancing.',
      focusSkillTag: 'Objection Control',
    };
  }

  return {
    tailoredReason: 'Skill profile suggests strongest gains come from proof-first explanations and explicit customer-choice framing.',
    adjustedApproach: 'Show evidence, explain impact, confirm understanding, then offer options.',
    focusSkillTag: 'Trust',
  };
}
