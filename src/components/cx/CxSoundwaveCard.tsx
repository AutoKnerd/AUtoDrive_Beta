'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CxScope, getScopeLabel } from '@/lib/cx/scope';
import { rollupCxTrend } from '@/lib/cx/rollups';
import { CX_SKILLS, CxSkillId } from '@/lib/cx/skills';
import { CxSoundwaveChart } from './CxSoundwaveChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Info, TrendingUp, Activity, Target } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface CxSoundwaveCardProps {
  scope: CxScope;
  personalScope?: CxScope;
  className?: string;
  /** 
   * Real-time scores to anchor the trend data to. 
   */
  data?: Partial<Record<string, number>>;
  memberSince?: string | null;
}

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

export function CxSoundwaveCard({ scope, personalScope, className, data, memberSince }: CxSoundwaveCardProps) {
  const [range, setRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [hoveredSkillId, setHoveredSkillId] = useState<CxSkillId | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<CxSkillId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeSkillId = hoveredSkillId || selectedSkillId;
  const activeScope = viewMode === 'personal' && personalScope ? personalScope : scope;
  const anchoredScores = useMemo(() => normalizeScores(data), [data]);

  const series = useMemo(() => {
    if (!mounted) return [];
    let days = 30;
    if (range === 'today') days = 1;
    else if (range === '7d') days = 7;
    else if (range === '90d') days = 90;

    const shouldAnchor = (viewMode === 'personal' && personalScope) || (viewMode === 'team');
    return rollupCxTrend(activeScope, days, shouldAnchor ? anchoredScores : undefined, memberSince);
  }, [activeScope, range, mounted, viewMode, anchoredScores, personalScope, memberSince]);

  const mode = activeScope.role === 'owner' && !activeScope.storeId ? 'groupOnly' : 'compare';

  const handleSkillClick = (id: CxSkillId | null) => {
    setSelectedSkillId(prev => prev === id ? null : id);
  };

  if (!mounted) {
    return (
      <Card className={cn("h-[400px] w-full bg-card border-border", className)}>
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
      "relative w-full overflow-hidden bg-card border-border shadow-2xl transition-all duration-500 dark:bg-slate-950 dark:border-white/5",
      className
    )}>
      {/* Background Glows */}
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
                <TooltipContent className="bg-popover border-border text-xs max-w-[240px]">
                  {range === 'today' ? 'Your current standing vs colleagues.' : `Trends over the last ${range}. The "Start Date Line" indicates when your membership began.`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            {getScopeLabel(activeScope)} {range === 'today' ? 'current standing' : `averages over the last ${range}`}.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

      <CardContent className="pt-0 space-y-4">
        {/* Scores Area with Border - Edge-to-Edge Chart Container */}
        <div className="rounded-2xl border border-border/60 bg-muted/5 overflow-hidden dark:bg-white/2 shadow-inner">
          {/* Visual Ledger - Padded internally but border spans full width */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 md:gap-x-8 gap-y-2 md:gap-y-3 border-b border-border/50 p-2 md:p-4 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 md:w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Performance Wave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 md:w-3 h-2.5 md:h-3 rounded-full bg-cyan-400/20 border border-cyan-400/50 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight">Depth of Mastery</span>
                <span className="text-[8px] text-muted-foreground/60 uppercase leading-none">Proficiency intensity</span>
              </div>
            </div>
            {mode === 'compare' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <div className="w-3 md:w-4 h-[1px] border-t border-dashed border-muted-foreground/40" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight">Team Benchmark</span>
                  <span className="text-[8px] text-muted-foreground/60 uppercase leading-none">Mean Average</span>
                </div>
              </div>
            )}
          </div>

          <CxSoundwaveChart 
            series={series} 
            activeSkillId={activeSkillId} 
            mode={mode} 
            onSkillHover={setHoveredSkillId}
            onSkillClick={handleSkillClick}
          />
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4 pt-2">
          {series.map((s) => {
            const displayValue = range === 'today' 
              ? (s.points[s.points.length - 1]?.foreground || 0)
              : (s.points.reduce((acc, p) => acc + p.foreground, 0) / s.points.length);
              
            const skill = CX_SKILLS.find(sk => sk.id === s.skillId);
            const Icon = skill?.icon || TrendingUp;
            const isActive = activeSkillId === s.skillId;
            const isDimmed = activeSkillId !== null && !isActive;

            return (
              <div 
                key={s.skillId} 
                onMouseEnter={() => setHoveredSkillId(s.skillId)}
                onMouseLeave={() => setHoveredSkillId(null)}
                onClick={() => handleSkillClick(s.skillId)}
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-all duration-500 cursor-pointer p-2 rounded-2xl",
                  isActive ? "bg-muted dark:bg-white/5 ring-1 ring-border dark:ring-white/10" : "hover:bg-muted/50 dark:hover:bg-white/5",
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
                    {displayValue.toFixed(0)}%
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
