import type { User } from '@/lib/definitions';

export const CONSISTENCY_ROLES = [
  'Sales Consultant',
  'manager',
  'Trainer',
] as const;

export const CONSISTENCY_TIMEFRAMES = [
  'Last 3 days',
  'Last 7 days',
  'Last 14 days',
  'Last 30 days',
] as const;

export const CONSISTENCY_THEMES = [
  'greeting_consistency',
  'discovery_retention',
  'expectation_setting',
  'confidence_under_pressure',
  'customer_clarity',
  'follow_through',
  'old_habit_relapse',
  'manager_visibility',
  'team_experience_consistency',
] as const;

export const CONSISTENCY_MODULES = [
  {
    id: 'quick_pulse',
    title: 'Quick Pulse',
    subtitle: 'Instinctive read on core behaviors',
    style: 'cards',
  },
  {
    id: 'pressure_test',
    title: 'Pressure Test',
    subtitle: 'What holds when real pushback shows up',
    style: 'scenario',
  },
  {
    id: 'habit_drift',
    title: 'Habit Drift Scan',
    subtitle: 'Spot relapses and shortcuts quickly',
    style: 'slider',
  },
  {
    id: 'team_visibility',
    title: 'Team Consistency / Visibility',
    subtitle: 'Check reinforcement visibility across people',
    style: 'status',
  },
] as const;

export type ConsistencyRole = typeof CONSISTENCY_ROLES[number];
export type ConsistencyTimeframe = typeof CONSISTENCY_TIMEFRAMES[number];
export type ConsistencyTheme = typeof CONSISTENCY_THEMES[number];
export type ConsistencyBand = 'Sticking' | 'Wobbling' | 'Fading' | 'Needs Reinforcement';
export type ConsistencyModuleId = typeof CONSISTENCY_MODULES[number]['id'];

export type ConsistencyPromptOption = {
  key: string;
  label: string;
  score: 1 | 2 | 3 | 4;
};

export type ConsistencyPrompt = {
  id: string;
  moduleId: ConsistencyModuleId;
  themes: ConsistencyTheme[];
  roleText: Record<ConsistencyRole, string>;
  options: readonly ConsistencyPromptOption[];
};

export type ConsistencyResponses = Partial<Record<string, string>>;

export type ConsistencyDriftRow = {
  theme: ConsistencyTheme;
  label: string;
  score: number;
  percent: number;
  band: ConsistencyBand;
  atRisk: boolean;
};

export type ConsistencyResult = {
  overallScore: number;
  overallBand: ConsistencyBand;
  strongestZones: ConsistencyTheme[];
  weakZones: ConsistencyTheme[];
  whyThisIsHappening: string;
  nextReinforcementMove: string;
  interpretation: string;
  themeScores: Record<ConsistencyTheme, number>;
  driftMap: ConsistencyDriftRow[];
};

export type ConsistencySprocketEnhancement = {
  likelyCause: string;
  sharperReinforcementAngle: string;
  coachingLanguage: string;
  resetMove3Day: string;
};

export type ConsistencyCxEnhancement = {
  tailoredReason: string;
  adjustedMove: string;
  focusSkillTag: 'Listening' | 'Follow-Through' | 'Manager Visibility' | 'Tone/Pacing' | 'Trust';
  mapHighlights: ConsistencyTheme[];
};

export type ConsistencySavedDiagnostic = {
  id: string;
  createdAt: string;
  role: ConsistencyRole;
  timeframe: ConsistencyTimeframe;
  overallScore: number;
  overallBand: ConsistencyBand;
  weakZones: ConsistencyTheme[];
  strongestZones: ConsistencyTheme[];
  nextReinforcementMove: string;
  driftMap: Array<Pick<ConsistencyDriftRow, 'theme' | 'score' | 'band'>>;
};

const THEME_LABELS: Record<ConsistencyTheme, string> = {
  greeting_consistency: 'Greeting Consistency',
  discovery_retention: 'Discovery Retention',
  expectation_setting: 'Expectation Setting',
  confidence_under_pressure: 'Confidence Under Pressure',
  customer_clarity: 'Customer Clarity',
  follow_through: 'Follow-Through',
  old_habit_relapse: 'Old Habit Relapse',
  manager_visibility: 'Manager Visibility',
  team_experience_consistency: 'Team Experience Consistency',
};

