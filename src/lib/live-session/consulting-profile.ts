// Deterministic "Sprocket AI" synthesis for the Consulting Performance summary
// (section 2 — "Consulting with Customers"). Scores how well a consultant — or
// the whole room — matched Kia ADAS features to the customer personas (Jamie,
// Ryan), and shapes the result to the SAME contract the slide-32 render already
// consumes (gauge + 3 bars + 4 feature cards + insight), plus display labels.
// The natural-language coaching is layered on by the Gemini flow; this module's
// text is the fallback.

export const CONSULTING_RESPONSE_KEYS = {
  jamieFeatures: 'slide22',
  ryanFeatures: 'slide23',
  jamiePitch: 'slide22-pitch',
  ryanPitch: 'slide23-pitch',
  familiarityA: 'slide19',
  familiarityB: 'slide20',
} as const;

type FeatureRef = { label: string; icon: string };

// The ADAS features a consultant can recommend (the activity's pick list).
export const FEATURE_CATALOG: Record<string, FeatureRef> = {
  'scc-stopgo': { label: 'Smart Cruise Control (Stop & Go)', icon: 'speed' },
  hda: { label: 'Highway Driving Assist', icon: 'directions_car' },
  lfa: { label: 'Lane Following Assist', icon: 'road' },
  fca: { label: 'Forward Collision-Avoidance Assist', icon: 'warning' },
  bvm: { label: 'Blind-Spot View Monitor', icon: 'visibility' },
  bca: { label: 'Blind-Spot Collision-Avoidance Assist', icon: 'sensors' },
  rcca: { label: 'Rear Cross-Traffic Collision-Avoidance', icon: 'minor_crash' },
  svm: { label: 'Surround View Monitor', icon: 'panorama' },
  pdw: { label: 'Parking Distance Warning', icon: 'local_parking' },
  rspa: { label: 'Remote Smart Parking Assist', icon: 'open_with' },
  hba: { label: 'High Beam Assist', icon: 'nights_stay' },
  faw: { label: 'Forward Attention Warning', icon: 'face' },
};

// The "right answers" — the ideal feature recommendation per persona, authored
// from each persona's lifestyle bullets. Tweak these to change the scoring key.
export const PERSONAS: Record<string, { label: string; ideal: string[]; needs: string }> = {
  jamie: {
    label: 'Jamie',
    needs: 'garage parking, a highway commute she hates in stop-and-go, and cargo blocking her rear view',
    ideal: ['svm', 'pdw', 'rspa', 'scc-stopgo', 'hda', 'rcca'],
  },
  ryan: {
    label: 'Ryan',
    needs: 'dark congested roads with cyclists, a family to protect, and weekend road trips',
    ideal: ['hba', 'fca', 'bca', 'scc-stopgo', 'hda', 'faw'],
  },
};

const FAMILIARITY_SCORE: Record<string, number> = { 'not-yet': 20, 'getting-there': 60, confident: 95 };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

function jitterFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 7) - 3;
}

export function featuresFor(slugs: string[]): FeatureRef[] {
  const out: FeatureRef[] = [];
  const seen = new Set<string>();
  for (const s of slugs) {
    const f = FEATURE_CATALOG[s];
    if (f && !seen.has(s)) { seen.add(s); out.push(f); }
  }
  return out;
}

// Output matches what confidence-profile-render.js reads, plus display labels.
export type ConsultingProfile = {
  hasData: boolean;
  confidenceScore: number; // gauge — overall match %
  primaryFocus: string;
  secondaryFocus: string;
  areasOfConfidencePct: number;
  areasForGrowthPct: number;
  recommendedFocusPct: number;
  dimensions: { key: string; label: string; pct: number; needCount: number }[];
  features: FeatureRef[]; // the top MISSED ideal features = coaching targets
  insight: string;
  learningFocus: string;
  participantCount?: number;
  // display labels (render uses these when present)
  title: string;
  subtitle: string;
  dimensionsHeading: string;
  // surfaced for the AI flow
  topMisses: { slug: string; label: string }[];
  scores: { jamie: number | null; ryan: number | null; readiness: number | null };
};

function matchPct(picks: string[], ideal: string[]): number {
  if (!ideal.length) return 0;
  const set = new Set(picks);
  const hit = ideal.filter((s) => set.has(s)).length;
  return (hit / ideal.length) * 100;
}

function missesFor(picks: string[], ideal: string[]): string[] {
  const set = new Set(picks);
  return ideal.filter((s) => !set.has(s));
}

