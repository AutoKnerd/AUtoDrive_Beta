'use client';

import Link from 'next/link';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

const legalLinks = [
  {
    href: '/terms',
    title: 'Terms of Service',
    description: 'Review the rules that govern use of AutoKnerd services.',
  },
  {
    href: '/privacy',
    title: 'Privacy Policy',
    description: 'See how information is collected, used, and protected.',
  },
] as const;

export default function LegalPage() {
  return (
    <AutoknerdShell active="home">
      <main className="bg-[#0d0f0f] px-6 pb-24 pt-32 text-[#f4f3f3] md:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-12 text-center">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Legal</p>
            <h1 className="text-4xl font-black uppercase leading-none tracking-tighter md:text-6xl">Legal</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#aaabab] md:text-lg">
              Use the links below to review the core policies for the platform.
            </p>
          </div>

          <section className="mb-10 border border-[#464848]/15 bg-[#121414] p-6 md:p-8">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Plain-English Version</p>
            <h2 className="mb-6 text-3xl font-black uppercase leading-none tracking-tighter md:text-5xl">Trust &amp; Transparency</h2>

            <div className="space-y-6 text-[#aaabab]">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">What We Do</h3>
                <p>
                  AutoKnerd helps dealerships improve customer experience, team performance, and consistency using tools, coaching systems, analytics, and AI-supported recommendations.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">What We Don't Do</h3>
                <ul className="list-disc space-y-2 pl-6">
                  <li>We do not guarantee results.</li>
                  <li>We do not replace your judgment.</li>
                  <li>We do not run your dealership.</li>
                </ul>
                <p>We provide guidance. You make decisions.</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">Your Data</h3>
                <p>We do NOT sell your data.</p>
                <p>We do NOT share your dealership&apos;s identifiable performance with other dealerships.</p>
                <p>Your data is used to:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Power your insights</li>
                  <li>Improve your recommendations</li>
                  <li>Improve the platform overall using anonymous data</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">AI Use</h3>
                <p>AutoForge, Otto, and Sprocket provide recommendations and insights.</p>
                <p>They do not make decisions.</p>
                <p>You remain in control.</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">Your Responsibility</h3>
                <p>You are responsible for:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>How you use the tools</li>
                  <li>How your team executes</li>
                  <li>The decisions you make</li>
                </ul>
                <p>We provide the system. You run the operation.</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">How We Make Money</h3>
                <p>We make money through subscriptions, platform access, and services.</p>
                <p>We do not monetize your data.</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">Short Version</h3>
                <ul className="list-disc space-y-2 pl-6">
                  <li>We help, not guarantee</li>
                  <li>Your data is not sold</li>
                  <li>AI supports, not replaces</li>
                  <li>Results come from execution</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#f4f3f3]">Contact</h3>
                <p>
                  AutoKnerd LLC
                  <br />
                  Andrew@AutoKnerd.com
                </p>
              </div>
            </div>
          </section>

          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative overflow-hidden border border-[#464848]/15 bg-[#121414] p-6 transition-all duration-300 hover:border-[#bdfc00]/30 hover:bg-[#171919]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#bdfc00]/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Open</p>
                <h2 className="text-xl font-semibold text-[#f4f3f3] transition-colors group-hover:text-[#eaffb8]">{link.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#aaabab]">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </AutoknerdShell>
  );
}
