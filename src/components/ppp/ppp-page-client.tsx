'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { managerialRoles } from '@/lib/definitions';
import { PppInterface } from '@/components/ppp/ppp-interface';
import { getPppAccessForUser } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';

export function PppPageClient() {
  const { user, loading, isTouring } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [pppFeatureEnabled, setPppFeatureEnabled] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    let active = true;

    async function loadFeatureState() {
      if (!user) return;
      setConfigLoading(true);
      try {
        const enabled = await getPppAccessForUser(user);
        if (!active) return;
        setPppFeatureEnabled(enabled === true);
      } catch (error: any) {
        if (!active) return;
        setPppFeatureEnabled(false);
        toast({
          variant: 'destructive',
          title: 'PPP status unavailable',
          description: error?.message || 'Could not verify PPP access for your dealership.',
        });
      } finally {
        if (active) setConfigLoading(false);
      }
    }

    if (!loading && user) {
      loadFeatureState();
    }

    return () => {
      active = false;
    };
  }, [loading, user, toast]);

  if (loading || !user || configLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  const isManager = managerialRoles.includes(user.role);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 pb-24 md:p-8 md:pb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AutoKnerd: The Next Gear</h1>
            <p className="text-sm text-muted-foreground">
              Mastery-based certification with role-adaptive coaching and pass-first progression.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {pppFeatureEnabled ? (
          <PppInterface featureEnabled={pppFeatureEnabled} />
        ) : (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>PPP is currently disabled</AlertTitle>
            <AlertDescription>
              This module is off right now. Your core AutoDrive training remains unchanged.
            </AlertDescription>
          </Alert>
        )}
      </main>
      {!isManager && !isTouring && <BottomNav />}
    </div>
  );
}
