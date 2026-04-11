'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TodaysDriveCardProps {
  recommendedLessonHref: string | null;
  improvementSkills?: string[];
  className?: string;
}

export function TodaysDriveCard({
  recommendedLessonHref,
  improvementSkills = [],
  className,
}: TodaysDriveCardProps) {
  const displaySkills = improvementSkills.filter(Boolean).slice(0, 2);
  const hasRecommendation = Boolean(recommendedLessonHref);
  const supportCopy = hasRecommendation
    ? 'Recommended next step to build your CX skill'
    : 'No specific recommendation right now - keep building momentum.';

  return (
    <Card
      data-sprocket-tour="recommended-lesson"
      className={cn(
        'rounded-2xl border border-cyan-400/45 bg-slate-950 text-slate-100 shadow-[0_0_0_1px_rgba(45,212,191,0.22),0_0_24px_rgba(45,212,191,0.18)]',
        className
      )}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="sr-only">Today&apos;s Drive</CardTitle>
        <div className="flex items-center">
          <Image
            src="/AutoDriveCXLogo030625.png"
            alt="AutoDriveCX"
            width={220}
            height={64}
            priority
            className="h-auto w-[285px] max-w-full select-none object-contain"
          />
        </div>
        <p className="text-sm text-slate-300">{supportCopy}</p>
        {hasRecommendation && displaySkills.length > 0 ? (
          <p className="text-sm font-medium text-cyan-200">Improves: {displaySkills.join(' + ')}</p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {hasRecommendation ? (
          <>
            <Button
              asChild
              className="group lesson-ready-pulse h-12 w-full bg-[#7CC242] font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(124,194,66,0.35)] transition-transform duration-150 hover:bg-[#8ED24F] active:translate-y-[1px]"
            >
              <Link href={recommendedLessonHref!}>
                Start Recommended Session
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start px-1 text-sm font-medium text-cyan-100/80 hover:bg-white/5 hover:text-cyan-50"
            >
              <Link href="/ppp">Start the &quot;CX Road to the Sale&quot; and level up faster</Link>
            </Button>
          </>
        ) : (
          <>
            <Button
              asChild
              className="group lesson-ready-pulse h-12 w-full bg-[#7CC242] font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(124,194,66,0.35)] transition-transform duration-150 hover:bg-[#8ED24F] active:translate-y-[1px]"
            >
              <Link href="/ppp">
                Press Start
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start px-1 text-sm font-medium text-cyan-100/80 hover:bg-white/5 hover:text-cyan-50"
            >
              <Link href="/ppp">Start the &quot;CX Road to the Sale&quot; and level up faster</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
