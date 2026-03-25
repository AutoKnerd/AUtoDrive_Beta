import type { User } from '@/lib/definitions';

export const WALKAROUND_MOTIVATORS = [
  'safety',
  'style',
  'utility',
  'status',
  'value',
  'tech',
] as const;

export const WALKAROUND_VEHICLE_TYPES = [
  'truck',
  'SUV',
  'sedan',
  'EV',
  'luxury',
] as const;

export const WALKAROUND_CUSTOMER_BEHAVIORS = [
  'engaged',
  'distracted',
  'analytical',
  'emotional',
  'rushed',
] as const;

export const WALKAROUND_FEATURE_LIBRARY = [
  'safety suite',
  'cargo space',
  'rear seat comfort',
  'infotainment',
  'driver display',
  'exterior design',
  'wheel/tire package',
  'powertrain',
  'fuel efficiency',
  'charging flow',
  'towing capability',
  'premium interior',
] as const;

export type WalkaroundMotivator = typeof WALKAROUND_MOTIVATORS[number];
export type WalkaroundVehicleType = typeof WALKAROUND_VEHICLE_TYPES[number];
export type WalkaroundCustomerBehavior = typeof WALKAROUND_CUSTOMER_BEHAVIORS[number];
export type WalkaroundFeature = typeof WALKAROUND_FEATURE_LIBRARY[number];

export type WalkaroundInput = {
  customerMotivator: WalkaroundMotivator;
  prioritizedFeatures: WalkaroundFeature[];
  talkLength: number;
  vehicleType?: WalkaroundVehicleType | null;
  customerBehavior?: WalkaroundCustomerBehavior | null;
};

export type WalkaroundPlan = {
  bestWalkaroundOrder: string;
  startHere: string;
  tieFeatureToNeed: string;
  transitionToNextStep: string;
  doNotDoThis: string;
};

export type WalkaroundSprocketEnhancement = {
  sharperSequence: string;
  betterFeatureBenefitLanguage: string;
  naturalRewrite: string;
  pacingAndEngagementCoaching: string;
};

export type WalkaroundCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Listening' | 'Trust' | 'Pacing' | 'Brevity';
};

