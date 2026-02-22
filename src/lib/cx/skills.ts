import { Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon } from 'lucide-react';
import type { ThemePreference } from '@/lib/definitions';

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

/**
 * "Elite Executive" Palette
 * A sophisticated blend of Purple, Green, and Gold.
 */
export const EXECUTIVE_PALETTE: Record<string, string> = {
  empathy: '#a855f7', // Purple 500
  listening: '#22c55e', // Green 500
  trust: '#eab308', // Gold 500
  followUp: '#7e22ce', // Purple 700 (Deep Purple)
  closing: '#15803d', // Green 700 (Deep Green)
  relationship: '#a16207', // Gold 700 (Deep Gold)
  relationshipBuilding: '#a16207',
};

/**
 * "Professional Steel" Palette
 * A tech-forward blend of Slate, Sky, and Blue.
 */
export const STEEL_PALETTE: Record<string, string> = {
  empathy: '#94a3b8', // Slate 400
  listening: '#0ea5e9', // Sky 500
  trust: '#0891b2', // Cyan 600
  followUp: '#1d4ed8', // Blue 700
  closing: '#3730a3', // Indigo 800
  relationship: '#475569', // Slate 600
  relationshipBuilding: '#475569',
};

/**
 * Returns the correct hex color for a skill based on user theme preference.
 */
export function getTraitColor(id: string, theme: ThemePreference = 'vibrant'): string {
  let palette = VIBRANT_PALETTE;
  if (theme === 'executive') palette = EXECUTIVE_PALETTE;
  if (theme === 'steel') palette = STEEL_PALETTE;
  
  return palette[id] || palette[id === 'relationshipBuilding' ? 'relationship' : 'empathy'];
}

export const CX_SKILLS: CxSkill[] = [
  { id: 'empathy', label: 'Empathy', color: VIBRANT_PALETTE.empathy, icon: Smile },
  { id: 'listening', label: 'Listening', color: VIBRANT_PALETTE.listening, icon: Ear },
  { id: 'trust', label: 'Trust', color: VIBRANT_PALETTE.trust, icon: Handshake },
  { id: 'followUp', label: 'Follow Up', color: VIBRANT_PALETTE.followUp, icon: Repeat },
  { id: 'closing', label: 'Closing', color: VIBRANT_PALETTE.closing, icon: Target },
  { id: 'relationship', label: 'Relationship', color: VIBRANT_PALETTE.relationship, icon: Users },
];