'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TodayActionCardProps {
  lessonHref: string | null;
  improvementSkills?: string[];
  className?: string;
}

export function TodayActionCard({ lessonHref, improvementSkills = [], className }: TodayActionCardProps) {
  const displaySkills = improvementSkills.filter(Boolean).slice(0, 2);
  const showSkillLine = displaySkills.length > 0;

  return (
    <Card
      data-sprocket-tour="recommended-lesson"
      className={cn(
        'rounded-2xl border border-cyan-400/45 bg-slate-950 text-slate-100 shadow-[0_0_0_1px_rgba(45,212,191,0.25),0_0_24px_rgba(45,212,191,0.22)]',
        className
      )}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-semibold tracking-tight">Today&apos;s Action</CardTitle>
        <p className="text-sm text-slate-300">Keep your momentum going.</p>
        {showSkillLine ? (
          <p className="text-sm font-medium text-cyan-200">Improves: {displaySkills.join(' + ')}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        {lessonHref ? (
          <Button
            asChild
            className="group lesson-ready-pulse h-12 w-full bg-[#7CC242] font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(124,194,66,0.35)] transition-transform duration-150 hover:bg-[#8ED24F] active:translate-y-[1px]"
          >
            <Link href={lessonHref}>
              START RECOMMENDED
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-slate-300">You&apos;re all caught up. Check back soon.</p>
        )}
      </CardContent>
    </Card>
  );
}
