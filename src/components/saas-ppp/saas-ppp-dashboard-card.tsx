'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, Medal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/definitions';
import { normalizeSaasPppUserState } from '@/lib/saas-ppp/state';
import { getSaasPppLevelTitle } from '@/lib/saas-ppp/definitions';

interface SaasPppDashboardCardProps {
  user: User;
  className?: string;
  featureEnabled?: boolean;
}

function LevelBadge({ certified }: { certified: boolean }) {
  if (certified) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/70 bg-gradient-to-br from-slate-950 to-black text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
        <Medal className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-300">
      <Briefcase className="h-6 w-6" />
    </div>
  );
}

export function SaasPppDashboardCard({ user, className, featureEnabled }: SaasPppDashboardCardProps) {
  const state = normalizeSaasPppUserState(user);
  const enabled = featureEnabled ?? state.enabled;
  if (!enabled) return null;

  const certified = !!state.certifiedTimestamp;
  const levelLabel = certified ? 'LVL 5 Certified' : `LVL ${state.currentLevel}`;
  const levelContext = certified
    ? 'Certification complete'
    : getSaasPppLevelTitle(state.currentLevel);

  return (
    <Card className={cn('flex flex-col justify-between border border-border bg-card/95 p-6', className)}>
      <CardHeader className="p-0 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl text-foreground">PPP - SaaS Edition</CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">Strategic Sales Certification</CardDescription>
            <p className="mt-1 text-xs text-muted-foreground">{levelContext}</p>
          </div>
          <LevelBadge certified={certified} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{levelLabel}</p>
          <p className="text-xs text-muted-foreground">{state.currentLevelProgress}% complete</p>
        </div>
        <Progress
          value={state.currentLevelProgress}
          className="h-3 border border-border bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-400"
        />
        <Button asChild className="w-full bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
          <Link href="/ppp-saas">
            Enter SaaS PPP
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
