'use client';

import React from 'react';

interface AvatarSoundRingProps {
  scores?: Record<string, number>;
  hasActivity?: boolean;
}

/**
 * A circular soundwave frame for avatars that reacts to CX scores.
 * Colors and lengths are driven by the user's proficiency traits.
 */
export function AvatarSoundRing({ scores, hasActivity = true }: AvatarSoundRingProps) {
  // Mapping traits to the standard AutoDrive CX color grade
  const traits = [
    { id: 'empathy', color: '#00f2ff' }, // Neon Cyan
    { id: 'listening', color: '#70ff00' }, // Neon Lime
    { id: 'trust', color: '#ff00ea' }, // Neon Pink
    { id: 'followUp', color: '#ffff00' }, // Neon Yellow
    { id: 'closing', color: '#9d00ff' }, // Neon Purple
    { id: 'relationshipBuilding', color: '#ffae00' }, // Neon Orange
  ];
  
  const barCount = 96; // 16 bars per trait for a smooth circle
  const barsPerTrait = barCount / traits.length;
  
  return (
    <div className="absolute inset-[-25%] w-[150%] h-[150%] pointer-events-none select-none">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <filter id="sound-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Subtle central glow to provide depth behind the avatar */}
          <radialGradient id="center-soft-glow">
            <stop offset="0%" stopColor="#8DC63F" stopOpacity="0.15" />
            <stop offset="70%" stopColor="#8DC63F" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#8DC63F" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Soft background glow circle */}
        <circle cx="50" cy="50" r="35" fill="url(#center-soft-glow)" />

        <g filter="url(#sound-glow)">
          {Array.from({ length: barCount }).map((_, i) => {
            const traitIndex = Math.floor(i / barsPerTrait);
            const trait = traits[traitIndex];
            
            // Safely retrieve score or default to a baseline for new users
            const baseScore = scores ? (scores[trait.id] || 50) : 60;
            const score = hasActivity ? baseScore : 40;
            
            // Calculate polar coordinates for the bar
            // Shifted by -90deg to start empathy at the top
            const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
            const innerRadius = 36; // Just outside the avatar border
            
            // Stylized soundwave length logic
            const normalizedScore = score / 100;
            const scoreInfluence = 2 + (normalizedScore * 8);
            const visualNoise = Math.sin(i * 0.8) * 2 + Math.cos(i * 0.3) * 1.5;
            const rhythmicSpike = (i % 4 === 0) ? 3 : 0;
            
            const length = Math.max(1.2, scoreInfluence + visualNoise + rhythmicSpike);
            
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
                stroke={trait.color}
                strokeWidth="1.2"
                strokeLinecap="round"
                className="animate-pulse"
                style={{ 
                  animationDelay: `${i * 12}ms`, 
                  animationDuration: `${1.5 + (i % 5) * 0.2}s`,
                  opacity: 0.5 + (Math.sin(i * 0.25) * 0.4)
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
