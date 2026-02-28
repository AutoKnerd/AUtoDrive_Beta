
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RegisterForm } from '@/components/auth/register-form';
import { Logo } from '@/components/layout/logo';
import { EmailInvitation } from '@/lib/definitions';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [invitation, setInvitation] = useState<EmailInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided. Please use the link from your invitation email.');
      setLoading(false);
      return;
    }

    async function validateToken() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const raw = await response.text();
        const payload = raw ? JSON.parse(raw) : {};

        if (response.ok) {
          setInvitation(payload as EmailInvitation);
        } else {
          setError(payload?.message || 'This invitation is invalid or has expired.');
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setError('Invitation validation timed out. Please refresh and try again.');
        } else {
          setError('Could not validate your invitation. Please try again later.');
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground">Validating your invitation...</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
            <AlertCircle className="h-10 w-10 text-destructive"/>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild variant="outline" className="w-full">
                <Link href="/login">Return to Login</Link>
            </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center justify-center text-center">
        <div className="mb-4">
          <Logo variant="full" width={610} height={203} />
        </div>
        <p className="text-muted-foreground">
          You've been invited to join <strong>{invitation.dealershipName}</strong> as a <strong>{invitation.role}</strong>.
          <br/>
          Create your account to get started.
        </p>
      </div>
      <RegisterForm invitation={invitation} />
    </div>
  );
}


export default function RegisterPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Suspense fallback={<Spinner size="lg" />}>
                <RegisterPageContent />
            </Suspense>
        </main>
    );
}
