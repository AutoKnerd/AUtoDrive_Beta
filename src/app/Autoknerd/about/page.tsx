'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BeehiivSubscriberDialog } from '@/components/autoknerd/beehiiv-subscriber-dialog';
import { AutoknerdFooter } from '@/components/autoknerd/autoknerd-footer';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

export default function AutoknerdAboutPage() {
  const [isScheduleCallModalOpen, setIsScheduleCallModalOpen] = useState(false);

  return (
    <AutoknerdShell active="about">
      <main className="grid-bg pt-28">
        <section className="relative flex min-h-[819px] items-center overflow-hidden px-8 md:px-16">
          <div className="z-10 max-w-5xl">
            <span className="mb-4 block text-sm font-bold uppercase tracking-widest text-[#eaffb8]">The Performance Engine</span>
            <h1 className="mb-8 max-w-4xl text-6xl font-bold leading-[0.9] tracking-tighter md:text-8xl">
              This isn&apos;t a <span className="text-[#b1ed00]">training company.</span>
            </h1>
            <p className="mb-4 max-w-3xl text-2xl font-light leading-snug text-[#aaabab] md:text-3xl">
              AutoKnerd is a dealership performance system built to fix the inconsistent behaviors customers can feel.
            </p>
            <p className="mb-10 max-w-2xl text-lg text-[#747675]">
              Effort is easy to measure. Consistency is what actually drives results.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => setIsScheduleCallModalOpen(true)}
                className="glow-hover bg-[#bdfc00] px-10 py-4 text-lg font-bold text-[#445d00] transition-all"
              >
                Schedule a Call
              </button>
              <Link href="/Autoknerd" className="border border-[#464848] px-10 py-4 text-lg font-bold transition-all hover:bg-[#2a2d2d]">
                Explore the System
              </Link>
            </div>
          </div>
          <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 opacity-20 lg:block">
            <div className="flex h-[600px] w-[600px] rotate-45 items-center justify-center border border-[#eaffb8]/20">
              <div className="flex h-[500px] w-[500px] items-center justify-center border border-[#eaffb8]/40">
                <div className="h-[400px] w-[400px] rounded-full bg-[#eaffb8]/5 blur-3xl" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#121414] px-8 py-24 md:px-16">
          <div className="mx-auto grid max-w-7xl items-start gap-16 md:grid-cols-2">
            <div>
              <h2 className="mb-8 text-4xl font-bold tracking-tight md:text-5xl">
                The real problem isn&apos;t effort. It&apos;s <span className="text-[#eaffb8]">inconsistency.</span>
              </h2>
              <p className="mb-12 text-xl text-[#aaabab]">
                Effort is easy to measure, but consistency is hard to scale. Without a system, excellence is just an accident.
              </p>
            </div>
            <div className="space-y-6">
              {[
                ['analytics', 'Fragmented Consulting', 'Every consultant brings their own flavor, leading to a disjointed brand experience.'],
                ['diversity_3', 'Management Gaps', 'Individual manager styles override shared operating standards.'],
                ['sentiment_dissatisfied', 'Customer Whiplash', 'Customers receive different levels of service depending on who they speak with.'],
              ].map(([icon, title, copy]) => (
                <div key={title} className="flex gap-4 border-l-4 border-[#eaffb8] bg-[#181a1a] p-6">
                  <span className="material-symbols-outlined text-[#eaffb8]">{icon}</span>
                  <div>
                    <h4 className="mb-1 text-lg font-bold">{title}</h4>
                    <p className="text-sm text-[#aaabab]">{copy}</p>
                  </div>
                </div>
              ))}
              <p className="pt-4 text-right font-bold italic text-[#eaffb8]">&quot;Customers feel that immediately. And it creates friction.&quot;</p>
            </div>
          </div>
        </section>

        <section className="px-8 py-24 md:px-16">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-4xl font-bold md:text-6xl">
              Friction kills trust. And <span className="text-[#eaffb8]">trust drives results.</span>
            </h2>
            <p className="mb-12 text-xl italic text-[#aaabab] opacity-80">Customers don&apos;t analyze your process. They feel it.</p>
            <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                ['01', 'Confusion', 'Uncertainty about the next steps paralyzes the deal cycle.'],
                ['02', 'Variation', 'Unpredictable behavior makes forecasting impossible.'],
                ['03', 'Leakage', 'Weak follow-through lets ready-to-buy customers walk away.'],
              ].map(([number, title, copy]) => (
                <div key={number} className="border border-[#464848]/20 bg-[#232626] p-8">
                  <h3 className="mb-2 text-4xl font-black text-[#eaffb8]">{number}</h3>
                  <p className="mb-2 font-bold">{title}</p>
                  <p className="text-sm text-[#aaabab]">{copy}</p>
                </div>
              ))}
            </div>
            <p className="text-3xl font-bold tracking-tight">
              This isn&apos;t a sales problem. It&apos;s a <span className="text-[#eaffb8] underline decoration-2 underline-offset-8">behavior problem.</span>
            </p>
          </div>
        </section>

        <section className="bg-[#181a1a] px-8 py-32 md:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center gap-16 md:flex-row">
              <div className="w-full md:w-1/2">
                <img
                  alt="Advanced automotive performance tracking dashboard"
                  className="w-full border border-[#eaffb8]/10 grayscale contrast-125 opacity-80"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2T0FpZGElBQjKzLgexjZQgAktYOboLtVCEXJfmVOOiUIy5IOmxP6k0gNan28G4Ccwwk3TVh207yCDPJ9yn_JZ8KpROibGmo9J8SN5d_YIwI6aFU-kpgZRPx1zCzLfFfgnJYoN-pDGWUZ37owReYuqowJo9e2xfd3pJylTwdLsdbM4GJK5cjFfasJCVtUC5Pfo9Uq0FHZkBDcE8UFB2L0JEUbRLOMkjMGtvwyDgX3n5yyZYnX4uF-tEkX2yysSQi37twkIZmTEojQ"
                />
              </div>
              <div className="w-full md:w-1/2">
                <h2 className="mb-8 text-4xl font-bold leading-tight md:text-5xl">
                  Diagnose behavior.
                  <br />
                  Prescribe action.
                  <br />
                  <span className="text-[#eaffb8]">Drive weekly execution.</span>
                </h2>
                <p className="mb-8 text-xl leading-relaxed text-[#aaabab]">
                  AutoKnerd builds systems that make better behavior repeatable. Not just taught, but consistently executed across every department, every shift, every time.
                </p>
                <div className="flex gap-4">
                  <span className="material-symbols-outlined scale-150 text-[#eaffb8]">bolt</span>
                  <p className="text-sm font-black uppercase tracking-widest text-[#747675]">Engineered for Velocity</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-8 py-24 md:px-16">
          <div className="mx-auto mb-20 max-w-7xl text-center">
            <h2 className="mb-4 text-5xl font-bold">One system. Three ways to fix performance.</h2>
            <p className="text-sm font-bold uppercase tracking-widest text-[#eaffb8]">Start where you are. Scale as your dealership grows.</p>
          </div>
          <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-0 border border-[#464848]/20 md:grid-cols-3">
            <div className="absolute left-1/3 top-1/2 hidden h-0.5 w-12 -translate-y-1/2 bg-[#eaffb8]/30 md:block" />
            <div className="absolute left-2/3 top-1/2 hidden h-0.5 w-12 -translate-y-1/2 bg-[#eaffb8]/30 md:block" />
              {[
              ['Phase 01', 'AutoShop', 'TOOLS', 'Practical diagnostic tools that standardize interactions and capture behavioral data in real time.', '/autoshop', 'View Tools'],
              ['Phase 02', 'AutoDriveCX', 'PLATFORM', 'The intelligence layer that turns behavior data into visible trends and clear coaching priorities.', '/login', 'Explore Platform'],
              ['Phase 03', 'AutoForge', 'DEPLOYMENT', 'Manager-led execution cycles that reinforce the behaviors your dealership needs every week.', '/autoforge', 'See Deployment'],
            ].map(([phase, title, eyebrow, copy, href, cta], index) => (
              <div
                key={title}
                className={`group p-12 transition-colors hover:bg-[#2a2d2d] ${index < 2 ? 'border-b border-[#464848]/20 md:border-b-0 md:border-r' : ''}`}
              >
                <div className="mb-8">
                  <span className="bg-[#232626] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#eaffb8]">{phase}</span>
                </div>
                <h3 className="mb-4 text-3xl font-bold transition-colors group-hover:text-[#eaffb8]">{title}</h3>
                <p className="mb-6 text-sm font-bold tracking-widest text-[#eaffb8]">{eyebrow}</p>
                <p className="mb-8 h-20 text-[#aaabab]">{copy}</p>
                <Link href={href} className="block w-full border border-[#eaffb8] py-3 text-center font-bold text-[#eaffb8] transition-all hover:bg-[#eaffb8] hover:text-[#445d00]">
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-black px-8 py-24 md:px-16">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-16 md:flex-row">
            <div className="w-full md:sticky md:top-32 md:w-1/3">
              <h2 className="text-4xl font-bold leading-tight">
                Because most dealerships don&apos;t have a <span className="text-[#eaffb8]">knowledge problem.</span>
              </h2>
              <div className="mt-6">
                <p className="text-2xl font-bold italic text-[#eaffb8]">They have a consistency problem.</p>
              </div>
            </div>
            <div className="w-full space-y-12 md:w-2/3">
              {[
                ["Training doesn't stick.", 'Workshops create temporary spikes in excitement, but Monday morning often drifts back to the old routine. AutoKnerd replaces spikes with a sustained baseline.'],
                ["Processes aren't followed.", "A manual in a drawer isn't a process. A process is only real when it's visible, measurable, and reinforced. We make it all three."],
                ["Execution varies by shift.", "Closing rates shouldn't depend on who's on the schedule. The system helps the dealership own the standard, not just the individual."],
              ].map(([title, copy]) => (
                <div key={title} className="border-b border-[#464848]/10 pb-12">
                  <h4 className="mb-4 text-2xl font-bold">{title}</h4>
                  <p className="text-lg leading-relaxed text-[#aaabab]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-8 py-48 md:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="glass-panel relative border border-[#eaffb8]/10 p-16">
              <h2 className="mb-12 text-4xl font-bold md:text-5xl">
                What happens when behavior
                <br />
                becomes <span className="text-[#eaffb8]">consistent.</span>
              </h2>
              <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
                {[
                  ['chat', 'Clearer Conversations', 'Scripts become frameworks. Frameworks become natural confidence.'],
                  ['payments', 'Calmer Pricing', 'Value-based presentation reduces negotiation friction and protects margins.'],
                  ['sync_alt', 'Improved Handoffs', 'Clearer transitions between sales, finance, and delivery.'],
                  ['verified', 'Stronger Follow-through', 'Every lead is nurtured according to a rigorous, systematic timeline.'],
                ].map(([icon, title, copy]) => (
                  <div key={title} className="space-y-4">
                    <span className="material-symbols-outlined text-[#eaffb8]">{icon}</span>
                    <h4 className="font-bold">{title}</h4>
                    <p className="text-xs text-[#aaabab]">{copy}</p>
                  </div>
                ))}
              </div>
              <p className="mt-16 text-center text-3xl font-bold text-[#bdfc00]">And when trust improves, results follow.</p>
            </div>
          </div>
        </section>

        <section className="bg-[#1d2020] px-8 py-24 md:px-16">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="mb-16 text-4xl font-bold md:text-5xl">Who this is built for</h2>
            <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
              {[
                ['person', 'Consultants', 'Who want a repeatable path to top-tier earnings without the guesswork.'],
                ['manage_accounts', 'Managers', 'Who need visibility into team performance to coach with precision.'],
                ['leaderboard', 'Leaders', 'Tired of inconsistency and looking for a scalable dealership system.'],
              ].map(([icon, title, copy]) => (
                <div key={title}>
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-[#eaffb8]/10">
                    <span className="material-symbols-outlined text-[#eaffb8]">{icon}</span>
                  </div>
                  <h4 className="mb-2 text-xl font-bold">{title}</h4>
                  <p className="text-sm text-[#aaabab]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative bg-[#bdfc00] px-8 py-32 text-[#445d00] md:px-16">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-8 text-5xl font-black leading-[0.9] md:text-7xl">
              Knowing what to do isn&apos;t the problem. <span className="opacity-70">Doing it consistently is.</span>
            </h2>
            <p className="mb-12 text-lg">Choose your path into the system.</p>
            <div className="flex flex-col justify-center gap-4 md:flex-row">
              <button
                type="button"
                onClick={() => setIsScheduleCallModalOpen(true)}
                className="bg-[#f4f3f3] px-8 py-5 text-lg font-bold text-[#0d0f0f] transition-all hover:bg-white"
              >
                Schedule a Call
              </button>
              <button
                type="button"
                onClick={() => setIsScheduleCallModalOpen(true)}
                className="border-2 border-[#445d00] px-8 py-5 text-lg font-bold transition-all hover:bg-[#445d00] hover:text-[#bdfc00]"
              >
                Start AutoDriveCX
              </button>
              <button
                type="button"
                onClick={() => setIsScheduleCallModalOpen(true)}
                className="border-2 border-[#445d00] px-8 py-5 text-lg font-bold transition-all hover:bg-[#445d00] hover:text-[#bdfc00]"
              >
                Book AutoForge Diagnostic
              </button>
            </div>
          </div>
        </section>
      </main>

      <BeehiivSubscriberDialog
        open={isScheduleCallModalOpen}
        onOpenChange={setIsScheduleCallModalOpen}
        title="Schedule a Call"
        description="Built for dealerships that want clearer communication, stronger customer trust, and more consistent experiences."
      />
      <AutoknerdFooter />
    </AutoknerdShell>
  );
}
