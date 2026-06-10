// Deterministic "Sprocket AI" synthesis for the DRIVE_OS Driver Confidence
// Profile (slide 32). It turns an individual's slide 15/16/17 answers — or the
// whole room's answers — into the structured numbers + recommended ADAS features
// that drive the gauge, bars, and feature cards. The natural-language insight is
// layered on top by the Gemini flow (with this module's text as the fallback).

export const CONFIDENCE_RESPONSE_KEYS = {
  category: 'slide15', // driving | parking | visibility
  driving: 'slide16', // which driving situation concerns you most
  parking: 'slide17', // which parking scenario causes the most concern
} as const;

type FeatureRef = { label: string; icon: string };

// slide 15 — top category interest → primary focus label
const CATEGORY_FOCUS: Record<string, string> = {
  driving: 'Driving Assistance',
  parking: 'Precision Parking',
  visibility: 'Visibility & Awareness',
};

// slide 16 — driving concern → the ADAS feature that addresses it
const DRIVING_CONCERN: Record<string, { focus: string; feature: FeatureRef }> = {
  'sudden-braking': { focus: 'Forward Awareness', feature: { label: 'Forward Collision-Avoidance Assist', icon: 'warning' } },
  'lane-drifting': { focus: 'Lane Keeping', feature: { label: 'Lane Following Assist', icon: 'road' } },
  'heavy-traffic': { focus: 'Traffic Flow', feature: { label: 'Smart Cruise Control (Stop & Go)', icon: 'speed' } },
  'blind-spots': { focus: 'Blind-Spot Awareness', feature: { label: 'Blind-Spot View Monitor', icon: 'visibility' } },
  highway: { focus: 'Highway Confidence', feature: { label: 'Highway Driving Assist', icon: 'speed' } },
};

// slide 17 — parking concern → the ADAS feature that addresses it
const PARKING_CONCERN: Record<string, { focus: string; feature: FeatureRef }> = {
  'tight-spaces': { focus: 'Precision Parking', feature: { label: 'Parking Distance Warning', icon: 'local_parking' } },
  parallel: { focus: 'Parallel Parking', feature: { label: 'Remote Smart Parking Assist', icon: 'open_with' } },
  'backing-out': { focus: 'Rear Awareness', feature: { label: 'Rear Cross-Traffic Collision-Avoidance', icon: 'minor_crash' } },
  'detecting-objects': { focus: 'Object Detection', feature: { label: 'Surround View Monitor', icon: 'sensors' } },
  pedestrians: { focus: 'Pedestrian Safety', feature: { label: 'Reverse Parking Collision-Avoidance', icon: 'directions_walk' } },
};

// slide 18 — visibility concern → the ADAS feature that addresses it
const VISIBILITY_CONCERN: Record<string, { focus: string; feature: FeatureRef }> = {
  night: { focus: 'Low-Light Visibility', feature: { label: 'High Beam Assist', icon: 'nights_stay' } },
  weather: { focus: 'All-Weather Awareness', feature: { label: 'Forward Collision-Avoidance Assist', icon: 'thunderstorm' } },
  'blind-spot': { focus: 'Blind-Spot Awareness', feature: { label: 'Blind-Spot View Monitor', icon: 'blind' } },
  'fast-traffic': { focus: 'High-Speed Awareness', feature: { label: 'Blind-Spot Collision-Avoidance Assist', icon: 'speed' } },
  urban: { focus: 'Urban Awareness', feature: { label: 'Surround View Monitor', icon: 'apartment' } },
};

const CATEGORY_FEATURE: Record<string, FeatureRef> = {
  driving: { label: 'Smart Cruise Control', icon: 'speed' },
  parking: { label: 'Surround View Monitor', icon: 'sensors' },
  visibility: { label: 'Blind-Spot View Monitor', icon: 'visibility' },
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

// Small stable per-person jitter so two people with identical answers don't show
// identical gauges (feels more "analyzed"), derived from their id — not random.
function jitterFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 7) - 3; // -3..+3
}

export type ConfidenceAnswers = {
  category?: string; // driving | parking | visibility
  drivingConcern?: string; // slug from slide 16
  parkingConcern?: string; // slug from slide 17
  visibilityConcern?: string; // slug from slide 18
  drivingConcernLabel?: string;
  parkingConcernLabel?: string;
  visibilityConcernLabel?: string;
  categoryLabel?: string;
};

