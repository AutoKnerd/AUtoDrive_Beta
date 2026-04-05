
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { UserNav } from './user-nav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AutoknerdHeaderMenu } from '@/components/autoknerd/autoknerd-header-menu';

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isToolsSurface = pathname?.startsWith('/tools');
  const hasActiveAutoDriveCx = Boolean(user?.hasAutoDriveCX || (user as any)?.hasAutoDriveCx);
  const shouldShowSurfaceToggle = Boolean(user);
  const [showAutoDriveBadgePulse, setShowAutoDriveBadgePulse] = useState(false);

  const trainingSurfaceHref = '/';
  const isToolsActive = Boolean(pathname?.startsWith('/tools'));
  const isTrainingActive = !isToolsActive;
  const brandHref = isToolsSurface ? '/tools' : '/';

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
            ? 'border-[#1a6eb6]/85 bg-gradient-to-r from-[#061d38] via-[#092e55] to-[#072444]'
            : 'border-[#7B2EFF]/85 bg-gradient-to-r from-[#2b0d52] via-[#4b1f8a] to-[#31135d]',
          showAutoDriveBadgePulse && 'animate-pulse ring-2 ring-[#63e36f]/45',
          className
        )}
        title="Open training dashboard"
      >
        <Link
          href="/tools"
          className={cn(
            'rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all',
            isToolsActive
              ? 'bg-gradient-to-r from-[#63e36f] to-[#37c86a] text-[#083618] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_8px_16px_rgba(56,183,97,0.35)]'
              : 'text-[#d7c4ff] hover:bg-[#7B2EFF]/16'
          )}
        >Tools</Link>
        <Link
          href={trainingSurfaceHref}
          className={cn(
            'rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all',
            isTrainingActive
              ? 'bg-gradient-to-r from-[#63e36f] to-[#37c86a] text-[#083618] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_8px_16px_rgba(56,183,97,0.35)]'
              : 'text-[#b2d9ff] hover:bg-[#2cc3ff]/16'
          )}
          onClick={() => {
            if (typeof window !== 'undefined' && user?.userId && hasActiveAutoDriveCx) {
              window.localStorage.setItem(`autodrivecx_badge_seen:${user.userId}`, '1');
            }
            setShowAutoDriveBadgePulse(false);
          }}
          prefetch={false}
        >Drive</Link>
      </div>
    );
  };

  return (
    <header
      className={`sticky top-0 z-30 flex h-24 items-center border-b backdrop-blur-sm ${
        isToolsSurface
          ? 'border-[#c7d6e8] bg-[#f6fbff]/95 text-[#0f2135] dark:border-[#1f3657] dark:bg-[#0f192c]/95 dark:text-[#eaf2ff]'
          : 'border-border bg-background/80'
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <AutoknerdHeaderMenu
            mobileMenuTitle={isToolsSurface ? 'AutoShop' : 'AutoDriveCX'}
            mobileMenuDescription="AutoKnerd navigation and product links"
            tone={isToolsSurface ? 'light' : 'dark'}
          />
        </div>
        <Link
          href={brandHref}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center font-semibold text-[#FFFFFF]"
        >
          {isToolsSurface ? (
            <div className="relative flex h-14 w-[240px] items-center justify-center md:h-16 md:w-[280px]">
              <Image
                src="/Autoshop logo.png"
                alt="AutoShopCX"
                width={320}
                height={80}
                className="max-h-full w-auto object-contain brightness-110 drop-shadow-[0_4px_12px_rgba(123,46,255,0.4)]"
                priority
              />
            </div>
          ) : (
            <Logo
              variant="full"
              width={292}
              height={96}
              className="h-14 w-auto object-contain brightness-110 drop-shadow-[0_4px_12px_rgba(44,152,255,0.4)] md:h-16"
            />
          )}
        </Link>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {renderSurfaceToggle()}
          {!user && isToolsSurface && (
            <Link
              href="/login"
              className="inline-flex min-h-[46px] items-center justify-center bg-[#7B2EFF] px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(123,46,255,0.24)] transition hover:bg-[#9d19ff]"
            >
              Log In
            </Link>
          )}
          {user && (
            <UserNav user={user} avatarClassName="h-9 w-9" />
          )}
        </div>
      </div>
    </header>
  );
}
