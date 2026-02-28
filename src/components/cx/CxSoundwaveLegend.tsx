'use client';

import React from 'react';
import { CX_SKILLS, CxSkillId } from '@/lib/cx/skills';
import { cn } from '@/lib/utils';

interface CxSoundwaveLegendProps {
  activeSkillId: CxSkillId | null;
  onSkillHover: (id: CxSkillId | null) => void;
  onSkillClick: (id: CxSkillId | null) => void;
}

export function CxSoundwaveLegend({ activeSkillId, onSkillHover, onSkillClick }: CxSoundwaveLegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
      {CX_SKILLS.map((skill) => {
        const isActive = activeSkillId === skill.id;
        const isDimmed = activeSkillId !== null && !isActive;

        return (
          <button
            key={skill.id}
            onMouseEnter={() => onSkillHover(skill.id)}
            onMouseLeave={() => onSkillHover(null)}
            onClick={() => onSkillClick(isActive ? null : skill.id)}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-full transition-all duration-300",
              isActive ? "bg-muted ring-1 ring-border dark:bg-white/10 dark:ring-white/20" : "hover:bg-muted/50 dark:hover:bg-white/5",
              isDimmed ? "opacity-40 grayscale-[0.5]" : "opacity-100"
            )}
          >
            <div 
              className="w-2 h-2 rounded-full shadow-sm dark:shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
              style={{ 
                backgroundColor: skill.color,
                boxShadow: isActive ? `0 0 10px ${skill.color}` : 'none'
              }} 
            />
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground dark:text-white/70">
              {skill.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