export type ConfidenceProfile = {
  hasData: boolean;
  answeredCount: number;
  confidenceScore: number;
  primaryFocus: string;
  secondaryFocus: string;
  areasOfConfidencePct: number;
  areasForGrowthPct: number;
  recommendedFocusPct: number;
  features: FeatureRef[];
  // Per car-area assistance need. On an individual this is how much THEY would
  // benefit from assistance in each area; on the room it's the % of people.
  dimensions: { key: string; label: string; pct: number; needCount: number }[];
  // narrative — filled by the AI flow, but always has a usable fallback here
  insight: string;
  learningFocus: string;
};

const DEFAULT_FEATURES: FeatureRef[] = [
  { label: 'Blind-Spot View Monitor', icon: 'visibility' },
  { label: 'Parking Distance Warning', icon: 'local_parking' },
  { label: 'Forward Collision Assist', icon: 'warning' },
  { label: 'Smart Cruise Control', icon: 'speed' },
];

function dedupeFeatures(features: FeatureRef[]): FeatureRef[] {
  const seen = new Set<string>();
  const out: FeatureRef[] = [];
  for (const f of [...features, ...DEFAULT_FEATURES]) {
    if (seen.has(f.label)) continue;
    seen.add(f.label);
    out.push(f);
    if (out.length === 4) break;
  }
  return out;
}

export function buildConfidenceProfile(answers: ConfidenceAnswers, id = 'anon'): ConfidenceProfile {
  const category = (answers.category || '').toLowerCase();
  const driving = (answers.drivingConcern || '').toLowerCase();
  const parking = (answers.parkingConcern || '').toLowerCase();
  const visibility = (answers.visibilityConcern || '').toLowerCase();

  const drivingMap = DRIVING_CONCERN[driving];
  const parkingMap = PARKING_CONCERN[parking];
  const visibilityMap = VISIBILITY_CONCERN[visibility];

  const answeredCount = [category, driving, parking, visibility].filter(Boolean).length;
  const concerns = [driving, parking, visibility].filter(Boolean).length;

  const jitter = jitterFromId(id);
  const confidenceScore = clamp(88 - concerns * 6 + jitter, 50, 92);
  const areasForGrowthPct = clamp(100 - confidenceScore + concerns * 3, 18, 66);
  const areasOfConfidencePct = clamp(confidenceScore + 3, 40, 96);
  const recommendedFocusPct = clamp(50 + concerns * 8 + (answeredCount ? 4 : 0), 40, 90);

  // Focus areas: take the two most acute concern areas in priority order, then
  // fall back to the category interest so something always shows.
  const focusPool = [
    drivingMap?.focus,
    visibilityMap?.focus,
    parkingMap?.focus,
    CATEGORY_FOCUS[category],
  ].filter((v): v is string => Boolean(v));
  const primaryFocus = focusPool[0] || 'Driving Assistance';
  const secondaryFocus = focusPool.find((f) => f !== primaryFocus) || 'Precision Parking';

  const features = dedupeFeatures([
    ...(drivingMap ? [drivingMap.feature] : []),
    ...(parkingMap ? [parkingMap.feature] : []),
    ...(visibilityMap ? [visibilityMap.feature] : []),
    ...(category && CATEGORY_FEATURE[category] ? [CATEGORY_FEATURE[category]] : []),
  ]);

  // Per-person assistance need by car area: how much THIS person would benefit
  // from help in each area, from their own answers. A flagged concern weighs
  // most; their top category adds to it; a small per-area jitter keeps it human.
  const areaPct = (hasConcern: boolean, isCategory: boolean, salt: string) =>
    clamp(20 + (hasConcern ? 60 : 0) + (isCategory ? 20 : 0) + jitterFromId(id + salt), 15, 100);
  const dimensions = [
    { key: 'driving', label: 'Driving Assistance', pct: areaPct(Boolean(driving), category === 'driving', 'd'), needCount: driving ? 1 : 0 },
    { key: 'parking', label: 'Parking & Maneuvering', pct: areaPct(Boolean(parking), category === 'parking', 'p'), needCount: parking ? 1 : 0 },
    { key: 'visibility', label: 'Visibility & Safety', pct: areaPct(Boolean(visibility), category === 'visibility', 'v'), needCount: visibility ? 1 : 0 },
  ];

  return {
    hasData: answeredCount > 0,
    answeredCount,
    confidenceScore,
    primaryFocus,
    secondaryFocus,
    areasOfConfidencePct,
    areasForGrowthPct,
    recommendedFocusPct,
    features,
    dimensions,
    insight: buildFallbackInsight(answers),
    learningFocus: buildFallbackLearningFocus(answers),
  };
}

