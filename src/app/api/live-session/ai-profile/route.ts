import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import { LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION } from '@/lib/live-session';
import {
  buildConfidenceProfile,
  buildRoomProfile,
  type RoomAnswerRecord,
} from '@/lib/live-session/confidence-profile';
import { generateConfidenceInsight } from '@/ai/flows/live-session-confidence-profile-flow';
import {
  buildConsultingProfile,
  buildConsultingRoomProfile,
} from '@/lib/live-session/consulting-profile';
import { generateConsultingInsight } from '@/ai/flows/live-session-consulting-flow';
import { buildImpactProfile, buildImpactRoomProfile } from '@/lib/live-session/impact-profile';
import { generateImpactInsight } from '@/ai/flows/live-session-impact-flow';
import { generateTakeaways } from '@/ai/flows/live-session-takeaways-flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function ts(record: { timestamp?: unknown; createdAt?: unknown }) {
  const t = Date.parse(text(record.timestamp));
  if (Number.isFinite(t)) return t;
  const c = record.createdAt;
  if (c && typeof c === 'object' && 'toDate' in c) return (c as { toDate: () => Date }).toDate().getTime();
  return 0;
}

// A concern answer may now be multi-select ("a,b,c") or the cleared sentinel
// "none". Split into valid slugs so each pick counts on its own.
function splitSlugs(answer: string): string[] {
  return answer
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== 'none');
}
type ConcernRecord = { userId: string; responseKey: string; answer: string; answerLabel: string };
function expandConcerns(records: ConcernRecord[]): ConcernRecord[] {
  return records.flatMap((r) => {
    const slugs = splitSlugs(r.answer);
    if (!slugs.length) return [];
    const labels = (r.answerLabel || '').split(',').map((s) => s.trim());
    return slugs.map((slug, i) => ({
      userId: r.userId,
      responseKey: r.responseKey,
      answer: slug,
      answerLabel: labels[i] || r.answerLabel,
    }));
  });
}

// The slide polls every few seconds; without this it would re-call Gemini each
// time and the (non-deterministic) insight would visibly churn. Cache the AI
// narrative keyed by the exact inputs, so the text only changes when the room's
// answers actually change. Keyed cache also avoids redundant model calls.
type Insight = { insight: string; learningFocus: string };
const insightCache = new Map<string, { value: Insight; expires: number }>();
const INSIGHT_TTL_MS = 15 * 60 * 1000;

async function cachedInsight(input: Parameters<typeof generateConfidenceInsight>[0]): Promise<Insight> {
  const key = JSON.stringify(input);
  const now = Date.now();
  const hit = insightCache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await generateConfidenceInsight(input);
  insightCache.set(key, { value, expires: now + INSIGHT_TTL_MS });
  // Opportunistic cleanup so the map can't grow unbounded across many sessions.
  if (insightCache.size > 200) {
    for (const [k, v] of insightCache) if (v.expires <= now) insightCache.delete(k);
  }
  return value;
}

async function cachedConsultingInsight(
  input: Parameters<typeof generateConsultingInsight>[0],
): Promise<Insight> {
  const key = 'consulting:' + JSON.stringify(input);
  const now = Date.now();
  const hit = insightCache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await generateConsultingInsight(input);
  insightCache.set(key, { value, expires: now + INSIGHT_TTL_MS });
  return value;
}

type SessionRow = { userId: string; responseKey: string; answer: string; answerLabel: string; _t: number };

async function loadSessionRows(sessionToken: string, keySet: Set<string>): Promise<SessionRow[]> {
  const snapshot = await getAdminDb().collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).get();
  return snapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .filter((r) => text(r.sessionToken) === sessionToken && keySet.has(text(r.responseKey)))
    .map((r) => ({
      userId: text(r.userId),
      responseKey: text(r.responseKey),
      answer: text(r.answer) || text(r.selectedValue),
      answerLabel: text(r.answerLabel) || text(r.answer),
      _t: ts(r as { timestamp?: unknown; createdAt?: unknown }),
    }))
    .filter((r) => r.answer);
}

