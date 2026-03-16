'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

function normalizeConsultant(value: string | null): string {
  return (value || '').trim().toLowerCase();
}

export default function DemoPage() {
  const [consultant, setConsultant] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const { login } = useAuth();

  const signupHref = useMemo(() => {
    if (!consultant) return '/signup';
    return `/join/${encodeURIComponent(consultant)}`;
  }, [consultant]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromQuery = normalizeConsultant(searchParams.get('consultant'));
    const fromPath = normalizeConsultant(pathname.startsWith('/demo/') ? pathname.slice('/demo/'.length) : '');
    const fromTourStorage = normalizeConsultant(localStorage.getItem('tourConsultant'));
    const resolved = fromPath || fromQuery || fromTourStorage;
    const shouldStartTour = ['1', 'true', 'yes'].includes((searchParams.get('tour') || '').trim().toLowerCase());

    setConsultant(resolved);

    if (shouldStartTour) {
      if (resolved) {
        localStorage.setItem('tourConsultant', resolved);
        localStorage.setItem('consultant_referral', resolved);
      }
      localStorage.setItem('tourMode', 'true');
    }
  }, [pathname]);

  useEffect(() => {
    if (localStorage.getItem('tourMode') !== 'true') return;

    const tourConsultant = normalizeConsultant(localStorage.getItem('tourConsultant'));
    if (tourConsultant) {
      localStorage.setItem('consultant_referral', tourConsultant);
    }

    // Force guided tour to open when the demo dashboard loads.
    localStorage.removeItem('sprocketTourComplete');
    localStorage.removeItem('sprocketTourComplete_tour-consultant');
    localStorage.setItem('sprocketTourStep_tour-consultant', '0');
    sessionStorage.removeItem('tourWelcomeSeen_Sales Consultant');

    void (async () => {
      try {
        await login('consultant.demo@autodrive.com', 'readyplayer1');
        router.replace('/');
      } finally {
        localStorage.removeItem('tourMode');
      }
    })();
  }, [login, router]);

  useEffect(() => {
    if (!consultant) return;

    localStorage.setItem('consultant_referral', consultant);

    const key = `demo_visit_logged:${consultant}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    void fetch('/api/consultant-marketing-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        consultant_id: consultant,
        event_type: 'demo_visit',
        source: 'demo_page_view',
      }),
    });
  }, [consultant]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
          <CardHeader>
            <CardTitle className="text-2xl text-cyan-200">AutoDriveCX Demo</CardTitle>
            <CardDescription className="text-slate-300">
              Preview AutoDriveCX and start your dealer trial when ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-200">
              Consultant referral: <span className="font-semibold">{consultant || 'none'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={signupHref}>Start Dealer Signup</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/signup">Open Signup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
