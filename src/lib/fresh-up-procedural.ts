import type { FreshUpArchetypeCategory, FreshUpProfile, FreshUpTag } from '@/lib/definitions';
import { pickFreshUpArchetype } from '@/lib/fresh-up-archetypes';

const PERSONALITY_POOL = ['analytical', 'friendly', 'skeptical', 'impatient', 'overwhelmed', 'excited', 'defensive'] as const;
const BUYING_STAGE_POOL = ['just browsing', 'comparing models', 'trade-in evaluation', 'payment discussion', 'ready to buy'] as const;
const PRIMARY_CONCERN_POOL = ['price', 'trade value', 'monthly payment', 'reliability', 'technology confusion', 'fuel economy', 'safety', 'time efficiency'] as const;
const SECONDARY_CONCERN_POOL = ['dealership honesty', 'maintenance cost', 'warranty coverage', 'resale value', 'comfort', 'family fit', 'financing terms'] as const;
const COMMUNICATION_STYLE_POOL = ['talkative', 'reserved', 'direct', 'sarcastic', 'story-driven', 'cautious', 'rapid-fire questions'] as const;
const VEHICLE_INTEREST_POOL = ['SUV', 'truck', 'sedan', 'hybrid', 'EV', 'performance vehicle', 'family vehicle'] as const;
const DIFFICULTY_POOL = ['easy', 'medium', 'hard'] as const;
const EMOTIONAL_STATE_POOL = ['cautious', 'curious', 'stressed', 'excited', 'guarded', 'frustrated', 'optimistic'] as const;

const FIRST_NAMES = ['Jordan', 'Taylor', 'Morgan', 'Avery', 'Cameron', 'Parker', 'Riley', 'Dakota', 'Casey', 'Rowan'];
const LAST_NAMES = ['Bennett', 'Miller', 'Soto', 'Reed', 'Hayes', 'Brooks', 'Perry', 'Adams', 'Wells', 'Foster'];

export type FreshUpCustomerType =
  | 'Friendly'
  | 'Curious'
  | 'Funny'
  | 'Analytical'
  | 'Skeptical'
  | 'Budget Focused'
  | 'High Stakes Buyer'
  | 'Complex Family Decision';

type WeightedCustomerType = {
  type: FreshUpCustomerType;
  weight: number;
};

type ProceduralOverrides = Partial<{
  consultantLevel: number;
  customerType: FreshUpCustomerType;
  forceArchetypeIdOrName: string;
  archetypeCategoryFilter: FreshUpArchetypeCategory[];
  personalityType: string;
  buyingStage: string;
  primaryConcern: string;
  secondaryConcern: string;
  communicationStyle: string;
  vehicleInterest: string;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  emotionalState: string;
  customerName: string;
}>;

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickFrom<T>(items: readonly T[], seed: number, offset: number): T {
  return items[(seed + offset) % items.length];
}