// Consulting Performance report (section 2) — scores feature→persona matching.
async function handleConsulting(sessionToken: string, deckId: string, mode: 'room' | 'individual', userId: string) {
  const k = {
    jamie: `${deckId}-slide22`,
    ryan: `${deckId}-slide23`,
    jamiePitch: `${deckId}-slide22-pitch`,
    ryanPitch: `${deckId}-slide23-pitch`,
    famA: `${deckId}-slide19`,
    famB: `${deckId}-slide20`,
  };
  const rows = await loadSessionRows(sessionToken, new Set(Object.values(k)));
  const isFamiliarity = (rk: string) => rk === k.famA || rk === k.famB;

  if (mode === 'room') {
    const personaRows = (rk: string) =>
      rows.filter((r) => r.responseKey === rk).map((r) => ({ userId: r.userId, slugs: splitSlugs(r.answer) }));
    const familiarity = rows
      .filter((r) => isFamiliarity(r.responseKey))
      .map((r) => ({ userId: r.userId, rating: r.answer.toLowerCase() }));
    const profile = buildConsultingRoomProfile({ jamie: personaRows(k.jamie), ryan: personaRows(k.ryan), familiarity });
    if (profile.hasData) {
      const pitchSamples = rows
        .filter((r) => r.responseKey === k.jamiePitch || r.responseKey === k.ryanPitch)
        .map((r) => r.answer)
        .filter(Boolean)
        .slice(0, 4);
      const ai = await cachedConsultingInsight({
        mode: 'room',
        jamieScore: profile.scores.jamie,
        ryanScore: profile.scores.ryan,
        topMisses: profile.topMisses.map((m) => m.label),
        pitchSamples,
        participantCount: profile.participantCount,
      });
      profile.insight = ai.insight;
      profile.learningFocus = ai.learningFocus;
    }
    return NextResponse.json({ ok: true, mode, report: 'consulting', profile });
  }

  const mine = rows.filter((r) => r.userId === userId).sort((a, b) => b._t - a._t);
  const latest = (rk: string) => mine.find((r) => r.responseKey === rk);
  const jamieR = latest(k.jamie);
  const ryanR = latest(k.ryan);
  const picks = {
    jamie: jamieR ? splitSlugs(jamieR.answer) : undefined,
    ryan: ryanR ? splitSlugs(ryanR.answer) : undefined,
  };
  const familiarity = [latest(k.famA), latest(k.famB)]
    .filter((r): r is SessionRow => Boolean(r))
    .map((r) => r.answer.toLowerCase());
  const profile = buildConsultingProfile(picks, familiarity, userId);
  if (profile.hasData) {
    const ai = await cachedConsultingInsight({
      mode: 'individual',
      jamieScore: profile.scores.jamie,
      ryanScore: profile.scores.ryan,
      topMisses: profile.topMisses.map((m) => m.label),
      jamiePitch: latest(k.jamiePitch)?.answer,
      ryanPitch: latest(k.ryanPitch)?.answer,
    });
    profile.insight = ai.insight;
    profile.learningFocus = ai.learningFocus;
  }
  return NextResponse.json({ ok: true, mode, report: 'consulting', profile });
}

async function cachedImpactInsight(input: Parameters<typeof generateImpactInsight>[0]): Promise<Insight> {
  const key = 'impact:' + JSON.stringify(input);
  const now = Date.now();
  const hit = insightCache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await generateImpactInsight(input);
  insightCache.set(key, { value, expires: now + INSIGHT_TTL_MS });
  return value;
}