const QUICK_PULSE_OPTIONS: readonly ConsistencyPromptOption[] = [
  { key: 'locked_in', label: 'Locked In', score: 4 },
  { key: 'mostly_there', label: 'Mostly There', score: 3 },
  { key: 'uneven', label: 'Uneven', score: 2 },
  { key: 'slipping', label: 'Slipping', score: 1 },
] as const;

const PRESSURE_OPTIONS: readonly ConsistencyPromptOption[] = [
  { key: 'holds', label: 'Holds', score: 4 },
  { key: 'softens', label: 'Softens', score: 2 },
  { key: 'breaks', label: 'Breaks', score: 1 },
] as const;

const DRIFT_OPTIONS: readonly ConsistencyPromptOption[] = [
  { key: 'none', label: 'No Drift', score: 4 },
  { key: 'some', label: 'Some Drift', score: 2 },
  { key: 'clear', label: 'Clear Drift', score: 1 },
] as const;

const VISIBILITY_OPTIONS: readonly ConsistencyPromptOption[] = [
  { key: 'strong', label: 'Strong', score: 4 },
  { key: 'mixed', label: 'Mixed', score: 2 },
  { key: 'weak', label: 'Weak', score: 1 },
] as const;

const CONSISTENCY_PROMPTS: readonly ConsistencyPrompt[] = [
  {
    id: 'pulse_greeting',
    moduleId: 'quick_pulse',
    themes: ['greeting_consistency'],
    roleText: {
      'Sales Consultant': 'Your trained greeting consistency lately feels:',
      Manager: 'Team greeting consistency lately feels:',
      'Trainer': 'Store-level greeting consistency lately feels:',
    },
    options: QUICK_PULSE_OPTIONS,
  },
  {
    id: 'pulse_discovery',
    moduleId: 'quick_pulse',
    themes: ['discovery_retention'],
    roleText: {
      'Sales Consultant': 'Your discovery habits lately feel:',
      Manager: 'Team discovery habits lately feel:',
      'Trainer': 'Discovery habit retention lately feels:',
    },
    options: QUICK_PULSE_OPTIONS,
  },
  {
    id: 'pressure_greeting',
    moduleId: 'pressure_test',
    themes: ['greeting_consistency', 'confidence_under_pressure'],
    roleText: {
      'Sales Consultant': 'When the customer pushes back early, your greeting discipline usually:',
      Manager: 'When customers push back early, team greeting discipline usually:',
      'Trainer': 'Under early pushback, greeting discipline usually:',
    },
    options: PRESSURE_OPTIONS,
  },
  {
    id: 'pressure_expectation',
    moduleId: 'pressure_test',
    themes: ['expectation_setting', 'customer_clarity'],
    roleText: {
      'Sales Consultant': 'When time pressure rises, your expectation setting usually:',
      Manager: 'When time pressure rises, team expectation setting usually:',
      'Trainer': 'When time pressure rises, expectation setting usually:',
    },
    options: [
      { key: 'clear', label: 'Stays Clear', score: 4 },
      { key: 'rushed', label: 'Gets Rushed', score: 2 },
      { key: 'skipped', label: 'Gets Skipped', score: 1 },
    ],
  },
  {
    id: 'pressure_follow_through',
    moduleId: 'pressure_test',
    themes: ['follow_through', 'customer_clarity'],
    roleText: {
      'Sales Consultant': 'After objections, your follow-through on the next step usually:',
      Manager: 'After objections, team follow-through on the next step usually:',
      'Trainer': 'After objections, follow-through on next steps usually:',
    },
    options: [
      { key: 'completes', label: 'Completes Cleanly', score: 4 },
      { key: 'partial', label: 'Partially Holds', score: 2 },
      { key: 'drops', label: 'Drops Off', score: 1 },
    ],
  },
  {
    id: 'drift_old_habits',
    moduleId: 'habit_drift',
    themes: ['old_habit_relapse'],
    roleText: {
      'Sales Consultant': 'Old greeting/discovery shortcuts are showing back up:',
      Manager: 'Old greeting/discovery shortcuts are showing back up on the team:',
      'Trainer': 'Old shortcut habits are showing back up:',
    },
    options: [
      { key: 'not_at_all', label: 'Not at All', score: 4 },
      { key: 'a_little', label: 'A Little', score: 2 },
      { key: 'regularly', label: 'Regularly', score: 1 },
    ],
  },
  {
    id: 'drift_discovery_depth',
    moduleId: 'habit_drift',
    themes: ['discovery_retention', 'confidence_under_pressure'],
    roleText: {
      'Sales Consultant': 'Discovery depth is drifting toward old habits:',
      Manager: 'Discovery depth across the team is drifting toward old habits:',
      'Trainer': 'Discovery depth is drifting toward old habits:',
    },
    options: DRIFT_OPTIONS,
  },
  {
    id: 'team_experience',
    moduleId: 'team_visibility',
    themes: ['team_experience_consistency'],
    roleText: {
      'Sales Consultant': 'Across your recent deals, customer experience felt:',
      Manager: 'Across the team, customer experience has felt:',
      'Trainer': 'Across teams and shifts, customer experience has felt:',
    },
    options: [
      { key: 'consistent', label: 'Consistent', score: 4 },
      { key: 'mixed', label: 'Mixed', score: 2 },
      { key: 'uneven', label: 'Highly Uneven', score: 1 },
    ],
  },
  {
    id: 'team_manager_visibility',
    moduleId: 'team_visibility',
    themes: ['manager_visibility'],
    roleText: {
      'Sales Consultant': 'Manager visibility reinforcing trained behavior has been:',
      Manager: 'Your visible reinforcement in live moments has been:',
      'Trainer': 'Manager reinforcement visibility has been:',
    },
    options: [
      { key: 'active', label: 'Active', score: 4 },
      { key: 'occasional', label: 'Occasional', score: 2 },
      { key: 'absent', label: 'Mostly Absent', score: 1 },
    ],
  },
  {
    id: 'team_expectation_clarity',
    moduleId: 'team_visibility',
    themes: ['expectation_setting', 'customer_clarity'],
    roleText: {
      'Sales Consultant': 'Customers are leaving conversations with clear expectations:',
      Manager: 'Customers are leaving team conversations with clear expectations:',
      'Trainer': 'Customers are leaving conversations with clear expectations:',
    },
    options: VISIBILITY_OPTIONS,
  },
] as const;

