'use client';

import React, { useState } from 'react';
import { CxSeries, CxPoint } from '@/lib/cx/rollups';
import { CxSkillId } from '@/lib/cx/skills';
import { cn } from '@/lib/utils';

interface CxSoundwaveChartProps {
  series: CxSeries[];
  activeSkillId: CxSkillId | null;
  mode: 'groupOnly' | 'compare';
  onSkillHover?: (id: CxSkillId | null) => void;
  onSkillClick?: (id: CxSkillId | null) => void;
}

export function CxSoundwaveChart({ series, activeSkillId, mode, onSkillHover, onSkillClick }: CxSoundwaveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    skillId: CxSkillId;
    point: CxPoint;
    x: number;
    y: number;
    renderX: number;
    renderY: number;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  const padding = { top: 10, bottom: 10, left: 0, right: 0 };
  const width = 800;
  const height = 450;

  const pointsCount = series[0]?.points.length || 0;
  const isPointGraph = pointsCount === 1;
  const isLongRange = pointsCount >= 60;

  const xScale = isPointGraph
    ? (width - padding.left - padding.right) / Math.max(1, series.length)
    : (width - padding.left - padding.right) / Math.max(1, pointsCount - 1);

  const yScale = (val: number) => padding.top + (1 - val / 100) * (height - padding.top - padding.bottom);

  const startDateIndex = series[0]?.startDateIndex ?? null;

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

  const smoothPointsForRange = (points: number[]) => {
    if (points.length < 30) return points;

    const config = points.length >= 90
      ? { window: 13, passes: 4, neighborBlend: 0.28 }
      : { window: 9, passes: 3, neighborBlend: 0.18 };
    const radius = Math.floor(config.window / 2);
    const pass = (input: number[]) => {
      const output = input.map((_, idx) => {
        let weightedSum = 0;
        let weightSum = 0;

        for (let offset = -radius; offset <= radius; offset++) {
          const sampleIdx = Math.min(input.length - 1, Math.max(0, idx + offset));
          const weight = radius + 1 - Math.abs(offset);
          weightedSum += input[sampleIdx] * weight;
          weightSum += weight;
        }

        return weightSum > 0 ? weightedSum / weightSum : input[idx];
      });

      return output;
    };

    let smoothed = [...points];
    for (let i = 0; i < config.passes; i++) {
      smoothed = pass(smoothed);
    }

    if (config.neighborBlend > 0 && smoothed.length > 2) {
      smoothed = smoothed.map((value, idx) => {
        if (idx === 0 || idx === smoothed.length - 1) return value;
        const neighbors = (smoothed[idx - 1] + smoothed[idx + 1]) / 2;
        return value * (1 - config.neighborBlend) + neighbors * config.neighborBlend;
      });
    }

    // Keep exact start/end anchors so range edges remain accurate.
    smoothed[0] = points[0];
    smoothed[smoothed.length - 1] = points[points.length - 1];
    return smoothed;
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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!series.length || isPointGraph || !activeSkillId) {
      setHoveredPoint(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round((mouseX - padding.left) / xScale);

    if (idx >= 0 && idx < pointsCount) {
      const skill = series.find(s => s.skillId === activeSkillId);
      if (skill) {
        const pt = skill.points[idx];
        const chartX = padding.left + idx * xScale;
        const chartY = yScale(pt.foreground);
        setHoveredPoint({
          skillId: skill.skillId,
          point: pt,
          x: chartX,
          y: chartY,
          renderX: (chartX / width) * rect.width,
          renderY: (chartY / height) * rect.height,
          containerWidth: rect.width,
          containerHeight: rect.height
        });
      }
    }
  };

  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[2.4/1]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible [shape-rendering:geometricPrecision]"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur2" />
            <feGaussianBlur stdDeviation="0.8" in="SourceGraphic" result="blur1" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="particle-diffuse" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
          {series.map(s => (
            <linearGradient key={`grad-${s.skillId}`} id={`grad-${s.skillId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        <line x1={padding.left} y1={yScale(50)} x2={width - padding.right} y2={yScale(50)} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" className="text-foreground" />
        <line x1={padding.left} y1={yScale(100)} x2={width - padding.right} y2={yScale(100)} stroke="currentColor" strokeOpacity="0.1" className="text-foreground" />

        {startDateIndex !== null && !isPointGraph && (
          <g className="tenure-marker">
            <line
              x1={padding.left + startDateIndex * xScale}
              y1={padding.top}
              x2={padding.left + startDateIndex * xScale}
              y2={height - padding.bottom}
              stroke="currentColor"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeDasharray="6 4"
              className="text-cyan-400"
            />
            <text
              x={padding.left + startDateIndex * xScale}
              y={padding.top + 15}
              textAnchor="middle"
              className="fill-cyan-400 text-[9px] font-black uppercase"
            >
              Start Date Line
            </text>
          </g>
        )}

        {series.map((s, sIdx) => {
          const isActive = activeSkillId === s.skillId;
          const isDimmed = activeSkillId !== null && !isActive;
          const fgRaw = s.points.map(p => p.foreground);
          const bgRaw = s.points.map(p => p.baseline);
          const fgPoints = smoothPointsForRange(fgRaw);
          const bgPoints = smoothPointsForRange(bgRaw);

          if (isPointGraph) {
            const x = padding.left + (sIdx + 0.5) * xScale;
            const y = yScale(fgPoints[0]);
            const yBaseline = yScale(bgPoints[0]);

            return (
              <g
                key={s.skillId}
                className="transition-all duration-500 cursor-pointer"
                opacity={isDimmed ? 0.15 : 1}
                onClick={() => onSkillClick?.(s.skillId)}
                onMouseEnter={() => onSkillHover?.(s.skillId)}
                onMouseLeave={() => onSkillHover?.(null)}
              >
                {mode === 'compare' && (
                  <line
                    x1={x}
                    y1={yBaseline}
                    x2={x}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    className="text-foreground dark:text-white/40"
                  />
                )}

                {mode === 'compare' && (
                  <circle
                    cx={x}
                    cy={yBaseline}
                    r="5.5"
                    fill="currentColor"
                    fillOpacity="0.55"
                    className="text-foreground dark:text-white/70"
                  />
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 10.5 : 7}
                  fill={s.color}
                  filter="url(#neon-glow)"
                  className={cn("transition-all duration-500", isActive ? "animate-[pulse_2.4s_ease-in-out_infinite]" : "")}
                />
              </g>
            );
          }

          return (
            <g
              key={s.skillId}
              className="transition-opacity duration-500"
              opacity={isDimmed ? 0.35 : 1}
              style={{ mixBlendMode: isDimmed ? 'normal' : 'screen' }}
            >
              {mode === 'compare' && (
                <path d={getValleyPath(fgPoints, bgPoints)} fill={`url(#grad-${s.skillId})`} className="pointer-events-none opacity-40" />
              )}

              {mode === 'compare' && (
                <path d={getPath(bgPoints)} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 2" className="pointer-events-none" />
              )}

              {/* High-Density Particle Cloud Mesh Rendering */}
              {(() => {
                const particleCount = isActive
                  ? (isLongRange ? 12 : 16)
                  : activeSkillId
                    ? 0
                    : (isLongRange ? 3 : 5);
                if (particleCount === 0) return null;
                return Array.from({ length: particleCount }).map((_, i) => {
                  const step = i / (particleCount - 1 || 1);
                  // Depth maps from Average (0) up to Personal (1)
                  const depth = 0.5 - Math.cos(step * Math.PI) * 0.5;

                  const swirlPhase = step * Math.PI * 3;
                  const swirlAmplitude = isActive ? (isLongRange ? 9 : 11) : 6;

                  const layerPoints = fgPoints.map((p, idx) => {
                    const noise = Math.sin(idx * 0.5 + i * 0.2) * (isActive ? 1 : 0.5);
                    const swirl = Math.sin(idx * 0.3 + swirlPhase) * swirlAmplitude * Math.sin(step * Math.PI);

                    if (mode === 'compare') {
                      return bgPoints[idx] + (fgPoints[idx] - bgPoints[idx]) * depth + swirl + noise;
                    } else {
                      const amplitudeShift = (depth - 0.5) * (isActive ? 14 : 8);
                      return p + amplitudeShift + swirl + noise;
                    }
                  });

                  return (
                    <path
                      key={`particle-layer-${i}`}
                      d={getPath(layerPoints)}
                      fill="none"
                      stroke={s.color}
                      strokeDasharray={isActive ? "0.1 4" : "0.1 6"}
                      strokeLinecap="round"
                      strokeWidth={isActive ? 1 : 0.55}
                      strokeOpacity={isActive ? (Math.sin(step * Math.PI) * 0.32 + 0.04) : (Math.sin(step * Math.PI) * 0.14 + 0.03)}
                      filter={isActive ? "url(#particle-diffuse)" : undefined}
                      className="transition-all duration-1000 pointer-events-none"
                    />
                  );
                });
              })()}

              {/* Baseline Average Path (Dim / Anchor) */}
              {mode === 'compare' && (
                <path
                  d={getPath(bgPoints)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeOpacity={isActive ? 0.35 : 0.15}
                  strokeDasharray="2 4"
                  className="pointer-events-none transition-opacity duration-1000"
                />
              )}

              {/* Personal Score Path (Bright / Core) */}
              <path
                d={getPath(fgPoints)}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeOpacity={isActive ? 1 : 0.5}
                strokeDasharray="0.1 2.5"
                strokeLinecap="round"
                filter="url(#neon-glow)"
                className="pointer-events-none transition-all duration-300"
              />

              {/* Invisible wide line for easier clicking/hovering */}
              <path
                d={getPath(fgPoints)}
                fill="none"
                stroke="transparent"
                strokeWidth={30}
                className="cursor-pointer"
                onClick={() => onSkillClick?.(s.skillId)}
                onMouseEnter={() => onSkillHover?.(s.skillId)}
                onMouseLeave={() => onSkillHover?.(null)}
              />
            </g>
          );
        })}

        {hoveredPoint && !isPointGraph && (
          <g className="pointer-events-none">
            <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={height - padding.bottom} stroke="currentColor" strokeOpacity="0.2" className="text-foreground" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={5} fill="currentColor" className="animate-pulse text-foreground" />
          </g>
        )}
      </svg>

      {hoveredPoint && (() => {
        const tooltipWidth = 168;
        const tooltipHeight = 116;
        const edgePadding = 10;
        const gap = 16;
        const preferredLeft = hoveredPoint.renderX > hoveredPoint.containerWidth / 2
          ? hoveredPoint.renderX - tooltipWidth - gap
          : hoveredPoint.renderX + gap;
        const preferredTop = hoveredPoint.renderY - 40;
        const left = Math.max(edgePadding, Math.min(preferredLeft, hoveredPoint.containerWidth - tooltipWidth - edgePadding));
        const top = Math.max(edgePadding, Math.min(preferredTop, hoveredPoint.containerHeight - tooltipHeight - edgePadding));

        return (
          <div
            className="absolute z-50 pointer-events-none bg-card/95 border border-border p-3 rounded-lg backdrop-blur-md shadow-2xl text-[10px] space-y-1 dark:bg-slate-900/90"
            style={{ left, top }}
          >
            <p className="text-muted-foreground font-medium">{hoveredPoint.point.date}</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: series.find(s => s.skillId === hoveredPoint.skillId)?.color }} />
              <p className="text-foreground font-bold text-sm uppercase">{series.find(s => s.skillId === hoveredPoint.skillId)?.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 pt-1 border-t border-border">
              <div>
                <p className="text-muted-foreground">Proficiency</p>
                <p className="text-lg font-bold text-foreground">{hoveredPoint.point.foreground.toFixed(1)}%</p>
              </div>
              {mode === 'compare' && (
                <div>
                  <p className="text-muted-foreground">Dealer Average</p>
                  <p className="text-lg font-bold text-muted-foreground/60">{hoveredPoint.point.baseline.toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