export function buildFallbackInsight(answers: ConfidenceAnswers): string {
  const driving = answers.drivingConcernLabel || DRIVING_CONCERN[(answers.drivingConcern || '').toLowerCase()]?.focus;
  const parking = answers.parkingConcernLabel || PARKING_CONCERN[(answers.parkingConcern || '').toLowerCase()]?.focus;
  const visibility = answers.visibilityConcernLabel || VISIBILITY_CONCERN[(answers.visibilityConcern || '').toLowerCase()]?.focus;

  const phrases: string[] = [];
  if (driving) phrases.push(`${driving.toLowerCase()} on the road`);
  if (visibility) phrases.push(`${visibility.toLowerCase()} in low-visibility moments`);
  if (parking) phrases.push(`${parking.toLowerCase()} when parking`);

  if (phrases.length >= 2) {
    const last = phrases.pop();
    return `Based on your responses, awareness-focused ADAS features can ease ${phrases.join(', ')} and ${last} — the areas you flagged.`;
  }
  if (phrases.length === 1) {
    return `Based on your responses, ADAS features that support ${phrases[0]} are likely to give you the biggest confidence boost.`;
  }
  return 'Answer the confidence questions on your companion and DRIVE_OS will tailor ADAS recommendations to you.';
}

export function buildFallbackLearningFocus(answers: ConfidenceAnswers): string {
  const drivingMap = DRIVING_CONCERN[(answers.drivingConcern || '').toLowerCase()];
  const parkingMap = PARKING_CONCERN[(answers.parkingConcern || '').toLowerCase()];
  const visibilityMap = VISIBILITY_CONCERN[(answers.visibilityConcern || '').toLowerCase()];
  if (drivingMap) return `Pay close attention to how ${drivingMap.feature.label} responds in real driving.`;
  if (visibilityMap) return `Notice how ${visibilityMap.feature.label} sharpens what you can see and react to.`;
  if (parkingMap) return `Focus on how ${parkingMap.feature.label} guides you in tight spots.`;
  return 'Watch how each ADAS feature behaves and where it stays in control.';
}

// ---- Room aggregate -----------------------------------------------------
export type RoomAnswerRecord = { userId: string; responseKey: string; answer: string; answerLabel?: string };

export type RoomProfile = ConfidenceProfile & {
  participantCount: number;
  topDriving?: { label: string; count: number };
  topParking?: { label: string; count: number };
  topVisibility?: { label: string; count: number };
  topCategory?: { label: string; count: number };
};

function topOf(records: RoomAnswerRecord[]): { value: string; label: string; count: number } | undefined {
  const counts: Record<string, { value: string; label: string; count: number }> = {};
  for (const r of records) {
    const v = (r.answer || '').toLowerCase();
    if (!v) continue;
    if (!counts[v]) counts[v] = { value: v, label: r.answerLabel || r.answer, count: 0 };
    counts[v].count += 1;
  }
  const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
  return sorted[0];
}

