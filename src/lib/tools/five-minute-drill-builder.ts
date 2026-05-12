import type { User } from '@/lib/definitions';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';

export const FIVE_MINUTE_DRILL_ROLES = ['Sales Associate', 'Service Advisor'] as const;
export const FIVE_MINUTE_DRILL_FOCUSES = [
  'greeting',
  'discovery',
  'objection',
  'price/payment',
  'trade',
  'repair approval',
  'status update',
  'handoff',
  'follow-up',
] as const;
export const FIVE_MINUTE_DRILL_ISSUES = [
  'too vague',
  'too pushy',
  'lacks confidence',
  'skips discovery',
  'weak close',
  'poor clarity',
] as const;

export type FiveMinuteDrillRole = typeof FIVE_MINUTE_DRILL_ROLES[number];
export type FiveMinuteDrillFocus = typeof FIVE_MINUTE_DRILL_FOCUSES[number];
export type FiveMinuteDrillIssue = typeof FIVE_MINUTE_DRILL_ISSUES[number];

export type FiveMinuteDrillInput = {
  role: FiveMinuteDrillRole;
  focus: FiveMinuteDrillFocus;
  currentIssue: FiveMinuteDrillIssue;
  managerNote: string;
  associateName?: string;
};

export type FiveMinuteDrillMetricLabel = 'Clarity' | 'Confidence' | 'Customer focus' | 'Next-step control';

export type FiveMinuteDrillScoreMetric = {
  label: FiveMinuteDrillMetricLabel;
  value: number;
  note: string;
};

export type FiveMinuteDrillStage = {
  label: '30-second setup' | '2-minute practice' | '90-second feedback' | '60-second second rep' | '30-second commitment';
  body: string;
};

export type FiveMinuteDrillPlan = {
  drillName: string;
  summary: string;
  stages: FiveMinuteDrillStage[];
  coachThisWay: string;
  avoidThis: string;
  quickCopy: string;
  nextDrill: string;
  managerCue: string;
  scorecard: FiveMinuteDrillScoreMetric[];
};

export type FiveMinuteDrillSprocketInsight = {
  issueRead: string;
  drillRecommendation: string;
  managerLanguage: string;
  riskyPhrases: string[];
  nextDrill: string;
  calmText: string;
};

export type FiveMinuteDrillCxMetric = {
  label: FiveMinuteDrillMetricLabel;
  note: string;
};

export type FiveMinuteDrillCxInsight = {
  hasProfile: boolean;
  focusSkill: FiveMinuteDrillMetricLabel;
  personalNote: string;
  coachingNotes: FiveMinuteDrillCxMetric[];
};

export type FiveMinuteDrillSavedEntry = {
  id: string;
  signature: string;
  createdAt: string;
  variantSeed: number;
  role: FiveMinuteDrillRole;
  focus: FiveMinuteDrillFocus;
  currentIssue: FiveMinuteDrillIssue;
  managerNote: string;
  drillName: string;
  summary: string;
  stages: FiveMinuteDrillStage[];
  coachThisWay: string;
  avoidThis: string;
  quickCopy: string;
  nextDrill: string;
  scorecard: FiveMinuteDrillScoreMetric[];
  favorite?: boolean;
  sprocketInsight?: FiveMinuteDrillSprocketInsight | null;
  cxInsight?: FiveMinuteDrillCxInsight | null;
};

export type FiveMinuteDrillHistorySummary = {
  lastFocus?: FiveMinuteDrillFocus;
  lastIssue?: FiveMinuteDrillIssue;
  lastSavedAt?: string;
  totalSaved: number;
};

type RolePack = {
  opener: readonly string[];
  setup: readonly string[];
  practice: readonly string[];
  feedback: readonly string[];
  secondRep: readonly string[];
  commitment: readonly string[];
  coachThisWay: readonly string[];
  avoidThis: readonly string[];
};

type FocusPack = {
  title: string;
  drillHints: readonly string[];
  setup: readonly string[];
  practice: readonly string[];
  feedback: readonly string[];
  secondRep: readonly string[];
  commitment: readonly string[];
  coachThisWay: readonly string[];
  avoidThis: readonly string[];
  nextDrill: readonly string[];
  purpose: string;
};

