export type User = {
  userId: string;
  name: string;
  email: string;
  role: 'consultant' | 'manager';
  dealershipId: string;
  avatarUrl: string;
};

export type Lesson = {
  lessonId: string;
  title: string;
  role: 'consultant' | 'manager';
  category: 'Sales Process' | 'Product Knowledge' | 'Customer Service' | 'Financing';
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
