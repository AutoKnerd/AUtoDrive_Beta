'use client';

import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

type HeroRoleSegment = 'sales' | 'service' | 'management';

interface UnlockSectionProps {
  isAuthenticated?: boolean;
  onCreateAccount?: () => void;
  onDismiss?: () => void;
  heroRole?: HeroRoleSegment | null;
  onHeroRoleChange?: (role: HeroRoleSegment) => void;
}

const HERO_COPY: Record<HeroRoleSegment | 'general', string> = {
  general: 'AutoShopCX gives dealership professionals a tool for every moment — so you can close more deals, increase approvals, and deliver a better customer experience without guessing your next move.',
  sales: 'AutoShopCX helps sales teams close more deals by handling objections cleanly, moving momentum forward, and always knowing the next best move.',
  service: 'AutoShopCX helps service teams increase approvals, build trust faster, and communicate clearly so customers move forward with confidence.',
  management: 'AutoShopCX helps managers coach consistently, drive team performance, and build repeatable behaviors that lead to stronger outcomes.',
};

export function OnboardingSection({
  isAuthenticated = false,
  onCreateAccount,
  onDismiss,
  heroRole = null,
  onHeroRoleChange,
}: UnlockSectionProps) {
  const activeCopy = heroRole ? HERO_COPY[heroRole] : HERO_COPY.general;

  return (
    <section className="relative flex min-h-[68vh] w-full flex-col items-center justify-center overflow-hidden bg-[#05080C] px-4 py-20 pb-16 transition-all duration-700">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="pointer-events-none absolute left-1/2 top-[20%] z-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7B2EFF]/20 blur-[150px] opacity-70 md:h-[800px] md:w-[1000px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1000px] flex-col items-center text-center">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#1C2533] bg-[#0A0E14]/80 px-4 py-2 shadow-sm backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full border border-[#5BFF3A]/30 bg-[#9DEE75] shadow-[0_0_12px_#5BFF3A]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0AABF]">
            Built for Dealership Sales • Service • Managers Who Want More Deals
          </span>
        </div>

        <h1 className="max-w-[850px] bg-gradient-to-b from-[#FFFFFF] to-[#8B9DBA] bg-clip-text text-5xl font-black leading-[1.05] tracking-tight text-transparent sm:text-6xl md:text-[80px]">
          Stop Winging It.
          <br />
          Start Winning It.
        </h1>

        <p className="mx-auto mt-8 max-w-[760px] text-lg font-medium leading-relaxed text-[#6C7E96] md:text-xl md:leading-relaxed">
          {activeCopy}
        </p>

        {!isAuthenticated && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8FA0BA]">I work in:</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {([
                { key: 'sales', label: 'Sales' },
                { key: 'service', label: 'Service' },
                { key: 'management', label: 'Management' },
              ] as const).map((option) => {
                const selected = heroRole === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onHeroRoleChange?.(option.key)}
                    className={
                      selected
                        ? 'rounded-full border border-[#9DEE75] bg-[#9DEE75] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0A0F16] shadow-[0_0_0_1px_rgba(157,238,117,0.35),0_8px_20px_rgba(107,188,67,0.2)] transition-all'
                        : 'rounded-full border border-[#2A2A38] bg-[#12121A] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#B8B8C5] transition-all hover:border-[#7B2EFF]/60 hover:text-[#FFFFFF]'
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="mx-auto mt-6 max-w-[760px] text-sm font-semibold text-[#A0AABF] md:text-base">
          Try the tools below. Unlock your free account when you&apos;re ready to save your progress and access everything.
        </p>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-[#4B5E77]">
          Instant direction. No training required.
        </p>

        <div className="mt-8 flex w-full max-w-[540px] flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={onCreateAccount}
              className="w-full rounded-full border border-transparent bg-[#9DEE75] px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#05080C] transition-all hover:bg-[#ABF28A] sm:w-auto"
            >
              Create Free Account
            </button>
          ) : (
            <Link
              href="/profile"
              className="w-full rounded-full border border-transparent bg-[#9DEE75] px-6 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-[#05080C] transition-all hover:bg-[#ABF28A] sm:w-auto"
            >
              View Profile
            </Link>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-full border border-[#2A3B52] bg-[#0A0E14] px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#D7E2F1] transition-all hover:border-[#7B2EFF]/50 hover:bg-[#111827] sm:w-auto"
          >
            Try Tools Below
          </button>
        </div>

        {!isAuthenticated && (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8FA0BA]">
            Close more deals • Save your wins • Track your growth
          </p>
        )}
      </div>

      <div className="relative z-10 mt-16 flex w-full max-w-[1000px] flex-col items-center">
        <div className="mb-12 flex w-full flex-col items-center justify-center gap-4 border-t border-[#1C2533] pt-12 md:flex-row md:gap-8 md:pt-16">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-[#5BFF3A]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[15px] font-bold text-[#E2E8F0]">Close more deals.</span>
          </div>

          <div className="hidden h-1 w-1 rounded-full bg-[#2A3B52] md:block" />

          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-[#5BFF3A]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[15px] font-bold text-[#E2E8F0]">Improve CSI.</span>
          </div>

          <div className="hidden h-1 w-1 rounded-full bg-[#2A3B52] md:block" />

          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-[#5BFF3A]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[15px] font-bold text-[#E2E8F0]">Make more money.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
