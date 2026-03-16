export type LeadScoringInput = {
  intent?: string | null;
  email?: string | null;
  dealership?: string | null;
  messageText?: string | null;
};

export function calculateSprocketLeadScore(input: LeadScoringInput): number {
  const intent = String(input.intent || '').toLowerCase();
  const messageText = String(input.messageText || '').toLowerCase();
  const combined = `${intent} ${messageText}`.trim();

  let score = 0;

  if (/(install|installation|integrat)/i.test(combined)) score += 3;
  if (/(pricing|price|cost|how much)/i.test(combined)) score += 3;
  if (/(request demo|book demo|schedule demo|\bdemo\b)/i.test(combined)) score += 5;
  if (String(input.email || '').trim()) score += 5;
  if (String(input.dealership || '').trim()) score += 2;

  return score;
}

export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';

export function getLeadTemperature(score: number): LeadTemperature {
  if (score >= 10) return 'HOT';
  if (score >= 6) return 'WARM';
  return 'COLD';
}

