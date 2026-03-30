import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const FEE_TRANSPARENCY_FEE_TYPES = [
  'Documentation fee',
  'Dealer service fee',
  'Reconditioning fee',
  'Protection package',
  'Electronic filing fee',
  'Government / registration fee',
  'Market adjustment',
  'Shipping / destination',
  'Accessory or add-on fee',
  'Other / custom',
] as const;

export const FEE_TRANSPARENCY_STAGES = [
  'Online listing',
  'Early pricing conversation',
  'First pencil / numbers',
  'Trade or payment review',
  'F&I menu',
  'Late in process',
  'At signing',
] as const;

export const FEE_TRANSPARENCY_EMOTIONS = [
  'confused',
  'skeptical',
  'annoyed',
  'angry',
  'feeling blindsided',
  'feeling disrespected',
  'comparing to another dealer',
  'ready to walk',
] as const;

export const FEE_TRANSPARENCY_FRUSTRATIONS = [
  'money/payment impact',
  'surprise or timing',
  'fairness or ethics',
  'distrust of dealership intent',
  'online price mismatch',
  'time/process fatigue',
  'influence from spouse/friend/third party',
  'prior bad dealership experience',
] as const;

export const FEE_TRANSPARENCY_RISK = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const FEE_TRANSPARENCY_RESPONSE_MODES = [
  'short response',
  'fuller explanation',
  'recovery plan',
] as const;

export const FEE_TRANSPARENCY_SCRIPT_MODES = [
  '10-second version',
  '30-second version',
  'full conversation version',
  'text message follow-up version',
] as const;

export type FeeTransparencyFeeType = typeof FEE_TRANSPARENCY_FEE_TYPES[number];
export type FeeTransparencyStage = typeof FEE_TRANSPARENCY_STAGES[number];
export type FeeTransparencyEmotion = typeof FEE_TRANSPARENCY_EMOTIONS[number];
export type FeeTransparencyFrustration = typeof FEE_TRANSPARENCY_FRUSTRATIONS[number];
export type FeeTransparencyRiskLevel = typeof FEE_TRANSPARENCY_RISK[number];
export type FeeTransparencyResponseMode = typeof FEE_TRANSPARENCY_RESPONSE_MODES[number];
export type FeeTransparencyScriptMode = typeof FEE_TRANSPARENCY_SCRIPT_MODES[number];

export type FeeTransparencyInput = {
  feeType: FeeTransparencyFeeType;
  customFeeName: string;
  amount: string;
  objectionStage: FeeTransparencyStage;
  emotion: FeeTransparencyEmotion;
  frustrationFactors: FeeTransparencyFrustration[];
  riskLevel: FeeTransparencyRiskLevel;
  desiredResponse: FeeTransparencyResponseMode;
  messyNotes: string;
};

export type FeeTransparencyPlan = {
  feeLabel: string;
  scenarioSummary: string;
  recommendedOpeningLine: string;
  plainEnglishFeeExplanation: string;
  whatNotToSay: string;
  likelyHiddenObjection: string;
  bestResponsePath: string;
  nextStepRecommendation: string;
  deEscalationPhrasing: string;
  primaryApproach: string;
  backupApproach: string;
  scripts: Record<FeeTransparencyScriptMode, string>;
};

export type FeeTransparencySprocketEnhancement = {
  noteInterpretation: string;
  realObjection: string;
  bestNextMove: string;
  triggerAvoidance: string;
  calmRewrite: string;
  directRewrite: string;
  empatheticRewrite: string;
  assertiveRewrite: string;
  trustRebuildingRewrite: string;
};

export type FeeTransparencyCxEnhancement = {
  tailoredReason: string;
  coachingPattern: string;
  recommendedAdjustment: string;
  skillAwareTip: string;
  focusSkillTag: 'Empathy' | 'Listening' | 'Trust' | 'Closing';
};

export type FeeTransparencySavedScenario = {
  id: string;
  createdAt: string;
  feeLabel: string;
  amount: string;
  emotion: FeeTransparencyEmotion;
  frustrationFactors: FeeTransparencyFrustration[];
  riskLevel: FeeTransparencyRiskLevel;
  primaryApproach: string;
  backupApproach: string;
  recommendedOpeningLine: string;
  nextStepRecommendation: string;
  scenarioSummary: string;
  favorite?: boolean;
};