// Session Impact finale — rolls up before/after knowledge + confidence, pass
// rate, and opt-in rate for the whole session.
async function handleImpact(sessionToken: string, deckId: string, mode: 'room' | 'individual', userId: string) {
  const k = {
    pretest: `${deckId}-pretest`,
    posttest: `${deckId}-posttest`,
    detail: `${deckId}-posttest-detail`,
    confPre: `${deckId}-confidence-pre`,
    confPost: `${deckId}-confidence-post`,
    optin: `${deckId}-slide28`,
  };
  const rows = await loadSessionRows(sessionToken, new Set(Object.values(k)));
  const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : undefined; };

  if (mode === 'room') {
    const scoreRows = (rk: string) => rows
      .filter((r) => r.responseKey === rk)
      .map((r) => ({ userId: r.userId, score: num(r.answer) ?? 0 }))
      .filter((r) => Number.isFinite(r.score));
    const confVals = (rk: string) => rows.filter((r) => r.responseKey === rk).map((r) => num(r.answer)).filter((n): n is number => typeof n === 'number');
    const optin = rows.filter((r) => r.responseKey === k.optin).map((r) => ({ userId: r.userId, yes: r.answer.toLowerCase() === 'yes' }));

    // Aggregate which post-test TOPICS staff missed most → coaching priorities.
    const detailRows = rows.filter((r) => r.responseKey === k.detail);
    const responders = detailRows.length;
    const counts: Record<string, number> = {};
    for (const r of detailRows) {
      if (!r.answer || r.answer.toLowerCase() === 'none') continue;
      for (const topic of r.answer.split('|').map((s) => s.trim()).filter(Boolean)) {
        counts[topic] = (counts[topic] || 0) + 1;
      }
    }
    const gaps = Object.entries(counts)
      .map(([topic, c]) => ({ topic, missRate: responders ? Math.round((c / responders) * 100) : 0 }))
      .sort((a, b) => b.missRate - a.missRate);

    const profile = buildImpactRoomProfile({
      pre: scoreRows(k.pretest), post: scoreRows(k.posttest),
      confPre: confVals(k.confPre), confPost: confVals(k.confPost), optin, gaps,
    });
    if (profile.hasData) {
      const ai = await cachedImpactInsight({
        mode: 'room', ...profile.metrics,
        participantCount: profile.participantCount,
        topGaps: (profile.coachingGaps || []).slice(0, 3).map((g) => g.topic),
      });
      profile.insight = ai.insight; profile.learningFocus = ai.learningFocus;
    }
    return NextResponse.json({ ok: true, mode, report: 'impact', profile });
  }

  const mine = rows.filter((r) => r.userId === userId).sort((a, b) => b._t - a._t);
  const latest = (rk: string) => mine.find((r) => r.responseKey === rk);
  const optinRow = latest(k.optin);
  const profile = buildImpactProfile({
    pre: num(latest(k.pretest)?.answer || ''),
    post: num(latest(k.posttest)?.answer || ''),
    confPre: num(latest(k.confPre)?.answer || ''),
    confPost: num(latest(k.confPost)?.answer || ''),
    optedIn: optinRow ? optinRow.answer.toLowerCase() === 'yes' : null,
  });
  if (profile.hasData) {
    const ai = await cachedImpactInsight({ mode: 'individual', ...profile.metrics });
    profile.insight = ai.insight; profile.learningFocus = ai.learningFocus;
  }
  return NextResponse.json({ ok: true, mode, report: 'impact', profile });
}

// Personalized takeaways + resource routing (slides 25 / 26-27). Individual only.
function buildResources(topMisses: { slug: string; label: string }[]) {
  const RC = 'https://www.kiaresourcecenter.com';
  const fromMiss = topMisses.slice(0, 2).map((m) => ({
    title: m.label,
    why: 'You skipped this in the consulting activity — worth a refresher.',
    type: 'Web Course + Quick Tip',
    url: RC,
  }));
  return [
    ...fromMiss,
    { title: 'ADAS Resource Page', why: 'Your home base for every ADAS feature.', type: 'Resource Center', url: RC },
    { title: 'Subscribe to Quick Tips', why: 'Short text refreshers on launches & features.', type: 'Quick Tips', url: RC },
  ];
}

async function handleTakeaways(sessionToken: string, deckId: string, userId: string) {
  const k = { jamie: `${deckId}-slide22`, ryan: `${deckId}-slide23` };
  const rows = await loadSessionRows(sessionToken, new Set(Object.values(k)));
  const mine = rows.filter((r) => r.userId === userId).sort((a, b) => b._t - a._t);
  const latest = (rk: string) => mine.find((r) => r.responseKey === rk);
  const picks = {
    jamie: latest(k.jamie) ? splitSlugs(latest(k.jamie)!.answer) : undefined,
    ryan: latest(k.ryan) ? splitSlugs(latest(k.ryan)!.answer) : undefined,
  };
  const profile = buildConsultingProfile(picks, [], userId);
  const jamieScore = profile.scores.jamie;
  const ryanScore = profile.scores.ryan;
  const strongPersona = (jamieScore ?? 0) >= (ryanScore ?? 0) ? 'Jamie' : 'Ryan';
  const weakPersona = strongPersona === 'Jamie' ? 'Ryan' : 'Jamie';

  const ai = await generateTakeaways({
    strongPersona,
    weakPersona,
    topMisses: profile.topMisses.map((m) => m.label),
    jamieScore,
    ryanScore,
  });
  return NextResponse.json({
    ok: true,
    report: 'takeaways',
    hasData: profile.hasData,
    takeaways: ai.takeaways,
    resources: buildResources(profile.topMisses),
    headline: 'Your playbook from today',
  });
}

