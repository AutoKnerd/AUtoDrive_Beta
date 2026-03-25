'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CxScope, getComparisonScope, getScopeLabel } from '@/lib/cx/scope';
import { rollupCxTrend, type CxSeries } from '@/lib/cx/rollups';
import { CX_SKILLS, CxSkillId } from '@/lib/cx/skills';
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
  actionLabel?: string;
  onActionClick?: () => void;
  actionDisabled?: boolean;
  actionLoading?: boolean;
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
  hideInternalToggle = false,
  actionLabel,
  onActionClick,
  actionDisabled = false,
  actionLoading = false,
}: CxSoundwaveCardProps) {
  const [internalRange, setInternalRange] = useState<CxRange>('today');
  const [internalViewMode, setInternalViewMode] = useState<'team' | 'personal'>('team');
  const [nonTodayView, setNonTodayView] = useState<'trend' | 'change'>('trend');
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

  const activeScope = viewMode === 'personal' && personalScope ? personalScope : scope;
  const comparisonScope = useMemo(() => getComparisonScope(activeScope), [activeScope]);
  const anchoredScores = useMemo(() => normalizeScores(data), [data]);
  const [series, setSeries] = useState<CxSeries[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const loadSeries = async () => {
      setSeriesLoading(true);
      try {
        let days = 30;
        if (range === 'today') days = 1;
        else if (range === '7d') days = 7;
        else if (range === '90d') days = 90;

        const shouldAnchor = Boolean(
          anchoredScores &&
          Object.values(anchoredScores).some((score) => typeof score === 'number' && Number.isFinite(score))
        );
        const next = await rollupCxTrend(
          activeScope,
          days,
          shouldAnchor ? anchoredScores : undefined,
          memberSince,
          themePreference
        );
        if (!cancelled) setSeries(next);
      } catch {
        if (!cancelled) setSeries([]);
      } finally {
        if (!cancelled) setSeriesLoading(false);
      }
    };

    loadSeries();
    return () => {
      cancelled = true;
    };
  }, [activeScope, range, mounted, viewMode, anchoredScores, personalScope, memberSince, themePreference]);

  const hasComparisonData = useMemo(() => (
    series.some((s) => s.points.some((p) => Math.abs(p.baseline - p.foreground) > 0.1))
  ), [series]);
  const mode = comparisonScope && hasComparisonData ? 'compare' : 'groupOnly';
  const primaryScopeLabel = useMemo(() => {
    const raw = getScopeLabel(activeScope);
    if (raw === 'Individual') return 'You';
    if (raw === 'Store Average') return 'Store';
    if (raw === 'Group Average') return 'Group';
    return raw;
  }, [activeScope]);
  const comparisonScopeLabel = useMemo(() => {
    if (!comparisonScope) return null;
    const raw = getScopeLabel(comparisonScope);
    if (raw === 'Individual') return 'You';
    if (raw === 'Store Average') return 'Store Avg';
    if (raw === 'Group Average') return 'Group Avg';
    return raw;
  }, [comparisonScope]);

  const handleViewModeToggle = (mode: 'team' | 'personal') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  const rangeOptions = [
    { id: 'today', label: 'Today', min: 0 },
    { id: '7d', label: '7d', min: 7 },
    { id: '30d', label: '30d', min: 30 },
    { id: '90d', label: '90d', min: 90 },
  ] as const;
  const barRows = useMemo(() => {
    return series.map((s) => {
      const foregroundValue = range === 'today'
        ? (s.points[s.points.length - 1]?.foreground || 0)
        : (s.points.reduce((acc, p) => acc + p.foreground, 0) / Math.max(1, s.points.length));
      const baselineValue = range === 'today'
        ? (s.points[s.points.length - 1]?.baseline || 0)
        : (s.points.reduce((acc, p) => acc + p.baseline, 0) / Math.max(1, s.points.length));
      const skill = CX_SKILLS.find((entry) => entry.id === s.skillId);
      return {
        skillId: s.skillId,
        label: skill?.label || s.skillId,
        color: s.color,
        foregroundValue: Math.max(0, Math.min(100, foregroundValue)),
        baselineValue: Math.max(0, Math.min(100, baselineValue)),
      };
    });
  }, [series, range]);
  const trendRows = useMemo(() => {
    return series.map((s) => {
      const skill = CX_SKILLS.find((entry) => entry.id === s.skillId);
      const points = s.points
        .map((p) => Math.max(0, Math.min(100, p.foreground)))
        .filter((value) => Number.isFinite(value));
      const currentValue = points.length ? points[points.length - 1] : 0;
      const startValue = points.length ? points[0] : 0;
      const delta = currentValue - startValue;
      return {
        skillId: s.skillId,
        label: skill?.label || s.skillId,
        color: s.color,
        points,
        currentValue,
        delta,
      };
    });
  }, [series]);
  const maxAbsDelta = useMemo(() => {
    const largest = trendRows.reduce((max, row) => Math.max(max, Math.abs(row.delta)), 0);
    return Math.max(1, largest);
  }, [trendRows]);
  const trendTickPercents = useMemo(() => {
    if (range === 'today') return [];
    const tickCountByRange: Record<Exclude<CxRange, 'today'>, number> = {
      '7d': 8,   // daily marks
      '30d': 7,  // roughly weekly marks
      '90d': 7,  // evenly distributed long-range marks
    };
    const tickCount = tickCountByRange[range];
    if (tickCount <= 1) return [0, 100];
    return Array.from({ length: tickCount }, (_, index) => (
      (index / (tickCount - 1)) * 100
    ));
  }, [range]);
  const formatPercent = (value: number) => (
    range === 'today' ? `${value.toFixed(0)}%` : `${value.toFixed(1)}%`
  );
  const buildSparklinePath = (points: number[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M 0,20 L 100,20`;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const spread = Math.max(1, max - min);

    return points
      .map((value, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 22 - ((value - min) / spread) * 18;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };
  const targetMarker = 75;

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

          {range !== 'today' && (
            <div className="flex bg-muted p-1 rounded-lg border border-border dark:bg-white/5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNonTodayView('trend')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase",
                  nonTodayView === 'trend' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                )}
              >
                Trend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNonTodayView('change')}
                className={cn(
                  "h-7 px-3 text-[10px] font-bold tracking-widest uppercase",
                  nonTodayView === 'change' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                )}
              >
                Change
              </Button>
            </div>
          )}

          {actionLabel && onActionClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onActionClick}
              disabled={actionDisabled || actionLoading}
              className="h-7 px-3 text-[10px] font-bold tracking-widest uppercase"
            >
              {actionLoading ? 'Updating...' : actionLabel}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative pt-0 space-y-4 px-0">
        <div className="border border-border/50 bg-muted/5 overflow-hidden rounded-xl backdrop-blur-[1px] dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b border-border/50 p-1.5 md:p-3 dark:border-white/5 bg-muted/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{primaryScopeLabel} (Top Bar)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/20 border border-cyan-400/50" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight">
                  {range === 'today' ? 'Average Score Bars' : (nonTodayView === 'trend' ? 'Trend Sparkline' : 'Delta Bar')}
                </span>
                <span className="text-[8px] text-muted-foreground/60 uppercase leading-none">
                  {range === 'today'
                    ? 'Current snapshot'
                    : (nonTodayView === 'trend' ? `Direction over ${range}` : `Current vs start (${range})`)}
                </span>
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
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight">{comparisonScopeLabel} (Bottom Bar)</span>
                  <span className="text-[8px] text-muted-foreground/60 uppercase leading-none">Benchmark</span>
                </div>
              </div>
            )}
          </div>

          {seriesLoading ? (
            <div className="p-4">
              <Skeleton className="h-[250px] w-full" />
            </div>
          ) : (range === 'today' ? barRows.length === 0 : trendRows.length === 0) ? (
            <div className="flex h-[250px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
              No scored data available for this range.
            </div>
          ) : range === 'today' ? (
            <div className="space-y-4 p-4">
              {barRows.map((row, idx) => (
                <div key={row.skillId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{row.label}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground">
                        {primaryScopeLabel} {formatPercent(row.foregroundValue)}
                        {mode === 'compare' ? ` / ${comparisonScopeLabel} ${formatPercent(row.baselineValue)}` : ''}
                      </p>
                      {mode === 'compare' && (
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            row.foregroundValue - row.baselineValue >= 0
                              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                              : "border-rose-400/40 bg-rose-400/10 text-rose-300"
                          )}
                        >
                          Δ
                          {row.foregroundValue - row.baselineValue >= 0 ? '+' : ''}
                          {(row.foregroundValue - row.baselineValue).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="relative h-3 rounded-full bg-muted/60 border border-border/60 overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:25%_100%] pointer-events-none" />
                      <div
                        className="absolute top-0 bottom-0 w-px border-l border-dashed border-amber-300/40"
                        style={{ left: `${targetMarker}%` }}
                      />
                      <div
                        className="relative h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${row.foregroundValue}%`,
                          background: `linear-gradient(90deg, ${row.color}CC 0%, ${row.color} 60%, ${row.color}F0 100%)`,
                          boxShadow: `0 0 14px ${row.color}66`,
                          transitionDelay: `${idx * 40}ms`,
                        }}
                      />
                      <div className="absolute left-0 right-0 top-0 h-[35%] rounded-full bg-white/15 pointer-events-none" />
                    </div>
                    {mode === 'compare' && (
                      <div className="relative h-2 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:25%_100%] pointer-events-none" />
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out opacity-60"
                          style={{
                            width: `${row.baselineValue}%`,
                            background: `linear-gradient(90deg, ${row.color}AA 0%, ${row.color}CC 100%)`,
                            transitionDelay: `${idx * 40 + 20}ms`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : nonTodayView === 'trend' ? (
            <div className="space-y-3 p-4">
              {trendRows.map((row) => (
                <div key={row.skillId} className="grid grid-cols-[minmax(120px,170px)_78px_66px_1fr] items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{row.label}</p>
                  <p className="text-xs font-semibold text-foreground">{formatPercent(row.currentValue)}</p>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      row.delta >= 0
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                        : "border-rose-400/40 bg-rose-400/10 text-rose-300"
                    )}
                  >
                    {row.delta >= 0 ? '▲' : '▼'} {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(1)}
                  </span>
                  <div className="h-7 rounded-md border border-border/60 bg-background/40 px-2 py-1">
                    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-full w-full">
                      {trendTickPercents.map((x, index) => (
                        <line
                          key={`tick-${row.skillId}-${index}`}
                          x1={x}
                          y1={1}
                          x2={x}
                          y2={23}
                          stroke="currentColor"
                          strokeWidth="0.5"
                          className="text-muted-foreground/35"
                        />
                      ))}
                      <path d={buildSparklinePath(row.points)} stroke={row.color} strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {trendRows.map((row) => {
                const halfWidthPct = (Math.abs(row.delta) / maxAbsDelta) * 50;
                const left = row.delta >= 0 ? 50 : 50 - halfWidthPct;
                return (
                  <div key={row.skillId} className="grid grid-cols-[minmax(120px,170px)_66px_1fr] items-center gap-3 rounded-lg border border-border/50 bg-muted/5 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{row.label}</p>
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        row.delta >= 0
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                          : "border-rose-400/40 bg-rose-400/10 text-rose-300"
                      )}
                    >
                      {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(1)}
                    </span>
                    <div className="relative h-4 rounded-full border border-border/60 bg-muted/40 overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/50" />
                      <div
                        className={cn(
                          "absolute top-0 bottom-0 rounded-full",
                          row.delta >= 0 ? "bg-emerald-400/70" : "bg-rose-400/70"
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${halfWidthPct}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
