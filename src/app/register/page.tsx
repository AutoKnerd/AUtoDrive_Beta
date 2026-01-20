import { RegisterForm } from '@/components/auth/register-form';
import { Logo } from '@/components/layout/logo';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4">
                <Logo variant="full" width={423} height={141} />
            </div>
            <p className="mt-4 text-muted-foreground">Activate your account</p>
        </div>
        <RegisterForm />
         <p className="mt-4 px-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-primary"
          >
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
