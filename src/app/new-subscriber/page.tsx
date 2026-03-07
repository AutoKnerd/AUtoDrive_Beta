'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import { useAuth as useFirebaseAuth } from '@/firebase';
import { createUserProfile } from '@/lib/data.client';
import { claimCheckoutFirstSubscriber } from '@/app/actions/stripe';
import { Logo } from '@/components/layout/logo';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

type SetupState = 'ready' | 'submitting' | 'success' | 'error';

function NewSubscriberContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firebaseAuth = useFirebaseAuth();
  const sessionId = useMemo(() => searchParams.get('session_id') || '', [searchParams]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<SetupState>('ready');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionId) {
      setState('error');
      setMessage('Missing checkout session. Please contact support with your Stripe receipt.');
      return;
    }

    if (name.trim().length < 2) {
      setState('error');
      setMessage('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setState('error');
      setMessage('Please enter your email.');
      return;
    }

    if (password.length < 8) {
      setState('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setState('error');
      setMessage('Passwords do not match.');
      return;
    }

    setState('submitting');
    setMessage('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);

      await createUserProfile(
        cred.user.uid,
        name.trim(),
        normalizedEmail,
        'Sales Consultant',
        [],
      );

      const idToken = await cred.user.getIdToken(true);
      await claimCheckoutFirstSubscriber(idToken, sessionId);

      setState('success');
      setMessage('Account created and subscription connected. Redirecting to your dashboard...');
      window.setTimeout(() => {
        router.replace('/');
      }, 900);
    } catch (error: any) {
      console.error('[new-subscriber] setup failed', error);
      setState('error');
      setMessage(error?.message || 'Could not complete your setup. Please try again.');
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center">
          <Logo variant="full" width={610} height={203} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold tracking-tight">Finish Account Setup</CardTitle>
            <CardDescription className="text-center">
              You completed checkout. Create your login credentials to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={state === 'submitting'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={state === 'submitting'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={state === 'submitting'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={state === 'submitting'}
                />
              </div>
              <Button type="submit" className="w-full" disabled={state === 'submitting'}>
                {state === 'submitting' ? <Spinner size="sm" /> : 'Create Account'}
              </Button>
            </form>

            {state === 'error' && (
              <Alert variant="destructive">
                <AlertTitle>Setup Failed</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {state === 'success' && (
              <Alert>
                <AlertTitle>Setup Complete</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full" disabled={state === 'submitting'}>
              <Link href="/login">I already have an account</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

export default function NewSubscriberPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-8">
            <div className="flex flex-col items-center">
              <Logo variant="full" width={610} height={203} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-xl font-semibold tracking-tight">Finish Account Setup</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-6">
                <Spinner size="md" />
              </CardContent>
            </Card>
          </div>
        </main>
      }
    >
      <NewSubscriberContent />
    </Suspense>
  );
}
