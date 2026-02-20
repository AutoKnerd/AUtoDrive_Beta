'use client';

import React, { useState, useMemo } from 'react';
import { CxScope, getScopeLabel } from '@/lib/cx/scope';
import { rollupCxTrend } from '@/lib/cx/rollups';
import { CxSkillId } from '@/lib/cx/skills';
import { CxSoundwaveChart } from './CxSoundwaveChart';
import { CxSoundwaveLegend } from './CxSoundwaveLegend';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Info, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CxSoundwaveCardProps {
  scope: CxScope;
  personalScope?: CxScope;
  className?: string;
}

export function CxSoundwaveCard({ scope, personalScope, className }: CxSoundwaveCardProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [activeSkillId, setActiveSkillId] = useState<CxSkillId | null>(null);

  const activeScope = viewMode === 'personal' && personalScope ? personalScope : scope;

  const series = useMemo(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return rollupCxTrend(activeScope, days);
  }, [activeScope, range]);

  const mode = activeScope.role === 'owner' && !activeScope.storeId ? 'groupOnly' : 'compare';

  return (
    <Card className={cn(
      "relative overflow-hidden bg-slate-950 border-white/5 shadow-2xl transition-all duration-500",
      className
    )}>
      {/* Premium Background Glows */}
      <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />

      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 space-y-0 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              CX Skill Velocity
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-white/20 cursor-help hover:text-white/40 transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 border-white/10 text-xs max-w-[200px]">
                  Real-time skill trends indexed from recent lesson performance. 
                  Neon lines show {getScopeLabel(activeScope).toLowerCase()} performance.
                  {mode === 'compare' && ' Ghostly fills indicate delta vs higher-level average.'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription className="text-white/40 text-xs">
            {getScopeLabel(activeScope)} trends over {range === '7d' ? 'the last week' : range === '30d' ? '30 days' : '90 days'}.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          {personalScope && (
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('team')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase transition-all",
                  viewMode === 'team' ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"
                )}
              >
                Dealership
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('personal')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase transition-all",
                  viewMode === 'personal' ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"
                )}
              >
                Personal
              </Button>
            </div>
          )}

          {/* Range Toggle */}
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                onClick={() => setRange(r)}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase transition-all",
                  range === r ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"
                )}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <CxSoundwaveChart 
          series={series} 
          activeSkillId={activeSkillId} 
          mode={mode} 
        />
        <CxSoundwaveLegend 
          activeSkillId={activeSkillId} 
          onSkillHover={setActiveSkillId} 
          onSkillClick={setActiveSkillId} 
        />
      </CardContent>
    </Card>
  );
}
