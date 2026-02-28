

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

export type User = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  dealershipIds: string[];
  avatarUrl: string;
  xp: number;
  brand?: string;
  phone?: string;
  address?: Address;
  isPrivate?: boolean;
  isPrivateFromOwner?: boolean;
  showDealerCriticalOnly?: boolean;
  memberSince?: string;
  privacyPolicyAcceptedAt?: string | null;
  privacyPolicyVersion?: string | null;
  selfDeclaredDealershipId?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'inactive';
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

export type Lesson = {
  lessonId: string;
  title: string;
  role: LessonRole;
  category: LessonCategory;
  associatedTrait: CxTrait;
  customScenario?: string;
  createdByUserId?: string;
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
  address?: Address;
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