type NoteSignals = {
  mentionsPayment: boolean;
  mentionsTrust: boolean;
  mentionsTiming: boolean;
  mentionsOnline: boolean;
  mentionsThirdParty: boolean;
  mentionsWalk: boolean;
  mentionsManager: boolean;
  mentionsBadExperience: boolean;
};

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function readNoteSignals(notes: string): NoteSignals {
  const text = notes.trim().toLowerCase();

  return {
    mentionsPayment: hasKeyword(text, ['payment', 'monthly', 'month', 'afford', 'budget', 'too much', 'expensive']),
    mentionsTrust: hasKeyword(text, ['dishonest', 'shady', 'scam', 'hidden', 'bait', 'switch', 'lying', 'trust']),
    mentionsTiming: hasKeyword(text, ['late', 'now', 'suddenly', 'at the end', 'last minute', 'blindsided', 'surprise']),
    mentionsOnline: hasKeyword(text, ['online', 'website', 'listing', 'internet', 'advertised']),
    mentionsThirdParty: hasKeyword(text, ['wife', 'husband', 'spouse', 'friend', 'dad', 'mom', 'brother', 'sister']),
    mentionsWalk: hasKeyword(text, ['walk', 'leave', 'done', 'out of here', 'going somewhere else']),
    mentionsManager: hasKeyword(text, ['manager', 'desk', 'gm', 'sales manager']),
    mentionsBadExperience: hasKeyword(text, ['last dealer', 'before', 'previous', 'bad experience', 'burned']),
  };
}

function cleanAmount(amount: string): string {
  const trimmed = amount.trim();
  if (!trimmed) return 'the fee';
  return /^\$/.test(trimmed) ? trimmed : `$${trimmed}`;
}

function buildFeeLabel(input: FeeTransparencyInput): string {
  if (input.feeType === 'Other / custom' && input.customFeeName.trim()) {
    return input.customFeeName.trim();
  }

  return input.feeType;
}

function inferFeeFamily(feeLabel: string): 'doc' | 'dealer' | 'reconditioning' | 'protection' | 'efile' | 'government' | 'market' | 'shipping' | 'addon' | 'other' {
  const text = feeLabel.toLowerCase();
  if (text.includes('doc')) return 'doc';
  if (text.includes('service')) return 'dealer';
  if (text.includes('recondition')) return 'reconditioning';
  if (text.includes('protect')) return 'protection';
  if (text.includes('electronic') || text.includes('e-file')) return 'efile';
  if (text.includes('government') || text.includes('registration') || text.includes('dmv')) return 'government';
  if (text.includes('market')) return 'market';
  if (text.includes('shipping') || text.includes('destination')) return 'shipping';
  if (text.includes('accessory') || text.includes('add-on')) return 'addon';
  return 'other';
}

function buildOpeningLine(input: FeeTransparencyInput): string {
  if (input.riskLevel === 'critical' || input.emotion === 'ready to walk') {
    return 'I hear why that feels like too much right now, and I want to slow this down and be clear instead of trying to talk past it.';
  }
  if (input.emotion === 'angry' || input.emotion === 'feeling disrespected') {
    return 'I can see why that hit wrong, and I want to explain it plainly without getting defensive.';
  }
  if (input.emotion === 'feeling blindsided' || input.emotion === 'confused') {
    return 'That makes sense to question, especially if it did not feel clear early enough.';
  }
  if (input.emotion === 'comparing to another dealer') {
    return 'Fair question. Let me separate what this fee is from how the other quote may have been presented.';
  }
  return 'That is a fair thing to ask about, and I want to answer it clearly.';
}

