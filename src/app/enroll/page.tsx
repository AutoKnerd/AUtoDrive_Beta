'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { EnrollmentForm } from '@/components/auth/enrollment-form';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { getEnrollmentLinkByToken, type EnrollmentLinkPreview } from '@/lib/data.client';
import type { UserRole } from '@/lib/definitions';

function formatRole(role: UserRole): string {
  return role === 'manager' ? 'Sales Manager' : role;
}

function EnrollmentPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [enrollment, setEnrollment] = useState<EnrollmentLinkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('No enrollment token was provided.');
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const payload = await getEnrollmentLinkByToken(token);
        if (mounted) setEnrollment(payload);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'This enrollment link is invalid or expired.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground">Preparing enrollment...</p>
      </div>
    );
  }

  if (!enrollment || error) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <CardTitle>Enrollment Error</CardTitle>
          <CardDescription>{error || 'This enrollment link is unavailable.'}</CardDescription>
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
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <div className="mb-4 flex justify-center">
          <Logo variant="full" width={610} height={203} />
        </div>
        <p className="text-muted-foreground">
          Join <strong>{enrollment.dealershipName}</strong> on AutoDrive.
          <br />
          Select your role and complete your account setup.
        </p>
        <p className="text-xs text-muted-foreground">
          Available roles: {enrollment.allowedRoles.map(formatRole).join(', ')}
        </p>
      </div>
      <EnrollmentForm enrollment={enrollment} />
    </div>
  );
}

export default function EnrollmentPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Suspense fallback={<Spinner size="lg" />}>
        <EnrollmentPageContent />
      </Suspense>
    </main>
  );
}
