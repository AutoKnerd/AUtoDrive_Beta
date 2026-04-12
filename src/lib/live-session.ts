export const LIVE_SESSION_ID = 'autoknerd-main';

export type LiveSessionStepId =
  | 'slide1'
  | 'slide2'
  | 'slide3'
  | 'slide4'
  | 'slide5'
  | 'slide6'
  | 'slide7'
  | 'slide8'
  | 'slide9'
  | 'slide10'
  | 'slide11'
  | 'slide12'
  | 'slide13'
  | 'slide14';

export type LiveSessionState = {
  currentStep: LiveSessionStepId;
  currentSlide: string;
  updatedAt: string | null;
};

export type LiveAudienceContent = {
  eyebrow: string;
  title: string;
  body: string;
  prompt?: string;
};

export const LIVE_SESSION_DEFAULT_STATE: LiveSessionState = {
  currentStep: 'slide1',
  currentSlide: '01-the-hook.html',
  updatedAt: null,
};

export const DECK_FILE_TO_STEP: Record<string, LiveSessionStepId> = {
  '01-the-hook.html': 'slide1',
  '02-the-problem.html': 'slide2',
  '03-root-cause.html': 'slide3',
  '04-the-shift.html': 'slide4',
  '05-the-system.html': 'slide5',
  '06-autodrivecx.html': 'slide6',
  '07-precision-insight.html': 'slide7',
  '08-weekly-cadence.html': 'slide8',
  '09-autoforge.html': 'slide9',
  '10-the-transformation.html': 'slide10',
  '11-business-impact.html': 'slide11',
  '12-the-philosophy.html': 'slide12',
  '13-the-vision.html': 'slide13',
  '14-call-to-action.html': 'slide14',
};

export const LIVE_AUDIENCE_CONTENT: Record<LiveSessionStepId, LiveAudienceContent> = {
  slide1: {
    eyebrow: 'AutoKnerd Live',
    title: 'You do not have a people problem.',
    body: 'You are about to see why inconsistent performance is usually produced by inconsistent systems.',
    prompt: 'Keep this page open. It will update as the presentation advances.',
  },
  slide2: {
    eyebrow: 'Quick Check',
    title: 'Is your CX consistent?',
    body: 'Think about the last five customer experiences in your store. Were they truly the same standard every time?',
    prompt: 'If the answer is “it depends,” that is the issue.',
  },
  slide3: {
    eyebrow: 'Daily Reality',
    title: 'Do you control behavior daily?',
    body: 'Expectation is not the same as control. Great intentions still break when nothing guides behavior in real time.',
    prompt: 'Would your team deliver the right experience today without reminders?',
  },
  slide4: {
    eyebrow: 'Decision Point',
    title: 'What do you rely on?',
    body: 'Training gives people information. Systems guide behavior when the moment actually happens.',
    prompt: 'Which one is carrying the weight in your store right now?',
  },
  slide5: {
    eyebrow: 'System Shift',
    title: 'The system becomes the operating layer.',
    body: 'From here, the presentation shifts from problem recognition into how consistent behavior is installed and reinforced.',
    prompt: 'The next slides show how that system closes the gap.',
  },
  slide6: {
    eyebrow: 'Live Companion',
    title: 'Behavior can be tracked before outcomes collapse.',
    body: 'The system watches the behaviors that create the customer experience, not just the score after the fact.',
  },
  slide7: {
    eyebrow: 'Live Companion',
    title: 'Clear signal beats noisy reporting.',
    body: 'Precise insight lets leaders act on the real breakdown instead of chasing vague summaries.',
  },
  slide8: {
    eyebrow: 'Live Companion',
    title: 'Execution needs a weekly rhythm.',
    body: 'Consistency comes from repeated inspection, correction, and reinforcement.',
  },
  slide9: {
    eyebrow: 'Live Companion',
    title: 'Insight only matters if it becomes action.',
    body: 'Once the breakdown is visible, the system has to turn it into a weekly operating move.',
  },
  slide10: {
    eyebrow: 'Live Companion',
    title: 'The store feels different when behavior is guided.',
    body: 'Clarity, consistency, confidence, and trust stop being accidental outputs.',
  },
  slide11: {
    eyebrow: 'Live Companion',
    title: 'The business impact follows the behavior shift.',
    body: 'When the system improves what happens on the floor, the measurable outcomes move with it.',
  },
  slide12: {
    eyebrow: 'Live Companion',
    title: 'Behavior beats training.',
    body: 'Great ideas do not scale by themselves. Consistent execution does.',
  },
  slide13: {
    eyebrow: 'Live Companion',
    title: 'This is what the new operating model looks like.',
    body: 'The dealership runs with a consistent behavioral framework instead of individual guesswork.',
  },
  slide14: {
    eyebrow: 'Next Step',
    title: 'You have reached the close.',
    body: 'If this matches the problem you are trying to solve, the next move is a live working session.',
    prompt: 'Stay connected with the presenter for follow-up.',
  },
};

export function getAudienceContent(step: LiveSessionStepId): LiveAudienceContent {
  return LIVE_AUDIENCE_CONTENT[step] ?? LIVE_AUDIENCE_CONTENT.slide1;
}

export function isLiveSessionStepId(value: string): value is LiveSessionStepId {
  return value in LIVE_AUDIENCE_CONTENT;
}
