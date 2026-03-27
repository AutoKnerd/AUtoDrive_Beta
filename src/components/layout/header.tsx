
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { UserNav } from './user-nav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isToolsSurface = pathname?.startsWith('/tools');
  const hasActiveAutoDriveCx = Boolean(user?.hasAutoDriveCX || (user as any)?.hasAutoDriveCx);
  const shouldShowSurfaceToggle = Boolean(user && hasActiveAutoDriveCx);
  const [showAutoDriveBadgePulse, setShowAutoDriveBadgePulse] = useState(false);

  const trainingSurfaceHref = '/';
  const isToolsActive = Boolean(pathname?.startsWith('/tools'));
  const isTrainingActive = !isToolsActive;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user?.userId || !shouldShowSurfaceToggle) return;
    if (!hasActiveAutoDriveCx) {
      setShowAutoDriveBadgePulse(false);
      return;
    }

    const storageKey = `autodrivecx_badge_seen:${user.userId}`;
    const alreadySeen = window.localStorage.getItem(storageKey) === '1';
    if (alreadySeen) return;

    setShowAutoDriveBadgePulse(true);
    const timer = window.setTimeout(() => {
      setShowAutoDriveBadgePulse(false);
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [hasActiveAutoDriveCx, shouldShowSurfaceToggle, user?.userId]);

  const renderSurfaceToggle = (className?: string) => {
    if (!shouldShowSurfaceToggle) return null;

    return (
      <div
        className={cn(
          'inline-flex items-center rounded-full border p-1 shadow-[0_10px_24px_rgba(0,0,0,0.32)]',
          isTrainingActive
            ? 'border-[#45c7ff]/85 bg-gradient-to-r from-[#0f3d72] via-[#1362b6] to-[#0f4f92]'
            : 'border-[#1a6eb6]/85 bg-gradient-to-r from-[#061d38] via-[#092e55] to-[#072444]',
          showAutoDriveBadgePulse && 'animate-pulse ring-2 ring-[#63e36f]/45',
          className
        )}
        title="Open AutoDriveCX dashboard"
      >
        <Link
          href={trainingSurfaceHref}
          className={cn(
            'rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all',
            isTrainingActive
              ? 'bg-gradient-to-r from-[#53d7ff] to-[#2c98ff] text-[#031a34] shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_10px_20px_rgba(18,132,228,0.5)]'
              : 'text-[#b2d9ff] hover:bg-[#2cc3ff]/16'
          )}
          onClick={() => {
            if (typeof window !== 'undefined' && user?.userId && hasActiveAutoDriveCx) {
              window.localStorage.setItem(`autodrivecx_badge_seen:${user.userId}`, '1');
            }
            setShowAutoDriveBadgePulse(false);
          }}
          prefetch={false}
        >AutoDriveCX</Link>
        <Link
          href="/tools"
          className={cn(
            'rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all',
            isToolsActive
              ? 'bg-gradient-to-r from-[#63e36f] to-[#37c86a] text-[#083618] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_8px_16px_rgba(56,183,97,0.35)]'
              : 'text-[#b2d9ff] hover:bg-[#2cc3ff]/16'
          )}
        >AutoShopCX</Link>
      </div>
    );
  };

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur-sm ${
        isToolsSurface
          ? 'border-[#c7d6e8] bg-[#f6fbff]/95 text-[#0f2135] dark:border-[#1f3657] dark:bg-[#0f192c]/95 dark:text-[#eaf2ff]'
          : 'border-border bg-background/80'
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center font-semibold">
          <Logo variant="full" width={146} height={48} />
        </Link>
        {renderSurfaceToggle('absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:inline-flex')}
        <div className="ml-auto flex items-center gap-2">
          {renderSurfaceToggle('md:hidden')}
          {user && (
            <UserNav user={user} avatarClassName="h-9 w-9" />
          )}
        </div>
      </div>
    </header>
  );
}