function clampConsultantLevel(level?: number): number {
  const raw = Number(level);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export function getCustomerTypeDistributionForLevel(consultantLevel?: number): WeightedCustomerType[] {
  const level = clampConsultantLevel(consultantLevel);
  if (level <= 5) {
    return [
      { type: 'Friendly', weight: 35 },
      { type: 'Curious', weight: 30 },
      { type: 'Funny', weight: 15 },
      { type: 'Skeptical', weight: 10 },
      // "Complex Buyer" from spec is represented by this profile bucket.
      { type: 'Complex Family Decision', weight: 10 },
    ];
  }
  if (level <= 15) {
    return [
      { type: 'Friendly', weight: 25 },
      { type: 'Curious', weight: 25 },
      { type: 'Funny', weight: 10 },
      { type: 'Skeptical', weight: 20 },
      { type: 'Analytical', weight: 20 },
    ];
  }
  if (level <= 30) {
    return [
      { type: 'Friendly', weight: 20 },
      { type: 'Funny', weight: 10 },
      { type: 'Analytical', weight: 25 },
      { type: 'Skeptical', weight: 25 },
      { type: 'Budget Focused', weight: 20 },
    ];
  }
  return [
    { type: 'Friendly', weight: 15 },
    { type: 'Funny', weight: 10 },
    { type: 'Analytical', weight: 25 },
    { type: 'Skeptical', weight: 25 },
    { type: 'High Stakes Buyer', weight: 15 },
    { type: 'Complex Family Decision', weight: 10 },
  ];
}

function pickWeightedCustomerType(weights: WeightedCustomerType[], seed: number): FreshUpCustomerType {
  const total = weights.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return 'Friendly';
  let roll = Math.abs(seed % total);
  for (const entry of weights) {
    const weight = Math.max(0, entry.weight);
    if (roll < weight) return entry.type;
    roll -= weight;
  }
  return weights[weights.length - 1]?.type ?? 'Friendly';
}

function getArchetypePools(customerType: FreshUpCustomerType) {
  if (customerType === 'Friendly') {
    return {
      personalityPool: ['friendly', 'excited'] as const,
      stagePool: ['just browsing', 'comparing models'] as const,
      concernPool: ['reliability', 'safety', 'fuel economy'] as const,
      secondaryPool: ['comfort', 'family fit', 'warranty coverage'] as const,
      stylePool: ['talkative', 'story-driven', 'cautious'] as const,
      vehiclePool: ['SUV', 'sedan', 'family vehicle'] as const,
      moodPool: ['optimistic', 'curious', 'excited'] as const,
    };
  }
  if (customerType === 'Curious') {
    return {
      personalityPool: ['analytical', 'friendly'] as const,
      stagePool: ['just browsing', 'comparing models'] as const,
      concernPool: ['technology confusion', 'fuel economy', 'reliability'] as const,
      secondaryPool: ['maintenance cost', 'warranty coverage', 'resale value'] as const,
      stylePool: ['talkative', 'rapid-fire questions', 'cautious'] as const,
      vehiclePool: ['hybrid', 'EV', 'SUV'] as const,
      moodPool: ['curious', 'optimistic', 'cautious'] as const,
    };
  }
  if (customerType === 'Funny') {
    return {
      personalityPool: ['friendly', 'excited', 'skeptical'] as const,
      stagePool: ['just browsing', 'comparing models', 'ready to buy'] as const,
      concernPool: ['price', 'technology confusion', 'time efficiency'] as const,
      secondaryPool: ['comfort', 'dealership honesty', 'financing terms'] as const,
      stylePool: ['sarcastic', 'story-driven', 'talkative'] as const,
      vehiclePool: ['performance vehicle', 'SUV', 'truck'] as const,
      moodPool: ['excited', 'curious', 'optimistic'] as const,
    };
  }
  if (customerType === 'Analytical') {
    return {
      personalityPool: ['analytical', 'skeptical'] as const,
      stagePool: ['comparing models', 'trade-in evaluation'] as const,
      concernPool: ['reliability', 'fuel economy', 'technology confusion'] as const,
      secondaryPool: ['resale value', 'maintenance cost', 'warranty coverage'] as const,
      stylePool: ['direct', 'reserved', 'rapid-fire questions'] as const,
      vehiclePool: ['hybrid', 'EV', 'sedan'] as const,
      moodPool: ['curious', 'cautious', 'guarded'] as const,
    };
  }
  if (customerType === 'Skeptical') {
    return {
      personalityPool: ['skeptical', 'defensive'] as const,
      stagePool: ['trade-in evaluation', 'payment discussion', 'comparing models'] as const,
      concernPool: ['price', 'trade value', 'monthly payment'] as const,
      secondaryPool: ['dealership honesty', 'financing terms', 'resale value'] as const,
      stylePool: ['direct', 'reserved', 'sarcastic'] as const,
      vehiclePool: ['truck', 'SUV', 'sedan'] as const,
      moodPool: ['guarded', 'frustrated', 'cautious'] as const,
    };
  }
  if (customerType === 'Budget Focused') {
    return {
      personalityPool: ['analytical', 'impatient'] as const,
      stagePool: ['payment discussion', 'trade-in evaluation'] as const,
      concernPool: ['monthly payment', 'price', 'fuel economy'] as const,
      secondaryPool: ['maintenance cost', 'financing terms', 'warranty coverage'] as const,
      stylePool: ['direct', 'cautious', 'rapid-fire questions'] as const,
      vehiclePool: ['sedan', 'hybrid', 'SUV'] as const,
      moodPool: ['cautious', 'stressed', 'guarded'] as const,
    };
  }
  if (customerType === 'High Stakes Buyer') {
    return {
      personalityPool: ['impatient', 'analytical', 'skeptical'] as const,
      stagePool: ['ready to buy', 'payment discussion'] as const,
      concernPool: ['time efficiency', 'price', 'monthly payment'] as const,
      secondaryPool: ['dealership honesty', 'financing terms', 'resale value'] as const,
      stylePool: ['direct', 'rapid-fire questions', 'reserved'] as const,
      vehiclePool: ['performance vehicle', 'EV', 'truck'] as const,
      moodPool: ['stressed', 'guarded', 'excited'] as const,
    };
  }
  return {
    personalityPool: ['overwhelmed', 'friendly', 'defensive'] as const,
    stagePool: ['comparing models', 'trade-in evaluation', 'just browsing'] as const,
    concernPool: ['safety', 'reliability', 'time efficiency'] as const,
    secondaryPool: ['comfort', 'maintenance cost', 'warranty coverage'] as const,
    stylePool: ['story-driven', 'cautious', 'talkative'] as const,
    vehiclePool: ['family vehicle', 'SUV', 'hybrid'] as const,
    moodPool: ['stressed', 'cautious', 'optimistic'] as const,
  };
}

function getArchetypeCategoryPools(category: FreshUpArchetypeCategory): {
  personalityPool?: readonly string[];
  stagePool?: readonly string[];
  concernPool?: readonly string[];
  secondaryPool?: readonly string[];
  stylePool?: readonly string[];
  vehiclePool?: readonly string[];
  moodPool?: readonly string[];
} {
  if (category === 'friendly') return {
    personalityPool: ['friendly', 'excited'] as const,
    stylePool: ['talkative', 'story-driven'] as const,
    moodPool: ['optimistic', 'curious'] as const,
  };
  if (category === 'curious') return {
    personalityPool: ['analytical', 'friendly'] as const,
    stylePool: ['rapid-fire questions', 'talkative'] as const,
    moodPool: ['curious', 'cautious'] as const,
  };
  if (category === 'funny') return {
    personalityPool: ['friendly', 'excited', 'skeptical'] as const,
    stylePool: ['sarcastic', 'story-driven', 'talkative'] as const,
    moodPool: ['excited', 'optimistic'] as const,
  };
  if (category === 'analytical') return {
    personalityPool: ['analytical', 'skeptical'] as const,
    stylePool: ['direct', 'reserved', 'rapid-fire questions'] as const,
    moodPool: ['curious', 'guarded'] as const,
  };
  if (category === 'skeptical') return {
    personalityPool: ['skeptical', 'defensive'] as const,
    stylePool: ['direct', 'reserved', 'sarcastic'] as const,
    moodPool: ['guarded', 'frustrated'] as const,
  };
  if (category === 'budget_focused') return {
    concernPool: ['monthly payment', 'price', 'fuel economy'] as const,
    stylePool: ['direct', 'cautious'] as const,
    moodPool: ['cautious', 'stressed'] as const,
  };
  if (category === 'high_stakes') return {
    stagePool: ['ready to buy', 'payment discussion'] as const,
    concernPool: ['time efficiency', 'price'] as const,
    moodPool: ['stressed', 'guarded'] as const,
  };
  if (category === 'family_complex') return {
    concernPool: ['safety', 'reliability'] as const,
    vehiclePool: ['family vehicle', 'SUV'] as const,
    moodPool: ['cautious', 'stressed'] as const,
  };
  if (category === 'emotional') return {
    personalityPool: ['overwhelmed', 'defensive', 'friendly'] as const,
    stylePool: ['story-driven', 'cautious'] as const,
    moodPool: ['stressed', 'guarded', 'cautious'] as const,
  };
  return {
    personalityPool: ['friendly', 'skeptical'] as const,
    stylePool: ['story-driven', 'sarcastic'] as const,
    moodPool: ['curious', 'excited', 'guarded'] as const,
  };
}

function mergePool<T extends string>(base: readonly T[] | undefined, extra: readonly T[] | undefined): readonly T[] | undefined {
  if (!base && !extra) return undefined;
  return Array.from(new Set([...(base ?? []), ...(extra ?? [])]));
}

function pickDifficulty(seed: number, personality: string, stage: string): 'easy' | 'medium' | 'hard' {
  if (personality === 'skeptical' || personality === 'defensive' || stage === 'payment discussion') return 'hard';
  if (personality === 'impatient' || stage === 'trade-in evaluation' || stage === 'ready to buy') return 'medium';
  return pickFrom(DIFFICULTY_POOL, seed, 13);
}

function mapConcernToTag(concern: string, style: string): FreshUpTag {
  if (concern === 'price') return 'price_first';
  if (concern === 'monthly payment') return 'payment_focus';
  if (concern === 'trade value') return 'trust_drop';
  if (concern === 'technology confusion') return 'feature_confusion';
  if (concern === 'time efficiency') return 'process_efficiency';
  if (style === 'reserved') return 'needs_listening';
  if (style === 'rapid-fire questions') return 'weak_discovery';
  return 'relationship_builder';
}

function mapSkills(primaryConcern: string, stage: string): string[] {
  const skills = new Set<string>(['empathy', 'listening', 'trust']);
  if (primaryConcern === 'price' || primaryConcern === 'monthly payment') skills.add('closing');
  if (primaryConcern === 'trade value' || stage === 'trade-in evaluation') skills.add('relationship');
  if (primaryConcern === 'technology confusion') skills.add('productKnowledge');
  return Array.from(skills);
}

function buildPrompt(input: {
  customerName: string;
  personalityType: string;
  buyingStage: string;
  primaryConcern: string;
  secondaryConcern: string;
  communicationStyle: string;
  vehicleInterest: string;
  emotionalState: string;
}): string {
  return `You are ${input.customerName}, a ${input.personalityType} customer at the "${input.buyingStage}" stage considering a ${input.vehicleInterest}. `
    + `Your primary concern is ${input.primaryConcern}, and your secondary concern is ${input.secondaryConcern}. `
    + `You communicate in a ${input.communicationStyle} style and currently feel ${input.emotionalState}. `
    + `You respond positively to clear, patient, transparent guidance and push back when answers feel rushed or vague.`;
}

export function generateProceduralFreshUpCustomer(seedInput: string, overrides: ProceduralOverrides = {}): FreshUpProfile {
  const seed = hashSeed(seedInput);
  const firstName = pickFrom(FIRST_NAMES, seed, 3);
  const lastName = pickFrom(LAST_NAMES, seed, 7);
  const generatedCustomerName = `${firstName} ${lastName}`;

  const customerType = overrides.customerType ?? pickWeightedCustomerType(
    getCustomerTypeDistributionForLevel(overrides.consultantLevel),
    seed + 5,
  );
  const customerTypePools = getArchetypePools(customerType);
  const selectedArchetype = pickFreshUpArchetype({
    customerType,
    consultantLevel: overrides.consultantLevel,
    seedInput: `${seedInput}:${customerType}`,
    forcedArchetypeIdOrName: overrides.forceArchetypeIdOrName,
    allowedCategories: overrides.archetypeCategoryFilter,
  });
  const archetypeCategoryPools = getArchetypeCategoryPools(selectedArchetype.category);

  const personalityType = overrides.personalityType
    ?? pickFrom(mergePool(customerTypePools.personalityPool, archetypeCategoryPools.personalityPool) ?? PERSONALITY_POOL, seed, 11)
    ?? pickFrom(PERSONALITY_POOL, seed, 11);
  const buyingStage = overrides.buyingStage
    ?? pickFrom(mergePool(customerTypePools.stagePool, archetypeCategoryPools.stagePool) ?? BUYING_STAGE_POOL, seed, 17)
    ?? pickFrom(BUYING_STAGE_POOL, seed, 17);
  const primaryConcern = overrides.primaryConcern
    ?? pickFrom(mergePool(customerTypePools.concernPool, archetypeCategoryPools.concernPool) ?? PRIMARY_CONCERN_POOL, seed, 23)
    ?? pickFrom(PRIMARY_CONCERN_POOL, seed, 23);
  const secondaryConcern = overrides.secondaryConcern
    ?? pickFrom(mergePool(customerTypePools.secondaryPool, archetypeCategoryPools.secondaryPool) ?? SECONDARY_CONCERN_POOL, seed, 29)
    ?? pickFrom(SECONDARY_CONCERN_POOL, seed, 29);
  const communicationStyle = overrides.communicationStyle
    ?? pickFrom(mergePool(customerTypePools.stylePool, archetypeCategoryPools.stylePool) ?? COMMUNICATION_STYLE_POOL, seed, 31)
    ?? pickFrom(COMMUNICATION_STYLE_POOL, seed, 31);
  const vehicleInterest = overrides.vehicleInterest
    ?? pickFrom(mergePool(customerTypePools.vehiclePool, archetypeCategoryPools.vehiclePool) ?? VEHICLE_INTEREST_POOL, seed, 37)
    ?? pickFrom(VEHICLE_INTEREST_POOL, seed, 37);
  const emotionalState = overrides.emotionalState
    ?? pickFrom(mergePool(customerTypePools.moodPool, archetypeCategoryPools.moodPool) ?? EMOTIONAL_STATE_POOL, seed, 41)
    ?? pickFrom(EMOTIONAL_STATE_POOL, seed, 41);
  const difficultyLevel = overrides.difficultyLevel ?? pickDifficulty(seed, personalityType, buyingStage);
  const customerName = overrides.customerName ?? generatedCustomerName;
  const coachingTag = mapConcernToTag(primaryConcern, communicationStyle);
  const skillsTested = mapSkills(primaryConcern, buyingStage);

  const freshUpId = `proc-${seed.toString(36)}`;

  const prompt = buildPrompt({
    customerName,
    personalityType,
    buyingStage,
    primaryConcern,
    secondaryConcern,
    communicationStyle,
    vehicleInterest,
    emotionalState,
  });
  const blendedPrompt = `${prompt} Archetype context: ${selectedArchetype.archetypeName}. ${selectedArchetype.corePersonality} ${selectedArchetype.behaviorPattern} Preferred response style: ${selectedArchetype.preferredResponseStyle}`;

  return {
    freshUpId,
    sourceType: 'procedural',
    scenarioId: freshUpId,
    scenarioName: `Generated Customer ${seed.toString(36).toUpperCase()}`,
    characterName: customerName,
    customerName,
    personalityType,
    buyingStage,
    primaryConcern,
    secondaryConcern,
    communicationStyle,
    vehicleInterest,
    difficultyLevel,
    emotionalState,
    conversationPrompt: blendedPrompt,
    scenarioPrompt: blendedPrompt,
    customerType,
    archetypeId: selectedArchetype.archetypeId,
    archetypeName: selectedArchetype.archetypeName,
    archetypeCategory: selectedArchetype.category,
    humorLevel: selectedArchetype.humorLevel,
    personalityTone: `${personalityType} and ${emotionalState}`,
    conversationStyle: communicationStyle,
    skillsTested,
    winCondition: 'Consultant stays curious, acknowledges concerns, and guides a clear next step.',
    failurePattern: 'Consultant rushes the conversation, ignores concerns, or gives vague responses.',
    coachingTag,
  };
}
