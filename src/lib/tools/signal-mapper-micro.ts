export type SignalMapperMicroDraft = {
  customerName: string;
  currentVehicle: string;
  emotionalTone: string;
  saying: string;
  unsaid: string;
  concern: string;
  solving: string;
  show: string;
  sayNext: string;
  notes: string;
};

export type SignalMapperFullPrefill = {
  customerName: string;
  currentVehicle: string;
  emotionalTone: string;
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
  customerName: 'Customer Name',
  currentVehicle: 'Current Vehicle',
  emotionalTone: 'Emotional Tone',
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
    customerName: '',
    currentVehicle: '',
    emotionalTone: '',
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
  const rawValue = to === -1 ? source.slice(from) : source.slice(from, to);
  return rawValue.replace(/\r/g, '').replace(/\n+$/, '');
}

export function parseSignalMapperMicroDraft(rawDraft: string): SignalMapperMicroDraft {
  const source = String(rawDraft || '');
  if (!source.includes(SIGNAL_MAPPER_MICRO_HEADER)) {
    return { ...emptySignalMapperMicroDraft(), notes: source };
  }

  return {
    customerName: findSectionValue(source, SIGNAL_MAPPER_LABELS.customerName, SIGNAL_MAPPER_LABELS.currentVehicle),
    currentVehicle: findSectionValue(source, SIGNAL_MAPPER_LABELS.currentVehicle, SIGNAL_MAPPER_LABELS.emotionalTone),
    emotionalTone: findSectionValue(source, SIGNAL_MAPPER_LABELS.emotionalTone, SIGNAL_MAPPER_LABELS.saying),
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
    SIGNAL_MAPPER_LABELS.customerName,
    input.customerName,
    '',
    SIGNAL_MAPPER_LABELS.currentVehicle,
    input.currentVehicle,
    '',
    SIGNAL_MAPPER_LABELS.emotionalTone,
    input.emotionalTone,
    '',
    SIGNAL_MAPPER_LABELS.saying,
    input.saying,
    '',
    SIGNAL_MAPPER_LABELS.unsaid,
    input.unsaid,
    '',
    SIGNAL_MAPPER_LABELS.concern,
    input.concern,
    '',
    SIGNAL_MAPPER_LABELS.solving,
    input.solving,
    '',
    SIGNAL_MAPPER_LABELS.show,
    input.show,
    '',
    SIGNAL_MAPPER_LABELS.sayNext,
    input.sayNext,
    '',
    SIGNAL_MAPPER_LABELS.notes,
    input.notes,
  ].join('\n');
}

export function hasSignalMapperMicroContent(input: SignalMapperMicroDraft): boolean {
  return Object.values(input).some((value) => String(value || '').trim().length > 0);
}

export function buildSignalMapperFullPrefillFromMicro(input: SignalMapperMicroDraft): SignalMapperFullPrefill {
  return {
    customerName: input.customerName.trim(),
    currentVehicle: input.currentVehicle.trim(),
    emotionalTone: input.emotionalTone.trim(),
    customerSaying: input.saying.trim(),
    customerUnsaid: input.unsaid.trim(),
    realConcern: input.concern.trim(),
    tryingToSolve: input.solving.trim(),
    whatToShow: input.show.trim(),
    whatToSayNext: input.sayNext.trim(),
    notes: input.notes.trim(),
  };
}
