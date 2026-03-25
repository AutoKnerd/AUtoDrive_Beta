
'use client';

import { SignupForm } from '@/components/auth/signup-form';
import { Logo } from '@/components/layout/logo';

export default function SignupPage() {
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? 'local';

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-3 py-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-10 lg:px-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_18%,hsl(197_83%_50%/.24),transparent_36%),radial-gradient(circle_at_82%_6%,hsl(164_80%_42%/.16),transparent_32%),linear-gradient(180deg,hsl(224_67%_8%),hsl(224_52%_6%))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(hsl(0_0%_100%/.045)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/.045)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(circle_at_center,black,transparent_74%)]"
      />

      <div className="mx-auto grid w-full max-w-6xl gap-4 rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-xl md:grid-cols-[0.95fr_1.05fr] md:gap-8 md:rounded-3xl md:p-8">
        <section className="order-2 space-y-3 md:order-2 md:space-y-4">
          <div className="rounded-2xl md:border md:border-white/10 md:bg-slate-950/70 md:p-1">
            <SignupForm />
          </div>
        </section>

        <section className="order-1 flex flex-col gap-5 rounded-2xl p-2 text-white md:order-1 md:rounded-2xl md:border md:border-white/10 md:bg-white/[0.03] md:p-7">
          <div className="space-y-4">
            <div className="w-fit rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              AutoDriveCX Individual
            </div>
            <div className="w-fit rounded-full border border-amber-300/35 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
              Build {gitSha}
            </div>
            <Logo variant="full" width={330} height={110} className="h-auto w-auto max-w-[300px]" />
            <h1 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Start your Individual plan free for 30 days.
            </h1>
            <p className="max-w-xl text-sm text-slate-200/90 sm:text-base">
              Built for dealership pros who handle customer conversations every day and want better execution, stronger survey scores, and higher commissions.
            </p>
          </div>

          <details className="-mx-2 group md:hidden">
            <summary className="mx-auto w-fit cursor-pointer list-none rounded-xl border border-cyan-300/45 bg-cyan-400/10 px-3 py-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100 shadow-[0_10px_30px_-18px_rgba(34,211,238,0.95)] transition-all hover:bg-cyan-400/20 active:scale-[0.99]">
              Who it&apos;s for + what you get
            </summary>
            <div className="mt-4 space-y-5 border-t border-white/10 pt-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">Who this is for</p>
                <ul className="flex flex-wrap gap-2 text-sm text-slate-100">
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Sales Consultants</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Service Advisors</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">BDC Professionals</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Parts Consultants</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Sales Managers</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Service & Parts Managers</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">General Managers</li>
                  <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">F&amp;I Directors</li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">What you get</p>
                <ul className="grid gap-2 text-sm text-slate-200/90">
                  <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">3-5 minute daily practice reps</li>
                  <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Real-world customer conversation training</li>
                  <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Real-time skill tracking for empathy, listening, and trust</li>
                  <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Habit-based coaching for consistent CX execution</li>
                </ul>
              </div>
            </div>
          </details>

          <div className="hidden space-y-3 border-t border-white/10 pt-5 md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">Who this is for</p>
            <ul className="flex flex-wrap gap-2 text-sm text-slate-100">
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Sales Consultants</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Service Advisors</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">BDC Professionals</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Parts Consultants</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Sales Managers</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">Service & Parts Managers</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">General Managers</li>
              <li className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">F&amp;I Directors</li>
            </ul>
          </div>

          <div className="hidden space-y-3 border-t border-white/10 pt-5 md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">What you get</p>
            <ul className="grid gap-2 text-sm text-slate-200/90 sm:grid-cols-2">
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">3-5 minute daily practice reps</li>
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Real-world customer conversation training</li>
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Real-time skill tracking for empathy, listening, and trust</li>
              <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">Habit-based coaching for consistent CX execution</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
