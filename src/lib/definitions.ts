
export type UserRole = 
  | 'consultant' 
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
  dealershipId: string;
  avatarUrl: string;
};

export type LessonRole = Exclude<UserRole, 'Owner' | 'Admin'>;

export type LessonCategory = 
  | 'Sales Process' 
  | 'Product Knowledge' 
  | 'Customer Service' 
  | 'Financing'
  | 'Service'
  | 'Parts';

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
};
