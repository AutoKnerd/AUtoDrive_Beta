import { Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon } from 'lucide-react';

export type CxSkillId = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';

export interface CxSkill {
  id: CxSkillId;
  label: string;
  color: string;
  icon: LucideIcon;
}

export const VIBRANT_PALETTE: Record<string, string> = {
  empathy: '#00f2ff', // Neon Cyan
  listening: '#70ff00', // Neon Lime
  trust: '#ff00ea', // Neon Pink
  followUp: '#ffff00', // Neon Yellow
  closing: '#9d00ff', // Neon Purple
  relationship: '#ffae00', // Neon Orange
  relationshipBuilding: '#ffae00',
};

export const PROFESSIONAL_PALETTE: Record<string, string> = {
  empathy: '#22d3ee', // Cyan 400
  listening: '#38bdf8', // Sky 400
  trust: '#06b6d4', // Cyan 500
  followUp: '#0ea5e9', // Sky 500
  closing: '#64748b', // Slate 500
  relationship: '#2dd4bf', // Teal 400
  relationshipBuilding: '#2dd4bf',
};

/**
 * Returns the correct hex color for a skill based on user theme preference.
 */
export function getTraitColor(id: string, useProfessionalTheme?: boolean): string {
  const palette = useProfessionalTheme ? PROFESSIONAL_PALETTE : VIBRANT_PALETTE;
  return palette[id] || palette.empathy;
}

export const CX_SKILLS: CxSkill[] = [
  { id: 'empathy', label: 'Empathy', color: VIBRANT_PALETTE.empathy, icon: Smile },
  { id: 'listening', label: 'Listening', color: VIBRANT_PALETTE.listening, icon: Ear },
  { id: 'trust', label: 'Trust', color: VIBRANT_PALETTE.trust, icon: Handshake },
  { id: 'followUp', label: 'Follow Up', color: VIBRANT_PALETTE.followUp, icon: Repeat },
  { id: 'closing', label: 'Closing', color: VIBRANT_PALETTE.closing, icon: Target },
  { id: 'relationship', label: 'Relationship', color: VIBRANT_PALETTE.relationship, icon: Users },
];