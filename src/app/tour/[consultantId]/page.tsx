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

function normalizeConsultant(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export default function TourConsultantLauncherPage() {
  const params = useParams<{ consultantId: string }>();
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isTouring, setIsTouring] = useState(false);
  const consultantId = useMemo(() => normalizeConsultant(params.consultantId), [params.consultantId]);

  useEffect(() => {
    if (consultantId) {
      localStorage.setItem('tourConsultant', consultantId);
      localStorage.setItem('consultant_referral', consultantId);
    }
  }, [consultantId]);

  async function startTour(role: 'consultant' | 'manager') {
    setIsTouring(true);
    localStorage.setItem('tourMode', 'true');

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto items-start justify-start p-6"
                onClick={() => void startTour('consultant')}
                disabled={isTouring}
              >
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Team Member</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Explore as a Sales Consultant or Service Writer. Focus on personal growth and mastering customer interactions.
                  </p>
                  <div className="flex items-center text-sm font-semibold text-primary">
                    Start Tour <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto items-start justify-start p-6"
                onClick={() => void startTour('manager')}
                disabled={isTouring}
              >
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Leader</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View as a Manager or Owner. See high-level insights to coach your team effectively.
                  </p>
                  <div className="flex items-center text-sm font-semibold text-primary">
                    Start Tour <ArrowRight className="ml-2 h-4 w-4" />
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
