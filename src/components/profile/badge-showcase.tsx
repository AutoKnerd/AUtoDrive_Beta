
'use client';

import * as icons from 'lucide-react';
import type { Badge } from '@/lib/definitions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface BadgeShowcaseProps {
  badges: Badge[];
}

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  if (badges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You haven't earned any badges yet. Keep completing lessons to unlock them!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Badges</CardTitle>
        <CardDescription>Your collection of earned achievements.</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex flex-wrap gap-4">
            {badges.map((badge) => {
              const Icon = icons[badge.icon as keyof typeof icons] || icons['Badge'];
              return (
                <Tooltip key={badge.id}>
                  <TooltipTrigger asChild>
                    <div className="flex h-20 w-20 flex-col items-center justify-center gap-2 rounded-lg bg-muted p-2 text-center transition-transform hover:scale-105">
                      <Icon className="h-8 w-8 text-primary" />
                      <span className="text-xs font-semibold leading-tight">{badge.name}</span>
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
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
