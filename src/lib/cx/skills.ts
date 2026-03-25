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

export const PATRIOT_PALETTE: Record<string, string> = {
  empathy: '#ef4444',     // Red 500
  listening: '#f1f5f9',   // Slate 100 (near-white)
  trust: '#2563eb',       // Blue 600
  followUp: '#b91c1c',    // Red 700
  closing: '#1d4ed8',     // Blue 700
  relationship: '#e2e8f0',// Slate 200 (Off-white)
  relationshipBuilding: '#e2e8f0',
};

export const VELOCITY_PALETTE: Record<string, string> = {
  empathy: '#f97316',     // Orange 500
  listening: '#6366f1',   // Indigo 500
  trust: '#14b8a6',       // Teal 500
  followUp: '#ea580c',    // Orange 600
  closing: '#4f46e5',     // Indigo 600
  relationship: '#0d9488',// Teal 600
  relationshipBuilding: '#0d9488',
};

export const MONOCHROME_PALETTE: Record<string, string> = {
  empathy: '#cbd5e1',     // Slate 300
  listening: '#64748b',   // Slate 500
  trust: '#334155',       // Slate 700
  followUp: '#94a3b8',    // Slate 400
  closing: '#475569',     // Slate 600
  relationship: '#0f172a',// Slate 900
  relationshipBuilding: '#0f172a',
};

export const FOREST_PALETTE: Record<string, string> = {
  empathy: '#10b981',     // Emerald 500
  listening: '#84cc16',   // Lime 500
  trust: '#059669',       // Emerald 600
  followUp: '#4d7c0f',    // Lime 700
  closing: '#047857',     // Emerald 700
  relationship: '#65a30d',// Lime 600
  relationshipBuilding: '#65a30d',
};

export const SUNSET_PALETTE: Record<string, string> = {
  empathy: '#e11d48',     // Rose 600
  listening: '#f59e0b',   // Amber 500
  trust: '#d946ef',       // Fuchsia 500
  followUp: '#be123c',    // Rose 700
  closing: '#f97316',     // Orange 500
  relationship: '#c026d3',// Fuchsia 600
  relationshipBuilding: '#c026d3',
};

export const OCEANIC_PALETTE: Record<string, string> = {
  empathy: '#0284c7',     // Light Blue 600
  listening: '#0d9488',   // Teal 600
  trust: '#0369a1',       // Light Blue 700
  followUp: '#0f766e',    // Teal 700
  closing: '#075985',     // Light Blue 800
  relationship: '#115e59',// Teal 800
  relationshipBuilding: '#115e59',
};

export const CYBER_PALETTE: Record<string, string> = {
  empathy: '#ff00ff',     // Magenta
  listening: '#00ffff',   // Cyan
  trust: '#00ff00',       // Lime
  followUp: '#d900d9',    // Darker Magenta
  closing: '#00d9d9',     // Darker Cyan
  relationship: '#00cc00',// Darker Lime
  relationshipBuilding: '#00cc00',
};

/**
 * Returns the correct hex color for a skill based on user theme preference.
 */
export function getTraitColor(id: string, theme: ThemePreference = 'vibrant'): string {
  const palettes: Record<ThemePreference, Record<string, string>> = {
    vibrant: VIBRANT_PALETTE,
    executive: EXECUTIVE_PALETTE,
    steel: STEEL_PALETTE,
    patriot: PATRIOT_PALETTE,
    velocity: VELOCITY_PALETTE,
    monochrome: MONOCHROME_PALETTE,
    forest: FOREST_PALETTE,
    sunset: SUNSET_PALETTE,
    oceanic: OCEANIC_PALETTE,
    cyber: CYBER_PALETTE
  };

  const palette = palettes[theme] || VIBRANT_PALETTE;
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
