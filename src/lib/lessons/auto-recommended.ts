import type { CxTrait, Lesson, LessonCategory, LessonRole } from '@/lib/definitions';
import { lessonCategoriesByRole } from '@/lib/definitions';

const TRAIT_LABELS: Record<CxTrait, string> = {
  empathy: 'Empathy',
  listening: 'Listening',
  trust: 'Trust',
  followUp: 'Follow Up',
  closing: 'Closing',
  relationshipBuilding: 'Relationship Building',
};

const SCENARIO_TEMPLATES: Record<CxTrait, string[]> = {
  empathy: [
    'A customer arrives frustrated after a long wait and expects you to rush. How do you acknowledge emotion first, then guide the interaction calmly?',
    'A guest seems anxious about making a wrong decision. What empathetic response helps them feel understood before you move forward?',
    'A customer appears disengaged and answers in short phrases. How do you show empathy and reopen trust in the conversation?',
  ],
  listening: [
    'A customer gives multiple priorities that conflict. What listening approach helps you clarify the top priority before recommending a next step?',
    'A guest shares concerns quickly and jumps topics. How do you summarize and confirm key needs so they feel heard?',
    'A customer says, "I do not want to repeat myself." How do you demonstrate active listening and regain confidence immediately?',
  ],
  trust: [
    'A customer challenges your recommendation and asks if you are upselling. How do you respond with transparency and evidence to build trust?',
    'A buyer asks for side-by-side options and worries about hidden costs. How do you present clearly to strengthen trust?',
    'A customer says they had a bad experience elsewhere. What trust-building language and actions do you use in the first five minutes?',
  ],
  followUp: [
    'A customer went quiet after showing strong interest yesterday. What follow-up message keeps value high without sounding pushy?',
    'A prior customer had a positive visit but did not commit. How do you structure a follow-up that feels personal and relevant?',
    'A guest requested more information and has not replied in two days. What follow-up sequence would you use next?',
  ],
  closing: [
    'A customer agrees on value but hesitates to decide today. How do you close with confidence while keeping customer comfort high?',
    'A buyer asks to think overnight even though key concerns are resolved. What closing question helps move to commitment respectfully?',
    'A customer says, "I am close, but not quite there." How do you close the final gap without pressure tactics?',
  ],
  relationshipBuilding: [
    'A customer interaction ends successfully. What specific next steps would you take to build a longer-term relationship?',
    'A returning customer wants efficient service and recognition. How do you personalize the interaction to deepen loyalty?',
    'A customer gives positive feedback but shows little emotional connection. What relationship-building actions do you take now and after the visit?',
  ],
};

function toRoleSlug(role: LessonRole): string {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function traitLabel(trait: CxTrait): string {
  return TRAIT_LABELS[trait];
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function dateTimeKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
}

function dateLabel(key: string): string {
  if (!/^\d{8}$/.test(key)) return key;
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

function pickCategory(role: LessonRole, trait: CxTrait, key: string): LessonCategory {
  const categories = lessonCategoriesByRole[role] as LessonCategory[] | undefined;
  if (!categories || categories.length === 0) return 'Product Knowledge';
  const index = hashSeed(`${role}:${trait}:${key}:category`) % categories.length;
  return categories[index];
}

function pickScenario(role: LessonRole, trait: CxTrait, key: string): string {
  const templates = SCENARIO_TEMPLATES[trait];
  const index = hashSeed(`${role}:${trait}:${key}:scenario`) % templates.length;
  return `${templates[index]} Context: ${role} role, customer-first standards, and ethical communication.`;
}

function pickTestingTwist(role: LessonRole, trait: CxTrait, key: string): string {
  const twists = [
    'The customer has limited time and asks for a concise interaction.',
    'A second stakeholder joins midway with a different priority.',
    'The customer asks a skeptical follow-up after your first recommendation.',
    'The interaction starts positive, then shifts after a new objection.',
    'You need to recover after a misunderstood statement.',
  ];
  const index = hashSeed(`${role}:${trait}:${key}:twist`) % twists.length;
  return twists[index];
}

function randomSuffix(size: number = 6): string {
  return Math.random().toString(36).slice(2, 2 + size);
}

export function buildAutoRecommendedLessonId(role: LessonRole, trait: CxTrait, now: Date = new Date()): string {
  return `auto-${toRoleSlug(role)}-${trait}-${dateKey(now)}`;
}

export function buildAutoRecommendedLesson(
  role: LessonRole,
  trait: CxTrait,
  now: Date = new Date()
): Lesson {
  const key = dateKey(now);
  const lessonId = buildAutoRecommendedLessonId(role, trait, now);
  const title = `${role} ${traitLabel(trait)} Daily Drill (${dateLabel(key)})`;

  return {
    lessonId,
    title,
    role,
    associatedTrait: trait,
    category: pickCategory(role, trait, key),
    customScenario: pickScenario(role, trait, key),
    createdByUserId: 'system-ai',
  };
}

export function buildUniqueRecommendedTestingLesson(
  role: LessonRole,
  trait: CxTrait,
  now: Date = new Date()
): Lesson {
  const timestamp = dateTimeKey(now);
  const nonce = randomSuffix();
  const entropyKey = `${timestamp}-${nonce}`;
  const lessonId = `auto-testing-${toRoleSlug(role)}-${trait}-${entropyKey}`;
  const title = `${role} ${traitLabel(trait)} Testing Drill ${now.toLocaleString('en-US')}`;
  const baseScenario = pickScenario(role, trait, entropyKey);
  const twist = pickTestingTwist(role, trait, entropyKey);

  return {
    lessonId,
    title,
    role,
    associatedTrait: trait,
    category: pickCategory(role, trait, entropyKey),
    customScenario: `${baseScenario} Additional constraint: ${twist} Scenario ID: ${entropyKey}.`,
    createdByUserId: 'system-ai-testing',
  };
}
