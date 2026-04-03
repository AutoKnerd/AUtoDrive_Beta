import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type AutoknerdShellProps = {
  active?: 'home' | 'about' | 'podcast' | 'fit';
  children: React.ReactNode;
};

const navItems = [
  { href: '/Autoknerd', label: 'Home', key: 'home' },
  { href: '/Autoknerd/podcast', label: 'Podcast', key: 'podcast' },
  { href: '/Autoknerd/about', label: 'About', key: 'about' },
] as const;

export function AutoknerdShell({ active = 'home', children }: AutoknerdShellProps) {
  return (
    <div className="min-h-screen bg-[#0d0f0f] text-[#f4f3f3] selection:bg-[#bdfc00] selection:text-[#445d00]">
      <header className="nav-glass fixed top-0 z-50 w-full border-b border-zinc-900/50 shadow-[0_4px_20px_rgba(191,255,0,0.05)]">
        <div className="mx-auto flex min-h-28 w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/Autoknerd"
              className="flex items-center"
            >
              <Image
                src="/AutoKnerd Logo.png"
                alt="AutoKnerd"
                width={610}
                height={203}
                className="h-20 w-auto object-contain"
                priority
              />
            </Link>
            <nav className="hidden h-full items-center space-x-8 md:flex">
              <div className="dropdown-group relative flex h-full items-center">
                <button className="flex items-center gap-1 text-sm uppercase tracking-tight text-zinc-400 transition-all duration-300 hover:text-zinc-100">
                  System
                  <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                </button>
                <div className="dropdown-animate absolute left-0 top-full flex w-64 flex-col space-y-2 border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
                  <a className="group flex flex-col p-3 transition-colors hover:bg-zinc-900" href="#product-ecosystem">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-lime-400">AutoShop</span>
                    <span className="block text-[10px] uppercase text-zinc-500">Diagnostic Suite</span>
                  </a>
                  <a className="group flex flex-col p-3 transition-colors hover:bg-zinc-900" href="#product-ecosystem">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-lime-400">AutoDriveCX</span>
                    <span className="block text-[10px] uppercase text-zinc-500">Behavioral Platform</span>
                  </a>
                  <a className="group flex flex-col p-3 transition-colors hover:bg-zinc-900" href="#product-ecosystem">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-lime-400">AutoForge</span>
                    <span className="block text-[10px] uppercase text-zinc-500">Hardware Deployment</span>
                  </a>
                </div>
              </div>
              {navItems.filter((item) => item.key !== 'home').map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'text-sm uppercase tracking-tight transition-all duration-300',
                    active === item.key ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-6">
            <div className="hidden items-center space-x-3 md:flex">
              <span className="material-symbols-outlined cursor-pointer text-zinc-400 transition-colors hover:text-lime-400">settings</span>
              <span className="material-symbols-outlined cursor-pointer text-zinc-400 transition-colors hover:text-lime-400">notifications</span>
            </div>
            <Link
              href="/login?next=/Autoknerd"
              className="hidden rounded-sm border border-zinc-800 px-6 py-2 text-sm font-bold uppercase tracking-tight text-zinc-400 transition-all duration-300 hover:border-zinc-600 hover:text-zinc-100 md:inline-flex"
            >
              Login
            </Link>
            <Link
              href="/Autoknerd/find-your-fit"
              className="glow-primary-hover inline-flex items-center justify-center rounded-sm bg-[#bdfc00] px-6 py-2 text-sm font-bold uppercase tracking-tight text-[#445d00] transition-all duration-150 hover:brightness-110 active:scale-95"
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
