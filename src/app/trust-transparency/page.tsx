'use client';

import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

const whatWeDo = [
  'AutoKnerd helps dealerships improve customer experience, team performance, and consistency using tools, coaching systems, analytics, and AI-supported recommendations.',
] as const;

const whatWeDontDo = [
  'We do not guarantee results.',
  'We do not replace your judgment.',
  'We do not run your dealership.',
] as const;

const yourData = [
  'Power your insights',
  'Improve your recommendations',
  'Improve the platform overall using anonymous data',
] as const;

const aiUse = [
  'AutoForge, Otto, and Sprocket provide recommendations and insights.',
  'They do not make decisions.',
  'You remain in control.',
] as const;

const yourResponsibility = [
  'How you use the tools',
  'How your team executes',
  'The decisions you make',
] as const;

const shortVersion = [
  'We help, not guarantee',
  'Your data is not sold',
  'AI supports, not replaces',
  'Results come from execution',
] as const;

export default function TrustTransparencyPage() {
  return (
    <AutoknerdShell active="home">
      <main className="bg-[#0d0f0f] px-6 pb-24 pt-32 text-[#f4f3f3] md:px-10">
        <div className="mx-auto w-full max-w-5xl space-y-8">
          <div className="border border-[#464848]/15 bg-[#121414] px-6 py-8 md:px-10">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Legal</p>
            <h1 className="text-4xl font-black uppercase leading-none tracking-tighter md:text-6xl">Trust &amp; Transparency</h1>
            <p className="mt-4 text-[#aaabab]">Plain-English Version</p>
          </div>

          <div className="space-y-6 border border-[#464848]/15 bg-[#121414] p-6 text-[#aaabab] md:p-8">
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">What We Do</h2>
              {whatWeDo.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">What We Don’t Do</h2>
              <ul className="list-disc space-y-2 pl-6">
                {whatWeDontDo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="pt-2">We provide guidance. You make decisions.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">Your Data</h2>
              <p>We do NOT sell your data.</p>
              <p>We do NOT share your dealership’s identifiable performance with other dealerships.</p>
              <p>Your data is used to:</p>
              <ul className="list-disc space-y-2 pl-6">
                {yourData.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">AI Use</h2>
              <ul className="list-disc space-y-2 pl-6">
                {aiUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">Your Responsibility</h2>
              <p>You are responsible for:</p>
              <ul className="list-disc space-y-2 pl-6">
                {yourResponsibility.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="pt-2">We provide the system. You run the operation.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">How We Make Money</h2>
              <p>We make money through subscriptions, platform access, and services.</p>
              <p>We do not monetize your data.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">Short Version</h2>
              <ul className="list-disc space-y-2 pl-6">
                {shortVersion.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">Contact</h2>
              <p>
                AutoKnerd LLC
                <br />
                Andrew@AutoKnerd.com
              </p>
            </section>
          </div>
        </div>
      </main>
    </AutoknerdShell>
  );
}
