

export type Address = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type UserRole = 
  | 'Sales Consultant' 
  | 'manager' 
  | 'Service Writer' 
  | 'Service Manager' 
  | 'Finance Manager' 
  | 'Parts Consultant' 
  | 'Parts Manager' 
  | 'Owner'
  | 'Trainer'
  | 'Admin';

export type User = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  dealershipIds: string[];
  avatarUrl: string;
  xp: number;
  phone?: string;
  address?: Address;
  isPrivate?: boolean;
  isPrivateFromOwner?: boolean;
  memberSince?: string;
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
  | 'Product Knowledge';

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
  manager: [ // Sales Manager
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
  ],
  // No categories for trainer
};

const allCategories = Object.values(lessonCategoriesByRole).flat();
export const lessonCategories: LessonCategory[] = [...new Set(allCategories)];


export type CxTrait = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationshipBuilding';

export type Lesson = {
  lessonId: string;
  title: string;
  role: LessonRole;
  category: LessonCategory;
  associatedTrait: CxTrait;
  customScenario?: string;
};

export type LessonLog = {
  logId: string;
  timestamp: Date;
  userId: string;
  lessonId: string;
  stepResults: Record<string, 'pass' | 'fail'>;
  xpGained: number;
  empathy: number;
  listening: number;
  trust: number;
  followUp: number;
  closing: number;
  relationshipBuilding: number;
  isRecommended: boolean;
};

export type EmailInvitation = {
  token: string;
  dealershipId: string;
  role: UserRole;
  email: string;
  claimed: boolean;
};

export type Dealership = {
  id: string;
  name: string;
  trainerId?: string;
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
  | 'service-specialist';

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
