
'use client';

import { SignupForm } from '@/components/auth/signup-form';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center">
          <Logo variant="full" width={610} height={203} />
        </div>
        <SignupForm />
        <div className="text-center">
             <p className="mt-2 px-8 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Button asChild variant="link" className="px-1">
                    <Link href="/login">Sign In</Link>
                </Button>
            </p>
        </div>
      </div>
    </main>
  );
}
