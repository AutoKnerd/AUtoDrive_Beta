export const carBrands = [
  'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet',
  'Chrysler', 'Dodge', 'Fiat', 'Ford', 'Genesis', 'GMC', 'Honda', 'Hyundai',
  'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Lincoln',
  'Maserati', 'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan',
  'Polestar', 'Porsche', 'Ram', 'Rivian', 'Subaru', 'Tesla', 'Toyota',
  'Volkswagen', 'Volvo'
];

export type Address = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type UserRole =
  | 'Sales Consultant'
  | 'BDC'
  | 'manager'
  | 'Service Writer'
  | 'Service Manager'
  | 'Finance Manager'
  | 'Parts Consultant'
  | 'Parts Manager'
  | 'General Manager'
  | 'Owner'
  | 'Trainer'
  | 'Admin'
  | 'Developer';

export type AisRoleType = 'sales' | 'service' | 'parts' | 'fi';
export type AisDisplayRole = AisRoleType | 'manager' | 'gm';

export const allRoles: UserRole[] = [
  'Developer',
  'Admin',
  'Owner',
  'Trainer',
  'General Manager',
  'manager',
  'Service Manager',
  'Parts Manager',
  'Finance Manager',
  'Sales Consultant',
  'BDC',
  'Service Writer',
  'Parts Consultant',
];

export const managerialRoles: UserRole[] = [
  'manager',
  'Service Manager',
  'Parts Manager',
  'Finance Manager',
  'Owner',
  'Trainer',
  'Admin',
  'General Manager',
  'Developer',
];

export const noPersonalDevelopmentRoles: UserRole[] = ['Owner', 'Trainer', 'Admin', 'Developer'];

export type ThemePreference = 'vibrant' | 'executive' | 'steel' | 'patriot' | 'velocity' | 'monochrome' | 'forest' | 'sunset' | 'oceanic' | 'cyber';

export type BillingSubscriptionStatus =
  | 'active'
  | 'inactive'
  | 'trialing'
  | 'past_due'
  | 'canceled';

export type DealershipBillingTier = 'sales_fi' | 'service_parts' | 'owner_hq';

export type User = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  signupRoleInterest?: UserRole;
  dealershipIds: string[];
  avatarUrl: string;
  xp: number;
  brand?: string;
  phone?: string;
  address?: Address;
  isPrivate?: boolean;
  isPrivateFromOwner?: boolean;
  showDealerCriticalOnly?: boolean;
  useProfessionalTheme?: boolean;
  themePreference?: ThemePreference;
  memberSince?: string;
  privacyPolicyAcceptedAt?: string | null;
  privacyPolicyVersion?: string | null;
  selfDeclaredDealershipId?: string;
  stripeCustomerId?: string;
  consultant_referral?: string;
  subscriptionStatus?: BillingSubscriptionStatus;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  hasSeenSprocketTour?: boolean;
  forceSprocketTourOnNextLogin?: boolean;
  freshUpMeter?: number;
  freshUpAvailable?: boolean;
  freshUpLastTriggeredAt?: string | null;
  freshUpLastCompletedAt?: string | null;
  freshUpCompletedCount?: number;
  stats?: Partial<UserStats>;
  ppp_enabled?: boolean;
  ppp_level?: number;
  ppp_lessons_passed?: Record<string, string[]>;
  ppp_progress_percentage?: number;
  ppp_badge?: string;
  ppp_abandonment_counter?: number;
  ppp_certified?: boolean;
  ppp_daily_pass_date?: string;
  ppp_daily_pass_count?: number;
  saas_ppp_enabled?: boolean;
  saas_ppp_level_completed?: number;
  saas_ppp_current_level?: number;
  saas_ppp_current_level_progress?: number;
  saas_ppp_primary_channel?: string;
  saas_ppp_secondary_channel?: string | null;
  saas_ppp_certified_timestamp?: string | null;
  saas_ppp_l2_phase?: 'primary' | 'secondary';
  saas_ppp_lessons_passed?: Record<string, string[]>;
  saas_ppp_abandonment_counter?: number;
  passwordSetup?: {
    status?: 'pending' | 'used' | 'failed';
    link?: string;
    setupToken?: string;
    createdAt?: string;
    usedAt?: string | null;
    createdByUserId?: string | null;
    mode?: 'redirect' | 'default' | null;
    error?: string | null;
  };
};

export type LessonRole = Exclude<UserRole, 'Owner' | 'Admin'> | 'global';

