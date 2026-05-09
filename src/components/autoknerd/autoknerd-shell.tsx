'use client';

import { useMemo } from 'react';
import { type AutoknerdNavKey } from '@/components/autoknerd/autoknerd-header-menu';
import { ProductHeader, type ProductHeaderCta } from '@/components/marketing/product-header';

type AutoknerdShellProps = {
  active?: AutoknerdNavKey;
  children: React.ReactNode;
  primaryCta?: ProductHeaderCta;
};

export function AutoknerdShell({ active = 'home', children, primaryCta }: AutoknerdShellProps) {
  const resolvedPrimaryCta = useMemo<ProductHeaderCta | undefined>(() => {
    if (primaryCta) return primaryCta;

    return {
      href: '/Autoknerd/find-your-fit',
      label: 'Find Your Fit',
      mobileLabel: 'Find Your Fit',
      hideOnMobile: true,
    };
  }, [primaryCta]);

  return (
    <div className="min-h-screen bg-[#0d0f0f] pt-16 text-[#f4f3f3] selection:bg-[#bdfc00] selection:text-[#445d00] md:pt-24">
      <ProductHeader
        brandHref="/Autoknerd"
        brandSrc="/AutoKnerd Logo.png"
        brandAlt="AutoKnerd"
        brandWidth={610}
        brandHeight={203}
        brandLinkClassName="top-1/2"
        brandFrameClassName="h-[56px] w-[240px] md:h-20 md:w-[350px]"
        brandClassName="scale-100"
        mobileMenuTitle="AutoKnerd"
        mobileMenuDescription="Performance intelligence navigation"
        menuActive={active}
        currentSystem="autoknerd"
        className="nav-glass border-zinc-900/50 shadow-[0_4px_20px_rgba(191,255,0,0.05)]"
        loginHref="/login"
        loginClassName="border border-zinc-800 bg-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-100 md:border md:border-zinc-800 md:bg-transparent md:text-zinc-400 md:hover:border-zinc-600 md:hover:text-zinc-100 max-md:glow-primary-hover max-md:border-0 max-md:bg-[#bdfc00] max-md:text-[#445d00] max-md:hover:brightness-110"
        primaryCta={resolvedPrimaryCta}
        primaryClassName="glow-primary-hover bg-[#bdfc00] text-[#445d00] hover:brightness-110"
      />
      {children}
    </div>
  );
}
