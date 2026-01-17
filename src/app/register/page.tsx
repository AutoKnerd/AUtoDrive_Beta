import { RegisterForm } from '@/components/auth/register-form';
import { Cog } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Cog className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">AutoDrive</h1>
              <p className="text-sm font-medium text-muted-foreground">powered by AutoKnerd</p>
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