export type LessonCategory =
  | 'Sales - Meet and Greet'
  | 'Sales - Needs Assessment'
  | 'Sales - Vehicle Presentation'
  | 'Sales - Test Drive'
  | 'Sales - Negotiation'
  | 'Sales - Closing'
  | 'Sales - Delivery'
  | 'Sales - Follow-up'
  | 'Service - Appointment'
  | 'Service - Write-up'
  | 'Service - Walk-around'
  | 'Service - Presenting MPI'
  | 'Service - Status Updates'
  | 'Service - Active Delivery'
  | 'Parts - Identifying Needs'
  | 'Parts - Sourcing'
  | 'F&I - Menu Selling'
  | 'F&I - Objection Handling'
  | 'Product Knowledge'
  | 'Management - Coaching'
  | 'Management - Performance Review'
  | 'Leadership - Team Motivation'
  | 'Leadership - Conflict Resolution'
  | 'Operations - Financial Acumen'
  | 'Operations - Process Improvement';

export const lessonCategoriesByRole: Record<string, LessonCategory[]> = {
  'Sales Consultant': [
    'Sales - Meet and Greet',
    'Sales - Needs Assessment',
    'Sales - Vehicle Presentation',
    'Sales - Test Drive',
    'Sales - Negotiation',
    'Sales - Closing',
    'Sales - Delivery',
    'Sales - Follow-up',
    'Product Knowledge',
  ],
  BDC: [
    'Sales - Meet and Greet',
    'Sales - Needs Assessment',
    'Sales - Follow-up',
    'Product Knowledge',
  ],
  manager: [ // Sales Manager
    'Management - Coaching',
    'Management - Performance Review',
  ],
  'Service Writer': [
    'Service - Appointment',
    'Service - Write-up',
    'Service - Walk-around',
    'Service - Presenting MPI',
    'Service - Status Updates',
    'Service - Active Delivery',
    'Product Knowledge',
  ],
  'Service Manager': [
    'Service - Appointment',
    'Service - Write-up',
    'Service - Walk-around',
    'Service - Presenting MPI',
    'Service - Status Updates',
    'Service - Active Delivery',
    'Product Knowledge',
    'Management - Coaching',
    'Management - Performance Review',
  ],
  'Finance Manager': [
    'F&I - Menu Selling',
    'F&I - Objection Handling',
    'Product Knowledge',
  ],
  'Parts Consultant': [
    'Parts - Identifying Needs',
    'Parts - Sourcing',
    'Product Knowledge',
  ],
  'Parts Manager': [
    'Parts - Identifying Needs',
    'Parts - Sourcing',
    'Product Knowledge',
    'Management - Coaching',
    'Management - Performance Review',
  ],
  'General Manager': [
    'Leadership - Team Motivation',
    'Leadership - Conflict Resolution',
    'Operations - Financial Acumen',
    'Operations - Process Improvement',
  ],
  'Developer': [],
  // No categories for trainer
};

const allCategories = Object.values(lessonCategoriesByRole).flat();
export const lessonCategories: LessonCategory[] = [...new Set(allCategories)];


export type CxTrait = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationshipBuilding';

export type RatingKey = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';

export type Ratings = {
  empathy: number;
  listening: number;
  trust: number;
  followUp: number;
  closing: number;
  relationship: number;
};

export type InteractionSeverity = 'normal' | 'behavior_violation';

export type UserStat = {
  score: number;
  lastUpdated: Date | { toDate: () => Date };
};

export type UserStats = Record<RatingKey, UserStat>;

export type Lesson = {
  lessonId: string;
  title: string;
  role: LessonRole;
  category: LessonCategory;
  associatedTrait: CxTrait;
  lessonType?: 'standard' | 'fresh-up';
  customScenario?: string;
  createdByUserId?: string;
  dealershipIds?: string[];
};

export type FreshUpProfile = {
  freshUpId: string;
  sourceType: 'procedural' | 'signature';
  roleType?: AisRoleType;
  scenarioId?: string;
  scenarioName?: string;
  characterName: string;
  customerName: string;
  personalityType: string;
  buyingStage: string;
  communicationStyle: string;
  emotionalState: string;
  conversationPrompt: string;
  scenarioPrompt?: string;
  customerType: string;
  vehicleInterest: string;
  personalityTone: string;
  primaryConcern: string;
  secondaryConcern: string;
  conversationStyle: string;
  skillsTested: string[];
  difficultyLevel: 'easy' | 'medium' | 'hard';
  archetypeId: string;
  archetypeName: string;
  archetypeCategory: FreshUpArchetypeCategory;
  humorLevel: 0 | 1 | 2 | 3;
  winCondition: string;
  failurePattern: string;
  coachingTag: FreshUpTag;
};

export type FreshUpArchetypeCategory =
  | 'friendly'
  | 'curious'
  | 'funny'
  | 'analytical'
  | 'skeptical'
  | 'budget_focused'
  | 'high_stakes'
  | 'family_complex'
  | 'emotional'
  | 'unusual';