function buildExplanation(input: FeeTransparencyInput, feeLabel: string): string {
  const amount = cleanAmount(input.amount);
  const family = inferFeeFamily(feeLabel);

  switch (family) {
    case 'doc':
      return `${feeLabel} is ${amount}, and the clean way to explain it is that it covers the dealership's documentation and processing work. It is not the vehicle price itself, so I want to keep it separate and transparent.`;
    case 'dealer':
      return `${feeLabel} is ${amount}, and it is meant to cover dealership handling tied to getting the deal processed and delivered correctly. The right way to present it is clearly and early, not as something tucked in later.`;
    case 'reconditioning':
      return `${feeLabel} is ${amount}, and it reflects work already done to prepare the vehicle for sale. The key is to explain what was done and keep that separate from pressure or spin.`;
    case 'protection':
      return `${feeLabel} is ${amount}, and it relates to a protection product or coverage item. If the customer does not understand the value first, it will sound like a markup, so the explanation has to stay simple and optional where appropriate.`;
    case 'efile':
      return `${feeLabel} is ${amount}, and it covers electronic filing or title-related processing. The clean explanation is administrative, not emotional.`;
    case 'government':
      return `${feeLabel} is ${amount}, and it is tied to registration, title, or government-related processing rather than dealership profit language.`;
    case 'market':
      return `${feeLabel} is ${amount}, and this one usually triggers fairness questions because it feels like pricing rather than admin. If you explain it, do it plainly and avoid acting like the customer should just accept it.`;
    case 'shipping':
      return `${feeLabel} is ${amount}, and it should be explained as transport or destination cost, not hidden inside vague pricing language.`;
    case 'addon':
      return `${feeLabel} is ${amount}, and the explanation only works if you are specific about what the customer is actually getting. Vague wording will make it sound slippery fast.`;
    default:
      return `${feeLabel} is ${amount}. The best explanation is plain and specific: what it is, what it is not, and why you want the customer to see it clearly instead of feeling surprised by it.`;
  }
}

function strongestFrustration(input: FeeTransparencyInput, signals: NoteSignals): FeeTransparencyFrustration {
  if (signals.mentionsOnline) return 'online price mismatch';
  if (signals.mentionsPayment) return 'money/payment impact';
  if (signals.mentionsTrust) return 'distrust of dealership intent';
  if (signals.mentionsThirdParty) return 'influence from spouse/friend/third party';
  if (signals.mentionsBadExperience) return 'prior bad dealership experience';
  return input.frustrationFactors[0] ?? 'surprise or timing';
}

function buildHiddenObjection(input: FeeTransparencyInput, signals: NoteSignals): string {
  const driver = strongestFrustration(input, signals);

  switch (driver) {
    case 'money/payment impact':
      return 'The hidden objection is likely affordability, not the fee itself. The fee is the visible target because it feels more negotiable than admitting the payment is now uncomfortable.';
    case 'surprise or timing':
      return 'The hidden objection is loss of control. The customer is reacting less to the amount and more to feeling that the process changed late.';
    case 'fairness or ethics':
      return 'The hidden objection is moral trust. Once the customer thinks the fee is unfair, they start questioning the whole deal, not just one line item.';
    case 'distrust of dealership intent':
      return 'The hidden objection is dealership motive. They are testing whether you will get clearer or more slippery when challenged.';
    case 'online price mismatch':
      return 'The hidden objection is credibility around the advertised number. Until that gap feels resolved, every explanation will sound defensive.';
    case 'time/process fatigue':
      return 'The hidden objection is emotional exhaustion. They may be less opposed to the fee than to feeling dragged through one more conversation.';
    case 'influence from spouse/friend/third party':
      return 'The hidden objection is outside validation. The consultant is no longer the only voice in the decision.';
    case 'prior bad dealership experience':
      return 'The hidden objection is pattern recognition. They think this fee confirms a story they have seen before.';
    default:
      return 'The hidden objection is probably trust and control, not just the fee line itself.';
  }
}

function buildWhatNotToSay(input: FeeTransparencyInput): string {
  if (input.emotion === 'angry' || input.emotion === 'feeling disrespected') {
    return 'Do not say, "Everybody pays that," "It is standard," or "It is not a big deal."';
  }
  if (input.emotion === 'comparing to another dealer' || input.frustrationFactors.includes('online price mismatch')) {
    return 'Do not say, "Their deal probably has hidden stuff too," or attack the other dealer before clarifying your own number.';
  }
  if (input.frustrationFactors.includes('money/payment impact')) {
    return 'Do not jump straight to defending the fee before finding out whether the real issue is monthly payment or total out-of-pocket.';
  }
  return 'Do not get vague, sarcastic, or overly transactional. Avoid phrases that sound dismissive or rehearsed.';
}

