import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/layout/logo';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4">
                <Logo variant="full" width={423} height={141} />
            </div>
            <p className="mt-4 text-muted-foreground">Sign in to your account</p>
        </div>
        <LoginForm />
        <p className="mt-4 px-8 text-center text-sm text-muted-foreground">
          Have an invitation code?{' '}
          <Link
            href="/register"
            className="underline underline-offset-4 hover:text-primary"
          >
            Activate Your Account
          </Link>
        </p>
      </div>
    </main>
  );
}
