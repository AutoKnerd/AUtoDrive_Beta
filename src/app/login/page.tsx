
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/layout/logo';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';


export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);
  
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
        <div className="text-center">
             <p className="mt-4 px-8 text-center text-sm text-muted-foreground">
                Have an invitation? Use the unique link from your email to register your account.
            </p>
        </div>
      </div>
    </main>
  );
}
