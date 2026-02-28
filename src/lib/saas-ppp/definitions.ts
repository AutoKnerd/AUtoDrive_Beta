export type SaasPppLevel = 1 | 2 | 3 | 4 | 5;

export type SaasLeadChannel =
  | 'cold_calling'
  | 'cold_email'
  | 'linkedin_outreach'
  | 'content_inbound'
  | 'referrals'
  | 'not_sure';

export type SaasPppPhase = 'primary' | 'secondary';

export type SaasPppLessonTemplate = {
  lessonId: string;
  level: SaasPppLevel;
  levelTitle: string;
  phase?: SaasPppPhase;
  channel?: SaasLeadChannel;
  title: string;
  objective: string;
  sequence: number;
  scenario: string;
};

export const SAAS_PPP_LEVEL_MIN: SaasPppLevel = 1;
export const SAAS_PPP_LEVEL_MAX: SaasPppLevel = 5;

export const SAAS_PPP_LEVELS: Array<{ level: SaasPppLevel; title: string }> = [
  { level: 1, title: 'Regulated Authority' },
  { level: 2, title: 'Strategic Lead Generation' },
  { level: 3, title: 'Strategic Diagnosis' },
  { level: 4, title: 'Precision Alignment' },
  { level: 5, title: 'Pricing Stability & Objection Regulation' },
];

export const SAAS_PPP_LEVEL_XP: Record<SaasPppLevel, number> = {
  1: 140,
  2: 260,
  3: 360,
  4: 480,
  5: 640,
};

export const SAAS_PPP_L2_SECONDARY_BONUS_XP = 120;

export const SAAS_LEAD_CHANNEL_OPTIONS: Array<{ value: SaasLeadChannel; label: string }> = [
  { value: 'cold_calling', label: 'Cold calling' },
  { value: 'cold_email', label: 'Cold email' },
  { value: 'linkedin_outreach', label: 'LinkedIn outreach' },
  { value: 'content_inbound', label: 'Content-driven inbound' },
  { value: 'referrals', label: 'Referrals' },
  { value: 'not_sure', label: 'Not sure yet' },
];

const SAAS_CHANNEL_CONTEXT: Record<SaasLeadChannel, string> = {
  cold_calling: 'live call opening and objection handling',
  cold_email: 'first-touch email and follow-up sequencing',
  linkedin_outreach: 'LinkedIn connection and DM progression',
  content_inbound: 'inbound lead triage and consultative response',
  referrals: 'warm intro conversion and trust transfer',
  not_sure: 'multi-channel testing and baseline outreach practice',
};

type BaseLesson = {
  id: string;
  title: string;
  objective: string;
};

const LEVEL_LESSONS: Record<Exclude<SaasPppLevel, 2>, BaseLesson[]> = {
  1: [
    {
      id: 'l1-authority-frame',
      title: 'Authority Frame Setup',
      objective: 'Set clear ownership of the conversation without sounding rigid.',
    },
    {
      id: 'l1-regulated-language',
      title: 'Regulated Language',
      objective: 'Use concise phrasing that keeps confidence and compliance aligned.',
    },
    {
      id: 'l1-pace-control',
      title: 'Pace Control',
      objective: 'Control tempo under pressure and avoid rushing into pitch mode.',
    },
    {
      id: 'l1-curiosity-balance',
      title: 'Curiosity Balance',
      objective: 'Stay curious without losing structure or sounding scripted.',
    },
    {
      id: 'l1-stability-close',
      title: 'Stability Close',
      objective: 'End interactions with calm authority and a clear next step.',
    },
  ],
  3: [
    {
      id: 'l3-diagnosis-depth',
      title: 'Diagnosis Depth',
      objective: 'Uncover operational pain and business impact with layered questioning.',
    },
    {
      id: 'l3-risk-surface',
      title: 'Risk Surface',
      objective: 'Identify emotional and organizational risk blockers early.',
    },
    {
      id: 'l3-priority-order',
      title: 'Priority Order',
      objective: 'Sequence problems by urgency, ownership, and business impact.',
    },
    {
      id: 'l3-confirmation-loop',
      title: 'Confirmation Loop',
      objective: 'Confirm diagnosis in customer language before solution framing.',
    },
  ],
  4: [
    {
      id: 'l4-outcome-alignment',
      title: 'Outcome Alignment',
      objective: 'Map product capabilities directly to diagnosis outcomes.',
    },
    {
      id: 'l4-stakeholder-fit',
      title: 'Stakeholder Fit',
      objective: 'Align message to technical, financial, and executive stakeholders.',
    },
    {
      id: 'l4-proof-selection',
      title: 'Proof Selection',
      objective: 'Use only proof points that reinforce stated buying criteria.',
    },
    {
      id: 'l4-next-step-contract',
      title: 'Next-Step Contract',
      objective: 'Lock precise next actions with timing and owner confirmation.',
    },
  ],
  5: [
    {
      id: 'l5-pricing-frame',
      title: 'Pricing Frame Stability',
      objective: 'Present pricing with certainty and without defensive language.',
    },
    {
      id: 'l5-objection-regulation',
      title: 'Objection Regulation',
      objective: 'Regulate objections through clarification and alignment, not pressure.',
    },
    {
      id: 'l5-discount-discipline',
      title: 'Discount Discipline',
      objective: 'Protect value and avoid premature concessions.',
    },
    {
      id: 'l5-close-under-pressure',
      title: 'Close Under Pressure',
      objective: 'Maintain composure and decision leadership in final negotiations.',
    },
  ],
};

