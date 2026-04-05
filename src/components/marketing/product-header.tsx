'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AutoknerdHeaderMenu, type AutoknerdNavKey, type ProductSurfaceKey } from '@/components/autoknerd/autoknerd-header-menu';
import { cn } from '@/lib/utils';

type ProductHeaderCta = {
  href: string;
  label: string;
  mobileLabel?: string;
  hideOnMobile?: boolean;
};

type ProductHeaderProps = {
  brandHref: string;
  brandSrc: string;
  brandAlt: string;
  brandWidth: number;
  brandHeight: number;
  brandLinkClassName?: string;
  brandFrameClassName?: string;
  brandClassName?: string;
  mobileMenuTitle: string;
  mobileMenuDescription: string;
  menuActive?: AutoknerdNavKey;
  currentSystem?: ProductSurfaceKey;
  tone?: 'dark' | 'light';
  className?: string;
  loginHref?: string;
  loginLabel?: string;
  trialCta?: ProductHeaderCta;
  primaryCta?: ProductHeaderCta;
  accentClassName?: string;
  loginClassName?: string;
  trialClassName?: string;
  primaryClassName?: string;
};

export function ProductHeader({
  brandHref,
  brandSrc,
  brandAlt,
  brandWidth,
  brandHeight,
  brandLinkClassName,
  brandFrameClassName,
  brandClassName,
  mobileMenuTitle,
  mobileMenuDescription,
  menuActive,
  currentSystem,
  tone = 'dark',
  className,
  loginHref = '/login',
  loginLabel = 'Log In',
  trialCta,
  primaryCta,
  accentClassName,
  loginClassName,
  trialClassName,
  primaryClassName,
}: ProductHeaderProps) {
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl',
        tone === 'light'
          ? 'border-slate-200/80 bg-[rgba(255,255,255,0.84)]'
          : 'border-white/10 bg-[rgba(10,10,10,0.78)]',
        className
      )}
    >
      <div className="relative mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
        <div className="flex min-w-0 items-center gap-8 md:min-w-0">
          <AutoknerdHeaderMenu
            active={menuActive}
            currentSystem={currentSystem}
            mobileMenuTitle={mobileMenuTitle}
            mobileMenuDescription={mobileMenuDescription}
            tone={tone}
          />
        </div>

        <Link
          href={brandHref}
          className={cn(
            'absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center transition-all duration-500 ease-out',
            brandLinkClassName
          )}
          aria-label={brandAlt}
        >
            <span
              className={cn(
                'flex h-16 w-[322px] items-center justify-center transition-all duration-500 ease-out md:h-[4.6rem] md:w-[368px]',
                brandFrameClassName,
                accentClassName
              )}
          >
            <Image
              src={brandSrc}
              alt={brandAlt}
              width={brandWidth}
              height={brandHeight}
              className={cn('max-h-full w-auto object-contain', brandClassName)}
              priority
            />
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <Link
            href={loginHref}
            className={cn(
              'inline-flex min-h-[46px] items-center justify-center px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-black uppercase tracking-[0.16em] transition',
              tone === 'light'
                ? 'border border-slate-300 bg-white text-slate-900 hover:border-slate-500'
                : 'bg-white/5 text-white shadow-[0_0_24px_rgba(255,255,255,0.08)] hover:bg-white/10',
              loginClassName
            )}
          >
            {loginLabel}
          </Link>

          {trialCta ? (
            <Link
              href={trialCta.href}
              className={cn(
                'hidden min-h-[46px] items-center justify-center px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-black uppercase tracking-[0.16em] transition md:inline-flex',
                trialClassName
              )}
            >
              {trialCta.label}
            </Link>
          ) : null}

          {primaryCta ? (
            <>
              {!primaryCta.hideOnMobile ? (
                <Link
                  href={primaryCta.href}
                  className={cn(
                    'inline-flex min-h-[46px] items-center justify-center px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-black uppercase tracking-[0.16em] transition md:hidden',
                    primaryClassName
                  )}
                >
                  {primaryCta.mobileLabel ?? primaryCta.label}
                </Link>
              ) : null}
              <Link
                href={primaryCta.href}
                className={cn(
                  'hidden min-h-[46px] items-center justify-center px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-black uppercase tracking-[0.16em] transition md:inline-flex',
                  primaryClassName
                )}
              >
                {primaryCta.label}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
