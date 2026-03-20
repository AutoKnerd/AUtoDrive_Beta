export type SignalMapperMicroDraft = {
  saying: string;
  unsaid: string;
  concern: string;
  solving: string;
  show: string;
  sayNext: string;
  notes: string;
};

export type SignalMapperFullPrefill = {
  customerSaying: string;
  customerUnsaid: string;
  realConcern: string;
  tryingToSolve: string;
  whatToShow: string;
  whatToSayNext: string;
  notes: string;
};

const SIGNAL_MAPPER_MICRO_HEADER = 'Signal Mapper Workspace';
const SIGNAL_MAPPER_LABELS = {
  saying: 'What are they saying?',
  unsaid: 'What are they not saying?',
  concern: "What's the real concern?",
  solving: 'What are they trying to solve?',
  show: 'What should I show?',
  sayNext: 'What should I say next?',
  notes: 'Working Notes',
} as const;

export function emptySignalMapperMicroDraft(): SignalMapperMicroDraft {
  return {
    saying: '',
    unsaid: '',
    concern: '',
    solving: '',
    show: '',
    sayNext: '',
    notes: '',
  };
}

function findSectionValue(source: string, label: string, nextLabel?: string): string {
  const marker = `${label}\n`;
  const start = source.indexOf(marker);
  if (start === -1) return '';

  const from = start + marker.length;
  const to = nextLabel ? source.indexOf(`${nextLabel}\n`, from) : -1;
  if (to === -1) return source.slice(from).trim();
  return source.slice(from, to).trim();
}

export function parseSignalMapperMicroDraft(rawDraft: string): SignalMapperMicroDraft {
  const source = String(rawDraft || '');
  if (!source.includes(SIGNAL_MAPPER_MICRO_HEADER)) {
    return { ...emptySignalMapperMicroDraft(), notes: source };
  }

  return {
    saying: findSectionValue(source, SIGNAL_MAPPER_LABELS.saying, SIGNAL_MAPPER_LABELS.unsaid),
    unsaid: findSectionValue(source, SIGNAL_MAPPER_LABELS.unsaid, SIGNAL_MAPPER_LABELS.concern),
    concern: findSectionValue(source, SIGNAL_MAPPER_LABELS.concern, SIGNAL_MAPPER_LABELS.solving),
    solving: findSectionValue(source, SIGNAL_MAPPER_LABELS.solving, SIGNAL_MAPPER_LABELS.show),
    show: findSectionValue(source, SIGNAL_MAPPER_LABELS.show, SIGNAL_MAPPER_LABELS.sayNext),
    sayNext: findSectionValue(source, SIGNAL_MAPPER_LABELS.sayNext, SIGNAL_MAPPER_LABELS.notes),
    notes: findSectionValue(source, SIGNAL_MAPPER_LABELS.notes),
  };
}

export function buildSignalMapperMicroDraft(input: SignalMapperMicroDraft): string {
  return [
    SIGNAL_MAPPER_MICRO_HEADER,
    '',
    SIGNAL_MAPPER_LABELS.saying,
    input.saying.trim(),
    '',
    SIGNAL_MAPPER_LABELS.unsaid,
    input.unsaid.trim(),
    '',
    SIGNAL_MAPPER_LABELS.concern,
    input.concern.trim(),
    '',
    SIGNAL_MAPPER_LABELS.solving,
    input.solving.trim(),
    '',
    SIGNAL_MAPPER_LABELS.show,
    input.show.trim(),
    '',
    SIGNAL_MAPPER_LABELS.sayNext,
    input.sayNext.trim(),
    '',
    SIGNAL_MAPPER_LABELS.notes,
    input.notes.trim(),
  ].join('\n');
}

export function hasSignalMapperMicroContent(input: SignalMapperMicroDraft): boolean {
  return Object.values(input).some((value) => String(value || '').trim().length > 0);
}

export function buildSignalMapperFullPrefillFromMicro(input: SignalMapperMicroDraft): SignalMapperFullPrefill {
  return {
    customerSaying: input.saying.trim(),
    customerUnsaid: input.unsaid.trim(),
    realConcern: input.concern.trim(),
    tryingToSolve: input.solving.trim(),
    whatToShow: input.show.trim(),
    whatToSayNext: input.sayNext.trim(),
    notes: input.notes.trim(),
  };
}

