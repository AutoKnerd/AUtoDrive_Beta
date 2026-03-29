'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/layout/logo';
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
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center">
            <Logo variant="full" width={610} height={203} />
        </div>
        <LoginForm />
        <div className="flex flex-col gap-3">
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
              Sign up for Pro plan
          </Link>
          <p className="px-2 text-center text-xs text-muted-foreground">
            New here? Create your account and start your subscription.
          </p>
        </div>
        <div className="text-center">
             <p className="mt-4 px-8 text-center text-sm text-muted-foreground">
                Have an invitation? Use the unique link from your email to register your account.
            </p>
        </div>
      </div>
    </main>
  );
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