function buildPrimaryApproach(input: FeeTransparencyInput, signals: NoteSignals): string {
  if (input.riskLevel === 'critical' || signals.mentionsWalk) {
    return 'Stabilize first: acknowledge the reaction, slow the pace, explain once, then invite the customer to tell you whether the issue is understanding, trust, or affordability.';
  }
  if (input.frustrationFactors.includes('online price mismatch')) {
    return 'Credibility-first: isolate the online-price concern before trying to justify the fee.';
  }
  if (input.frustrationFactors.includes('money/payment impact') || signals.mentionsPayment) {
    return 'Separate explanation from negotiation: explain the fee clearly, then diagnose whether the real problem is payment comfort.';
  }
  return 'Transparency-first: acknowledge emotion, explain the fee in plain language, then ask one focused question instead of overtalking.';
}

function buildBackupApproach(input: FeeTransparencyInput): string {
  if (input.riskLevel === 'critical') {
    return 'Use a manager handoff only after you lower the temperature and frame it as support, not pressure.';
  }
  if (input.frustrationFactors.includes('time/process fatigue')) {
    return 'Compress the conversation: one short explanation, one clarifying question, one next step.';
  }
  if (input.frustrationFactors.includes('influence from spouse/friend/third party')) {
    return 'Use a recap path: give the customer a clean explanation they can repeat to the other decision-maker without sounding sold.';
  }
  return 'If explanation alone does not settle it, move to a clean next-step question instead of repeating the same defense.';
}

function buildResponsePath(input: FeeTransparencyInput): string {
  const firstMove = input.riskLevel === 'critical'
    ? 'Acknowledge the emotion immediately and lower pace.'
    : 'Acknowledge the question without sounding apologetic or combative.';
  const secondMove = 'Explain the fee in one plain-English pass.';
  const thirdMove = input.frustrationFactors.includes('money/payment impact')
    ? 'Then separate the fee explanation from whether the overall deal still works financially.'
    : 'Then ask what part feels off: the amount, the timing, or the trust of how it showed up.';
  const fourthMove = input.riskLevel === 'high' || input.riskLevel === 'critical'
    ? 'If resistance stays high, involve a manager as support after framing the issue accurately.'
    : 'Once the real objection is isolated, move to the next step instead of circling.';

  return `${firstMove} ${secondMove} ${thirdMove} ${fourthMove}`;
}

function buildNextStep(input: FeeTransparencyInput, signals: NoteSignals): string {
  if (input.riskLevel === 'critical' || signals.mentionsWalk) {
    return 'Stop selling for a moment. Confirm whether they need clarity, a pricing adjustment conversation, or a manager involved before the deal slips into walk-out mode.';
  }
  if (input.frustrationFactors.includes('online price mismatch') || signals.mentionsOnline) {
    return 'Put the advertised number and current number side by side, explain the gap cleanly, and ask whether the concern is transparency or affordability.';
  }
  if (input.frustrationFactors.includes('money/payment impact') || signals.mentionsPayment) {
    return 'After the explanation, ask if the bigger issue is the fee itself or what it does to the monthly/payment structure.';
  }
  if (input.frustrationFactors.includes('time/process fatigue')) {
    return 'Shorten the path. Give one answer, then move to a single decision checkpoint.';
  }
  return 'After you explain it, ask one clean diagnostic question and keep forward motion toward either resolution or the right escalation.';
}

function buildDeEscalation(input: FeeTransparencyInput): string {
  if (input.emotion === 'angry' || input.emotion === 'ready to walk' || input.riskLevel === 'critical') {
    return 'I am not trying to push you through it. I just want to make sure you have a straight answer before we decide what makes sense next.';
  }
  if (input.emotion === 'feeling disrespected') {
    return 'You deserve a direct explanation, and if we did not make it feel clear early enough, I understand why you are calling it out.';
  }
  return 'I would rather be direct about it than have it feel like we are dancing around your question.';
}

function buildQuestion(input: FeeTransparencyInput, signals: NoteSignals): string {
  if (input.frustrationFactors.includes('money/payment impact') || signals.mentionsPayment) {
    return 'Is the bigger issue the fee itself, or what it does to the overall numbers?';
  }
  if (input.frustrationFactors.includes('online price mismatch') || signals.mentionsOnline) {
    return 'Is your main concern the number itself, or that it showed up differently than expected online?';
  }
  if (input.riskLevel === 'critical') {
    return 'Before we go any further, what feels most off right now: the fee, the timing, or the trust of the process?';
  }
  return 'What part of this feels most frustrating right now: the amount, the timing, or how it was presented?';
}