export type FreshUpArchetype = {
  archetypeId: string;
  archetypeName: string;
  category: FreshUpArchetypeCategory;
  corePersonality: string;
  defaultTone: string;
  behaviorPattern: string;
  commonStrength: string;
  commonFriction: string;
  preferredResponseStyle: string;
  skillsTested: Array<'empathy' | 'listening' | 'trust' | 'follow_up' | 'closing' | 'relationship'>;
  humorLevel: 0 | 1 | 2 | 3;
  difficultyBias: 'easy' | 'medium' | 'hard' | 'mixed';
  exampleOpeningStyle: string;
};

export type FreshUpMemoryState = {
  rememberedConcerns: string[];
  acknowledgedConcerns: string[];
  promisesMade: string[];
  promisesResolved: string[];
  rapportMoments: number;
  trustBreaks: number;
  repeatedQuestions: number;
  positiveMoments: number;
  emotionalShifts: string[];
  askedQuestions: string[];
};

export type FreshUpOutcome = 'successful' | 'mixed' | 'needs-work';
export type FreshUpOutcomeTag =
  | 'Customer Engaged'
  | 'Trust Established'
  | 'Appointment Set'
  | 'Lost Momentum'
  | 'Conversation Breakdown';

export type FreshUpEndingType =
  | 'positive_progress'
  | 'neutral_pause'
  | 'stalled_conversation'
  | 'trust_break'
  | 'appointment_ready';

export type FreshUpRecommendedNextStep =
  | 'discovery_lesson'
  | 'trust_building_lesson'
  | 'closing_lesson'
  | 'relationship_lesson'
  | 'follow_up_lesson'
  | 'no_recommendation';

export type FreshUpTag =
  | 'price_first'
  | 'payment_focus'
  | 'trust_drop'
  | 'weak_discovery'
  | 'knowledge_gap'
  | 'strong_empathy'
  | 'empathy_builder'
  | 'missed_influence'
  | 'feature_confusion'
  | 'weak_follow_up'
  | 'trust_pressure'
  | 'discount_focus'
  | 'premature_close'
  | 'missed_connection'
  | 'trust_gap'
  | 'clarity_needed'
  | 'tech_resistance'
  | 'relationship_opportunity'
  | 'closing_miss'
  | 'needs_alignment'
  | 'trust_rebuild'
  | 'process_efficiency'
  | 'feature_miss'
  | 'comparison_gap'
  | 'loyalty_opportunity'
  | 'negotiation_pressure'
  | 'relationship_build'
  | 'strong_relationship'
  | 'trust_builder'
  | 'closing_strength'
  | 'needs_listening'
  | 'relationship_builder';

export type FreshUpSandboxConfig = {
  enabled: boolean;
  roleType: AisRoleType | 'random';
  roleLabelKey?: AisDisplayRole | 'random';
  interactionDisplayLabel?: string;
  sourceType: 'procedural' | 'signature' | 'random';
  difficulty: 'easy' | 'medium' | 'hard' | 'random';
  vehicleInterest: 'SUV' | 'truck' | 'sedan' | 'hybrid' | 'EV' | 'performance vehicle' | 'family vehicle' | 'random';
  primaryConcern: 'price' | 'trade value' | 'monthly payment' | 'reliability' | 'technology confusion' | 'fuel economy' | 'safety' | 'time efficiency' | 'random';
  startingMood: 'cautious' | 'curious' | 'stressed' | 'excited' | 'guarded' | 'frustrated' | 'optimistic' | 'random';
  personalityType: 'analytical' | 'friendly' | 'skeptical' | 'impatient' | 'overwhelmed' | 'excited' | 'defensive' | 'random';
  communicationStyle: 'talkative' | 'reserved' | 'direct' | 'sarcastic' | 'story-driven' | 'cautious' | 'rapid-fire questions' | 'random';
  forceProfileIdOrName?: string;
  forceArchetypeIdOrName?: string;
  startingUpMeter: number;
  memoryDebugMode: boolean;
  scoringDebugMode: boolean;
  saveSessionToLiveAnalytics: boolean;
};

