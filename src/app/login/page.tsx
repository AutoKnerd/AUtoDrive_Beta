'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginSurface } from '@/components/auth/login-surface';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const resolvePostLoginPath = (): string => {
    const requested = searchParams.get('next')?.trim();
    if (!requested) return '/';
    if (!requested.startsWith('/') || requested.startsWith('//')) return '/';
    return requested;
  };

  useEffect(() => {
    if (!loading && user) {
      router.push(resolvePostLoginPath());
    }
  }, [user, loading, router, searchParams]);

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent">
        <Spinner size="lg" />
      </div>
    );
  }

  return <LoginSurface />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex h-screen w-full items-center justify-center bg-transparent">
          <Spinner size="lg" />
        </div>
      )}
    >
      <LoginPageContent />
    </Suspense>
  );
}
