'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CxScope, getScopeLabel } from '@/lib/cx/scope';
import { rollupCxTrend } from '@/lib/cx/rollups';
import { CX_SKILLS, CxSkillId } from '@/lib/cx/skills';
import { CxSoundwaveChart } from './CxSoundwaveChart';
import { CxSoundwaveLegend } from './CxSoundwaveLegend';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Info, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface CxSoundwaveCardProps {
  scope: CxScope;
  personalScope?: CxScope;
  className?: string;
  /** 
   * Real-time scores to anchor the trend data to. 
   * This ensures the visual matches your actual dashboard statistics.
   */
  data?: Partial<Record<string, number>>;
}

/**
 * Normalizes keys like 'relationshipBuilding' to the internal 'relationship' skill ID.
 */
function normalizeScores(raw?: Partial<Record<string, number>>): Partial<Record<CxSkillId, number>> | undefined {
  if (!raw) return undefined;
  return {
    empathy: raw.empathy,
    listening: raw.listening,
    trust: raw.trust,
    followUp: raw.followUp,
    closing: raw.closing,
    relationship: raw.relationship ?? raw.relationshipBuilding,
  } as Partial<Record<CxSkillId, number>>;
}

export function CxSoundwaveCard({ scope, personalScope, className, data }: CxSoundwaveCardProps) {
  const [range, setRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [activeSkillId, setActiveSkillId] = useState<CxSkillId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeScope = viewMode === 'personal' && personalScope ? personalScope : scope;
  const anchoredScores = useMemo(() => normalizeScores(data), [data]);

  const series = useMemo(() => {
    if (!mounted) return [];
    let days = 30;
    if (range === 'today') days = 1;
    else if (range === '7d') days = 7;
    else if (range === '90d') days = 90;

    // We only anchor the "Personal" view or the current scoped view if data was provided for it
    const shouldAnchor = (viewMode === 'personal' && personalScope) || (viewMode === 'team');
    return rollupCxTrend(activeScope, days, shouldAnchor ? anchoredScores : undefined);
  }, [activeScope, range, mounted, viewMode, anchoredScores, personalScope]);

  const mode = activeScope.role === 'owner' && !activeScope.storeId ? 'groupOnly' : 'compare';

  if (!mounted) {
    return (
      <Card className={cn("h-[400px] bg-card border-border", className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-8 w-[150px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "relative overflow-hidden bg-card border-border shadow-2xl transition-all duration-500 dark:bg-slate-950 dark:border-white/5",
      className
    )}>
      {/* Premium Background Glows */}
      <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none dark:bg-cyan-500/10" />
      <div className="absolute bottom-[-10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none dark:bg-purple-500/10" />

      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary dark:text-cyan-400" />
              Average CX Scores
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="bg-popover border-border text-xs max-w-[200px]">
                  Real-time skill averages indexed from recent lesson performance. 
                  Neon lines show {getScopeLabel(activeScope).toLowerCase()} performance.
                  {mode === 'compare' && ' Ghostly fills indicate delta vs higher-level average.'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            {getScopeLabel(activeScope)} {range === 'today' ? 'current standing' : `trends over the last ${range}`}.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          {personalScope && (
            <div className="flex bg-muted p-1 rounded-lg border border-border dark:bg-white/5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('team')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase transition-all",
                  viewMode === 'team' ? "bg-background text-foreground shadow-sm dark:bg-white/10 dark:text-white" : "text-muted-foreground/60 hover:text-foreground dark:text-white/30 dark:hover:text-white/60"
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
                  viewMode === 'personal' ? "bg-background text-foreground shadow-sm dark:bg-white/10 dark:text-white" : "text-muted-foreground/60 hover:text-foreground dark:text-white/30 dark:hover:text-white/60"
                )}
              >
                Personal
              </Button>
            </div>
          )}

          {/* Range Toggle */}
          <div className="flex bg-muted p-1 rounded-lg border border-border dark:bg-white/5">
            {(['today', '7d', '30d', '90d'] as const).map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                onClick={() => setRange(r)}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase transition-all",
                  range === r ? "bg-background text-foreground shadow-sm dark:bg-white/10 dark:text-white" : "text-muted-foreground/60 hover:text-foreground dark:text-white/30 dark:hover:text-white/60"
                )}
              >
                {r === 'today' ? 'Today' : r}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
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

        {/* Current Snapshot Grid - Anchor numeric values to real data */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4 pt-4 border-t border-border dark:border-white/5">
          {series.map((s) => {
            const current = s.points[s.points.length - 1]?.foreground || 0;
            const skill = CX_SKILLS.find(sk => sk.id === s.skillId);
            const Icon = skill?.icon || TrendingUp;
            const isActive = activeSkillId === s.skillId;
            const isDimmed = activeSkillId !== null && !isActive;

            return (
              <div 
                key={s.skillId} 
                onMouseEnter={() => setActiveSkillId(s.skillId)}
                onMouseLeave={() => setActiveSkillId(null)}
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-all duration-500 cursor-default p-2 rounded-2xl",
                  isActive ? "bg-muted dark:bg-white/5 ring-1 ring-border dark:ring-white/10" : "",
                  isDimmed ? "opacity-30 grayscale-[0.5]" : "opacity-100"
                )}
              >
                <div className="p-2 rounded-lg bg-background shadow-sm dark:bg-slate-900">
                  <Icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none">
                    {s.label}
                  </p>
                  <p className="text-xl font-black tracking-tighter text-foreground">
                    {current.toFixed(0)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
