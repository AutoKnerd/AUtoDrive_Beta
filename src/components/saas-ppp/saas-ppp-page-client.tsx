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
import { SaasPppInterface } from '@/components/saas-ppp/saas-ppp-interface';
import { getSaasPppAccessForUser } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';

export function SaasPppPageClient() {
  const { user, loading, isTouring } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [featureEnabled, setFeatureEnabled] = useState(false);
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
        const enabled = await getSaasPppAccessForUser(user);
        if (!active) return;
        setFeatureEnabled(enabled === true);
      } catch (error: any) {
        if (!active) return;
        setFeatureEnabled(false);
        toast({
          variant: 'destructive',
          title: 'SaaS PPP status unavailable',
          description: error?.message || 'Could not verify SaaS PPP access for your dealership.',
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
            <h1 className="text-2xl font-bold text-foreground">PPP - SaaS Edition</h1>
            <p className="text-sm text-muted-foreground">
              Strategic Sales Certification with private, mastery-based progression.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {featureEnabled ? (
          <SaasPppInterface featureEnabled={featureEnabled} />
        ) : (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>SaaS PPP is currently disabled</AlertTitle>
            <AlertDescription>
              This module is off for your dealership. Core AutoDrive training remains unchanged.
            </AlertDescription>
          </Alert>
        )}
      </main>
      {!isManager && !isTouring && <BottomNav />}
    </div>
  );
}
