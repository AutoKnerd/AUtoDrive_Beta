'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function SubscribePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Note: subscription gating will be moved to Stripe entitlements/webhook.
    // Keeping this page accessible so users can manage billing.
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-3xl">AutoDrive Beta</CardTitle>
            <CardDescription>
              Billing is temporarily disabled while we validate the beta with a few stores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What you can do right now:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Complete lessons and track progress</li>
                <li>Invite your team using share links (email invites coming back soon)</li>
                <li>Use dashboards and reporting during the pilot</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              If you were expecting a checkout flow, you’re not crazy — it’s just paused.
            </p>
          </CardContent>
          <CardFooter>
            <a
              href="/"
              className="w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Back to Dashboard
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
