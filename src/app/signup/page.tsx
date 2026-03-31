
'use client';

import { Suspense, type CSSProperties } from 'react';
import Image from 'next/image';
import { SignupForm } from '@/components/auth/signup-form';

const signupThemeStyle = {
  '--background': '40 18% 92%',
  '--foreground': '35 30% 10%',
  '--card': '40 12% 95%',
  '--card-foreground': '35 30% 10%',
  '--primary': '94 69% 44%',
  '--primary-foreground': '35 30% 7%',
  '--muted': '38 11% 86%',
  '--muted-foreground': '34 15% 34%',
  '--accent': '44 31% 84%',
  '--border': '38 12% 74%',
  '--ring': '94 69% 44%',
} as CSSProperties;

export default function SignupPage() {
  return (
    <main
      style={signupThemeStyle}
      className="relative isolate min-h-screen overflow-hidden bg-[hsl(var(--background))] px-3 py-6 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[hsl(var(--foreground))] sm:px-6 sm:py-10 lg:px-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(117,191,36,0.14),transparent_28%),radial-gradient(circle_at_92%_4%,rgba(232,226,206,0.34),transparent_22%),linear-gradient(180deg,rgba(239,236,228,1),rgba(231,227,217,1))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(45,42,30,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(45,42,30,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(circle_at_center,black,transparent_74%)]"
      />

      <div className="mx-auto grid w-full max-w-6xl gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[rgba(239,236,230,0.86)] p-3 shadow-[0_30px_90px_rgba(66,53,27,0.1)] backdrop-blur-xl md:grid-cols-[0.95fr_1.05fr] md:gap-8 md:rounded-3xl md:p-8">
        <section className="order-2 space-y-3 md:order-2 md:space-y-4">
          <div className="rounded-2xl md:border md:border-[hsl(var(--border))] md:bg-[rgba(236,233,227,0.92)] md:p-1">
            <Suspense fallback={<div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">Loading signup form...</div>}>
              <SignupForm />
            </Suspense>
          </div>
        </section>

        <section className="order-1 flex flex-col gap-5 rounded-2xl p-2 text-[hsl(var(--foreground))] md:order-1 md:rounded-2xl md:border md:border-[hsl(var(--border))] md:bg-[rgba(244,241,235,0.74)] md:p-7">
          <div className="space-y-4">
            <div className="w-fit rounded-full border border-[hsl(var(--border))] bg-[rgba(117,191,36,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--foreground))]">
              AutoDriveCX Individual
            </div>
            <Image
              src="/AutoKnerd Logo.png"
              alt="Autoknerd"
              width={1078}
              height={461}
              className="h-auto w-auto max-w-[300px]"
              priority
            />
            <h1 className="text-balance text-2xl font-semibold leading-tight text-[hsl(var(--foreground))] sm:text-3xl">
              Start your Individual plan free for 30 days.
            </h1>
            <p className="max-w-xl text-sm text-[hsl(var(--muted-foreground))] sm:text-base">
              Get practical conversation training, real-time support during customer interactions, and reinforcement tools that help turn better practice into stronger performance.
            </p>
          </div>

          <details className="-mx-2 group md:hidden">
            <summary className="mx-auto w-fit cursor-pointer list-none rounded-xl border border-[hsl(var(--border))] bg-[rgba(117,191,36,0.12)] px-3 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-[hsl(var(--foreground))] shadow-[0_10px_30px_-18px_rgba(117,191,36,0.35)] transition-all hover:bg-[rgba(117,191,36,0.18)] active:scale-[0.99]">
              Who it&apos;s for + what you get
            </summary>
            <div className="mt-4 space-y-5 border-t border-[hsl(var(--border))] pt-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground))]">Who this is for</p>
                <ul className="flex flex-wrap gap-2 text-sm text-[hsl(var(--foreground))]">
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Sales Consultants</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Service Advisors</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">BDC Professionals</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Parts Consultants</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Sales Managers</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Service & Parts Managers</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">General Managers</li>
                  <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">F&amp;I Directors</li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground))]">What you get</p>
                <div className="grid gap-2">
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-3">
                    <Image src="/AutoDriveCXLogo030625.png" alt="AutoDriveCX" width={180} height={50} className="h-auto w-auto max-w-[150px]" />
                    <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                      AutoDriveCX helps you build stronger customer conversations with practical training that sharpens trust, listening, empathy, and day-to-day execution.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-3">
                    <Image src="/Autoshop logo.png" alt="AutoShop" width={180} height={50} className="h-auto w-auto max-w-[150px]" />
                    <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                      AutoShop gives you real-time support during live customer interactions, with better wording, clearer next steps, and guidance you can use on the spot.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-3">
                    <Image src="/AutoForge logo.png" alt="AutoForge" width={180} height={50} className="h-auto w-auto max-w-[150px]" />
                    <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                      AutoForge helps turn improvement into consistency with reinforcement tools that support follow-through, accountability, and stronger execution over time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="hidden space-y-3 border-t border-[hsl(var(--border))] pt-5 md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground))]">Who this is for</p>
            <ul className="flex flex-wrap gap-2 text-sm text-[hsl(var(--foreground))]">
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Sales Consultants</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Service Advisors</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">BDC Professionals</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Parts Consultants</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Sales Managers</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">Service & Parts Managers</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">General Managers</li>
              <li className="rounded-full border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-1.5">F&amp;I Directors</li>
            </ul>
          </div>

          <div className="hidden space-y-3 border-t border-[hsl(var(--border))] pt-5 md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground))]">What you get</p>
            <div className="grid gap-3">
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-3">
                <Image src="/AutoDriveCXLogo030625.png" alt="AutoDriveCX" width={180} height={50} className="h-auto w-auto max-w-[150px]" />
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  AutoDriveCX helps you build stronger customer conversations with practical training that sharpens trust, listening, empathy, and day-to-day execution.
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-3">
                <Image src="/Autoshop logo.png" alt="AutoShop" width={180} height={50} className="h-auto w-auto max-w-[150px]" />
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  AutoShop gives you real-time support during live customer interactions, with better wording, clearer next steps, and guidance you can use on the spot.
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[rgba(248,246,241,0.82)] px-3 py-3">
                <Image src="/AutoForge logo.png" alt="AutoForge" width={180} height={50} className="h-auto w-auto max-w-[150px]" />
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  AutoForge helps turn improvement into consistency with reinforcement tools that support follow-through, accountability, and stronger execution over time.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