function topMissFeatures(missSlugs: string[]): { features: FeatureRef[]; topMisses: { slug: string; label: string }[] } {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const s of missSlugs) { if (!seen.has(s) && FEATURE_CATALOG[s]) { seen.add(s); ordered.push(s); } }
  const DEFAULTS = ['fca', 'bvm', 'hba', 'svm'];
  for (const s of DEFAULTS) { if (ordered.length >= 4) break; if (!seen.has(s)) { seen.add(s); ordered.push(s); } }
  const slice = ordered.slice(0, 4);
  return {
    features: slice.map((s) => FEATURE_CATALOG[s]),
    topMisses: slice.map((s) => ({ slug: s, label: FEATURE_CATALOG[s].label })),
  };
}

// ---- Individual ----------------------------------------------------------
export function buildConsultingProfile(
  picks: { jamie?: string[]; ryan?: string[] },
  familiarityRatings: string[],
  id = 'anon',
): ConsultingProfile {
  const jamiePicks = picks.jamie || [];
  const ryanPicks = picks.ryan || [];
  const answered: number[] = [];

  const jamieScore = picks.jamie ? matchPct(jamiePicks, PERSONAS.jamie.ideal) : null;
  const ryanScore = picks.ryan ? matchPct(ryanPicks, PERSONAS.ryan.ideal) : null;
  if (jamieScore !== null) answered.push(jamieScore);
  if (ryanScore !== null) answered.push(ryanScore);

  const readiness = familiarityRatings.length
    ? familiarityRatings.reduce((s, r) => s + (FAMILIARITY_SCORE[r] ?? 50), 0) / familiarityRatings.length
    : null;

  const overall = answered.length ? answered.reduce((a, b) => a + b, 0) / answered.length : 0;
  const jitter = jitterFromId(id);

  const misses = [
    ...(picks.jamie ? missesFor(jamiePicks, PERSONAS.jamie.ideal) : []),
    ...(picks.ryan ? missesFor(ryanPicks, PERSONAS.ryan.ideal) : []),
  ];
  const { features, topMisses } = topMissFeatures(misses);

  const confidenceScore = clamp(overall + jitter, 0, 100);
  const dims = [
    { key: 'jamie', label: 'Jamie Match', pct: clamp(jamieScore ?? 0, 0, 100), needCount: picks.jamie ? 1 : 0 },
    { key: 'ryan', label: 'Ryan Match', pct: clamp(ryanScore ?? 0, 0, 100), needCount: picks.ryan ? 1 : 0 },
    { key: 'readiness', label: 'Feature Readiness', pct: clamp(readiness ?? overall, 0, 100), needCount: familiarityRatings.length ? 1 : 0 },
  ];

  return {
    hasData: answered.length > 0,
    confidenceScore,
    primaryFocus: jamieScore !== null ? `Jamie — ${clamp(jamieScore, 0, 100)}% match` : 'Jamie — not yet',
    secondaryFocus: ryanScore !== null ? `Ryan — ${clamp(ryanScore, 0, 100)}% match` : 'Ryan — not yet',
    areasOfConfidencePct: clamp(overall, 0, 100),
    areasForGrowthPct: clamp(100 - overall, 0, 100),
    recommendedFocusPct: clamp(60, 0, 100),
    dimensions: dims,
    features,
    topMisses,
    scores: { jamie: jamieScore, ryan: ryanScore, readiness },
    title: 'Your Consulting Scorecard',
    subtitle: 'BASED ON YOUR RECOMMENDATIONS',
    dimensionsHeading: 'Persona Match',
    insight: buildFallbackConsultingInsight({ jamieScore, ryanScore, topMisses, mode: 'individual' }),
    learningFocus: buildFallbackConsultingLearning(topMisses),
  };
}

// ---- Room ----------------------------------------------------------------
export type ConsultingRecord = { userId: string; slugs: string[] };

