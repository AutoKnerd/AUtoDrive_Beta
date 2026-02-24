'use client';

import Link from 'next/link';
import { Shield, ShieldCheck, Medal, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/definitions';
import { normalizePppUserState } from '@/lib/ppp/state';
import { getPppLevelTitle } from '@/lib/ppp/definitions';

interface PppDashboardCardProps {
  user: User;
  className?: string;
  featureEnabled?: boolean;
}

function LevelBadge({ level, certified }: { level: number; certified: boolean }) {
  if (certified) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/70 bg-gradient-to-br from-slate-950 to-black text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.35)]">
        <Medal className="h-6 w-6" />
      </div>
    );
  }

  if (level >= 8) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
        <ShieldCheck className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary">
      <Shield className="h-6 w-6" />
    </div>
  );
}

export function PppDashboardCard({ user, className, featureEnabled }: PppDashboardCardProps) {
  const ppp = normalizePppUserState(user);
  const enabled = featureEnabled ?? ppp.enabled;
  if (!enabled) return null;

  const levelLabel = ppp.certified ? 'LVL 10 Certified' : `LVL ${ppp.level}`;
  const subtitle = ppp.certified
    ? 'Institutional Mastery complete.'
    : `${getPppLevelTitle(ppp.level)}`;

  return (
    <Card className={cn('flex flex-col justify-between border border-border bg-card/95 p-6', className)}>
      <CardHeader className="p-0 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl text-foreground">Profit Protection Protocol</CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">{subtitle}</CardDescription>
          </div>
          <LevelBadge level={ppp.level} certified={ppp.certified} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{levelLabel}</p>
          <p className="text-xs text-muted-foreground">{ppp.progressPercentage}% complete</p>
        </div>
        <Progress
          value={ppp.progressPercentage}
          className="h-3 border border-border bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-blue-500"
        />
        <Button asChild className="w-full font-semibold">
          <Link href="/ppp">
            Enter PPP
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
