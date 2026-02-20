'use client';

import React, { useMemo, useState } from 'react';
import { CxSeries, CxPoint } from '@/lib/cx/rollups';
import { CxSkillId } from '@/lib/cx/skills';
import { cn } from '@/lib/utils';

interface CxSoundwaveChartProps {
  series: CxSeries[];
  activeSkillId: CxSkillId | null;
  mode: 'groupOnly' | 'compare';
}

export function CxSoundwaveChart({ series, activeSkillId, mode }: CxSoundwaveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ skillId: CxSkillId; point: CxPoint; x: number; y: number } | null>(null);

  const padding = { top: 20, bottom: 10, left: 10, right: 10 };
  const width = 800;
  const height = 200;

  const pointsCount = series[0]?.points.length || 0;
  const isPointGraph = pointsCount === 1;

  // For multi-point trends, calculate scales based on total points
  // For single-point graph, distribute points horizontally across the width
  const xScale = isPointGraph 
    ? (width - padding.left - padding.right) / Math.max(1, series.length) 
    : (width - padding.left - padding.right) / Math.max(1, pointsCount - 1);

  const yScale = (val: number) => padding.top + (1 - val / 100) * (height - padding.top - padding.bottom);

  // Cubic Bezier interpolation for smooth paths
  const getPath = (points: number[]) => {
    if (points.length < 2) return '';
    let d = `M ${padding.left} ${yScale(points[0])}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x1 = padding.left + i * xScale;
      const y1 = yScale(points[i]);
      const x2 = padding.left + (i + 1) * xScale;
      const y2 = yScale(points[i + 1]);
      const cx = (x1 + x2) / 2;
      d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }
    return d;
  };

  const getValleyPath = (fg: number[], bg: number[]) => {
    if (fg.length < 2) return '';
    const fgPath = getPath(fg);
    const reversedBgPoints = [...bg].reverse();
    
    let bgPathBack = '';
    for (let i = bg.length - 1; i > 0; i--) {
      const x1 = padding.left + i * xScale;
      const y1 = yScale(bg[i]);
      const x2 = padding.left + (i - 1) * xScale;
      const y2 = yScale(bg[i - 1]);
      const cx = (x1 + x2) / 2;
      bgPathBack += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }
    
    return `${fgPath} L ${padding.left + (bg.length - 1) * xScale} ${yScale(bg[bg.length - 1])} ${bgPathBack} Z`;
  };

  return (
    <div className="relative w-full aspect-[4/1]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        onMouseMove={(e) => {
          if (!series.length || isPointGraph) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round((mouseX - padding.left) / xScale);
          if (idx >= 0 && idx < pointsCount) {
            const skill = activeSkillId ? series.find(s => s.skillId === activeSkillId) : series[0];
            if (skill) {
              const pt = skill.points[idx];
              setHoveredPoint({
                skillId: skill.skillId,
                point: pt,
                x: padding.left + idx * xScale,
                y: yScale(pt.foreground)
              });
            }
          }
        }}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {series.map(s => (
            <linearGradient key={`grad-${s.skillId}`} id={`grad-${s.skillId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        <line 
          x1={padding.left} y1={yScale(50)} x2={width - padding.right} y2={yScale(50)} 
          stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" 
          className="text-foreground"
        />
        <line 
          x1={padding.left} y1={yScale(100)} x2={width - padding.right} y2={yScale(100)} 
          stroke="currentColor" strokeOpacity="0.1" 
          className="text-foreground"
        />

        {series.map((s, sIdx) => {
          const isActive = activeSkillId === s.skillId;
          const isDimmed = activeSkillId !== null && !isActive;
          const fgPoints = s.points.map(p => p.foreground);
          const bgPoints = s.points.map(p => p.baseline);

          if (isPointGraph) {
            const x = padding.left + (sIdx + 0.5) * xScale;
            const y = yScale(fgPoints[0]);
            const yBaseline = yScale(bgPoints[0]);

            return (
              <g key={s.skillId} className="transition-all duration-500" opacity={isDimmed ? 0.15 : 1}>
                {/* Single Point Connector Line (Ghostly) */}
                {mode === 'compare' && (
                  <line 
                    x1={x} y1={yBaseline} x2={x} y2={y} 
                    stroke="currentColor" 
                    strokeOpacity="0.15" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 2" 
                    className="text-foreground"
                  />
                )}
                
                {/* Baseline Point (Grey Dealer/Group Avg) */}
                {mode === 'compare' && (
                  <circle 
                    cx={x} cy={yBaseline} r="4.5" 
                    fill="currentColor" 
                    fillOpacity="0.2" 
                    className="text-foreground hover:fill-opacity-40 transition-all cursor-help"
                  >
                    <title>Dealer Baseline: {bgPoints[0].toFixed(1)}%</title>
                  </circle>
                )}

                {/* Main Foreground Point with Glow */}
                <circle 
                  cx={x} cy={y} r={isActive ? 8 : 6} 
                  fill={s.color} 
                  filter="url(#neon-glow)" 
                  className={cn("transition-all duration-300", isActive ? "animate-pulse" : "")}
                  onMouseEnter={() => !activeSkillId && setHoveredPoint({ skillId: s.skillId, point: s.points[0], x, y })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                
                {/* Outer Rim */}
                <circle 
                  cx={x} cy={y} r={isActive ? 12 : 10} 
                  fill="none" 
                  stroke={s.color} 
                  strokeWidth="1" 
                  strokeOpacity="0.3" 
                />
              </g>
            );
          }

          return (
            <g key={s.skillId} className="transition-opacity duration-500" opacity={isDimmed ? 0.15 : 1}>
              {/* Valley Fill */}
              {mode === 'compare' && (
                <path
                  d={getValleyPath(fgPoints, bgPoints)}
                  fill={`url(#grad-${s.skillId})`}
                  className="pointer-events-none opacity-40 dark:opacity-100"
                />
              )}

              {/* Baseline Path */}
              {mode === 'compare' && (
                <path
                  d={getPath(bgPoints)}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="pointer-events-none text-foreground"
                />
              )}

              {/* Foreground Neon Wave */}
              <path
                d={getPath(fgPoints)}
                fill="none"
                stroke={s.color}
                strokeWidth={isActive ? 3 : 2}
                filter="url(#neon-glow)"
                className="pointer-events-none"
              />
            </g>
          );
        })}

        {/* Tooltip Marker */}
        {hoveredPoint && !isPointGraph && (
          <g>
            <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={height - padding.bottom} stroke="currentColor" strokeOpacity="0.2" className="text-foreground" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="currentColor" className="animate-pulse text-foreground" />
          </g>
        )}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div 
          className="absolute z-50 pointer-events-none bg-card/95 border border-border p-3 rounded-lg backdrop-blur-md shadow-2xl text-[10px] space-y-1 dark:bg-slate-900/90 dark:border-white/10"
          style={{ 
            left: hoveredPoint.x > width / 2 ? hoveredPoint.x - 160 : hoveredPoint.x + 20,
            top: hoveredPoint.y - 40
          }}
        >
          <p className="text-muted-foreground font-medium">{hoveredPoint.point.date}</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: series.find(s => s.skillId === hoveredPoint.skillId)?.color }} />
            <p className="text-foreground font-bold text-sm uppercase">{series.find(s => s.skillId === hoveredPoint.skillId)?.label}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 pt-1 border-t border-border dark:border-white/5">
            <div>
              <p className="text-muted-foreground">Current</p>
              <p className="text-lg font-bold text-foreground">{hoveredPoint.point.foreground.toFixed(1)}%</p>
            </div>
            {mode === 'compare' && (
              <div>
                <p className="text-muted-foreground">Baseline</p>
                <p className="text-lg font-bold text-muted-foreground/60">{hoveredPoint.point.baseline.toFixed(1)}%</p>
              </div>
            )}
          </div>
          {mode === 'compare' && (
            <p className={cn(
              "font-bold",
              hoveredPoint.point.foreground >= hoveredPoint.point.baseline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {hoveredPoint.point.foreground >= hoveredPoint.point.baseline ? '↑' : '↓'} 
              {Math.abs(hoveredPoint.point.foreground - hoveredPoint.point.baseline).toFixed(1)}% vs baseline
            </p>
          )}
        </div>
      )}
    </div>
  );
}