export function labelForTheme(theme: ConsistencyTheme): string {
  return THEME_LABELS[theme];
}

export function getConsistencyPromptsByModule(
  moduleId: ConsistencyModuleId,
  role: ConsistencyRole
): Array<ConsistencyPrompt & { prompt: string }> {
  return CONSISTENCY_PROMPTS
    .filter((prompt) => prompt.moduleId === moduleId)
    .map((prompt) => ({
      ...prompt,
      prompt: prompt.roleText[role],
    }));
}

function scoreForResponse(prompt: ConsistencyPrompt, responseKey: string | undefined): number {
  const option = prompt.options.find((item) => item.key === responseKey);
  if (!option) return 2;
  return option.score;
}

function mapBandFromScore(score: number): ConsistencyBand {
  if (score >= 3.35) return 'Sticking';
  if (score >= 2.65) return 'Wobbling';
  if (score >= 1.95) return 'Fading';
  return 'Needs Reinforcement';
}

function mapOverallBand(score: number): ConsistencyBand {
  if (score >= 78) return 'Sticking';
  if (score >= 60) return 'Wobbling';
  if (score >= 42) return 'Fading';
  return 'Needs Reinforcement';
}

function interpretationLine(band: ConsistencyBand): string {
  if (band === 'Sticking') return 'Strong behavior retention is visible. Keep pressure-proof reinforcement in place.';
  if (band === 'Wobbling') return 'Behavior is present, but pressure moments are creating drift.';
  if (band === 'Fading') return 'Adoption is slipping in live execution. Quick reinforcement is needed now.';
  return 'Behavior is not holding consistently. Immediate reset and visibility are required.';
}