// Build a room-level profile from the deck-keyed response slugs.
export function buildRoomProfile(
  byKey: {
    category: RoomAnswerRecord[];
    driving: RoomAnswerRecord[];
    parking: RoomAnswerRecord[];
    visibility: RoomAnswerRecord[];
  },
): RoomProfile {
  const topCategory = topOf(byKey.category);
  const topDriving = topOf(byKey.driving);
  const topParking = topOf(byKey.parking);
  const topVisibility = topOf(byKey.visibility);

  const participantCount = new Set(
    [...byKey.category, ...byKey.driving, ...byKey.parking, ...byKey.visibility]
      .map((r) => r.userId)
      .filter(Boolean),
  ).size;

  // Rank each concern dimension's dominant pick by how many people flagged it,
  // so focus areas + feature cards reflect what the GROUP most needs to learn.
  type Ranked = { count: number; focus: string; feature: FeatureRef };
  const ranked: Ranked[] = [];
  const addRanked = (top: { value: string; count: number } | undefined, map: Record<string, { focus: string; feature: FeatureRef }>) => {
    if (!top) return;
    const hit = map[top.value.toLowerCase()];
    if (hit) ranked.push({ count: top.count, focus: hit.focus, feature: hit.feature });
  };
  addRanked(topDriving, DRIVING_CONCERN);
  addRanked(topParking, PARKING_CONCERN);
  addRanked(topVisibility, VISIBILITY_CONCERN);
  ranked.sort((a, b) => b.count - a.count);

  // Focus areas: the two most-flagged concern areas (fall back to category).
  const focusPool = [
    ...ranked.map((r) => r.focus),
    topCategory ? CATEGORY_FOCUS[topCategory.value.toLowerCase()] : '',
  ].filter(Boolean);
  const primaryFocus = focusPool[0] || 'Collective Driving Assistance';
  const secondaryFocus = focusPool.find((f) => f !== primaryFocus) || 'Precision Parking';

  // The 4 cards = the ADAS features addressing the room's biggest gaps, ranked.
  const features = dedupeFeatures([
    ...ranked.map((r) => r.feature),
    ...(topCategory && CATEGORY_FEATURE[topCategory.value.toLowerCase()]
      ? [CATEGORY_FEATURE[topCategory.value.toLowerCase()]]
      : []),
  ]);

  // Data-driven analysis bars, all derived from the captured responses.
  const P = Math.max(1, participantCount);
  const totalConcerns = byKey.driving.length + byKey.parking.length + byKey.visibility.length;
  const intensity = Math.min(1, totalConcerns / (P * 3)); // how saturated the room's concerns are
  const sumTop = ranked.reduce((s, r) => s + r.count, 0);
  const dominant = ranked[0];

  const confidenceScore = clamp(92 - intensity * 40, 50, 92);
  const areasOfConfidencePct = clamp(95 - intensity * 45, 38, 96);
  const areasForGrowthPct = clamp(dominant ? (dominant.count / P) * 100 : 18, 12, 92);
  const recommendedFocusPct = clamp(totalConcerns ? (sumTop / totalConcerns) * 100 : 50, 40, 94);

  // Per car-area assistance need: a person needs help in an area if they picked
  // it as their top category (slide 15) OR flagged a concern there (16/17/18).
  const needUsers = (categoryValue: string, concerns: RoomAnswerRecord[]) => {
    const set = new Set<string>();
    byKey.category
      .filter((r) => (r.answer || '').toLowerCase() === categoryValue && r.userId)
      .forEach((r) => set.add(r.userId));
    concerns.filter((r) => r.userId).forEach((r) => set.add(r.userId));
    return set.size;
  };
  const pctOf = (count: number) => (participantCount > 0 ? clamp((count / participantCount) * 100, 0, 100) : 0);
  const drivingNeed = needUsers('driving', byKey.driving);
  const parkingNeed = needUsers('parking', byKey.parking);
  const visibilityNeed = needUsers('visibility', byKey.visibility);
  const dimensions = [
    { key: 'driving', label: 'Driving Assistance', needCount: drivingNeed, pct: pctOf(drivingNeed) },
    { key: 'parking', label: 'Parking & Maneuvering', needCount: parkingNeed, pct: pctOf(parkingNeed) },
    { key: 'visibility', label: 'Visibility & Safety', needCount: visibilityNeed, pct: pctOf(visibilityNeed) },
  ];

  return {
    dimensions,
    hasData: participantCount > 0,
    answeredCount: ranked.length + (topCategory ? 1 : 0),
    confidenceScore,
    primaryFocus,
    secondaryFocus,
    areasOfConfidencePct,
    areasForGrowthPct,
    recommendedFocusPct,
    features,
    participantCount,
    topDriving: topDriving ? { label: topDriving.label, count: topDriving.count } : undefined,
    topParking: topParking ? { label: topParking.label, count: topParking.count } : undefined,
    topVisibility: topVisibility ? { label: topVisibility.label, count: topVisibility.count } : undefined,
    topCategory: topCategory ? { label: topCategory.label, count: topCategory.count } : undefined,
    learningFocus: participantCount > 0
      ? buildFallbackLearningFocus({
          drivingConcern: topDriving?.value,
          parkingConcern: topParking?.value,
          visibilityConcern: topVisibility?.value,
        })
      : 'Watch how each ADAS feature behaves and where it stays in control.',
    insight: participantCount > 0
      ? buildFallbackInsight({
          drivingConcernLabel: topDriving?.label,
          parkingConcernLabel: topParking?.label,
          visibilityConcernLabel: topVisibility?.label,
          drivingConcern: topDriving?.value,
          parkingConcern: topParking?.value,
          visibilityConcern: topVisibility?.value,
        })
      : 'Waiting for the room to complete the confidence questions on slides 15–18…',
  };
}
