'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import Link from 'next/link';

import { useAuth as useFirebaseAuth } from '@/firebase';
import { Logo } from '@/components/layout/logo';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

function formatResetError(error: any): string {
  const code = error?.code || '';
  if (code === 'auth/invalid-action-code') return 'This setup link is invalid or already used. Request a new setup link.';
  if (code === 'auth/expired-action-code') return 'This setup link expired. Request a new setup link.';
  if (code === 'auth/weak-password') return 'Password is too weak. Use at least 8 characters.';
  return error?.message || 'Unable to set password. Please request a new setup link.';
}

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firebaseAuth = useFirebaseAuth();

  const oobCode = useMemo(() => searchParams.get('oobCode') || '', [searchParams]);
  const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'submitting' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    if (!oobCode) {
      setStatus('error');
      setMessage('Missing setup code. Request a new setup link.');
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const resolvedEmail = await verifyPasswordResetCode(firebaseAuth, oobCode);
        if (!active) return;
        setEmail(resolvedEmail || initialEmail);
        setStatus('ready');
      } catch (error: any) {
        if (!active) return;
        setStatus('error');
        setMessage(formatResetError(error));
      }
    })();

    return () => {
      active = false;
    };
  }, [firebaseAuth, initialEmail, oobCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      await confirmPasswordReset(firebaseAuth, oobCode, password);
      setStatus('success');
      setMessage('Password set. Redirecting to login...');
      window.setTimeout(() => {
        router.replace('/login');
      }, 900);
    } catch (error: any) {
      setStatus('error');
      setMessage(formatResetError(error));
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
            <CardTitle className="text-center text-xl font-semibold tracking-tight">Set Your Password</CardTitle>
            <CardDescription className="text-center">
              Complete first-time setup, then sign in.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {status === 'checking' && (
              <div className="flex items-center justify-center py-4">
                <Spinner size="md" />
              </div>
            )}

            {email && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Account: <span className="font-medium text-foreground">{email}</span>
              </div>
            )}

            {status === 'ready' || status === 'submitting' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={status === 'submitting'}
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
                    disabled={status === 'submitting'}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={status === 'submitting'}>
                  {status === 'submitting' ? <Spinner size="sm" /> : 'Save Password'}
                </Button>
              </form>
            ) : null}

            {status === 'error' && (
              <Alert variant="destructive">
                <AlertTitle>Setup Failed</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {status === 'success' && (
              <Alert>
                <AlertTitle>Password Saved</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
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
                <CardTitle className="text-center text-xl font-semibold tracking-tight">Set Your Password</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-6">
                <Spinner size="md" />
              </CardContent>
            </Card>
          </div>
        </main>
      }
    >
      <SetPasswordContent />
    </Suspense>
  );
}
