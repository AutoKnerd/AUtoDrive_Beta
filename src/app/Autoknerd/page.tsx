'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

export default function AutoknerdPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('.fade-in-section');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <AutoknerdShell active="home">
      <main className="pt-28">
        <section className="fade-in-section bg-grid-pattern relative flex min-h-[921px] flex-col items-center justify-center overflow-hidden px-6">
          <div className="animate-autoknerd-system-pulse pointer-events-none absolute inset-0 bg-[#bdfc00]/5" />
          <div className="scan-line animate-autoknerd-fast-scan opacity-20" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bdfc00]/10 blur-[120px]" />
          <div className="relative z-10 max-w-5xl text-center">
            <div className="mb-8 inline-flex items-center space-x-2 border border-[#eaffb8]/20 bg-[#eaffb8]/5 px-3 py-1 text-[10px] uppercase tracking-widest text-[#eaffb8]">
              <span className="flex h-2 w-2 rounded-full bg-[#bdfc00] animate-pulse" />
              <span>System Status: Optimal</span>
            </div>
            <h1 className="mb-6 text-[5.5rem] leading-[0.85] tracking-tighter text-[#f4f3f3] md:text-[8.5rem]">
              Diagnose behavior.
              <br />
              <span className="text-[#bdfc00]">Prescribe action.</span>
              <br />
              Drive weekly execution.
            </h1>
            <p className="mx-auto mb-4 max-w-2xl text-lg font-light leading-relaxed text-[#aaabab] md:text-xl">
              For dealerships tired of inconsistency, weak follow-through, and customer friction they can&apos;t quite explain.
            </p>
            <p className="mb-12 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Built from real dealership behavior, not theory.
            </p>
            <div className="relative mx-auto mb-12 h-px w-48 overflow-hidden bg-zinc-800">
              <div className="animate-autoknerd-scan absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-[#bdfc00] to-transparent" />
              <div className="absolute inset-0 h-full w-full opacity-30 shadow-[0_0_8px_rgba(189,252,0,0.5)]" />
            </div>
            <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/Autoknerd/find-your-fit" className="glow-primary-hover w-full rounded-sm bg-[#bdfc00] px-10 py-4 text-sm font-bold uppercase tracking-widest text-[#445d00] transition-all duration-300 active:scale-95 sm:w-auto">
                Find Your Fit
              </Link>
              <a href="#product-ecosystem" className="w-full rounded-sm border border-[#464848] px-10 py-4 text-sm font-bold uppercase tracking-widest text-[#f4f3f3] transition-all duration-300 hover:bg-[#f4f3f3] hover:text-[#0d0f0f] active:scale-95 sm:w-auto">
                Explore the System
              </a>
            </div>
            <p className="mx-auto max-w-md border-t border-[#eaffb8]/10 pt-6 text-xs uppercase tracking-widest text-[#f4f3f3]/60">
              One system. Built to diagnose, train, and deploy better behavior across your dealership.
            </p>
          </div>
          <div className="absolute bottom-0 h-32 w-full bg-gradient-to-t from-[#0d0f0f] to-transparent" />
        </section>

        <section className="fade-in-section mx-auto max-w-7xl px-8 py-48" id="product-ecosystem">
          <div className="mb-24 text-center">
            <h3 className="mb-6 text-xl tracking-tight text-zinc-400 md:text-2xl">
              If your team sounds different from one customer to the next, your system isn&apos;t working.
            </h3>
            <h2 className="mb-4 text-4xl tracking-tighter text-[#f4f3f3] md:text-5xl">Three connected products. One performance system.</h2>
            <p className="mb-8 text-lg font-light text-[#aaabab] md:text-xl">Start where you are. Scale as your dealership grows.</p>
          </div>
          <div className="relative">
            <div className="system-connector-line absolute left-0 top-1/2 z-0 hidden h-px w-full -translate-y-1/2 items-center justify-between md:flex">
              <span className="material-symbols-outlined ml-[28%] text-xs text-[#eaffb8]/30">arrow_forward</span>
              <span className="material-symbols-outlined mr-[28%] text-xs text-[#eaffb8]/30">arrow_forward</span>
            </div>
            <div className="relative z-10 grid grid-cols-1 items-center gap-8 md:grid-cols-3">
              <div className="group flex flex-col space-y-2 opacity-80 transition-opacity hover:opacity-100">
                <span className="px-1 text-[10px] uppercase tracking-widest text-zinc-600">TOOLS</span>
                <div className="flex h-full flex-col border border-[#464848]/10 bg-[#121414] p-8 transition-all duration-500 hover:-translate-y-2 hover:border-[#eaffb8]/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                  <h3 className="mb-3 text-2xl">AutoShop</h3>
                  <p className="mb-8 line-clamp-2 text-sm text-[#aaabab]">
                    Integrated diagnostic suite for baseline performance metrics and friction identification.
                  </p>
                  <div className="flex h-32 items-center justify-center overflow-hidden border border-[#464848]/5 bg-black">
                    <div
                      className="h-full w-full bg-cover bg-center opacity-20"
                      style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAaQWyznSaC_YzxqCMTDx7r8IlD1ccktn7iGxRsIa_WPD-11K6hi9Y2Tfx0blIA2BTtEfGvQmctlMKvvOJ2mwrSBlHvda6U0lXDs8nY4SgJlGGutROg5MbAT-qDnQppaS_Lsbv7T9zXg8I46EO7Zb1m3rQE-6HBOaJXovqk2awvRo0bQMyg3k8HNMbt61ATGJRNhxICjGdCjFCvXbrlOjYN3ZOOjkzeBBseQqC_BMuropUWG59iQElVYv5X-MOE0P97oUWIHczvoC8')" }}
                    />
                  </div>
                </div>
              </div>
              <div className="group z-20 flex scale-105 flex-col space-y-2 md:scale-[1.13]">
                <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-[#bdfc00]">PLATFORM</span>
                <div className="relative h-full overflow-hidden border-2 border-lime-400 bg-[#232626] p-8 shadow-[0_0_60px_rgba(189,252,0,0.25)] transition-all duration-500 hover:-translate-y-4 hover:shadow-[0_0_80px_rgba(189,252,0,0.4)]">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#eaffb8]/25 blur-3xl" />
                  <h3 className="mb-3 text-3xl text-white">AutoDriveCX</h3>
                  <p className="mb-8 line-clamp-2 text-base font-medium leading-relaxed text-white">
                    The central nervous system. Unified behavioral training designed for scale and consistency.
                  </p>
                  <div className="relative flex h-40 items-center justify-center border border-[#eaffb8]/40 bg-black">
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-70"
                      style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBTw-h2OTfPHdg19cY-HzLdqnDuxvXj8uWO8T7EK87rJnbjPD9qZo_l8wHKzA-YF7BAWpBSIfTZaaS779w24oWVPEPfLFY7tJvy7S6hWF4UmFPDRXPiTsbsmbHolmQiXmkEgAOGfQt1S5NC3jjIki0AxGkvAjI3m2Dv9CQt-uMt5aXCsB8QtccX1n4GSFwVtYiNoaIpieyoT3rbLarb5E6P_oUELaobTdTo86pET7KEtmi0izS13KqH6l7qcKyL2tHdJx8lKL3kCwk')" }}
                    />
                    <span className="material-symbols-outlined relative z-10 text-5xl text-[#bdfc00] drop-shadow-[0_0_20px_rgba(189,252,0,0.8)]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                      psychology
                    </span>
                  </div>
                </div>
              </div>
              <div className="group flex flex-col space-y-2 opacity-80 transition-opacity hover:opacity-100">
                <span className="px-1 text-[10px] uppercase tracking-widest text-zinc-600">DEPLOYMENT</span>
                <div className="flex h-full flex-col border border-[#464848]/10 bg-[#121414] p-8 transition-all duration-500 hover:-translate-y-2 hover:border-[#eaffb8]/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                  <h3 className="mb-3 text-2xl">AutoForge</h3>
                  <p className="mb-8 line-clamp-2 text-sm text-[#aaabab]">
                    Hardware and logic deployment for on-site execution. Hard-coding high performance into facility DNA.
                  </p>
                  <div className="flex h-32 items-center justify-center overflow-hidden border border-[#464848]/5 bg-black">
                    <div
                      className="h-full w-full bg-cover bg-center opacity-20"
                      style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxYDoYgM51GjeNF4Nk0qYF5cXudT1dpop9rQfWzlsjBcrGcWxS0LHB5W6sCVk0MizM3i81qkwZCzeaFEjhU8r3ab5GvWBpKQwclLwK3B4GShUMva4jcRqRlU8tog8ZQrIlWAh5LpKECme1TeeqNNxssy12S8FEPGdY-vVMi4pmIqvASiqTYWg_vroYi77x0x93W86jK-OIre7D_ts29QM0NR6DRHQIbkCVKVxIjvdrttpQKoxZkqU_g-AimrUBlEMT-PljG4bvxvQ')" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fade-in-section bg-[#121414] py-48">
          <div className="mx-auto max-w-7xl px-8">
            <div className="mb-24 max-w-3xl">
              <h2 className="mb-6 text-5xl tracking-tighter md:text-6xl">
                This is not a motivation problem.
                <br />
                <span className="text-[#eaffb8] opacity-90">It&apos;s a behavior consistency problem.</span>
              </h2>
              <p className="max-w-2xl text-xl leading-relaxed text-[#aaabab] md:text-2xl">
                Most dealerships don&apos;t lack the drive; they lack the infrastructure to maintain high performance across every single customer touchpoint.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-0.5 border border-[#464848]/10 bg-[#464848]/5 md:grid-cols-2 lg:grid-cols-4">
              {[
                ['security_update_warning', 'Customers feel guarded', 'Lack of transparency creates immediate psychological friction at sale.'],
                ['voice_over_off', 'Consultants sound inconsistent', 'Varied messaging across teams dilutes brand authority metrics.'],
                ['trending_down', 'Coaching is reactive', 'Managers respond to missed quotas instead of correcting patterns early.'],
                ['settings_input_component', 'Data is siloed', 'Valuable insights trapped in legacy systems with zero actionable output.'],
              ].map(([icon, title, copy]) => (
                <div key={title} className="group relative overflow-hidden bg-[#0d0f0f] p-10 transition-all duration-300 hover:bg-[#2a2d2d]">
                  <span className="material-symbols-outlined mb-6 block text-3xl text-zinc-600 transition-colors group-hover:text-[#eaffb8]">{icon}</span>
                  <h4 className="mb-4 text-xl font-medium">{title}</h4>
                  <div className="mb-4 h-px w-0 bg-[#eaffb8]/30 transition-all duration-500 group-hover:w-full" />
                  <p className="text-sm leading-relaxed text-[#aaabab] opacity-0 transition-opacity duration-300 group-hover:opacity-100">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fade-in-section overflow-hidden px-8 py-48">
          <div className="mx-auto max-w-7xl">
            <div className="relative">
              <div className="absolute left-0 top-1/2 hidden h-px w-full bg-[#464848]/20 md:block" />
              <div className="relative z-10 grid grid-cols-1 gap-12 md:grid-cols-3">
                {[
                  ['01', 'Input', 'Diagnostic phase. We audit current workflows via AutoShop to find gaps.', false],
                  ['02', 'Processing', 'Intelligence phase. AutoDriveCX recalibrates behavior and team alignment.', true],
                  ['03', 'Deployment', 'Execution phase. AutoForge implements the permanent high-performance OS.', false],
                ].map(([step, title, copy, active]) => (
                  <div
                    key={step}
                    className={active
                      ? 'border border-[#eaffb8]/20 bg-[#0d0f0f] p-12 text-center shadow-[0_0_30px_rgba(189,252,0,0.05)]'
                      : 'group border border-[#464848]/10 bg-[#0d0f0f] p-12 text-center transition-all duration-500 hover:border-[#eaffb8]/20'}
                  >
                    <span className={active ? 'mb-6 block text-4xl font-black text-[#eaffb8]' : 'mb-6 block text-4xl font-black text-[#eaffb8]/10 transition-colors group-hover:text-[#eaffb8]/30'}>
                      {step}
                    </span>
                    <h3 className="mb-4 text-2xl uppercase tracking-tighter">{title}</h3>
                    <p className={active ? 'leading-relaxed text-[#f4f3f3]' : 'leading-relaxed text-[#aaabab]'}>{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="fade-in-section bg-zinc-950 py-48">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-24 px-8 md:flex-row">
            <div className="md:w-1/3">
              <h2 className="mb-8 text-5xl leading-[0.95] tracking-tighter md:text-6xl">
                Precision execution,
                <br />
                predictable growth.
              </h2>
              <div className="mb-8 h-1 w-12 bg-[#eaffb8]" />
              <p className="leading-relaxed text-[#aaabab]">
                We don&apos;t just provide software.
                <br />
                We provide a closed-loop system
                <br />
                for continuous improvement.
              </p>
            </div>
            <div className="grid gap-8 md:w-2/3 md:grid-cols-2">
              {[
                ['chat', 'Clearer conversations', 'Every interaction mapped for maximum clarity and trust.'],
                ['visibility', 'Stronger transparency', 'End-to-end visibility for both consumers and management.'],
                ['sports', 'Better coaching', 'Behavior-based data allows for surgical precision in training.'],
                ['analytics', 'Operational Velocity', 'Reduce cycle times and increase throughput without headcount.'],
              ].map(([icon, title, copy]) => (
                <div key={title} className="flex items-start space-x-4 border-l border-[#eaffb8]/30 bg-[#181a1a]/50 p-8 transition-colors hover:bg-[#181a1a]">
                  <span className="material-symbols-outlined mt-1 text-[#eaffb8]">{icon}</span>
                  <div>
                    <h4 className="mb-2 text-lg">{title}</h4>
                    <p className="text-sm leading-relaxed text-zinc-500">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fade-in-section px-8 py-48">
          <div className="relative mx-auto max-w-7xl overflow-hidden border border-[#464848]/10 bg-[#1d2020] p-12 md:p-24">
            <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#eaffb8]/5 blur-[100px]" />
            <div className="relative z-10 max-w-2xl">
              <h2 className="mb-16 text-4xl tracking-tighter md:text-6xl">Not sure where to start?</h2>
              <div className="space-y-4">
                <Link className="group flex items-center justify-between border border-[#464848]/20 bg-[#0d0f0f] p-8 transition-all hover:border-[#eaffb8]/40 hover:shadow-[0_0_30px_rgba(189,252,0,0.05)]" href="/Autoknerd/find-your-fit">
                  <div className="flex items-center space-x-8">
                    <span className="font-bold text-[#eaffb8]">01</span>
                    <span className="text-xl font-medium">Take the CX Friction Check</span>
                  </div>
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-2">arrow_forward</span>
                </Link>
                <Link className="group flex items-center justify-between border border-[#464848]/20 bg-[#0d0f0f] p-8 transition-all hover:border-[#eaffb8]/40 hover:shadow-[0_0_30px_rgba(189,252,0,0.05)]" href="/login?next=/">
                  <div className="flex items-center space-x-8">
                    <span className="font-bold text-[#eaffb8]">02</span>
                    <span className="text-xl font-medium">Start AutoDriveCX</span>
                  </div>
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-2">arrow_forward</span>
                </Link>
                <Link className="group flex items-center justify-between border border-[#464848]/20 bg-[#0d0f0f] p-8 transition-all hover:border-[#eaffb8]/40 hover:shadow-[0_0_30px_rgba(189,252,0,0.05)]" href="/autoforge">
                  <div className="flex items-center space-x-8">
                    <span className="font-bold text-[#eaffb8]">03</span>
                    <span className="text-xl font-medium">Book an AutoForge Diagnostic</span>
                  </div>
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-2">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t border-zinc-900 bg-black">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 py-16 md:flex-row">
          <div className="text-lg font-bold uppercase tracking-widest text-lime-500">AutoKnerd AI</div>
          <div className="flex flex-wrap justify-center gap-10">
            <Link className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300" href="/privacy">Privacy Policy</Link>
            <a className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300" href="#">Terms of Service</a>
            <a className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300" href="#">Security Architecture</a>
            <a className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300" href="#">API Documentation</a>
            <a className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300" href="#">Contact</a>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-700 opacity-80">
            © 2024 AutoKnerd AI. High-Performance Automotive Intelligence.
          </div>
        </div>
      </footer>
    </AutoknerdShell>
  );
}