export type WalkaroundSavedScenario = {
  id: string;
  createdAt: string;
  customerMotivator: WalkaroundMotivator;
  prioritizedFeatures: WalkaroundFeature[];
  talkLength: number;
  vehicleType?: WalkaroundVehicleType | null;
  customerBehavior?: WalkaroundCustomerBehavior | null;
  bestWalkaroundOrder: string;
  startHere: string;
  tieFeatureToNeed: string;
  transitionToNextStep: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const MOTIVATOR_BENEFIT_MAP: Record<WalkaroundMotivator, string> = {
  safety: 'confidence and protection in daily driving',
  style: 'personal identity and visual pride',
  utility: 'day-to-day practicality and flexibility',
  status: 'presence, prestige, and social signal',
  value: 'smart long-term ownership return',
  tech: 'ease, control, and modern convenience',
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readableOrder(features: WalkaroundFeature[]): string {
  return features.map((item, index) => `${index + 1}. ${item}`).join(' -> ');
}

function behaviorAdjustment(behavior?: WalkaroundCustomerBehavior | null): Partial<WalkaroundPlan> {
  if (!behavior) return {};
  if (behavior === 'distracted') {
    return {
      startHere: 'Start with one high-impact feature and one direct customer benefit in under 20 seconds.',
      doNotDoThis: 'Do not run a long uninterrupted walkaround monologue.',
    };
  }
  if (behavior === 'analytical') {
    return {
      tieFeatureToNeed: 'Pair each feature with one measurable benefit and one practical ownership outcome.',
    };
  }
  if (behavior === 'emotional') {
    return {
      transitionToNextStep: 'Bridge from feeling to fit: confirm what excited them, then move to a practical next step.',
    };
  }
  if (behavior === 'rushed') {
    return {
      startHere: 'Use a fast 3-point walkaround: top need, top differentiator, then next-step question.',
      doNotDoThis: 'Do not insist on full-feature coverage when time urgency is clear.',
    };
  }
  return {};
}

function vehicleAdjustment(type?: WalkaroundVehicleType | null): Partial<WalkaroundPlan> {
  if (!type) return {};
  if (type === 'truck') return { tieFeatureToNeed: 'Tie capability features to real workload and weekend-use examples.' };
  if (type === 'SUV') return { tieFeatureToNeed: 'Connect space, safety, and daily family-use convenience in one flow.' };
  if (type === 'sedan') return { tieFeatureToNeed: 'Highlight comfort, efficiency, and ease in daily commute context.' };
  if (type === 'EV') return { tieFeatureToNeed: 'Translate EV tech into simple charging confidence and ownership ease.' };
  return { tieFeatureToNeed: 'Lead with craftsmanship and ownership experience before specs.' };
}

export function getWalkaroundPlan(input: WalkaroundInput): WalkaroundPlan {
  const talkLength = clamp(input.talkLength);
  const features = input.prioritizedFeatures.length > 0 ? input.prioritizedFeatures : ['safety suite', 'infotainment', 'cargo space'];
  const topFeature = features[0];
  const motivatorBenefit = MOTIVATOR_BENEFIT_MAP[input.customerMotivator];
  const detailMode = talkLength > 66 ? 'detailed' : talkLength < 34 ? 'concise' : 'balanced';

  const base: WalkaroundPlan = {
    bestWalkaroundOrder: readableOrder(features),
    startHere: `Start with ${topFeature}, then connect it directly to ${motivatorBenefit}.`,
    tieFeatureToNeed: `Tie each feature back to ${input.customerMotivator} by explaining how it improves ${motivatorBenefit}.`,
    transitionToNextStep:
      detailMode === 'detailed'
        ? 'After each feature, ask for reaction and carry that response into the next feature transition.'
        : detailMode === 'concise'
          ? 'After two key features, summarize fit in one sentence and transition to the next decision step.'
          : 'Use short feature-to-benefit bridges, then ask one commitment-building question.',
    doNotDoThis: 'Do not run an unordered feature dump disconnected from the customer’s motivator.',
  };

  const behavior = behaviorAdjustment(input.customerBehavior);
  const vehicle = vehicleAdjustment(input.vehicleType);

  return {
    bestWalkaroundOrder: base.bestWalkaroundOrder,
    startHere: behavior.startHere || base.startHere,
    tieFeatureToNeed: behavior.tieFeatureToNeed || vehicle.tieFeatureToNeed || base.tieFeatureToNeed,
    transitionToNextStep: behavior.transitionToNextStep || base.transitionToNextStep,
    doNotDoThis: behavior.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketWalkaroundEnhancement(
  input: WalkaroundInput,
  base: WalkaroundPlan
): WalkaroundSprocketEnhancement {
  const sharperSequence =
    input.customerBehavior === 'rushed'
      ? 'Use 3-point path: anchor motivator, strongest feature proof, then forward-move question.'
      : `Use a proof ladder: ${base.bestWalkaroundOrder}, then confirm emotional fit before next step.`;

  return {
    sharperSequence,
    betterFeatureBenefitLanguage: `Convert features into outcomes: "${base.tieFeatureToNeed}"`,
    naturalRewrite: `Try this opener: ${base.startHere}`,
    pacingAndEngagementCoaching: 'Keep each feature segment under 25 seconds, then ask for customer reaction.',
  };
}

type SkillSignals = {
  listeningLow: boolean;
  trustLow: boolean;
  pacingLow: boolean;
  brevityLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const listening = Number(stats?.listening ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const pacing = Number(stats?.closing ?? 60);
  const brevity = Number(stats?.followUp ?? 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    trustLow: trust > 0 && trust < 55,
    pacingLow: pacing > 0 && pacing < 55,
    brevityLow: brevity > 0 && brevity < 55,
  };
}

export function getAutoDriveCxWalkaroundEnhancement(
  _input: WalkaroundInput,
  _base: WalkaroundPlan,
  user?: User | null
): WalkaroundCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored to listening trend: more check-in questions improve walkaround relevance.',
      adjustedApproach: 'After each key feature, ask one reaction question before continuing.',
      focusSkillTag: 'Listening',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: customer-centered benefit language improves credibility.',
      adjustedApproach: 'Use transparent, non-hype wording and tie each feature to stated needs.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored to pacing trend: shorter feature blocks maintain engagement.',
      adjustedApproach: 'Use timed 20-second feature segments with clear transitions.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.brevityLow) {
    return {
      tailoredReason: 'Tailored to brevity trend: concise sequencing reduces attention loss.',
      adjustedApproach: 'Cut to top 3 prioritized features before moving to next step.',
      focusSkillTag: 'Brevity',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: intentional sequencing strengthens customer engagement.',
    adjustedApproach: 'Lead with motivator-match feature, then keep transitions tight and question-led.',
    focusSkillTag: 'Pacing',
  };
}
