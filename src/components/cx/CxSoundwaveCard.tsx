'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CxScope, getComparisonScope, getScopeLabel } from '@/lib/cx/scope';
import { rollupCxTrend } from '@/lib/cx/rollups';
import { CX_SKILLS, CxSkillId } from '@/lib/cx/skills';
import { CxSoundwaveChart } from './CxSoundwaveChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Info, TrendingUp, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { differenceInDays } from 'date-fns';
import type { ThemePreference } from '@/lib/definitions';

export type CxRange = 'today' | '7d' | '30d' | '90d';

interface CxSoundwaveCardProps {
  scope: CxScope;
  personalScope?: CxScope;
  className?: string;
  data?: Partial<Record<string, number>>;
  memberSince?: string | null;
  themePreference?: ThemePreference;
  viewMode?: 'team' | 'personal';
  onViewModeChange?: (mode: 'team' | 'personal') => void;
  range?: CxRange;
  onRangeChange?: (range: CxRange) => void;
  hideInternalToggle?: boolean;
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

export function CxSoundwaveCard({ 
  scope, 
  personalScope, 
  className, 
  data, 
  memberSince, 
  themePreference = 'vibrant',
  viewMode: externalViewMode,
  onViewModeChange,
  range: externalRange,
  onRangeChange: externalOnRangeChange,
  hideInternalToggle = false
}: CxSoundwaveCardProps) {
  const [internalRange, setInternalRange] = useState<CxRange>('today');
  const [internalViewMode, setInternalViewMode] = useState<'team' | 'personal'>('team');
  const [hoveredSkillId, setHoveredSkillId] = useState<CxSkillId | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<CxSkillId | null>(null);
  const [mounted, setMounted] = useState(false);

  const viewMode = externalViewMode || internalViewMode;
  const range = externalRange || internalRange;
  const setRange = externalOnRangeChange || setInternalRange;

  useEffect(() => {
    setMounted(true);
  }, []);

  const daysSinceJoining = useMemo(() => {
    if (!memberSince) return 100;
    try {
      return Math.max(0, differenceInDays(new Date(), new Date(memberSince)));
    } catch {
      return 100;
    }
  }, [memberSince]);

  const rangeAvailability = useMemo(() => ({
    today: true,
    '7d': daysSinceJoining >= 7,
    '30d': daysSinceJoining >= 30,
    '90d': daysSinceJoining >= 90,
  }), [daysSinceJoining]);

  useEffect(() => {
    if (mounted && range === 'today') {
      if (rangeAvailability['30d']) setRange('30d');
      else if (rangeAvailability['7d']) setRange('7d');
    }
  }, [mounted, rangeAvailability]);

  const activeSkillId = hoveredSkillId || selectedSkillId;
  const activeScope = viewMode === 'personal' && personalScope ? personalScope : scope;
  const comparisonScope = useMemo(() => getComparisonScope(activeScope), [activeScope]);
  const anchoredScores = useMemo(() => normalizeScores(data), [data]);

  const series = useMemo(() => {
    if (!mounted) return [];
    let days = 30;
    if (range === 'today') days = 1;
    else if (range === '7d') days = 7;
    else if (range === '90d') days = 90;

    const shouldAnchor = Boolean(
      anchoredScores &&
      Object.values(anchoredScores).some((score) => typeof score === 'number' && Number.isFinite(score))
    );

    return rollupCxTrend(activeScope, days, shouldAnchor ? anchoredScores : undefined, memberSince, themePreference);
  }, [activeScope, range, mounted, viewMode, anchoredScores, personalScope, memberSince, themePreference]);

  const mode = comparisonScope ? 'compare' : 'groupOnly';

  const handleSkillClick = (id: CxSkillId | null) => {
    setSelectedSkillId(prev => prev === id ? null : id);
  };

  const handleViewModeToggle = (mode: 'team' | 'personal') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
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

  const rangeOptions = [
    { id: 'today', label: 'Today', min: 0 },
    { id: '7d', label: '7d', min: 7 },
    { id: '30d', label: '30d', min: 30 },
    { id: '90d', label: '90d', min: 90 },
  ] as const;

  return (
    <Card className={cn(
      "relative w-full overflow-hidden bg-card border-border shadow-xl transition-all duration-500 dark:bg-slate-950/95 dark:border-white/10",
      className
    )}>
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-20 left-1/2 h-52 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />
        <div className="absolute -bottom-28 right-[-10%] h-56 w-96 rounded-full bg-sky-500/8 blur-3xl" />
      </div>
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
          {personalScope && !hideInternalToggle && (
            <div className="flex bg-muted p-1 rounded-lg border border-border dark:bg-white/5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeToggle('team')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase",
                  viewMode === 'team' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                )}
              >
                Dealership
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewModeToggle('personal')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase",
                  viewMode === 'personal' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                )}
              >
                Personal
              </Button>
            </div>
          )}

          <TooltipProvider>
            <div className="flex bg-muted p-1 rounded-lg border border-border dark:bg-white/5">
              {rangeOptions.map((opt) => {
                const isAvailable = rangeAvailability[opt.id];
                const button = (
                  <Button
                    key={opt.id}
                    variant="ghost"
                    size="sm"
                    disabled={!isAvailable}
                    onClick={() => setRange(opt.id)}
                    className={cn(
                      "h-7 px-3 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1",
                      range === opt.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60",
                      !isAvailable && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {!isAvailable && <Lock className="h-2.5 w-2.5" />}
                    {opt.label}
                  </Button>
                );

                if (!isAvailable) {
                  return (
                    <Tooltip key={opt.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Unlock after {opt.min} days in the system.</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return button;
              })}
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="relative pt-0 space-y-4 px-0">
        <div className="border border-border/50 bg-muted/5 overflow-hidden rounded-xl backdrop-blur-[1px] dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b border-border/50 p-1.5 md:p-3 dark:border-white/5 bg-muted/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Performance Wave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/20 border border-cyan-400/50" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight">Depth of Mastery</span>
                <span className="text-[8px] text-muted-foreground/60 uppercase leading-none">Proficiency intensity</span>
              </div>
            </div>
            {mode === 'compare' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <div className="w-3 h-[1px] border-t border-dashed border-muted-foreground/40" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight">Dealer Average</span>
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

        {/* Skill grid with percentages, now moved up and interactive */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4 pt-2 px-4 pb-4">
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
                  isActive ? "bg-muted dark:bg-white/5 ring-1 ring-border" : "hover:bg-muted/50",
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
