// Deterministic synthesis for the Session Impact finale (the deck's close). Rolls
// up the whole session — knowledge lift (pre→post quiz), confidence lift, pass
// rate, and opt-in rate — into the SAME contract the slide-32 render consumes,
// plus display labels. AI narrative is layered on by the impact flow.

type FeatureRef = { label: string; icon: string };

export const IMPACT_RESPONSE_KEYS = {
  pretest: 'pretest',
  posttest: 'posttest',
  confidencePre: 'confidence-pre',
  confidencePost: 'confidence-post',
  optin: 'slide28',
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export type ImpactProfile = {
  hasData: boolean;
  confidenceScore: number;
  primaryFocus: string;
  secondaryFocus: string;
  areasOfConfidencePct: number;
  areasForGrowthPct: number;
  recommendedFocusPct: number;
  dimensions: { key: string; label: string; pct: number; needCount: number }[];
  features: FeatureRef[];
  insight: string;
  learningFocus: string;
  participantCount?: number;
  title: string;
  subtitle: string;
  dimensionsHeading: string;
  // surfaced for the AI flow
  metrics: {
    prePct: number; postPct: number; knowledgeLift: number;
    confPre: number; confPost: number; confLift: number;
    passRate: number; optInRate: number;
  };
  // manager-facing: the post-test topics staff missed most (what to coach)
  coachingGaps?: { topic: string; missRate: number }[];
};

function buildFromMetrics(m: ImpactProfile['metrics'], hasData: boolean, opts: { individual?: boolean; participantCount?: number }): ImpactProfile {
  const liftSign = m.knowledgeLift >= 0 ? '+' : '';
  const confLiftSign = m.confLift >= 0 ? '+' : '';
  const who = opts.individual ? 'You' : 'The room';
  return {
    hasData,
    confidenceScore: clamp(m.postPct, 0, 100), // gauge = where they landed
    primaryFocus: `Knowledge ${clamp(m.prePct, 0, 100)}% → ${clamp(m.postPct, 0, 100)}% (${liftSign}${clamp(m.knowledgeLift, -100, 100)})`,
    secondaryFocus: `Confidence ${m.confPre.toFixed(1)} → ${m.confPost.toFixed(1)} (${confLiftSign}${m.confLift.toFixed(1)})`,
    areasOfConfidencePct: clamp(m.postPct, 0, 100),
    areasForGrowthPct: clamp(100 - m.postPct, 0, 100),
    recommendedFocusPct: clamp(m.passRate, 0, 100),
    dimensions: [
      { key: 'knowledge', label: 'Knowledge (post)', pct: clamp(m.postPct, 0, 100), needCount: 1 },
      { key: 'pass', label: 'Pass rate (≥80%)', pct: clamp(m.passRate, 0, 100), needCount: 1 },
      { key: 'optin', label: 'Opt-in rate', pct: clamp(m.optInRate, 0, 100), needCount: 1 },
    ],
    features: [
      { label: `Knowledge ${liftSign}${clamp(m.knowledgeLift, -100, 100)}%`, icon: 'trending_up' },
      { label: `Confidence ${confLiftSign}${m.confLift.toFixed(1)}`, icon: 'verified' },
      { label: `Pass rate ${clamp(m.passRate, 0, 100)}%`, icon: 'task_alt' },
      { label: `Opted in ${clamp(m.optInRate, 0, 100)}%`, icon: 'sms' },
    ],
    // Round so the AI narrative reads cleanly (29% not 29.07%).
    metrics: {
      prePct: Math.round(m.prePct), postPct: Math.round(m.postPct), knowledgeLift: Math.round(m.knowledgeLift),
      confPre: Math.round(m.confPre * 10) / 10, confPost: Math.round(m.confPost * 10) / 10, confLift: Math.round(m.confLift * 10) / 10,
      passRate: Math.round(m.passRate), optInRate: Math.round(m.optInRate),
    },
    participantCount: opts.participantCount,
    title: opts.individual ? 'Your Session Impact' : 'Session Impact',
    subtitle: opts.individual
      ? 'YOUR LIFT TODAY'
      : (opts.participantCount ? `FROM ${opts.participantCount} CONSULTANT${opts.participantCount === 1 ? '' : 'S'}` : 'AWAITING RESULTS'),
    dimensionsHeading: 'Live Results',
    insight: hasData ? buildFallbackImpactInsight(m, who) : 'Waiting for the room to complete the post-check…',
    learningFocus: hasData ? buildFallbackImpactLearning(m) : 'The session impact appears here once people finish the wrap-up check.',
  };
}

export type ImpactInputs = {
  pre?: number; post?: number;
  confPre?: number; confPost?: number;
  optedIn?: boolean | null;
};

export function buildImpactProfile(i: ImpactInputs): ImpactProfile {
  const hasData = typeof i.post === 'number' || typeof i.confPost === 'number';
  const m = {
    prePct: i.pre ?? 0,
    postPct: i.post ?? 0,
    knowledgeLift: (i.post ?? 0) - (i.pre ?? 0),
    confPre: i.confPre ?? 0,
    confPost: i.confPost ?? 0,
    confLift: (i.confPost ?? 0) - (i.confPre ?? 0),
    passRate: (i.post ?? 0) >= 80 ? 100 : 0,
    optInRate: i.optedIn ? 100 : 0,
  };
  return buildFromMetrics(m, hasData, { individual: true });
}

export type RoomImpactInputs = {
  pre: { userId: string; score: number }[];
  post: { userId: string; score: number }[];
  confPre: number[];
  confPost: number[];
  optin: { userId: string; yes: boolean }[];
  // aggregated post-test topic miss rates (already % across responders)
  gaps?: { topic: string; missRate: number }[];
};

export function buildImpactRoomProfile(i: RoomImpactInputs): ImpactProfile {
  const preAvg = avg(i.pre.map((r) => r.score));
  const postAvg = avg(i.post.map((r) => r.score));
  const passCount = i.post.filter((r) => r.score >= 80).length;
  const passRate = i.post.length ? (passCount / i.post.length) * 100 : 0;
  const optYes = i.optin.filter((r) => r.yes).length;
  const optInRate = i.optin.length ? (optYes / i.optin.length) * 100 : 0;
  const participantCount = new Set(
    [...i.pre, ...i.post, ...i.optin].map((r) => r.userId).filter(Boolean),
  ).size;

  const m = {
    prePct: preAvg, postPct: postAvg, knowledgeLift: postAvg - preAvg,
    confPre: avg(i.confPre), confPost: avg(i.confPost), confLift: avg(i.confPost) - avg(i.confPre),
    passRate, optInRate,
  };
  const hasData = i.post.length > 0 || i.confPost.length > 0;
  const profile = buildFromMetrics(m, hasData, { participantCount });

  // Manager view: replace the bars with the top topics staff still missed on the
  // post-test (the highest-leverage things to coach going forward). The KPI cards
  // keep the headline lift/pass/opt-in numbers.
  const gaps = (i.gaps || []).filter((g) => g.missRate > 0).sort((a, b) => b.missRate - a.missRate);
  if (gaps.length) {
    profile.coachingGaps = gaps;
    profile.dimensionsHeading = 'Top Coaching Priorities';
    profile.dimensions = gaps.slice(0, 3).map((g, idx) => ({
      key: 'gap' + idx, label: g.topic, pct: clamp(g.missRate, 0, 100), needCount: 1,
    }));
    profile.learningFocus = `Coach next on ${gaps.slice(0, 2).map((g) => g.topic).join(' and ')} — the topics most staff still missed.`;
  }
  return profile;
}

export function buildFallbackImpactInsight(m: ImpactProfile['metrics'], who: string): string {
  const k = Math.round(m.knowledgeLift);
  if (k > 0) {
    return `${who} grew ADAS knowledge from ${Math.round(m.prePct)}% to ${Math.round(m.postPct)}% — a ${k}-point lift — with ${Math.round(m.passRate)}% now at the 80% pass mark and ${Math.round(m.optInRate)}% opted in for Quick Tips.`;
  }
  return `${who} finished at ${Math.round(m.postPct)}% on the knowledge check, with ${Math.round(m.optInRate)}% opted in for Quick Tips. Reinforce the areas that stayed soft.`;
}

export function buildFallbackImpactLearning(m: ImpactProfile['metrics']): string {
  if (m.passRate < 80) return `${Math.round(100 - m.passRate)}% are still under the 80% bar — flag them for a quick follow-up before they hit the floor.`;
  return 'Strong finish — keep the Quick Tips opt-ins engaged with the follow-up cadence.';
}
