'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export type AutoknerdNavKey = 'home' | 'about' | 'podcast' | 'fit';

type AutoknerdHeaderMenuProps = {
  active?: AutoknerdNavKey;
  className?: string;
  mobileMenuTitle?: string;
  mobileMenuDescription?: string;
  tone?: 'dark' | 'light';
};

const navItems = [
  { href: '/Autoknerd', label: 'Home', key: 'home' },
  { href: '/Autoknerd/podcast', label: 'Podcast', key: 'podcast' },
  { href: '/Autoknerd/about', label: 'About', key: 'about' },
] as const;

const systemItems = [
  { href: '/tools', title: 'AutoShop', subtitle: 'Diagnostic Suite' },
  { href: 'https://autodrivecx.com', title: 'AutoDriveCX', subtitle: 'Behavioral Platform' },
  { href: '/autoforge', title: 'AutoForge', subtitle: 'Hardware Deployment' },
] as const;

export function AutoknerdHeaderMenu({
  active,
  className,
  mobileMenuTitle = 'AutoKnerd',
  mobileMenuDescription = 'Performance intelligence navigation',
  tone = 'dark',
}: AutoknerdHeaderMenuProps) {
  const { user } = useAuth();
  const mobileMenuCta = user
    ? { href: '/Autoknerd/find-your-fit', label: 'Find Your Fit' }
    : { href: '/login', label: 'Login' };
  const isLightTone = tone === 'light';

  return (
    <div className={cn('flex items-center gap-8 md:min-w-0', className)}>
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-sm border transition-all duration-300 md:hidden',
              isLightTone
                ? 'border-slate-300 text-slate-700 hover:border-slate-500 hover:text-slate-950'
                : 'border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:text-zinc-100'
            )}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="border-zinc-800 bg-[#0d0f0f] px-6 py-8 text-[#f4f3f3]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-left text-sm font-black uppercase tracking-[0.24em] text-[#bdfc00]">
              {mobileMenuTitle}
            </SheetTitle>
            <SheetDescription className="text-left text-xs uppercase tracking-[0.18em] text-zinc-500">
              {mobileMenuDescription}
            </SheetDescription>
          </SheetHeader>
          <nav className="mt-10 flex flex-col gap-3">
            <Link
              href={mobileMenuCta.href}
              className="mb-2 inline-flex min-h-12 items-center justify-center rounded-sm bg-[#bdfc00] px-4 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#445d00] transition-all duration-150 hover:brightness-110 active:scale-[0.99]"
            >
              {mobileMenuCta.label}
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'rounded-sm border px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] transition-all duration-300',
                  active === item.key
                    ? 'border-[#bdfc00]/40 bg-[#bdfc00]/10 text-[#bdfc00]'
                    : 'border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">System</p>
              <div className="flex flex-col gap-3">
                {systemItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-sm border border-zinc-800 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-zinc-300 transition-all duration-300 hover:border-zinc-600 hover:text-zinc-100"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <nav className="hidden h-full items-center space-x-8 md:flex">
        <div className="dropdown-group relative flex h-full items-center">
          <button
            className={cn(
              'flex items-center gap-1 text-sm uppercase tracking-tight transition-all duration-300',
              isLightTone ? 'text-slate-600 hover:text-slate-950' : 'text-zinc-400 hover:text-zinc-100'
            )}
          >
            System
            <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
          </button>
          <div
            className={cn(
              'dropdown-animate absolute left-0 top-full flex w-64 flex-col space-y-2 border p-4 shadow-2xl',
              isLightTone ? 'border-slate-200 bg-white' : 'border-zinc-800 bg-zinc-950'
            )}
          >
            {systemItems.map((item) => (
              <Link
                key={item.title}
                className={cn(
                  'group flex flex-col p-3 transition-colors',
                  isLightTone ? 'hover:bg-slate-100' : 'hover:bg-zinc-900'
                )}
                href={item.href}
              >
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-lime-400">{item.title}</span>
                <span className={cn('block text-[10px] uppercase', isLightTone ? 'text-slate-500' : 'text-zinc-500')}>
                  {item.subtitle}
                </span>
              </Link>
            ))}
          </div>
        </div>
        {navItems.filter((item) => item.key !== 'home').map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              'text-sm uppercase tracking-tight transition-all duration-300',
              active === item.key
                ? isLightTone
                  ? 'text-slate-950'
                  : 'text-zinc-100'
                : isLightTone
                  ? 'text-slate-600 hover:text-slate-950'
                  : 'text-zinc-400 hover:text-zinc-100'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
