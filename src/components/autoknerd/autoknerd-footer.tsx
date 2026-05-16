'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AutoknerdNewsletterForm } from '@/components/autoknerd/autoknerd-newsletter-form';

export function AutoknerdFooter() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-black">
      <div className="mx-auto max-w-7xl px-8 py-14">
        <div className="grid gap-6 border-b border-zinc-900 pb-10 md:grid-cols-2">
          <div className="rounded-sm border border-[#1b1f1f] bg-[#0d0f0f] p-6">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdfc00]">The AutoKnerd Dispatch</p>
            <p className="mb-5 max-w-lg text-sm leading-6 text-zinc-400">
              Weekly insights on trust, transparency, CSI, and dealership behavior consistency.
            </p>
            <AutoknerdNewsletterForm source="newsletter" fieldIdSuffix="footer" compact />
          </div>

          <div className="rounded-sm border border-[#1b1f1f] bg-[#0d0f0f] p-6">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdfc00]">Need something specific?</p>
            <p className="mb-5 max-w-lg text-sm leading-6 text-zinc-400">
              Questions about deployment, diagnostics, dealer groups, or partnerships? Reach out directly.
            </p>
            <Link
              href="/Autoknerd/contact"
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-[#464848] px-6 text-xs font-black uppercase tracking-[0.18em] text-[#f4f3f3] transition-all duration-300 hover:border-[#bdfc00]/40 hover:bg-[#151818] hover:text-[#eaffb8]"
            >
              Contact AutoKnerd
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-8 py-10 md:flex-row">
          <Link
            href="/Autoknerd"
            className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#bdfc00] transition-colors hover:text-[#d7ff66] md:text-[10px]"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            AutoKnerd
          </Link>
          <div className="flex items-center justify-center">
            <Image
              src="/AutoKnerd Logo.png"
              alt="AutoKnerd"
              width={120}
              height={36}
              className="h-auto w-[96px] md:w-[120px]"
              priority={false}
            />
          </div>
          <div
            className="flex flex-wrap items-center justify-center gap-3 text-[8px] uppercase tracking-[0.18em] text-zinc-700 opacity-80 md:text-[9px]"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <span>© 2024 AutoKnerd LLC Dealership CX Development.</span>
            <span className="text-zinc-800">|</span>
            <Link className="text-zinc-600 transition-colors hover:text-zinc-300" href="/legal">
              Legal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
