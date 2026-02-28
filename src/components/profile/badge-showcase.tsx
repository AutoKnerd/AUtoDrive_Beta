
'use client';

import * as icons from 'lucide-react';
import type { Badge } from '@/lib/definitions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';

interface BadgeShowcaseProps {
  badges: Badge[];
  className?: string;
}

export function BadgeShowcase({ badges, className }: BadgeShowcaseProps) {
  if (badges.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You haven't earned any badges yet. Keep completing lessons to unlock them!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Badges</CardTitle>
        <CardDescription>Your collection of earned achievements. Click a badge to see its details.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {badges.map((badge) => {
            const Icon = icons[badge.icon as keyof typeof icons] || icons['Badge'];
            return (
              <Dialog key={badge.id}>
                <DialogTrigger asChild>
                  <button className="flex h-20 w-20 flex-col items-center justify-center gap-2 rounded-lg bg-muted p-2 text-center transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring">
                    <Icon className="h-8 w-8 text-primary" />
                    <span className="text-xs font-semibold leading-tight">{badge.name}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xs">
                  <DialogHeader className="items-center p-4 text-center">
                    <Icon className="mb-2 h-16 w-16 text-primary" />
                    <DialogTitle className="text-2xl">{badge.name}</DialogTitle>
                    <DialogDescription className="text-base">{badge.description}</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
