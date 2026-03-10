'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function normalizeConsultant(value: string | null): string {
  return (value || '').trim().toLowerCase();
}

export default function DemoPage() {
  const [consultant, setConsultant] = useState('');

  const signupHref = useMemo(() => {
    if (!consultant) return '/signup';
    return `/signup?consultant=${encodeURIComponent(consultant)}`;
  }, [consultant]);

  useEffect(() => {
    const fromUrl = normalizeConsultant(new URLSearchParams(window.location.search).get('consultant'));
    setConsultant(fromUrl);
  }, []);

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