function buildScripts(input: FeeTransparencyInput, plan: Omit<FeeTransparencyPlan, 'scripts'>): Record<FeeTransparencyScriptMode, string> {
  const question = buildQuestion(input, readNoteSignals(input.messyNotes));

  return {
    '10-second version': `${plan.recommendedOpeningLine} ${plan.plainEnglishFeeExplanation} ${question}`,
    '30-second version': `${plan.recommendedOpeningLine} ${plan.plainEnglishFeeExplanation} What I do not want to do is blur explanation with negotiation. ${question}`,
    'full conversation version': `${plan.recommendedOpeningLine} ${plan.deEscalationPhrasing} ${plan.plainEnglishFeeExplanation} I want to separate what the fee is from whether the overall structure still feels right to you. ${question} ${plan.nextStepRecommendation}`,
    'text message follow-up version': `I wanted to follow up and answer your fee question more clearly. ${plan.plainEnglishFeeExplanation} If the bigger concern is how it affects the overall numbers or how it showed up in the process, tell me that directly and I will help with the cleanest next step.`,
  };
}

export function getFeeTransparencyPlan(input: FeeTransparencyInput): FeeTransparencyPlan {
  const feeLabel = buildFeeLabel(input);
  const signals = readNoteSignals(input.messyNotes);
  const recommendedOpeningLine = buildOpeningLine(input);
  const plainEnglishFeeExplanation = buildExplanation(input, feeLabel);
  const whatNotToSay = buildWhatNotToSay(input);
  const likelyHiddenObjection = buildHiddenObjection(input, signals);
  const bestResponsePath = buildResponsePath(input);
  const nextStepRecommendation = buildNextStep(input, signals);
  const deEscalationPhrasing = buildDeEscalation(input);
  const primaryApproach = buildPrimaryApproach(input, signals);
  const backupApproach = buildBackupApproach(input);
  const scenarioSummary = `${feeLabel}${input.amount.trim() ? ` · ${cleanAmount(input.amount)}` : ''} · ${input.emotion} · ${input.riskLevel} risk`;

  return {
    feeLabel,
    scenarioSummary,
    recommendedOpeningLine,
    plainEnglishFeeExplanation,
    whatNotToSay,
    likelyHiddenObjection,
    bestResponsePath,
    nextStepRecommendation,
    deEscalationPhrasing,
    primaryApproach,
    backupApproach,
    scripts: buildScripts(input, {
      feeLabel,
      scenarioSummary,
      recommendedOpeningLine,
      plainEnglishFeeExplanation,
      whatNotToSay,
      likelyHiddenObjection,
      bestResponsePath,
      nextStepRecommendation,
      deEscalationPhrasing,
      primaryApproach,
      backupApproach,
    }),
  };
}

