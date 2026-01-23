
'use client';

import * as React from 'react';
import { useMemo } from 'react';
import type { User, LessonLog, Badge as BadgeType, CxTrait } from '@/lib/definitions';
import { calculateLevel } from '@/lib/xp';
import * as icons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/logo';

interface ScoreCardProps {
  user: User;
  activity: LessonLog[];
  badges: BadgeType[];
}

const metricIcons: Record<CxTrait, icons.LucideIcon> = {
  empathy: icons.Smile,
  listening: icons.Ear,
  trust: icons.Handshake,
  followUp: icons.Repeat,
  closing: icons.Target,
  relationshipBuilding: icons.Users,
};

export const ScoreCard = React.forwardRef<HTMLDivElement, ScoreCardProps>(({ user, activity, badges }, ref) => {
  const { level, levelXp, nextLevelXp, progress } = calculateLevel(user.xp);
  const hasActivity = activity.length > 0;

  const averageScores = useMemo(() => {
    if (!hasActivity) {
      return {
        empathy: 0,
        listening: 0,
        trust: 0,
        followUp: 0,
        closing: 0,
        relationshipBuilding: 0,
      };
    }

    const total = activity.reduce(
      (acc, log) => {
        Object.keys(acc).forEach(key => {
          acc[key as CxTrait] += log[key as CxTrait];
        });
        return acc;
      },
      { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 }
    );

    const count = activity.length;
    return Object.fromEntries(
      Object.entries(total).map(([key, value]) => [key, Math.round(value / count)])
    ) as typeof total;
  }, [activity, hasActivity]);

  return (
    <TooltipProvider>
      <Card 
        ref={ref}
        className="w-full max-w-sm aspect-[5/7] rounded-3xl border-4 border-cyan-400/50 bg-slate-900/80 p-4 shadow-2xl shadow-cyan-500/20 backdrop-blur-lg flex flex-col overflow-hidden relative"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-cyan-900/50 to-transparent -z-10" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-slate-800/50 to-transparent -z-10" />

        {/* Header */}
        <header className="flex items-center justify-between text-white">
          <div className="text-left">
            <p className="font-bold text-2xl">Level {level}</p>
            <p className="text-xs text-muted-foreground">{user.xp.toLocaleString()} XP</p>
          </div>
          <Logo variant="icon" width={40} height={40} />
        </header>

        {/* XP Progress */}
        <div className="w-full space-y-1 mt-2">
            <Progress value={progress} className="h-2 bg-slate-700/50 border border-slate-600 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-blue-500" />
             <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()}</span>
                <span className="text-cyan-400">{nextLevelXp - levelXp} to next level</span>
            </div>
        </div>

        {/* Avatar */}
        <div className="flex-grow flex items-center justify-center my-1">
          <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 blur-lg" />
              <Avatar className="relative w-full h-full border-4 border-slate-700">
                  <AvatarImage src={user.avatarUrl} alt={user.name} crossOrigin="anonymous" />
                  <AvatarFallback className="text-3xl bg-slate-800 text-white">
                      {user.name.charAt(0)}
                  </AvatarFallback>
              </Avatar>
          </div>
        </div>
        
        {/* User Info */}
        <div className="text-center text-white -mt-1">
          <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-cyan-400 font-medium">{user.role === 'manager' ? 'Sales Manager' : user.role}</p>
          {user.brand && <p className="text-xs text-muted-foreground">{user.brand}</p>}
          {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
        </div>
        
        <Separator className="my-1.5 bg-cyan-400/20" />
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-y-0.5 gap-x-1 text-center">
            {Object.entries(averageScores).map(([key, value]) => {
                const Icon = metricIcons[key as keyof typeof metricIcons];
                const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return (
                    <div key={key} className="flex flex-col items-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-base font-bold text-white">{hasActivity ? `${value}%` : '--'}</span>
                        <span className="text-[10px] leading-tight text-muted-foreground">{title}</span>
                    </div>
                );
            })}
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <>
            <Separator className="my-1.5 bg-cyan-400/20" />
            <div className="flex flex-wrap gap-1 justify-center">
              {badges.map((badge) => {
                const Icon = icons[badge.icon as keyof typeof icons] || icons['Badge'];
                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger>
                       <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800/70 border border-slate-700 text-cyan-400">
                          <Icon className="h-5 w-5" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{badge.name}</p>
                      <p>{badge.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </TooltipProvider>
  );
});
ScoreCard.displayName = 'ScoreCard';