export function buildConsultingRoomProfile(input: {
  jamie: ConsultingRecord[];
  ryan: ConsultingRecord[];
  familiarity: { userId: string; rating: string }[];
}): ConsultingProfile {
  const personaRoom = (records: ConsultingRecord[], persona: 'jamie' | 'ryan') => {
    if (!records.length) return { pct: null as number | null, missRate: new Map<string, number>() };
    const scores = records.map((r) => matchPct(r.slugs, PERSONAS[persona].ideal));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // how often each ideal feature was MISSED across the room
    const missRate = new Map<string, number>();
    for (const slug of PERSONAS[persona].ideal) {
      const missed = records.filter((r) => !r.slugs.includes(slug)).length;
      missRate.set(slug, missed / records.length);
    }
    return { pct: avg, missRate };
  };

  const jamie = personaRoom(input.jamie, 'jamie');
  const ryan = personaRoom(input.ryan, 'ryan');

  const participantCount = new Set(
    [...input.jamie, ...input.ryan, ...input.familiarity].map((r) => r.userId).filter(Boolean),
  ).size;

  const answered = [jamie.pct, ryan.pct].filter((v): v is number => v !== null);
  const overall = answered.length ? answered.reduce((a, b) => a + b, 0) / answered.length : 0;

  const readiness = input.familiarity.length
    ? input.familiarity.reduce((s, r) => s + (FAMILIARITY_SCORE[r.rating] ?? 50), 0) / input.familiarity.length
    : null;

  // Top coaching gaps: the ideal features the room missed most often, both personas.
  const allMiss: { slug: string; rate: number }[] = [];
  jamie.missRate.forEach((rate, slug) => allMiss.push({ slug, rate }));
  ryan.missRate.forEach((rate, slug) => {
    const existing = allMiss.find((m) => m.slug === slug);
    if (existing) existing.rate = Math.max(existing.rate, rate);
    else allMiss.push({ slug, rate });
  });
  allMiss.sort((a, b) => b.rate - a.rate);
  const { features, topMisses } = topMissFeatures(allMiss.filter((m) => m.rate > 0).map((m) => m.slug));

  return {
    hasData: participantCount > 0 && answered.length > 0,
    confidenceScore: clamp(overall, 0, 100),
    primaryFocus: jamie.pct !== null ? `Jamie — ${clamp(jamie.pct, 0, 100)}% match` : 'Jamie — awaiting',
    secondaryFocus: ryan.pct !== null ? `Ryan — ${clamp(ryan.pct, 0, 100)}% match` : 'Ryan — awaiting',
    areasOfConfidencePct: clamp(overall, 0, 100),
    areasForGrowthPct: clamp(100 - overall, 0, 100),
    recommendedFocusPct: clamp(60, 0, 100),
    dimensions: [
      { key: 'jamie', label: 'Jamie Match', pct: clamp(jamie.pct ?? 0, 0, 100), needCount: input.jamie.length },
      { key: 'ryan', label: 'Ryan Match', pct: clamp(ryan.pct ?? 0, 0, 100), needCount: input.ryan.length },
      { key: 'readiness', label: 'Feature Readiness', pct: clamp(readiness ?? overall, 0, 100), needCount: input.familiarity.length },
    ],
    features,
    topMisses,
    scores: { jamie: jamie.pct, ryan: ryan.pct, readiness },
    participantCount,
    title: 'Collective Consulting Performance',
    subtitle: participantCount > 0 ? `FROM ${participantCount} CONSULTANT${participantCount === 1 ? '' : 'S'}` : 'AWAITING RECOMMENDATIONS',
    dimensionsHeading: 'Persona Match',
    insight: participantCount > 0
      ? buildFallbackConsultingInsight({ jamieScore: jamie.pct, ryanScore: ryan.pct, topMisses, mode: 'room' })
      : 'Waiting for the room to recommend features for Jamie and Ryan…',
    learningFocus: buildFallbackConsultingLearning(topMisses),
  };
}

// ---- Fallback narrative --------------------------------------------------
export function buildFallbackConsultingInsight(input: {
  jamieScore: number | null;
  ryanScore: number | null;
  topMisses: { slug: string; label: string }[];
  mode: 'individual' | 'room';
}): string {
  const who = input.mode === 'room' ? 'The room' : 'You';
  const miss = input.topMisses[0]?.label;
  const strong =
    (input.jamieScore ?? 0) >= (input.ryanScore ?? 0) ? 'Jamie' : 'Ryan';
  const weak = strong === 'Jamie' ? 'Ryan' : 'Jamie';
  if (miss) {
    return `${who} matched ${strong}'s needs well, but the biggest gap is ${weak} — most notably ${miss}. Lead with the features that map to each customer's real lifestyle.`;
  }
  return `${who} did a solid job matching ADAS features to each customer's lifestyle. Keep anchoring each recommendation to the customer's specific routine.`;
}

export function buildFallbackConsultingLearning(topMisses: { slug: string; label: string }[]): string {
  if (topMisses[0]) return `Practice the talk-track for ${topMisses[0].label} — tie it to the customer's daily drive.`;
  return 'Keep tying each ADAS feature to a concrete moment in the customer\'s day.';
}