// GET /api/live-session/ai-profile?sessionToken=..&deckId=..&mode=individual&userId=..
//     &report=confidence|consulting|impact|takeaways
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionToken = text(url.searchParams.get('sessionToken'));
    const deckId = text(url.searchParams.get('deckId')) || 'adas-ppt-test';
    const mode = url.searchParams.get('mode') === 'room' ? 'room' : 'individual';
    const userId = text(url.searchParams.get('userId'));

    if (!sessionToken) {
      return NextResponse.json({ ok: false, error: 'Missing sessionToken.' }, { status: 400 });
    }
    if (mode === 'individual' && !userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId.' }, { status: 400 });
    }

    const reportParam = url.searchParams.get('report');
    if (reportParam === 'consulting') {
      return await handleConsulting(sessionToken, deckId, mode, userId);
    }
    if (reportParam === 'impact') {
      return await handleImpact(sessionToken, deckId, mode, userId);
    }
    if (reportParam === 'takeaways') {
      if (!userId) return NextResponse.json({ ok: false, error: 'Missing userId.' }, { status: 400 });
      return await handleTakeaways(sessionToken, deckId, userId);
    }

    const keys = {
      category: `${deckId}-slide15`,
      driving: `${deckId}-slide16`,
      parking: `${deckId}-slide17`,
      visibility: `${deckId}-slide18`,
    };
    const keySet = new Set(Object.values(keys));

    const snapshot = await getAdminDb().collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).get();
    const records = snapshot.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .filter((r) => text(r.sessionToken) === sessionToken && keySet.has(text(r.responseKey)))
      .map((r) => ({
        userId: text(r.userId),
        responseKey: text(r.responseKey),
        answer: text(r.answer) || text(r.selectedValue),
        answerLabel: text(r.answerLabel) || text(r.answer),
        _t: ts(r as { timestamp?: unknown; createdAt?: unknown }),
      }))
      .filter((r) => r.answer);

    if (mode === 'room') {
      // Expand multi-select concern answers so each pick counts in the tally.
      const byKey = {
        category: records.filter((r) => r.responseKey === keys.category) as RoomAnswerRecord[],
        driving: expandConcerns(records.filter((r) => r.responseKey === keys.driving)) as RoomAnswerRecord[],
        parking: expandConcerns(records.filter((r) => r.responseKey === keys.parking)) as RoomAnswerRecord[],
        visibility: expandConcerns(records.filter((r) => r.responseKey === keys.visibility)) as RoomAnswerRecord[],
      };
      const profile = buildRoomProfile(byKey);
      if (profile.hasData) {
        const ai = await cachedInsight({
          mode: 'room',
          categoryLabel: profile.topCategory?.label,
          drivingConcernLabel: profile.topDriving?.label,
          parkingConcernLabel: profile.topParking?.label,
          visibilityConcernLabel: profile.topVisibility?.label,
          participantCount: profile.participantCount,
          primaryFocus: profile.primaryFocus,
        });
        profile.insight = ai.insight;
        profile.learningFocus = ai.learningFocus;
      }
      return NextResponse.json({ ok: true, mode, profile });
    }

    // individual — keep each person's most recent answer per key
    const mine = records.filter((r) => r.userId === userId).sort((a, b) => b._t - a._t);
    const latest = (key: string) => mine.find((r) => r.responseKey === key);
    const cat = latest(keys.category);
    const drv = latest(keys.driving);
    const prk = latest(keys.parking);
    const vis = latest(keys.visibility);

    // For multi-select concerns, the deterministic map keys on the first pick;
    // the (possibly joined) label still flows to the AI narrative.
    const firstSlug = (r?: { answer: string }) => (r ? splitSlugs(r.answer)[0] : undefined);
    const answers = {
      category: cat?.answer,
      drivingConcern: firstSlug(drv),
      parkingConcern: firstSlug(prk),
      visibilityConcern: firstSlug(vis),
      categoryLabel: cat?.answerLabel,
      drivingConcernLabel: drv?.answerLabel,
      parkingConcernLabel: prk?.answerLabel,
      visibilityConcernLabel: vis?.answerLabel,
    };
    const profile = buildConfidenceProfile(answers, userId);
    if (profile.hasData) {
      const ai = await cachedInsight({
        mode: 'individual',
        categoryLabel: answers.categoryLabel,
        drivingConcernLabel: answers.drivingConcernLabel,
        parkingConcernLabel: answers.parkingConcernLabel,
        visibilityConcernLabel: answers.visibilityConcernLabel,
        primaryFocus: profile.primaryFocus,
      });
      profile.insight = ai.insight;
      profile.learningFocus = ai.learningFocus;
    }
    return NextResponse.json({ ok: true, mode, profile });
  } catch (error) {
    console.error('Unable to build AI confidence profile.', error);
    return NextResponse.json({ ok: false, error: 'Unable to build AI confidence profile.' }, { status: 500 });
  }
}