export function getSprocketFeeTransparencyEnhancement(
  input: FeeTransparencyInput,
  plan: FeeTransparencyPlan
): FeeTransparencySprocketEnhancement {
  const signals = readNoteSignals(input.messyNotes);
  const realObjection =
    signals.mentionsPayment || input.frustrationFactors.includes('money/payment impact')
      ? 'This is probably landing as a fee objection, but the real objection is payment pressure or total out-the-door discomfort.'
      : signals.mentionsOnline || input.frustrationFactors.includes('online price mismatch')
        ? 'This sounds more like a credibility issue than a simple fee complaint.'
        : signals.mentionsTrust || input.frustrationFactors.includes('fairness or ethics') || input.frustrationFactors.includes('distrust of dealership intent')
          ? 'The real issue is trust. If the customer feels handled, logic alone will not settle it.'
          : signals.mentionsThirdParty
            ? 'The fee objection is likely being reinforced by another voice, so the response has to be easy to repeat outside the store.'
            : 'The deeper issue is control and emotional safety, not just the line item.';

  const noteInterpretation = input.messyNotes.trim()
    ? `Messy notes point to ${[
      signals.mentionsOnline ? 'online mismatch' : null,
      signals.mentionsPayment ? 'payment pressure' : null,
      signals.mentionsTrust ? 'trust damage' : null,
      signals.mentionsTiming ? 'late-process surprise' : null,
      signals.mentionsThirdParty ? 'outside influence' : null,
      signals.mentionsBadExperience ? 'prior bad-dealer baggage' : null,
    ].filter(Boolean).join(', ') || 'general resistance'}.`
    : 'No messy notes entered, so the safest read is that the fee objection is being driven by timing, trust, or affordability.';

  const bestNextMove =
    input.riskLevel === 'critical' || signals.mentionsWalk
      ? 'Do not argue the fee again. Slow down, confirm the real objection, then decide whether to reframe or bring in a manager.'
      : input.desiredResponse === 'recovery plan'
        ? 'Use the full conversation script, diagnose the real issue, then pick one concrete next move instead of stacking explanations.'
        : 'Lead with one calm acknowledgement, explain once, then ask the isolating question.';

  const triggerAvoidance =
    input.emotion === 'ready to walk' || input.emotion === 'angry'
      ? 'Avoid defending dealership policy, interrupting, or acting surprised that they are upset.'
      : 'Avoid overexplaining, vague filler, and any line that sounds like the customer should already understand this.';

  return {
    noteInterpretation,
    realObjection,
    bestNextMove,
    triggerAvoidance,
    calmRewrite: `${plan.recommendedOpeningLine} ${plan.deEscalationPhrasing}`,
    directRewrite: `${plan.recommendedOpeningLine} ${plan.plainEnglishFeeExplanation}`,
    empatheticRewrite: `${plan.recommendedOpeningLine} ${plan.deEscalationPhrasing} ${buildQuestion(input, signals)}`,
    assertiveRewrite: `Let me be direct so this does not feel slippery. ${plan.plainEnglishFeeExplanation} ${buildQuestion(input, signals)}`,
    trustRebuildingRewrite: `${plan.recommendedOpeningLine} I want to separate clarity from pressure here. ${plan.nextStepRecommendation}`,
  };
}

export function getAutoDriveCxFeeTransparencyEnhancement(
  _input: FeeTransparencyInput,
  _plan: FeeTransparencyPlan,
  user?: User | null
): FeeTransparencyCxEnhancement {
  const stats = user?.stats;
  const empathy = readCxStatScore(stats?.empathy, 60);
  const listening = readCxStatScore(stats?.listening, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const closing = readCxStatScore(stats?.closing, 60);

  if (empathy < 55) {
    return {
      tailoredReason: 'Tailored to your CX pattern: empathy looks like a development area in tense moments.',
      coachingPattern: 'You will win more fee conversations by acknowledging first and shrinking the explanation second.',
      recommendedAdjustment: 'Use one reflective line before any fee detail so the customer feels heard before corrected.',
      skillAwareTip: 'Slow down and acknowledge first.',
      focusSkillTag: 'Empathy',
    };
  }

  if (trust < 55) {
    return {
      tailoredReason: 'Tailored to your CX pattern: trust-building language matters more than extra detail here.',
      coachingPattern: 'Be clearer about what the fee is and what it is not before discussing numbers or policy.',
      recommendedAdjustment: 'Use transparency language early and avoid policy-heavy phrasing.',
      skillAwareTip: 'Be clearer about value and intent before discussing numbers.',
      focusSkillTag: 'Trust',
    };
  }

  if (listening < 55) {
    return {
      tailoredReason: 'Tailored to your CX pattern: better isolation questions can keep you from solving the wrong problem.',
      coachingPattern: 'Ask one diagnostic question sooner instead of adding another explanation layer.',
      recommendedAdjustment: 'Mirror the customer concern once, then ask what is really driving the reaction.',
      skillAwareTip: 'Ask a cleaner isolating question before rebutting.',
      focusSkillTag: 'Listening',
    };
  }

  if (closing < 55) {
    return {
      tailoredReason: 'Tailored to your CX pattern: forward motion tends to improve when you make the next step more explicit.',
      coachingPattern: 'Once the fee is clarified, pivot decisively into the next decision point.',
      recommendedAdjustment: 'Do not linger in explanation mode after the objection is isolated.',
      skillAwareTip: 'Once they feel clear, move them to the next decision point.',
      focusSkillTag: 'Closing',
    };
  }

  return {
    tailoredReason: 'Tailored to your CX profile: your best results will come from balanced transparency and momentum.',
    coachingPattern: 'Acknowledge, explain once, isolate the real issue, then move.',
    recommendedAdjustment: 'Keep your wording calm and your next-step ask specific.',
    skillAwareTip: 'Stay transparent without losing forward motion.',
    focusSkillTag: 'Trust',
  };
}