const L2_PRIMARY_LESSONS: BaseLesson[] = [
  {
    id: 'l2-tone-control',
    title: 'Tone Control',
    objective: 'Use calm, credible tone that creates authority and safety.',
  },
  {
    id: 'l2-curiosity-outreach',
    title: 'Curiosity-Driven Outreach',
    objective: 'Lead with diagnosis curiosity instead of pitch language.',
  },
  {
    id: 'l2-no-premature-pitch',
    title: 'No Premature Pitch',
    objective: 'Avoid product pitching before clear qualification.',
  },
  {
    id: 'l2-followup-pacing',
    title: 'Follow-up Pacing',
    objective: 'Sequence follow-ups with intent, spacing, and relevance.',
  },
  {
    id: 'l2-rejection-regulation',
    title: 'Rejection Regulation',
    objective: 'Regulate emotional response and maintain composure on rejection.',
  },
];

const L2_SECONDARY_LESSONS: BaseLesson[] = [
  {
    id: 'l2-secondary-open',
    title: 'Secondary Channel Open',
    objective: 'Establish channel-appropriate opening with authority.',
  },
  {
    id: 'l2-secondary-qualification',
    title: 'Secondary Qualification',
    objective: 'Qualify quickly while preserving trust and pacing.',
  },
  {
    id: 'l2-secondary-stability',
    title: 'Secondary Stability',
    objective: 'Maintain consistency under objections and low-response conditions.',
  },
];

export function clampSaasPppLevel(level: number): SaasPppLevel {
  if (!Number.isFinite(level)) return SAAS_PPP_LEVEL_MIN;
  const rounded = Math.round(level);
  if (rounded <= SAAS_PPP_LEVEL_MIN) return SAAS_PPP_LEVEL_MIN;
  if (rounded >= SAAS_PPP_LEVEL_MAX) return SAAS_PPP_LEVEL_MAX;
  return rounded as SaasPppLevel;
}

export function getSaasPppLevelTitle(level: number): string {
  const safe = clampSaasPppLevel(level);
  return SAAS_PPP_LEVELS.find((entry) => entry.level === safe)?.title ?? SAAS_PPP_LEVELS[0].title;
}

export function getSaasPppChannelLabel(channel: SaasLeadChannel | null | undefined): string {
  if (!channel) return 'Not selected';
  return SAAS_LEAD_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? 'Not selected';
}

export function sanitizeSaasLeadChannel(channel: unknown): SaasLeadChannel | null {
  if (typeof channel !== 'string') return null;
  const option = SAAS_LEAD_CHANNEL_OPTIONS.find((entry) => entry.value === channel);
  return option?.value ?? null;
}

export function getSaasPppLevelBadge(level: number, certifiedTimestamp?: string | null): string {
  if (certifiedTimestamp) return 'saas-ppp-lvl-5-certified';
  return `saas-ppp-lvl-${clampSaasPppLevel(level)}`;
}

export function getSaasPppLessonsForLevel(
  level: number,
  options?: {
    primaryChannel?: SaasLeadChannel | null;
    secondaryChannel?: SaasLeadChannel | null;
    phase?: SaasPppPhase;
  }
): SaasPppLessonTemplate[] {
  const safeLevel = clampSaasPppLevel(level);
  const levelTitle = getSaasPppLevelTitle(safeLevel);

  if (safeLevel === 2) {
    const phase = options?.phase ?? 'primary';
    const channel = phase === 'primary' ? options?.primaryChannel : options?.secondaryChannel;
    if (!channel) return [];

    const lessonSet = phase === 'primary' ? L2_PRIMARY_LESSONS : L2_SECONDARY_LESSONS;
    return lessonSet.map((lesson, index) => ({
      lessonId: `saas-ppp-l2-${phase}-${channel}-${lesson.id}`,
      level: safeLevel,
      levelTitle,
      phase,
      channel,
      title: lesson.title,
      objective: lesson.objective,
      sequence: index + 1,
      scenario: [
        `SaaS PPP ${levelTitle}.`,
        `Channel: ${getSaasPppChannelLabel(channel)}.`,
        `Context: ${SAAS_CHANNEL_CONTEXT[channel]}.`,
      ].join(' '),
    }));
  }

  const levelLessons = LEVEL_LESSONS[safeLevel as Exclude<SaasPppLevel, 2>] || [];
  return levelLessons.map((lesson, index) => ({
    lessonId: `saas-ppp-l${safeLevel}-${lesson.id}`,
    level: safeLevel,
    levelTitle,
    title: lesson.title,
    objective: lesson.objective,
    sequence: index + 1,
    scenario: `SaaS PPP ${levelTitle}. Objective: ${lesson.objective}`,
  }));
}

export function getSaasPppLevelXp(level: number): number {
  return SAAS_PPP_LEVEL_XP[clampSaasPppLevel(level)];
}

export function getSaasPppLessonXp(
  level: number,
  lessonCount: number,
  phase?: SaasPppPhase
): number {
  const safeLevel = clampSaasPppLevel(level);
  const safeCount = Math.max(1, Math.round(lessonCount));

  if (safeLevel === 2 && phase === 'secondary') {
    return Math.max(1, Math.round(SAAS_PPP_L2_SECONDARY_BONUS_XP / safeCount));
  }

  return Math.max(1, Math.round(getSaasPppLevelXp(safeLevel) / safeCount));
}

