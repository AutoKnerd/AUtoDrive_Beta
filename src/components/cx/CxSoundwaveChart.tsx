'use client';

import React, { useMemo, useState } from 'react';
import { CxSeries, CxPoint } from '@/lib/cx/rollups';
import { CxSkillId } from '@/lib/cx/skills';

interface CxSoundwaveChartProps {
  series: CxSeries[];
  activeSkillId: CxSkillId | null;
  mode: 'groupOnly' | 'compare';
}

export function CxSoundwaveChart({ series, activeSkillId, mode }: CxSoundwaveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ skillId: CxSkillId; point: CxPoint; x: number; y: number } | null>(null);

  const padding = { top: 40, bottom: 20, left: 10, right: 10 };
  const width = 800;
  const height = 300;

  const pointsCount = series[0]?.points.length || 0;
  const xScale = (width - padding.left - padding.right) / Math.max(1, pointsCount - 1);
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
    <div className="relative w-full aspect-[8/3]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        onMouseMove={(e) => {
          if (!series.length) return;
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

        {/* Grid lines (faint) */}
        <line x1={padding.left} y1={yScale(50)} x2={width - padding.right} y2={yScale(50)} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
        <line x1={padding.left} y1={yScale(100)} x2={width - padding.right} y2={yScale(100)} stroke="white" strokeOpacity="0.05" />

        {series.map((s) => {
          const isActive = activeSkillId === s.skillId;
          const isDimmed = activeSkillId !== null && !isActive;
          const fgPoints = s.points.map(p => p.foreground);
          const bgPoints = s.points.map(p => p.baseline);

          return (
            <g key={s.skillId} className="transition-opacity duration-500" opacity={isDimmed ? 0.15 : 1}>
              {/* Valley Fill */}
              {mode === 'compare' && (
                <path
                  d={getValleyPath(fgPoints, bgPoints)}
                  fill={`url(#grad-${s.skillId})`}
                  className="pointer-events-none"
                />
              )}

              {/* Baseline Path */}
              {mode === 'compare' && (
                <path
                  d={getPath(bgPoints)}
                  fill="none"
                  stroke="white"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="pointer-events-none"
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
        {hoveredPoint && (
          <g>
            <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={height - padding.bottom} stroke="white" strokeOpacity="0.2" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="white" className="animate-pulse" />
          </g>
        )}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div 
          className="absolute z-50 pointer-events-none bg-slate-900/90 border border-white/10 p-3 rounded-lg backdrop-blur-md shadow-2xl text-[10px] space-y-1"
          style={{ 
            left: hoveredPoint.x > width / 2 ? hoveredPoint.x - 160 : hoveredPoint.x + 20,
            top: hoveredPoint.y - 40
          }}
        >
          <p className="text-white/50 font-medium">{hoveredPoint.point.date}</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: series.find(s => s.skillId === hoveredPoint.skillId)?.color }} />
            <p className="text-white font-bold text-sm uppercase">{series.find(s => s.skillId === hoveredPoint.skillId)?.label}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 pt-1 border-t border-white/5">
            <div>
              <p className="text-white/40">Current</p>
              <p className="text-lg font-bold text-white">{hoveredPoint.point.foreground.toFixed(1)}%</p>
            </div>
            {mode === 'compare' && (
              <div>
                <p className="text-white/40">Baseline</p>
                <p className="text-lg font-bold text-white/60">{hoveredPoint.point.baseline.toFixed(1)}%</p>
              </div>
            )}
          </div>
          {mode === 'compare' && (
            <p className={cn(
              "font-bold",
              hoveredPoint.point.foreground >= hoveredPoint.point.baseline ? "text-green-400" : "text-red-400"
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