export type LessonLog = {
  logId: string;
  timestamp: Date;
  userId: string;
  dealerId?: string;
  lessonId: string;
  stepResults: Record<string, 'pass' | 'fail'>;
  xpGained: number;
  empathy: number;
  listening: number;
  trust: number;
  followUp: number;
  closing: number;
  relationshipBuilding: number;
  ratings?: Ratings;
  severity?: InteractionSeverity;
  flags?: string[];
  trainedTrait?: string;
  coachSummary?: string;
  recommendedNextFocus?: string;
  activitySource?: 'core' | 'fresh-up' | 'ppp' | 'saas-ppp';
  scoreDelta?: {
    empathy: number;
    listening: number;
    trust: number;
    followUp: number;
    closing: number;
    relationshipBuilding: number;
  };
  isRecommended: boolean;
  startedAt?: Date;
  completionStatus?: 'completed' | 'abandoned' | 'skipped';
  conversationLength?: number;
  outcome?: FreshUpOutcome;
  outcomeTag?: FreshUpOutcomeTag;
  freshUpId?: string;
  characterName?: string;
  coachingTag?: FreshUpTag;
  summaryTag?: FreshUpTag;
  sprocketCoachingLine?: string;
  difficulty?: number;
  sourceType?: 'procedural' | 'signature';
  personalityType?: string;
  buyingStage?: string;
  primaryConcern?: string;
  secondaryConcern?: string;
  communicationStyle?: string;
  vehicleInterestLabel?: string;
  difficultyLevel?: string;
  startingEmotionalState?: string;
  endingEmotionalState?: string;
  finalCustomerResponse?: string;
  endingType?: FreshUpEndingType;
  recommendedNextStep?: FreshUpRecommendedNextStep;
  trustShift?: number;
  archetypeId?: string;
  archetypeName?: string;
  archetypeCategory?: FreshUpArchetypeCategory;
  humorLevel?: 0 | 1 | 2 | 3;
  guardrailFlags?: string[];
  contentValidationPassed?: boolean;
  validationFailureReasons?: string[];
  skillWeightMultiplier?: number;
  freshUpVersionId?: string;
  freshUpVersionName?: string;
  isExperimental?: boolean;
  environment?: 'sandbox' | 'production';
  empathyDelta?: number;
  listeningDelta?: number;
  trustDelta?: number;
  followUpDelta?: number;
  closingDelta?: number;
  relationshipDelta?: number;
  roleType?: AisRoleType;
  scoreBand?: 'Needs Immediate Support' | 'Below Standard' | 'Developing' | 'Strong' | 'Excellent';
  interactionDisplayLabel?: string;
  concernCategoryRoleSpecific?: string;
  nextStepType?: string;
  roleLanguageVersion?: string;
};

export type EmailInvitation = {
  token: string;
  dealershipId: string;
  dealershipName: string;
  role: UserRole;
  email: string;
  claimed: boolean;
  inviterId: string;
};

export type PendingInvitation = EmailInvitation & {
  createdAt?: Date;
  expiresAt?: Date;
};

export type Dealership = {
  id: string;
  name: string;
  trainerId?: string;
  status: 'active' | 'paused' | 'deactivated';
  // Optional logical grouping for cross-store management.
  groupDealershipIds?: string[];
  address?: Address;
  enableRetakeRecommendedTesting?: boolean;
  enableNewRecommendedTesting?: boolean;
  disableManagementPrivateDataViewing?: boolean;
  enablePppProtocol?: boolean;
  enableSaasPppTraining?: boolean;
  billingTier?: DealershipBillingTier;
  billingSubscriptionStatus?: BillingSubscriptionStatus;
  billingTrialStartedAt?: string | null;
  billingTrialEndsAt?: string | null;
  billingStripeCustomerId?: string;
  billingStripeSubscriptionId?: string;
  billingUserCount?: number;
  billingOwnerAccountCount?: number;
  billingStoreCount?: number;
};

export type LessonAssignment = {
  assignmentId: string;
  userId: string;
  lessonId: string;
  assignerId: string;
  timestamp: Date;
  completed: boolean;
};

export type BadgeId =
  | 'first-drive'
  | 'xp-1000'
  | 'xp-5000'
  | 'xp-10000'
  | 'level-10'
  | 'level-25'
  | 'top-performer'
  | 'perfectionist'
  | 'empathy-expert'
  | 'listening-expert'
  | 'trust-builder'
  | 'follow-up-pro'
  | 'closing-champ'
  | 'relationship-ace'
  | 'managers-pick'
  | 'night-owl'
  | 'early-bird'
  | 'sales-specialist'
  | 'service-specialist'
  | 'talent-scout'
  | 'curriculum-architect'
  | 'empire-builder';

export type Badge = {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
};

export type EarnedBadge = {
  userId: string;
  badgeId: BadgeId;
  timestamp: Date;
};

export type MessageTargetScope = 'global' | 'dealership' | 'department';

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  content: string;
  scope: MessageTargetScope;
  // For 'global', this is 'all'.
  // For 'dealership', this is dealershipId.
  // For 'department', this is dealershipId.
  targetId: string;
  targetRole?: UserRole; // For 'department' scope to target specific roles
};