type IssuePack = {
  title: string;
  read: string;
  setup: readonly string[];
  practice: readonly string[];
  feedback: readonly string[];
  secondRep: readonly string[];
  commitment: readonly string[];
  coachThisWay: readonly string[];
  avoidThis: readonly string[];
  nextDrill: readonly string[];
  riskPhrases: readonly string[];
  scoreBias: Partial<Record<FiveMinuteDrillMetricLabel, number>>;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(items: readonly T[], seed: string): T {
  const safeItems = items.length > 0 ? items : [undefined as T];
  return safeItems[hashSeed(seed) % safeItems.length];
}

function ensureSentence(value: string): string {
  const text = normalizeText(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function joinSentences(parts: string[]): string {
  return parts
    .map((part) => ensureSentence(part))
    .filter(Boolean)
    .join(' ');
}

function clamp(value: number, min = 1, max = 5): number {
  return Math.max(min, Math.min(max, value));
}

function rewriteManagerLanguage(note: string, seed: string, fallback: string): string {
  const cleaned = normalizeText(note)
    .replace(/\byou need to\b/gi, 'let’s')
    .replace(/\byou have to\b/gi, 'we can')
    .replace(/\bwe have to\b/gi, 'let’s')
    .replace(/\bjust\s+/gi, '')
    .replace(/\bkind of\b/gi, '')
    .replace(/\bI think\b/gi, 'I want us to')
    .replace(/\bmaybe\b/gi, 'likely')
    .replace(/\bshould\b/gi, 'can');

  const body = cleaned || fallback;
  return joinSentences([
    pick(['Coach it like this', 'Try this wording', 'Use this line'], seed),
    body,
  ]);
}

function detectRiskyPhrases(note: string, fallbackPhrases: readonly string[]): string[] {
  const normalized = note.toLowerCase();
  const matches = fallbackPhrases.filter((phrase) => normalized.includes(phrase.toLowerCase()));
  return matches.length > 0 ? Array.from(new Set(matches)) : [...fallbackPhrases.slice(0, 3)];
}

const ROLE_LIBRARY: Record<FiveMinuteDrillRole, RolePack> = {
  'Sales Associate': {
    opener: ['Open with a calm welcome and one clear question.', 'Lead with warmth, then move to one simple next step.'],
    setup: ['Keep the first line friendly and short.', 'Do not stack three points into the opener.'],
    practice: ['Have them say the line once at real speed, then again with a pause.', 'Practice until the opening sounds natural, not read.'],
    feedback: ['Coach the pace, the tone, and the first sentence.', 'Point to one change only so the rep can absorb it quickly.'],
    secondRep: ['Run the opener again with fewer words and a clearer handoff.', 'Repeat the line with a steadier voice and one direct question.'],
    commitment: ['Lock in the exact line they will use on the next customer.', 'End with one visible behavior they will repeat live.'],
    coachThisWay: ['Start friendly, then move to one clear question.', 'Keep the language simple, calm, and customer-centered.'],
    avoidThis: ['Do not sound scripted, rushed, or eager to take over.', 'Avoid opening with too many details.'],
  },
  'Service Advisor': {
    opener: ['Open with a calm check-in and one clear path forward.', 'Lead with respect, then explain the next step simply.'],
    setup: ['Keep the first line organized and easy to follow.', 'Do not overload the customer with process language.'],
    practice: ['Have them practice the line once, then repeat it with a slower pace.', 'Practice the opener until it sounds steady and trustworthy.'],
    feedback: ['Coach the clarity, the pace, and the ownership in the line.', 'Point to the one spot where the explanation got heavy or vague.'],
    secondRep: ['Run the line again with shorter words and one next step.', 'Repeat it with a calmer voice and a cleaner handoff.'],
    commitment: ['Lock in the exact line they will use in the drive or lane.', 'End with one repeatable behavior for the next customer.'],
    coachThisWay: ['Lead with the customer need and keep the repair path simple.', 'Stay calm, specific, and easy to trust.'],
    avoidThis: ['Do not sound defensive, robotic, or overloaded.', 'Avoid burying the next step in process talk.'],
  },
};

const FOCUS_LIBRARY: Record<FiveMinuteDrillFocus, FocusPack> = {
  greeting: {
    title: 'Greeting Reset',
    drillHints: ['Start with warmth, then ask one light opening question.', 'Make the first contact feel human and easy.'],
    setup: ['Use a friendly opening that sounds natural.', 'Keep the first exchange short and relaxed.'],
    practice: ['Practice the greeting once, then repeat it with more warmth.', 'Aim for a welcoming tone that does not ramble.'],
    feedback: ['Call out where the greeting felt stiff or too busy.', 'Tighten the line until it feels easy to say out loud.'],
    secondRep: ['Run the greeting again with a softer landing.', 'Repeat it with fewer words and one clearer question.'],
    commitment: ['Agree on the exact first line to use next time.', 'Lock the greeting that feels the most natural.'],
    coachThisWay: ['Open warmly, then move into one clean question.', 'Let the customer feel welcomed before you gather info.'],
    avoidThis: ['Do not jump straight into business before the greeting lands.', 'Avoid sounding rehearsed or too eager.'],
    nextDrill: ['Run a one-line greeting drill with a pause after the welcome.'],
    purpose: 'A stronger greeting lowers pressure and earns permission for the next question.',
  },
  discovery: {
    title: 'Discovery Drill',
    drillHints: ['Ask one better question before giving answers.', 'Keep the rep listening long enough to hear the real need.'],
    setup: ['Set the drill around one question that matters.', 'Do not solve the problem before you understand it.'],
    practice: ['Practice asking, then pausing long enough for a real answer.', 'Keep the discovery question open and simple.'],
    feedback: ['Coach where they moved too fast or asked too much at once.', 'Point out the moment the conversation should have slowed down.'],
    secondRep: ['Run the question again with a shorter setup.', 'Repeat it with more space and less explanation.'],
    commitment: ['Agree on the exact discovery question they will use live.', 'Lock the question that best reveals the real concern.'],
    coachThisWay: ['Ask one question and listen for the answer before steering.', 'Let the customer talk before you guide.'],
    avoidThis: ['Do not fire off three questions in a row.', 'Avoid leading the answer too quickly.'],
    nextDrill: ['Run a one-question discovery ladder until the answer gets specific.'],
    purpose: 'Discovery keeps the coaching from jumping past the real concern.',
  },
  objection: {
    title: 'Objection Reset',
    drillHints: ['Meet the pushback without getting defensive.', 'Teach the rep to slow down and answer the concern directly.'],
    setup: ['Open by naming the concern in plain language.', 'Keep the response calm and direct.'],
    practice: ['Practice the objection line once, then answer it with one calm sentence.', 'Keep the voice steady and the reply short.'],
    feedback: ['Coach where the answer got too long or too reactive.', 'Tighten the response until it sounds steady.'],
    secondRep: ['Run the objection again with less pressure and one better question.', 'Repeat the line without sounding like a debate.'],
    commitment: ['Lock the calm response they will use the next time pushback shows up.', 'Agree on one sentence that stays grounded under pressure.'],
    coachThisWay: ['Answer the concern first and keep your voice even.', 'Stay calm and do not chase the customer.'],
    avoidThis: ['Do not argue or try to win the moment.', 'Avoid sounding impatient or annoyed.'],
    nextDrill: ['Run a pause-and-answer drill before giving any explanation.'],
    purpose: 'Objection drills build steadiness before the next explanation.',
  },
  'price/payment': {
    title: 'Price / Payment Drill',
    drillHints: ['Make the number feel clear instead of heavy.', 'Give the customer one clean reason before the next ask.'],
    setup: ['Lead with the number in plain language.', 'Do not rush through the explanation.'],
    practice: ['Practice the number, then the reason, then the next step.', 'Keep the delivery short and confident.'],
    feedback: ['Coach where the explanation sounded rushed or unclear.', 'Show the rep how to make the number easier to follow.'],
    secondRep: ['Run it again with cleaner pacing and fewer filler words.', 'Repeat the line with a calmer, more confident tone.'],
    commitment: ['Agree on the exact payment or price line they will use live.', 'Lock the next sentence that keeps the deal moving.'],
    coachThisWay: ['State the number clearly, then connect it to value.', 'Keep the explanation crisp and calm.'],
    avoidThis: ['Do not bury the number in extra talk.', 'Avoid sounding like you are bracing for pushback.'],
    nextDrill: ['Run a clear-number / calm-pause drill before the next close.'],
    purpose: 'Price and payment drills help the rep stay clear and confident.',
  },
  trade: {
    title: 'Trade Value Drill',
    drillHints: ['Make the trade conversation fair and transparent.', 'Keep the value explanation simple enough to trust.'],
    setup: ['Start with how the trade was reviewed.', 'Do not let the value feel hidden.'],
    practice: ['Practice the value explanation, then pause for reaction.', 'Keep the trade conversation calm and direct.'],
    feedback: ['Coach where the rep got too wordy or too quick.', 'Point to the line that needs more transparency.'],
    secondRep: ['Run the trade explanation again with a cleaner handoff.', 'Repeat it with less jargon and more trust.'],
    commitment: ['Lock in the trade line they will use next time.', 'Agree on the cleanest way to explain the value.'],
    coachThisWay: ['Be transparent about the trade path and keep it fair.', 'Use clear language and one next step.'],
    avoidThis: ['Do not make the trade feel like a secret number.', 'Avoid defensive language.'],
    nextDrill: ['Run a transparency drill before discussing the next value point.'],
    purpose: 'Trade drills help the rep explain value without losing trust.',
  },
  'repair approval': {
    title: 'Repair Approval Drill',
    drillHints: ['Make the reason for the repair feel understandable.', 'Practice a clean explanation before asking for approval.'],
    setup: ['Frame the need in one clear sentence.', 'Do not bury the repair reason in process talk.'],
    practice: ['Practice the explanation, then the ask.', 'Keep the approval request calm and direct.'],
    feedback: ['Coach where the explanation got too technical or too vague.', 'Tighten the language until the need is obvious.'],
    secondRep: ['Run the approval ask again with a more human tone.', 'Repeat the line with more confidence and less filler.'],
    commitment: ['Agree on the exact approval line they will use next.', 'Lock the explanation that makes the most sense.'],
    coachThisWay: ['Explain the need first and ask clearly.', 'Keep the repair path simple and respectful.'],
    avoidThis: ['Do not pressure the customer into agreeing.', 'Avoid sounding like the estimate is non-negotiable.'],
    nextDrill: ['Run a need-plus-ask drill until the explanation lands cleanly.'],
    purpose: 'Repair approval drills help the advisor explain the need without sounding pushy.',
  },
  'status update': {
    title: 'Status Update Drill',
    drillHints: ['Give the customer a clean update and a next checkpoint.', 'Keep the conversation current without overwhelming detail.'],
    setup: ['Start with the current status in plain language.', 'Do not flood the customer with process detail.'],
    practice: ['Practice the update, then the next checkpoint.', 'Keep the pace steady and easy to follow.'],
    feedback: ['Coach the clarity of the update and the handoff.', 'Show the rep where the update could be shorter.'],
    secondRep: ['Run the update again with one cleaner sentence.', 'Repeat it with more ownership and less filler.'],
    commitment: ['Lock in the exact status update line for the next customer.', 'Agree on the next checkpoint they will state.'],
    coachThisWay: ['Lead with what is known and what happens next.', 'Keep the update short, clear, and current.'],
    avoidThis: ['Do not leave the customer guessing.', 'Avoid vague status language.'],
    nextDrill: ['Run a status-line drill with one clear next checkpoint.'],
    purpose: 'Status updates build confidence when the customer knows what comes next.',
  },
  handoff: {
    title: 'Handoff Drill',
    drillHints: ['Make the transition feel intentional, not abrupt.', 'Show the customer exactly who owns the next step.'],
    setup: ['Name the person and the reason for the handoff.', 'Keep the transition smooth and simple.'],
    practice: ['Practice the handoff line, then the introduction.', 'Keep the customer oriented through the change.'],
    feedback: ['Coach where the transition felt too fast or too vague.', 'Tighten the ownership statement.'],
    secondRep: ['Run the handoff again with a cleaner bridge.', 'Repeat it with less noise and more confidence.'],
    commitment: ['Agree on the handoff line they will use live.', 'Lock the exact phrase that protects the transition.'],
    coachThisWay: ['Explain who is taking over and why.', 'Keep the handoff calm and obvious.'],
    avoidThis: ['Do not drop the customer into the next person cold.', 'Avoid a rushed transfer.'],
    nextDrill: ['Run a handoff bridge drill before the next transition.'],
    purpose: 'Handoff drills reduce confusion and keep ownership visible.',
  },
  'follow-up': {
    title: 'Follow-Up Drill',
    drillHints: ['Make the next touchpoint feel specific and reliable.', 'Keep the follow-up plan short enough to remember.'],
    setup: ['State the reason for the follow-up clearly.', 'Do not make the next step feel like a maybe.'],
    practice: ['Practice the follow-up ask, then the timing.', 'Keep the wording calm and direct.'],
    feedback: ['Coach the part that sounded too soft or too vague.', 'Point to one detail that should be more exact.'],
    secondRep: ['Run the follow-up line again with more ownership.', 'Repeat it with one clear commitment.'],
    commitment: ['Lock the exact follow-up line they will use next time.', 'Agree on the follow-up promise they can keep.'],
    coachThisWay: ['Make the next touchpoint specific and easy to honor.', 'Keep the follow-up clear and time-bound.'],
    avoidThis: ['Do not leave the next step fuzzy.', 'Avoid “I’ll reach out sometime.”'],
    nextDrill: ['Run a one-line follow-up commitment drill.'],
    purpose: 'Follow-up drills help the rep create a next touchpoint the customer will trust.',
  },
};

const ISSUE_LIBRARY: Record<FiveMinuteDrillIssue, IssuePack> = {
  'too vague': {
    title: 'Too Vague',
    read: 'The associate needs tighter words and a clearer path for the customer.',
    setup: ['Set the goal around one specific sentence.', 'Make the rep name the next step clearly.'],
    practice: ['Practice until the line is short and direct.', 'Ask for one concrete next step, not a general explanation.'],
    feedback: ['Coach the loose language and tighten it up.', 'Point to the place where clarity slipped.'],
    secondRep: ['Run the line again with fewer words and more direction.', 'Repeat it with a clearer customer path.'],
    commitment: ['Lock the one-sentence version they will use next.', 'Agree on a cleaner line that removes the fog.'],
    coachThisWay: ['Choose one message and say it plainly.', 'Make the next step easy to hear.'],
    avoidThis: ['Avoid broad phrases that do not tell the customer what happens next.', 'Do not leave the customer guessing.'],
    nextDrill: ['Run a one-sentence clarity drill next.'],
    riskPhrases: ['just keep it broad', 'we will see', 'kind of'],
    scoreBias: { Clarity: 2, 'Next-step control': 1 },
  },
  'too pushy': {
    title: 'Too Pushy',
    read: 'The associate is moving too fast and the customer needs more room.',
    setup: ['Set the goal around pace and permission.', 'Make the rep slow down before asking for anything.'],
    practice: ['Practice a softer opening with one pause.', 'Keep the customer in control of the pace.'],
    feedback: ['Coach the pressure points and soften them.', 'Show the rep where the ask came too soon.'],
    secondRep: ['Run it again with more space before the ask.', 'Repeat it without trying to force momentum.'],
    commitment: ['Lock in a slower, permission-first line.', 'Agree on one calm question they can use.'],
    coachThisWay: ['Lead with permission and one calm question.', 'Give the customer room before steering.'],
    avoidThis: ['Avoid pushing for a decision before the customer is ready.', 'Do not crowd the moment.'],
    nextDrill: ['Run a permission-first pause drill next.'],
    riskPhrases: ['you need to decide', 'we need to move', 'let me be direct'],
    scoreBias: { 'Customer focus': 2, Confidence: 1 },
  },
  'lacks confidence': {
    title: 'Lacks Confidence',
    read: 'The associate needs a steadier voice and a cleaner line.',
    setup: ['Set the goal around voice and posture.', 'Have the rep slow the delivery and own the line.'],
    practice: ['Practice the line with a steadier pace.', 'Repeat it until it sounds certain.'],
    feedback: ['Coach the hesitations and tighten the delivery.', 'Point out where the line lost authority.'],
    secondRep: ['Run it again with a calmer, stronger voice.', 'Repeat it with fewer fillers and more control.'],
    commitment: ['Lock the strongest version of the line.', 'Agree on the one sentence they can say with confidence.'],
    coachThisWay: ['Keep the words short and the voice steady.', 'Let certainty come through in the pace.'],
    avoidThis: ['Do not over-explain to cover nerves.', 'Avoid sounding unsure of the next step.'],
    nextDrill: ['Run a calm-voice confidence drill next.'],
    riskPhrases: ['I think', 'maybe', 'sort of'],
    scoreBias: { Confidence: 2, Clarity: 1 },
  },
  'skips discovery': {
    title: 'Skips Discovery',
    read: 'The associate needs to slow down and ask a better question first.',
    setup: ['Set the goal around asking before telling.', 'Make the rep uncover the need before offering a solution.'],
    practice: ['Practice one good question and a pause.', 'Keep the conversation in discovery for a little longer.'],
    feedback: ['Coach the jump to solutions and slow it down.', 'Point to the moment discovery should have happened.'],
    secondRep: ['Run it again with a cleaner question first.', 'Repeat it without jumping ahead.'],
    commitment: ['Lock the question that helps them uncover the need.', 'Agree on the first question they should ask.'],
    coachThisWay: ['Ask one better question before you explain.', 'Let the customer answer before you steer.'],
    avoidThis: ['Do not pitch too early.', 'Avoid giving answers before you know the need.'],
    nextDrill: ['Run a discovery ladder drill next.'],
    riskPhrases: ['what if I told you', 'let me show you', 'here is what you need'],
    scoreBias: { 'Customer focus': 2, Clarity: 1 },
  },
  'weak close': {
    title: 'Weak Close',
    read: 'The associate needs a clearer ask and a firmer next step.',
    setup: ['Set the goal around a direct close.', 'Make the rep ask cleanly and then stop talking.'],
    practice: ['Practice the close and the pause after it.', 'Keep the ask short and easy to hear.'],
    feedback: ['Coach the soft ending and tighten the ask.', 'Show the rep where the close needs more ownership.'],
    secondRep: ['Run the close again with a clearer next move.', 'Repeat it without backing away from the ask.'],
    commitment: ['Lock the exact close line they will use next.', 'Agree on the cleanest close for the next customer.'],
    coachThisWay: ['Ask clearly and pause.', 'Keep the close simple and direct.'],
    avoidThis: ['Do not trail off at the end.', 'Avoid closing without a real ask.'],
    nextDrill: ['Run a clean close-and-pause drill next.'],
    riskPhrases: ['what do you think', 'maybe later', 'let me know'],
    scoreBias: { 'Next-step control': 2, Confidence: 1 },
  },
  'poor clarity': {
    title: 'Poor Clarity',
    read: 'The associate is talking but not making the path easy to follow.',
    setup: ['Set the goal around plain language.', 'Make the rep translate the idea into one simple path.'],
    practice: ['Practice the sentence until it sounds obvious.', 'Keep the wording plain and easy to follow.'],
    feedback: ['Coach the confusing parts and cut them down.', 'Show the rep where the sentence lost the customer.'],
    secondRep: ['Run it again with simpler words and one clean next step.', 'Repeat it in language the customer can repeat back.'],
    commitment: ['Lock the clearest version of the message.', 'Agree on the simple line they will use live.'],
    coachThisWay: ['Use simple words and one clear action.', 'Make it easy for the customer to repeat back.'],
    avoidThis: ['Avoid jargon or layered explanations.', 'Do not make the customer work to understand the point.'],
    nextDrill: ['Run a plain-language reset drill next.'],
    riskPhrases: ['in a nutshell', 'basically', 'what I mean is'],
    scoreBias: { Clarity: 2, 'Customer focus': 1 },
  },
};

const METRIC_BASE_NOTES: Record<FiveMinuteDrillMetricLabel, string> = {
  Clarity: 'Make the first sentence shorter and easier to repeat.',
  Confidence: 'Use a steadier pace and remove filler words.',
  'Customer focus': 'Start from the customer concern, not the manager correction.',
  'Next-step control': 'Name the next move clearly and stop talking once it lands.',
};

const ROLE_METRIC_BIAS: Record<FiveMinuteDrillRole, Record<FiveMinuteDrillMetricLabel, number>> = {
  'Sales Associate': {
    Clarity: 0,
    Confidence: 0,
    'Customer focus': 1,
    'Next-step control': 0,
  },
  'Service Advisor': {
    Clarity: 1,
    Confidence: 0,
    'Customer focus': 1,
    'Next-step control': 1,
  },
};

const FOCUS_METRIC_BIAS: Record<FiveMinuteDrillFocus, Record<FiveMinuteDrillMetricLabel, number>> = {
  greeting: { Clarity: 1, Confidence: 0, 'Customer focus': 1, 'Next-step control': 0 },
  discovery: { Clarity: 1, Confidence: 0, 'Customer focus': 2, 'Next-step control': 0 },
  objection: { Clarity: 1, Confidence: 1, 'Customer focus': 0, 'Next-step control': 1 },
  'price/payment': { Clarity: 2, Confidence: 1, 'Customer focus': 0, 'Next-step control': 1 },
  trade: { Clarity: 1, Confidence: 0, 'Customer focus': 1, 'Next-step control': 1 },
  'repair approval': { Clarity: 1, Confidence: 0, 'Customer focus': 1, 'Next-step control': 1 },
  'status update': { Clarity: 2, Confidence: 0, 'Customer focus': 1, 'Next-step control': 1 },
  handoff: { Clarity: 1, Confidence: 0, 'Customer focus': 0, 'Next-step control': 2 },
  'follow-up': { Clarity: 1, Confidence: 1, 'Customer focus': 0, 'Next-step control': 2 },
};

const ISSUE_FOCUS_BIAS: Record<FiveMinuteDrillIssue, Record<FiveMinuteDrillMetricLabel, number>> = {
  'too vague': { Clarity: 2, Confidence: 0, 'Customer focus': 0, 'Next-step control': 1 },
  'too pushy': { Clarity: 0, Confidence: 1, 'Customer focus': 2, 'Next-step control': 0 },
  'lacks confidence': { Clarity: 1, Confidence: 2, 'Customer focus': 0, 'Next-step control': 0 },
  'skips discovery': { Clarity: 1, Confidence: 0, 'Customer focus': 2, 'Next-step control': 0 },
  'weak close': { Clarity: 0, Confidence: 1, 'Customer focus': 0, 'Next-step control': 2 },
  'poor clarity': { Clarity: 2, Confidence: 0, 'Customer focus': 1, 'Next-step control': 0 },
};

function scenarioFocusSkill(focus: FiveMinuteDrillFocus): FiveMinuteDrillMetricLabel {
  if (focus === 'greeting' || focus === 'discovery' || focus === 'trade' || focus === 'repair approval' || focus === 'status update') {
    return 'Customer focus';
  }
  if (focus === 'objection' || focus === 'follow-up' || focus === 'handoff') {
    return 'Next-step control';
  }
  if (focus === 'price/payment') {
    return 'Clarity';
  }
  return 'Confidence';
}

function scoreCard(
  role: FiveMinuteDrillRole,
  focus: FiveMinuteDrillFocus,
  issue: FiveMinuteDrillIssue,
): FiveMinuteDrillScoreMetric[] {
  return (['Clarity', 'Confidence', 'Customer focus', 'Next-step control'] as const).map((label) => {
    const value = clamp(2 + ROLE_METRIC_BIAS[role][label] + FOCUS_METRIC_BIAS[focus][label] + ISSUE_FOCUS_BIAS[issue][label], 1, 5);
    const note = label === 'Clarity'
      ? (value >= 4 ? 'This drill should make the next sentence obvious.' : METRIC_BASE_NOTES[label])
      : label === 'Confidence'
        ? (value >= 4 ? 'Coach the voice and pace first.' : METRIC_BASE_NOTES[label])
        : label === 'Customer focus'
          ? (value >= 4 ? 'Start from the customer need before the correction.' : METRIC_BASE_NOTES[label])
          : (value >= 4 ? 'Push the rep to land the next step cleanly.' : METRIC_BASE_NOTES[label]);

    return { label, value, note };
  });
}

function buildQuickCopy(stages: FiveMinuteDrillStage[]): string {
  return stages
    .map((stage) => `${stage.label}: ${stage.body}`)
    .join(' ');
}

function buildStage(
  label: FiveMinuteDrillStage['label'],
  role: RolePack,
  focus: FocusPack,
  issue: IssuePack,
  seed: string,
  selector: keyof Omit<RolePack, 'opener'>,
): string {
  return joinSentences([
    pick(role[selector], seed),
    pick(focus[selector], seed),
    pick(issue[selector], seed),
  ]);
}

export function getFiveMinuteDrillPlan(input: FiveMinuteDrillInput, variantSeed = 0): FiveMinuteDrillPlan {
  const role = ROLE_LIBRARY[input.role];
  const focus = FOCUS_LIBRARY[input.focus];
  const issue = ISSUE_LIBRARY[input.currentIssue];
  const seed = [input.role, input.focus, input.currentIssue, normalizeText(input.managerNote), normalizeText(input.associateName ?? ''), String(variantSeed)].join('|');

  const stages: FiveMinuteDrillStage[] = [
    {
      label: '30-second setup',
      body: buildStage('30-second setup', role, focus, issue, seed, 'setup'),
    },
    {
      label: '2-minute practice',
      body: buildStage('2-minute practice', role, focus, issue, seed, 'practice'),
    },
    {
      label: '90-second feedback',
      body: buildStage('90-second feedback', role, focus, issue, seed, 'feedback'),
    },
    {
      label: '60-second second rep',
      body: buildStage('60-second second rep', role, focus, issue, seed, 'secondRep'),
    },
    {
      label: '30-second commitment',
      body: buildStage('30-second commitment', role, focus, issue, seed, 'commitment'),
    },
  ];

  const drillName = `${input.role} ${focus.title} Drill`;
  const summary = `${focus.purpose} ${issue.read}`;
  const coachThisWay = joinSentences([
    pick(role.coachThisWay, seed),
    pick(focus.coachThisWay, seed),
    pick(issue.coachThisWay, seed),
  ]);
  const avoidThis = joinSentences([
    pick(role.avoidThis, seed),
    pick(focus.avoidThis, seed),
    pick(issue.avoidThis, seed),
  ]);
  const nextDrill = pick(issue.nextDrill, seed);
  const managerCue = joinSentences([
    pick(role.opener, seed),
    pick(focus.drillHints, seed),
    issue.read,
  ]);

  return {
    drillName,
    summary,
    stages,
    coachThisWay,
    avoidThis,
    quickCopy: buildQuickCopy(stages),
    nextDrill,
    managerCue,
    scorecard: scoreCard(input.role, input.focus, input.currentIssue),
  };
}

export function getFiveMinuteDrillSprocketInsight(
  input: FiveMinuteDrillInput,
  plan: FiveMinuteDrillPlan,
  variantSeed = 0,
): FiveMinuteDrillSprocketInsight {
  const role = ROLE_LIBRARY[input.role];
  const focus = FOCUS_LIBRARY[input.focus];
  const issue = ISSUE_LIBRARY[input.currentIssue];
  const seed = [input.role, input.focus, input.currentIssue, normalizeText(input.managerNote), normalizeText(input.associateName ?? ''), String(variantSeed)].join('|');
  const riskyPhrases = detectRiskyPhrases(input.managerNote, issue.riskPhrases);
  const rewrittenManagerLanguage = rewriteManagerLanguage(
    input.managerNote,
    seed,
    joinSentences([pick(role.coachThisWay, seed), pick(focus.coachThisWay, seed), pick(issue.coachThisWay, seed)]),
  );

  return {
    issueRead: joinSentences([issue.read, focus.purpose]),
    drillRecommendation: `${focus.title}: ${pick(focus.drillHints, seed)}`,
    managerLanguage: rewrittenManagerLanguage,
    riskyPhrases,
    nextDrill: plan.nextDrill,
    calmText: joinSentences([plan.coachThisWay, 'Keep the manager language direct, positive, and usable.']),
  };
}

function buildCxNotes(
  focusSkill: FiveMinuteDrillMetricLabel,
  historySummary?: FiveMinuteDrillHistorySummary | null,
): FiveMinuteDrillCxMetric[] {
  const baseNotes: Record<FiveMinuteDrillMetricLabel, string> = {
    Clarity: 'Coach one shorter sentence and one cleaner ask.',
    Confidence: 'Coach a steadier pace and fewer filler words.',
    'Customer focus': 'Coach the rep to start with the customer need first.',
    'Next-step control': 'Coach one visible next step and a clear owner.',
  };

  const historyLine = historySummary?.lastFocus
    ? ` Last saved drill: ${historySummary.lastFocus}${historySummary.lastIssue ? ` / ${historySummary.lastIssue}` : ''}.`
    : '';

  return [
    {
      label: 'Clarity',
      note: `${focusSkill === 'Clarity' ? 'This is your highest lift point.' : 'Keep the language simple and direct.'} ${baseNotes.Clarity}${historyLine}`,
    },
    {
      label: 'Confidence',
      note: `${focusSkill === 'Confidence' ? 'This is your highest lift point.' : 'Use a steady voice and short phrases.'} ${baseNotes.Confidence}${historyLine}`,
    },
    {
      label: 'Customer focus',
      note: `${focusSkill === 'Customer focus' ? 'This is your highest lift point.' : 'Coach from the customer problem first.'} ${baseNotes['Customer focus']}${historyLine}`,
    },
    {
      label: 'Next-step control',
      note: `${focusSkill === 'Next-step control' ? 'This is your highest lift point.' : 'Keep one clean move in front of the rep.'} ${baseNotes['Next-step control']}${historyLine}`,
    },
  ];
}

export function getFiveMinuteDrillCxInsight(
  input: FiveMinuteDrillInput,
  _plan: FiveMinuteDrillPlan,
  user?: User | null,
  historySummary?: FiveMinuteDrillHistorySummary | null,
  _variantSeed = 0,
): FiveMinuteDrillCxInsight {
  const hasProfile = Boolean(user?.stats && Object.keys(user.stats as Record<string, unknown>).length > 0);
  const skillScores = [
    { skill: 'Clarity' as const, score: readUserCxStatScore(user, 'listening') },
    { skill: 'Confidence' as const, score: readUserCxStatScore(user, 'closing') },
    { skill: 'Customer focus' as const, score: readUserCxStatScore(user, 'empathy') },
    { skill: 'Next-step control' as const, score: readUserCxStatScore(user, 'followUp') },
  ];

  const lowest = [...skillScores].sort((a, b) => a.score - b.score)[0];
  const focusSkill = hasProfile ? lowest.skill : scenarioFocusSkill(input.focus);
  const historyLine = historySummary?.lastFocus
    ? `You last saved a drill on ${historySummary.lastFocus}${historySummary.lastIssue ? ` / ${historySummary.lastIssue}` : ''}, so keep this one tight and usable.`
    : 'Use the saved drill history to keep the coaching practical and repeatable.';

  return {
    hasProfile,
    focusSkill,
    personalNote: hasProfile
      ? `${historyLine} Your ${focusSkill.toLowerCase()} trend is the weakest CX signal, so coach this drill through that lens.`
      : `Connect CX data to keep the drill specific. ${historyLine}`,
    coachingNotes: buildCxNotes(focusSkill, historySummary),
  };
}
