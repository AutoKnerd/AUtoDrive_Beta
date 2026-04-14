'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Shield, User } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { resolveConsultant, setAttribution, touchAttribution } from '@/lib/consultant-referral';

export default function TourConsultantLauncherPage() {
  const params = useParams<{ consultantId: string }>();
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isTouring, setIsTouring] = useState(false);
  const consultantId = useMemo(() => {
    const resolved = resolveConsultant(params.consultantId || '');
    return resolved ? resolved.code : '';
  }, [params.consultantId]);

  useEffect(() => {
    if (consultantId) {
      localStorage.setItem('tourConsultant', consultantId);
      setAttribution({
        consultant_id: consultantId,
        engagement_type: 'weak',
        engagement_event: 'page_visit',
        timestamp: Date.now(),
      });
    }
  }, [consultantId]);

  async function startTour(role: 'consultant' | 'manager') {
    setIsTouring(true);
    localStorage.setItem('tourMode', 'true');
    touchAttribution('medium', 'tour_started');

    const email = role === 'consultant' ? 'consultant.demo@autodrive.com' : 'manager.demo@autodrive.com';
    const roleName = role === 'consultant' ? 'Team Member' : 'Leader';

    try {
      await login(email, 'readyplayer1');
      toast({
        title: 'Tour Started',
        description: `Launching ${roleName} guided demo...`,
      });
      router.replace('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Tour Failed',
        description: (error as Error).message || 'Could not start guided demo.',
      });
      localStorage.removeItem('tourMode');
      setIsTouring(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center p-4 md:p-6 lg:p-8">
        <Card className="w-full border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
          <CardHeader>
            <CardTitle className="text-2xl text-cyan-200">Choose Your Tour Perspective</CardTitle>
            <CardDescription className="text-slate-300">
              Select a role to experience how AutoDriveCX empowers every member of your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              Referral consultant: <span className="font-semibold text-slate-100">{consultantId || 'none'}</span>
            </p>
            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="group flex h-full min-h-[15rem] w-full flex-col items-start justify-between whitespace-normal rounded-2xl border-cyan-400/20 bg-slate-950/60 p-5 text-left shadow-[0_0_0_1px_rgba(34,211,238,0.08)] transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900/90 hover:shadow-[0_0_28px_rgba(34,211,238,0.16)] focus-visible:ring-cyan-400/40"
                onClick={() => void startTour('consultant')}
                disabled={isTouring}
              >
                <div className="flex w-full flex-col gap-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 transition-colors group-hover:border-cyan-300/40 group-hover:bg-cyan-300/15">
                      <User className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Team Member</p>
                      <h3 className="text-base font-semibold text-slate-50">Consultant View</h3>
                    </div>
                  </div>
                  <p className="min-w-0 max-w-full text-sm leading-relaxed whitespace-normal break-words text-slate-300">
                    Explore as a Sales Consultant or Service Writer. Focus on personal growth and mastering customer interactions.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors group-hover:text-cyan-100">
                    Start Tour
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="group flex h-full min-h-[15rem] w-full flex-col items-start justify-between whitespace-normal rounded-2xl border-cyan-400/20 bg-slate-950/60 p-5 text-left shadow-[0_0_0_1px_rgba(34,211,238,0.08)] transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900/90 hover:shadow-[0_0_28px_rgba(34,211,238,0.16)] focus-visible:ring-cyan-400/40"
                onClick={() => void startTour('manager')}
                disabled={isTouring}
              >
                <div className="flex w-full flex-col gap-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 transition-colors group-hover:border-cyan-300/40 group-hover:bg-cyan-300/15">
                      <Shield className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Leader</p>
                      <h3 className="text-base font-semibold text-slate-50">Manager View</h3>
                    </div>
                  </div>
                  <p className="min-w-0 max-w-full text-sm leading-relaxed whitespace-normal break-words text-slate-300">
                    View as a Manager or Owner. See high-level insights to coach your team effectively.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors group-hover:text-cyan-100">
                    Start Tour
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Button>
            </div>
            {isTouring && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Spinner size="sm" />
                Starting guided demo...
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
