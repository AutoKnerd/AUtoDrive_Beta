'use client';

import React from 'react';
import { getTraitColor } from '@/lib/cx/skills';
import type { ThemePreference } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface AvatarSoundRingProps {
  scores?: Record<string, number>;
  hasActivity?: boolean;
  themePreference?: ThemePreference;
  className?: string;
}

/**
 * A circular soundwave frame for avatars that reacts to CX scores.
 * Colors and lengths are driven by the user's proficiency traits.
 */
export function AvatarSoundRing({ scores, hasActivity = true, themePreference = 'vibrant', className }: AvatarSoundRingProps) {
  const svgId = React.useId().replace(/:/g, '');
  const glowFilterId = `sound-glow-${svgId}`;
  const centerGlowId = `center-soft-glow-${svgId}`;

  // Mapping traits to the standard AutoDrive CX color grade
  const traits = [
    { id: 'empathy' }, 
    { id: 'listening' },
    { id: 'trust' },
    { id: 'followUp' },
    { id: 'closing' },
    { id: 'relationship' },
  ];
  
  const barCount = 96; // 16 bars per trait for a smooth circle
  const barsPerTrait = barCount / traits.length;
  
  return (
    <div className={cn("absolute inset-[-25%] w-[150%] h-[150%] pointer-events-none select-none", className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Subtle central glow to provide depth behind the avatar */}
          <radialGradient id={centerGlowId}>
            <stop offset="0%" stopColor="#8DC63F" stopOpacity="0.15" />
            <stop offset="70%" stopColor="#8DC63F" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#8DC63F" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Soft background glow circle */}
        <circle cx="50" cy="50" r="35" fill={`url(#${centerGlowId})`} />

        <g filter={`url(#${glowFilterId})`}>
          {Array.from({ length: barCount }).map((_, i) => {
            const traitIndex = Math.floor(i / barsPerTrait);
            const traitId = traits[traitIndex].id;
            const traitColor = getTraitColor(traitId, themePreference);
            
            // Safely retrieve score or default to a baseline for new users
            const scoreKey = traitId === 'relationship' ? 'relationshipBuilding' : traitId;
            const baseScore = scores ? (scores[scoreKey] || scores[traitId] || 50) : 60;
            const score = hasActivity ? baseScore : 40;
            
            // Calculate polar coordinates for the bar
            // Shifted by -90deg to start empathy at the top
            const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
            const innerRadius = 36; // Just outside the avatar border
            
            // Emphasize per-trait score differences so rings remain readable at small sizes.
            const normalizedScore = Math.max(0, Math.min(1, score / 100));
            const scoreInfluence = 1.5 + (normalizedScore * 13);
            const segmentProgress = (i % barsPerTrait) / barsPerTrait;
            const contour = Math.sin(segmentProgress * Math.PI * 2) * 1.2 + Math.cos(segmentProgress * Math.PI * 4) * 0.6;
            const length = Math.max(0.9, scoreInfluence + contour);
            
            const x1 = 50 + Math.cos(angle) * innerRadius;
            const y1 = 50 + Math.sin(angle) * innerRadius;
            const x2 = 50 + Math.cos(angle) * (innerRadius + length);
            const y2 = 50 + Math.sin(angle) * (innerRadius + length);
            
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={traitColor}
                strokeWidth={hasActivity ? (1 + normalizedScore * 0.5) : 1}
                strokeLinecap="round"
                className="animate-pulse"
                style={{ 
                  animationDelay: `${i * 12}ms`, 
                  animationDuration: `${1.5 + (i % 5) * 0.2}s`,
                  opacity: hasActivity ? (0.45 + normalizedScore * 0.5) : 0.35
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
