'use client';

import Image from 'next/image';
import Link from 'next/link';

export function AutoknerdFooter() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-black">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 py-16 md:flex-row">
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
    </footer>
  );
}
