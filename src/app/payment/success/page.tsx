'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { getUserById } from '@/lib/data.client';
import { finalizeCheckoutSession } from '@/app/actions/stripe';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FinalizeState = 'processing' | 'ready' | 'pending' | 'error';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PaymentSuccessPage() {
  const { setUser } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const [sessionId, setSessionId] = useState('');
  const [state, setState] = useState<FinalizeState>('processing');
  const [message, setMessage] = useState('Finalizing billing access...');
  const [syncAttempt, setSyncAttempt] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get('session_id') || '');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!sessionId) {
        if (!cancelled) {
          setState('error');
          setMessage('Missing checkout session. Please return to billing setup and try checkout again.');
        }
        return;
      }

      const firebaseUser = firebaseAuth.currentUser;
      if (!firebaseUser) {
        if (!cancelled) {
          setState('error');
          setMessage('Your session expired. Please sign in again.');
        }
        return;
      }

      try {
        if (!cancelled) {
          setState('processing');
          setMessage('Finalizing billing access...');
        }
        const idToken = await firebaseUser.getIdToken(true);
        await finalizeCheckoutSession(idToken, sessionId);
      } catch (error) {
        console.error('[PaymentSuccess] finalizeCheckoutSession failed', error);
        if (!cancelled) {
          setState('error');
          setMessage('Could not verify checkout yet. Retry sync in a moment.');
        }
        return;
      }

      // Refresh profile state; AuthProvider does not auto-resubscribe to profile document changes.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const refreshed = await getUserById(firebaseUser.uid);
        if (cancelled) return;

        if (refreshed) {
          setUser(refreshed);
          const hasDealershipCoverage = Array.isArray(refreshed.dealershipIds) && refreshed.dealershipIds.length > 0;
          const hasIndividualAccess = refreshed.subscriptionStatus && refreshed.subscriptionStatus !== 'inactive';
          if (hasDealershipCoverage || hasIndividualAccess) {
            setState('ready');
            setMessage('Billing setup confirmed. You can continue to your dashboard.');
            return;
          }
        }

        await sleep(1000);
      }

      if (!cancelled) {
        setState('pending');
        setMessage('Billing confirmation is still processing. Try dashboard again in a few seconds.');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [firebaseAuth, sessionId, setUser, syncAttempt]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="mt-4 text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {state === 'ready' ? (
            <Button asChild className="w-full">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          ) : (
            <Button className="w-full" disabled>
              {state === 'processing' ? 'Finalizing Access...' : 'Waiting for Billing Confirmation...'}
            </Button>
          )}
          {(state === 'pending' || state === 'error') ? (
            <>
              <Button variant="outline" className="w-full" onClick={() => setSyncAttempt((value) => value + 1)}>
                Retry Billing Sync
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/subscribe">Go to Billing Setup</Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
