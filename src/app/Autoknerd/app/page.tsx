'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { AUTOKNERD_APP_EMBED_URL } from '@/lib/autoknerd-app';

const signupCardStyle = {
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

export default function AutoknerdAppPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(117,191,36,0.18),_transparent_28%),linear-gradient(180deg,_rgba(5,5,4,0.98),_rgba(12,12,10,0.98))] px-2 py-2 text-[hsl(var(--foreground))] md:px-4 md:py-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,_rgba(117,191,36,0.16),_transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-28 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[#bdfc00]/10 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
        <section className="w-full">
          <div className="relative overflow-hidden rounded-[0.95rem] border border-white/5 bg-[radial-gradient(circle_at_top,_rgba(117,191,36,0.22),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(117,191,36,0.08),_transparent_38%),linear-gradient(180deg,_rgba(4,4,4,0.97),_rgba(9,9,8,0.99))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(117,191,36,0.13),_transparent_54%)]" />
            <iframe
              src={AUTOKNERD_APP_EMBED_URL}
              title="AutoKnerd app"
              className="relative h-[92svh] min-h-[860px] w-full border-0 bg-transparent md:h-[92svh]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        <section
          style={signupCardStyle}
          className="mx-auto w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-black/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        >
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
        </section>
      </div>
    </main>
  );
}