function buildWhyThisIsHappening(weakZones: ConsistencyTheme[]): string {
  const weakSet = new Set(weakZones);

  if (weakSet.has('confidence_under_pressure') || weakSet.has('old_habit_relapse')) {
    return 'Behaviors are present in ideal moments, but pressure is exposing relapse patterns.';
  }
  if (weakSet.has('manager_visibility') || weakSet.has('team_experience_consistency')) {
    return 'Training landed, but daily reinforcement visibility appears too light to hold consistency.';
  }
  if (weakSet.has('expectation_setting') || weakSet.has('customer_clarity')) {
    return 'Execution is drifting at transition moments, causing customer clarity to weaken.';
  }
  if (weakSet.has('follow_through')) {
    return 'Completion discipline is fading late in interactions, which erodes carry-through momentum.';
  }
  return 'Adoption is visible, but consistency routines are not yet stable in live customer flow.';
}

function reinforcementMove(weakZones: ConsistencyTheme[]): string {
  const top = weakZones[0];
  const second = weakZones[1];

  if (!top) {
    return 'Run one focused reinforcement sprint for the next 5 working days on your weakest behavior.';
  }

  if (top === 'expectation_setting' || top === 'follow_through') {
    return 'Reinforce expectation setting and follow-through for the next 5 working days in every transition moment.';
  }
  if (top === 'discovery_retention' || top === 'confidence_under_pressure') {
    return 'Coach discovery under pressure for the next 5 working days, not only in calm conversations.';
  }
  if (top === 'manager_visibility') {
    return 'Increase manager visibility around greeting and transition moments for the next 5 working days.';
  }
  if (top === 'old_habit_relapse') {
    return 'Choose one relapsing habit, block it by name, and run daily replacement reps for the next 5 working days.';
  }

  if (second) {
    return `Reinforce ${labelForTheme(top)} and ${labelForTheme(second)} with one live checkpoint each shift for the next 5 working days.`;
  }

  return `Reinforce ${labelForTheme(top)} with one live checkpoint each shift for the next 5 working days.`;
}

export function scoreConsistencyGapCheck(input: {
  role: ConsistencyRole;
  timeframe: ConsistencyTimeframe;
  responses: ConsistencyResponses;
}): ConsistencyResult {
  const themeTotals = {} as Record<ConsistencyTheme, number>;
  const themeCounts = {} as Record<ConsistencyTheme, number>;

  CONSISTENCY_THEMES.forEach((theme) => {
    themeTotals[theme] = 0;
    themeCounts[theme] = 0;
  });

  CONSISTENCY_PROMPTS.forEach((prompt) => {
    const score = scoreForResponse(prompt, input.responses[prompt.id]);
    prompt.themes.forEach((theme) => {
      themeTotals[theme] += score;
      themeCounts[theme] += 1;
    });
  });

  const themeScores = {} as Record<ConsistencyTheme, number>;
  CONSISTENCY_THEMES.forEach((theme) => {
    const count = Math.max(themeCounts[theme], 1);
    themeScores[theme] = Number((themeTotals[theme] / count).toFixed(2));
  });

  const orderedThemes = [...CONSISTENCY_THEMES].sort((a, b) => themeScores[a] - themeScores[b]);
  const weakZones = orderedThemes.slice(0, 3);
  const strongestZones = [...orderedThemes].reverse().slice(0, 3);

  const avgScore = CONSISTENCY_THEMES.reduce((sum, theme) => sum + themeScores[theme], 0) / CONSISTENCY_THEMES.length;
  const overallScore = Math.round(((avgScore - 1) / 3) * 100);
  const overallBand = mapOverallBand(overallScore);

  const riskSet = new Set(weakZones);
  const driftMap: ConsistencyDriftRow[] = CONSISTENCY_THEMES.map((theme) => {
    const score = themeScores[theme];
    return {
      theme,
      label: labelForTheme(theme),
      score,
      percent: Math.round(((score - 1) / 3) * 100),
      band: mapBandFromScore(score),
      atRisk: riskSet.has(theme),
    };
  }).sort((a, b) => b.score - a.score);

  return {
    overallScore,
    overallBand,
    strongestZones,
    weakZones,
    whyThisIsHappening: buildWhyThisIsHappening(weakZones),
    nextReinforcementMove: reinforcementMove(weakZones),
    interpretation: interpretationLine(overallBand),
    themeScores,
    driftMap,
  };
}

