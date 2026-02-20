import { Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon } from 'lucide-react';

export type CxSkillId = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';

export interface CxSkill {
  id: CxSkillId;
  label: string;
  color: string;
  icon: LucideIcon;
}

export const CX_SKILLS: CxSkill[] = [
  { id: 'empathy', label: 'Empathy', color: '#00f2ff', icon: Smile }, // Neon Cyan
  { id: 'listening', label: 'Listening', color: '#70ff00', icon: Ear }, // Neon Lime
  { id: 'trust', label: 'Trust', color: '#ff00ea', icon: Handshake }, // Neon Pink
  { id: 'followUp', label: 'Follow Up', color: '#ffff00', icon: Repeat }, // Neon Yellow
  { id: 'closing', label: 'Closing', color: '#9d00ff', icon: Target }, // Neon Purple
  { id: 'relationship', label: 'Relationship', color: '#ffae00', icon: Users }, // Neon Orange
];
