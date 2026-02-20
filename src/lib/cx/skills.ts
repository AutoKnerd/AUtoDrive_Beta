export type CxSkillId = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';

export interface CxSkill {
  id: CxSkillId;
  label: string;
  color: string;
}

export const CX_SKILLS: CxSkill[] = [
  { id: 'empathy', label: 'Empathy', color: '#00f2ff' }, // Neon Cyan
  { id: 'listening', label: 'Listening', color: '#70ff00' }, // Neon Lime
  { id: 'trust', label: 'Trust', color: '#ff00ea' }, // Neon Pink
  { id: 'followUp', label: 'Follow Up', color: '#ffff00' }, // Neon Yellow
  { id: 'closing', label: 'Closing', color: '#9d00ff' }, // Neon Purple
  { id: 'relationship', label: 'Relationship', color: '#ffae00' }, // Neon Orange
];
