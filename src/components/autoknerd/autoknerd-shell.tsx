'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { AutoknerdHeaderMenu, type AutoknerdNavKey } from '@/components/autoknerd/autoknerd-header-menu';

type AutoknerdShellProps = {
  active?: AutoknerdNavKey;
  children: React.ReactNode;
};

export function AutoknerdShell({ active = 'home', children }: AutoknerdShellProps) {
  const { user } = useAuth();
  const mobileCta = user
    ? { href: '/login', label: 'Login' }
    : { href: '/Autoknerd/find-your-fit', label: 'Find Your Fit' };

  return (
    <div className="min-h-screen bg-[#0d0f0f] text-[#f4f3f3] selection:bg-[#bdfc00] selection:text-[#445d00]">
      <header className="nav-glass fixed top-0 z-50 w-full border-b border-zinc-900/50 shadow-[0_4px_20px_rgba(191,255,0,0.05)]">
        <div className="mx-auto flex min-h-24 w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:min-h-28 md:px-8">
          <div className="flex items-center gap-8 md:min-w-0">
            <AutoknerdHeaderMenu active={active} />
            <Link
              href="/Autoknerd"
              className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 flex items-center"
            >
              <Image
                src="/AutoKnerd Logo.png"
                alt="AutoKnerd"
                width={610}
                height={203}
                className="h-14 w-auto object-contain md:h-20"
                priority
              />
            </Link>
          </div>
          <div className="ml-auto flex items-center space-x-3 md:space-x-6">
            <Link
              href="/login"
              className="hidden rounded-sm border border-zinc-800 px-6 py-2 text-sm font-bold uppercase tracking-tight text-zinc-400 transition-all duration-300 hover:border-zinc-600 hover:text-zinc-100 md:inline-flex"
            >
              Login
            </Link>
            <Link
              href={mobileCta.href}
              className="glow-primary-hover inline-flex min-h-11 items-center justify-center rounded-sm bg-[#bdfc00] px-4 py-2 text-xs font-bold uppercase tracking-tight text-[#445d00] transition-all duration-150 hover:brightness-110 active:scale-95 md:hidden"
            >
              {mobileCta.label}
            </Link>
            <Link
              href="/Autoknerd/find-your-fit"
              className="glow-primary-hover hidden items-center justify-center rounded-sm bg-[#bdfc00] px-6 py-2 text-sm font-bold uppercase tracking-tight text-[#445d00] transition-all duration-150 hover:brightness-110 active:scale-95 md:inline-flex"
            >
              Find Your Fit
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