export function getSprocketConsistencyEnhancement(
  result: ConsistencyResult
): ConsistencySprocketEnhancement {
  const weakTop = result.weakZones[0] ?? 'expectation_setting';
  const weakSecond = result.weakZones[1] ?? 'follow_through';

  let likelyCause = 'Behavior drift is likely coming from uneven reinforcement in pressure moments.';
  if (weakTop === 'old_habit_relapse') {
    likelyCause = 'Legacy habits are reappearing because replacement routines are not being reinforced live.';
  } else if (weakTop === 'manager_visibility') {
    likelyCause = 'Reinforcement is likely too invisible in real customer flow, so behaviors are not anchoring.';
  } else if (weakTop === 'discovery_retention') {
    likelyCause = 'Discovery behavior is being rushed, so confidence and clarity degrade downstream.';
  }

  return {
    likelyCause,
    sharperReinforcementAngle: `Anchor reinforcement around ${labelForTheme(weakTop)} and ${labelForTheme(weakSecond)} during live transitions, not recap-only coaching.`,
    coachingLanguage: `Coach line: "For the next 3 days, we are tightening ${labelForTheme(weakTop)} in every live interaction."`,
    resetMove3Day: `3-day reset focus: pre-shift cue, one live spot-coach, and one end-of-day review on ${labelForTheme(weakTop)}.`,
  };
}

type SkillSignals = {
  listeningLow: boolean;
  followUpLow: boolean;
  trustLow: boolean;
  toneLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const listening = Number(stats?.listening ?? 60);
  const followUp = Number(stats?.followUp ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const tone = Number(stats?.closing ?? 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    followUpLow: followUp > 0 && followUp < 55,
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
  };
}

export function getAutoDriveCxConsistencyEnhancement(
  result: ConsistencyResult,
  user?: User | null
): ConsistencyCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Listening trend suggests discovery drift creates downstream consistency wobble.',
      adjustedMove: `Prioritize discovery retention checks first, then run: ${result.nextReinforcementMove}`,
      focusSkillTag: 'Listening',
      mapHighlights: ['discovery_retention', 'customer_clarity'],
    };
  }
  if (signal.followUpLow) {
    return {
      tailoredReason: 'Follow-through trend indicates transition execution is likely where behavior is fading.',
      adjustedMove: 'Add explicit next-step verification in every interaction for the next 5 working days.',
      focusSkillTag: 'Follow-Through',
      mapHighlights: ['follow_through', 'expectation_setting'],
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Trust trend suggests clarity and expectation-setting consistency need earlier reinforcement.',
      adjustedMove: 'Use lower-pressure clarity language at each handoff before moving to the next ask.',
      focusSkillTag: 'Trust',
      mapHighlights: ['customer_clarity', 'expectation_setting'],
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tone/pacing trend suggests confidence under pressure is vulnerable in tense moments.',
      adjustedMove: 'Run short pressure-moment reps daily and coach for slower pacing with cleaner transitions.',
      focusSkillTag: 'Tone/Pacing',
      mapHighlights: ['confidence_under_pressure', 'old_habit_relapse'],
    };
  }

  return {
    tailoredReason: 'Current skill profile suggests reinforcement visibility and execution rhythm are the highest leverage.',
    adjustedMove: result.nextReinforcementMove,
    focusSkillTag: 'Manager Visibility',
    mapHighlights: ['manager_visibility', 'team_experience_consistency'],
  };
}

export function mapBandToOrder(band: ConsistencyBand): number {
  if (band === 'Sticking') return 0;
  if (band === 'Wobbling') return 1;
  if (band === 'Fading') return 2;
  return 3;
}

export function groupDriftMapByBand(driftMap: ConsistencyDriftRow[]): Record<ConsistencyBand, ConsistencyDriftRow[]> {
  const grouped: Record<ConsistencyBand, ConsistencyDriftRow[]> = {
    Sticking: [],
    Wobbling: [],
    Fading: [],
    'Needs Reinforcement': [],
  };

  driftMap.forEach((row) => {
    grouped[row.band].push(row);
  });

  (Object.keys(grouped) as ConsistencyBand[]).forEach((band) => {
    grouped[band].sort((a, b) => b.score - a.score);
  });

  return grouped;
}

export function getModuleCompletion(
  moduleId: ConsistencyModuleId,
  responses: ConsistencyResponses
): { answered: number; total: number } {
  const prompts = CONSISTENCY_PROMPTS.filter((prompt) => prompt.moduleId === moduleId);
  const answered = prompts.filter((prompt) => Boolean(responses[prompt.id])).length;
  return { answered, total: prompts.length };
}
