import type { FreshUpWeeklyDigestAggregates } from '@/lib/fresh-up-digest/types';

const RECOMMENDATION_BY_SKILL: Record<string, string> = {
  Trust: 'Coach discovery before numbers and reinforce transparent value framing.',
  Listening: 'Reinforce repeating back customer priorities before transitioning to solutions.',
  Closing: 'Practice guiding to a next step without rushing the conversation.',
  'Follow Up': 'Coach consultants to ask one stronger late-stage follow-up question before close.',
  Relationship: 'Run a huddle on building rapport while preserving conversation structure.',
  Empathy: 'Reinforce concern acknowledgment language early in the interaction.',
};

const AUTOFORGE_BY_SKILL: Record<string, string> = {
  Trust: 'Trust Through Discovery',
  Listening: 'Active Listening Workshop',
  Closing: 'Guiding the Customer to the Next Step',
  'Follow Up': 'Follow Up Momentum Builder',
  Relationship: 'Personal Connection Builder',
  Empathy: 'Understanding Customer Emotions',
};

export function buildWeeklyDigestRecommendation(input: {
  aggregates: FreshUpWeeklyDigestAggregates;
  digestType: string;
}): { recommendedAction: string; suggestedAutoForgeModule?: string } {
  const weakest = input.aggregates.topImprovementArea;
  const trustWeak = input.aggregates.averageTrust < 55;
  const listeningWeak = input.aggregates.averageListening < 55;
  const closingWeak = input.aggregates.averageClosing < 55;
  const followWeak = input.aggregates.averageFollowUp < 55;
  const relationshipWeak = input.aggregates.averageRelationship < 55;
  const empathyWeak = input.aggregates.averageEmpathy < 55;

  let focusSkill = weakest;
  if (trustWeak) focusSkill = 'Trust';
  else if (listeningWeak) focusSkill = 'Listening';
  else if (closingWeak) focusSkill = 'Closing';
  else if (followWeak) focusSkill = 'Follow Up';
  else if (relationshipWeak) focusSkill = 'Relationship';
  else if (empathyWeak) focusSkill = 'Empathy';

  const action = RECOMMENDATION_BY_SKILL[focusSkill] || 'Run a focused coaching session on current friction tags and trust progression.';
  const module = AUTOFORGE_BY_SKILL[focusSkill];
  return {
    recommendedAction: action,
    suggestedAutoForgeModule: module,
  };
}
