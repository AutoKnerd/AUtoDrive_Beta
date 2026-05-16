'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

const loginThemeStyle = {
  '--background': '35 25% 8%',
  '--foreground': '48 39% 88%',
  '--card': '35 18% 11%',
  '--card-foreground': '48 39% 88%',
  '--popover': '35 18% 11%',
  '--popover-foreground': '48 39% 88%',
  '--primary': '94 69% 44%',
  '--primary-foreground': '35 30% 7%',
  '--secondary': '35 12% 18%',
  '--secondary-foreground': '48 39% 88%',
  '--muted': '35 10% 16%',
  '--muted-foreground': '46 24% 74%',
  '--accent': '44 31% 84%',
  '--accent-foreground': '35 30% 7%',
  '--border': '94 55% 30%',
  '--input': '35 10% 18%',
  '--ring': '94 69% 44%',
} as CSSProperties;

type LoginSurfaceProps = {
  homeHref?: string;
  homeAriaLabel?: string;
};

export function LoginSurface({
  homeHref = '/Autoknerd',
  homeAriaLabel = 'Go to AutoKnerd homepage',
}: LoginSurfaceProps) {
  return (
    <main
      style={loginThemeStyle}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[hsl(var(--background))] px-4 py-10 text-[hsl(var(--foreground))]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(117,191,36,0.3),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(232,226,206,0.14),_transparent_32%),linear-gradient(135deg,_rgba(0,0,0,0.94),_rgba(23,21,14,0.92))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,_rgba(117,191,36,0.2),_transparent)]" />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center">
          <Link href={homeHref} aria-label={homeAriaLabel}>
            <Image
              src="/AutoKnerd Logo.png"
              alt="Autoknerd"
              width={610}
              height={203}
              className="h-auto w-full max-w-[340px] drop-shadow-[0_16px_40px_rgba(117,191,36,0.18)]"
              priority
            />
          </Link>
        </div>
        <LoginForm />
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-black/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-3">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[rgba(232,226,206,0.08)] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[rgba(117,191,36,0.14)]"
            >
              Sign up for Pro plan
            </Link>
            <p className="px-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
              New here? Create your account and start your subscription.
            </p>
          </div>
          <div className="text-center">
            <p className="mt-4 px-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Have an invitation? Use the unique link from your email to register your account.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
