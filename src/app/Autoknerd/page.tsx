'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AutoknerdFooter } from '@/components/autoknerd/autoknerd-footer';
import { BeehiivSubscriberDialog } from '@/components/autoknerd/beehiiv-subscriber-dialog';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

const ecosystemProducts = [
  {
    key: 'autoshop',
    label: 'TOOLS',
    title: 'AutoShop',
    copy: 'Integrated diagnostic suite for baseline performance metrics and friction identification.',
    href: '/autoshop',
    ariaLabel: 'Explore AutoShop diagnostic suite',
    cta: 'Explore Tools',
    accentText: 'text-[#9d19ff]',
    accentMutedText: 'text-[#9d19ff]/75',
    accentHoverText: 'group-hover:text-[#9d19ff]',
    accentLabelInactive: 'text-zinc-600',
    accentBorder: 'border-[#9d19ff]',
    accentGlow: 'shadow-[0_0_60px_rgba(157,25,255,0.26)] md:shadow-[0_0_80px_rgba(157,25,255,0.32)]',
    accentOrb: 'bg-[#9d19ff]/20',
    accentImageBorder: 'border-[#9d19ff]/35',
    accentIconActive: 'text-[#9d19ff] drop-shadow-[0_0_20px_rgba(157,25,255,0.72)]',
    accentIconInactive: 'text-[#9d19ff]/25',
    image: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAaQWyznSaC_YzxqCMTDx7r8IlD1ccktn7iGxRsIa_WPD-11K6hi9Y2Tfx0blIA2BTtEfGvQmctlMKvvOJ2mwrSBlHvda6U0lXDs8nY4SgJlGGutROg5MbAT-qDnQppaS_Lsbv7T9zXg8I46EO7Zb1m3rQE-6HBOaJXovqk2awvRo0bQMyg3k8HNMbt61ATGJRNhxICjGdCjFCvXbrlOjYN3ZOOjkzeBBseQqC_BMuropUWG59iQElVYv5X-MOE0P97oUWIHczvoC8')",
    icon: null,
  },
  {
    key: 'autodrivecx',
    label: 'PLATFORM',
    title: 'AutoDriveCX',
    copy: 'The central nervous system. Unified behavioral training designed for scale and consistency.',
    href: 'https://autodrivecx.com',
    ariaLabel: 'Explore AutoDriveCX platform',
    cta: 'Explore the System',
    accentText: 'text-[#bdfc00]',
    accentMutedText: 'text-[#bdfc00]/75',
    accentHoverText: 'group-hover:text-[#bdfc00]',
    accentLabelInactive: 'text-zinc-600',
    accentBorder: 'border-lime-400',
    accentGlow: 'shadow-[0_0_60px_rgba(189,252,0,0.25)] md:shadow-[0_0_80px_rgba(189,252,0,0.32)]',
    accentOrb: 'bg-[#eaffb8]/25',
    accentImageBorder: 'border-[#eaffb8]/40',
    accentIconActive: 'text-[#bdfc00] drop-shadow-[0_0_20px_rgba(189,252,0,0.8)]',
    accentIconInactive: 'text-[#bdfc00]/25',
    image: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBTw-h2OTfPHdg19cY-HzLdqnDuxvXj8uWO8T7EK87rJnbjPD9qZo_l8wHKzA-YF7BAWpBSIfTZaaS779w24oWVPEPfLFY7tJvy7S6hWF4UmFPDRXPiTsbsmbHolmQiXmkEgAOGfQt1S5NC3jjIki0AxGkvAjI3m2Dv9CQt-uMt5aXCsB8QtccX1n4GSFwVtYiNoaIpieyoT3rbLarb5E6P_oUELaobTdTo86pET7KEtmi0izS13KqH6l7qcKyL2tHdJx8lKL3kCwk')",
    icon: 'psychology',
  },
  {
    key: 'autoforge',
    label: 'DEPLOYMENT',
    title: 'AutoForge',
    copy: 'Hardware and logic deployment for on-site execution. Hard-coding high performance into facility DNA.',
    href: '/autoforge',
    ariaLabel: 'Explore AutoForge deployment system',
    cta: 'See It in Action',
    accentText: 'text-[#e00000]',
    accentMutedText: 'text-[#e00000]/75',
    accentHoverText: 'group-hover:text-[#e00000]',
    accentLabelInactive: 'text-zinc-600',
    accentBorder: 'border-[#e00000]',
    accentGlow: 'shadow-[0_0_60px_rgba(224,0,0,0.24)] md:shadow-[0_0_80px_rgba(224,0,0,0.30)]',
    accentOrb: 'bg-[#e00000]/18',
    accentImageBorder: 'border-[#e00000]/35',
    accentIconActive: 'text-[#e00000] drop-shadow-[0_0_20px_rgba(224,0,0,0.65)]',
    accentIconInactive: 'text-[#e00000]/25',
    image: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxYDoYgM51GjeNF4Nk0qYF5cXudT1dpop9rQfWzlsjBcrGcWxS0LHB5W6sCVk0MizM3i81qkwZCzeaFEjhU8r3ab5GvWBpKQwclLwK3B4GShUMva4jcRqRlU8tog8ZQrIlWAh5LpKECme1TeeqNNxssy12S8FEPGdY-vVMi4pmIqvASiqTYWg_vroYi77x0x93W86jK-OIre7D_ts29QM0NR6DRHQIbkCVKVxIjvdrttpQKoxZkqU_g-AimrUBlEMT-PljG4bvxvQ')",
    icon: null,
  },
] as const;

const frictionCards = [
  {
    key: 'guarded',
    icon: 'security_update_warning',
    title: 'Customers feel guarded',
    copy: 'Lack of transparency creates immediate psychological friction at sale.',
  },
  {
    key: 'inconsistent',
    icon: 'voice_over_off',
    title: 'Consultants sound inconsistent',
    copy: 'Varied messaging across teams dilutes brand authority metrics.',
  },
  {
    key: 'reactive',
    icon: 'trending_down',
    title: 'Coaching is reactive',
    copy: 'Managers respond to missed quotas instead of correcting patterns early.',
  },
  {
    key: 'siloed',
    icon: 'settings_input_component',
    title: 'Data is siloed',
    copy: 'Valuable insights trapped in legacy systems with zero actionable output.',
  },
] as const;

const processCards = [
  {
    key: 'input',
    step: '01',
    title: 'Input',
    copy: 'Diagnostic phase. We audit current workflows via AutoShop to find gaps.',
  },
  {
    key: 'processing',
    step: '02',
    title: 'Processing',
    copy: 'Intelligence phase. AutoDriveCX recalibrates behavior and team alignment.',
  },
  {
    key: 'deployment',
    step: '03',
    title: 'Deployment',
    copy: 'Execution phase. AutoForge implements the permanent high-performance OS.',
  },
] as const;

export default function AutoknerdPage() {
  const [activeProduct, setActiveProduct] = useState<(typeof ecosystemProducts)[number]['key']>('autodrivecx');
  const [hoveredProduct, setHoveredProduct] = useState<(typeof ecosystemProducts)[number]['key'] | null>(null);
  const [activeFrictionCard, setActiveFrictionCard] = useState<(typeof frictionCards)[number]['key']>('guarded');
  const [hoveredFrictionCard, setHoveredFrictionCard] = useState<(typeof frictionCards)[number]['key'] | null>(null);
  const [activeProcessCard, setActiveProcessCard] = useState<(typeof processCards)[number]['key']>('processing');
  const [hoveredProcessCard, setHoveredProcessCard] = useState<(typeof processCards)[number]['key'] | null>(null);
  const [isScheduleCallModalOpen, setIsScheduleCallModalOpen] = useState(false);
  const productRefs = useRef<Record<(typeof ecosystemProducts)[number]['key'], HTMLAnchorElement | null>>({
    autoshop: null,
    autodrivecx: null,
    autoforge: null,
  });
  const frictionRefs = useRef<Record<(typeof frictionCards)[number]['key'], HTMLButtonElement | null>>({
    guarded: null,
    inconsistent: null,
    reactive: null,
    siloed: null,
  });
  const processRefs = useRef<Record<(typeof processCards)[number]['key'], HTMLButtonElement | null>>({
    input: null,
    processing: null,
    deployment: null,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('.fade-in-section');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    let frameId = 0;

    const syncActiveCard = () => {
      if (!mediaQuery.matches) {
        setActiveProduct('autodrivecx');
        return;
      }

      const viewportCenter = window.innerHeight * 0.5;
      let closestKey: (typeof ecosystemProducts)[number]['key'] = 'autodrivecx';
      let closestDistance = Number.POSITIVE_INFINITY;

      ecosystemProducts.forEach((product) => {
        const node = productRefs.current[product.key];
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = product.key;
        }
      });

      setActiveProduct((current) => (current === closestKey ? current : closestKey));
    };

    const requestSync = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncActiveCard();
      });
    };

    requestSync();
    window.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', requestSync);
    mediaQuery.addEventListener('change', requestSync);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('scroll', requestSync);
      window.removeEventListener('resize', requestSync);
      mediaQuery.removeEventListener('change', requestSync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    let frameId = 0;

    const syncActiveCard = () => {
      if (!mediaQuery.matches) {
        setActiveProcessCard('processing');
        return;
      }

      const viewportCenter = window.innerHeight * 0.5;
      let closestKey: (typeof processCards)[number]['key'] = 'processing';
      let closestDistance = Number.POSITIVE_INFINITY;

      processCards.forEach((card) => {
        const node = processRefs.current[card.key];
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = card.key;
        }
      });

      setActiveProcessCard((current) => (current === closestKey ? current : closestKey));
    };

    const requestSync = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncActiveCard();
      });
    };

    requestSync();
    window.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', requestSync);
    mediaQuery.addEventListener('change', requestSync);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('scroll', requestSync);
      window.removeEventListener('resize', requestSync);
      mediaQuery.removeEventListener('change', requestSync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    let frameId = 0;

    const syncActiveCard = () => {
      if (!mediaQuery.matches) {
        setActiveFrictionCard('guarded');
        return;
      }

      const viewportCenter = window.innerHeight * 0.5;
      let closestKey: (typeof frictionCards)[number]['key'] = 'guarded';
      let closestDistance = Number.POSITIVE_INFINITY;

      frictionCards.forEach((card) => {
        const node = frictionRefs.current[card.key];
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = card.key;
        }
      });

      setActiveFrictionCard((current) => (current === closestKey ? current : closestKey));
    };

    const requestSync = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncActiveCard();
      });
    };

    requestSync();
    window.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', requestSync);
    mediaQuery.addEventListener('change', requestSync);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('scroll', requestSync);
      window.removeEventListener('resize', requestSync);
      mediaQuery.removeEventListener('change', requestSync);
    };
  }, []);

  return (
    <AutoknerdShell
      active="home"
      primaryCta={{
        label: 'Schedule a Call',
        mobileLabel: 'Schedule a Call',
        hideOnMobile: true,
        onClick: () => setIsScheduleCallModalOpen(true),
      }}
    >
      <main className="pt-28">
        <section className="fade-in-section bg-grid-pattern relative flex min-h-[921px] flex-col items-center justify-center overflow-hidden px-6">
          <div className="animate-autoknerd-system-pulse pointer-events-none absolute inset-0 bg-[#bdfc00]/5" />
          <div className="scan-line animate-autoknerd-fast-scan opacity-20" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bdfc00]/10 blur-[120px]" />
          <div className="relative z-10 max-w-5xl text-center">
            <div className="mb-8 inline-flex items-center space-x-2 border border-[#eaffb8]/20 bg-[#eaffb8]/5 px-3 py-1 text-[10px] uppercase tracking-widest text-[#eaffb8]">
              <span className="flex h-2 w-2 rounded-full bg-[#bdfc00] animate-pulse" />
              <span>System Status: Optimal</span>
            </div>
            <h1 className="mb-6 text-[5.5rem] leading-[0.85] tracking-tighter text-[#f4f3f3] md:text-[8.5rem]">
              Diagnose behavior.
              <br />
              <span className="text-[#bdfc00]">Prescribe action.</span>
              <br />
              Drive weekly execution.
            </h1>
            <p className="mx-auto mb-4 max-w-2xl text-lg font-light leading-relaxed text-[#aaabab] md:text-xl">
              For dealerships tired of inconsistency, weak follow-through, and customer friction they can&apos;t quite explain.
            </p>
            <p className="mb-12 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Built from real dealership behavior, not theory.
            </p>
            <div className="relative mx-auto mb-12 h-px w-48 overflow-hidden bg-zinc-800">
              <div className="animate-autoknerd-scan absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-[#bdfc00] to-transparent" />
              <div className="absolute inset-0 h-full w-full opacity-30 shadow-[0_0_8px_rgba(189,252,0,0.5)]" />
            </div>
            <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsScheduleCallModalOpen(true)}
                className="glow-primary-hover w-full rounded-sm bg-[#bdfc00] px-10 py-4 text-sm font-bold uppercase tracking-widest text-[#445d00] transition-all duration-300 active:scale-95 sm:w-auto"
              >
                Schedule a Call
              </button>
              <a href="#product-ecosystem" className="w-full rounded-sm border border-[#464848] px-10 py-4 text-sm font-bold uppercase tracking-widest text-[#f4f3f3] transition-all duration-300 hover:bg-[#f4f3f3] hover:text-[#0d0f0f] active:scale-95 sm:w-auto">
                Explore the System
              </a>
            </div>
            <p className="mx-auto max-w-md border-t border-[#eaffb8]/10 pt-6 text-xs uppercase tracking-widest text-[#f4f3f3]/60">
              One system. Built to diagnose, train, and deploy better behavior across your dealership.
            </p>
          </div>
          <div className="absolute bottom-0 h-32 w-full bg-gradient-to-t from-[#0d0f0f] to-transparent" />
        </section>

        <section className="fade-in-section mx-auto max-w-7xl px-8 py-48" id="product-ecosystem">
          <div className="mb-24 text-center">
            <h3 className="mb-6 text-xl tracking-tight text-zinc-400 md:text-2xl">
              If your team sounds different from one customer to the next, your system isn&apos;t working.
            </h3>
            <h2 className="mb-4 text-4xl tracking-tighter text-[#f4f3f3] md:text-5xl">Three connected products. One performance system.</h2>
            <p className="mb-8 text-lg font-light text-[#aaabab] md:text-xl">Start where you are. Scale as your dealership grows.</p>
          </div>
          <div className="relative">
            <div className="system-connector-line absolute left-0 top-1/2 z-0 hidden h-px w-full -translate-y-1/2 items-center justify-between md:flex">
              <span className="material-symbols-outlined ml-[28%] text-xs text-[#eaffb8]/30">arrow_forward</span>
              <span className="material-symbols-outlined mr-[28%] text-xs text-[#eaffb8]/30">arrow_forward</span>
            </div>
            <div className="relative z-10 grid grid-cols-1 items-center gap-8 md:grid-cols-3">
              {ecosystemProducts.map((product) => {
                const isActive = (hoveredProduct ?? activeProduct) === product.key;
                const isPlatform = product.key === 'autodrivecx';
                const isExternal = product.href.startsWith('http');

                return (
                  <Link
                    key={product.key}
                    href={product.href}
                    aria-label={product.ariaLabel}
                    onMouseEnter={() => setHoveredProduct(product.key)}
                    onMouseLeave={() => setHoveredProduct(null)}
                    onFocus={() => setHoveredProduct(product.key)}
                    onBlur={() => setHoveredProduct(null)}
                    ref={(node) => {
                      productRefs.current[product.key] = node;
                    }}
                    data-product-key={product.key}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noreferrer' : undefined}
                    className={[
                      'group flex h-full flex-col space-y-2 text-left no-underline outline-none transition-all duration-500 ease-out focus-visible:ring-2 focus-visible:ring-[#bdfc00]/80 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d0f0f]',
                      isActive
                        ? 'z-20 scale-100 cursor-pointer opacity-100 md:scale-[1.13]'
                        : 'z-10 cursor-pointer opacity-70 md:scale-[0.94] hover:opacity-100',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'px-1 text-[10px] uppercase tracking-widest transition-colors duration-500',
                        isActive ? `font-bold ${product.accentText}` : product.accentLabelInactive,
                      ].join(' ')}
                    >
                      {product.label}
                    </span>
                    <div
                      className={[
                        'relative flex h-full flex-col overflow-hidden p-8 transition-all duration-500 ease-out',
                        isActive
                          ? `border-2 ${product.accentBorder} bg-[#232626] ${product.accentGlow} md:-translate-y-3`
                          : 'border border-[#464848]/10 bg-[#121414] md:translate-y-3 hover:border-[#eaffb8]/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]',
                      ].join(' ')}
                    >
                      {isActive && <div className={`absolute right-0 top-0 h-32 w-32 rounded-full ${product.accentOrb} blur-3xl`} />}
                      <h3 className={isActive ? 'mb-3 text-3xl text-white' : 'mb-3 text-2xl text-[#f4f3f3]'}>
                        {product.title}
                      </h3>
                      <p
                        className={[
                          'mb-8 transition-all duration-500',
                          isActive ? 'text-base font-medium leading-relaxed text-white' : 'line-clamp-2 text-sm text-[#aaabab]',
                        ].join(' ')}
                      >
                        {product.copy}
                      </p>
                      <div
                        className={[
                          'relative flex items-center justify-center overflow-hidden bg-black transition-all duration-500',
                          isActive ? `h-40 border ${product.accentImageBorder}` : 'h-32 border border-[#464848]/5',
                        ].join(' ')}
                      >
                        <div
                          className={[
                            'absolute inset-0 bg-cover bg-center transition-all duration-500',
                            isActive ? 'opacity-70' : 'opacity-20',
                          ].join(' ')}
                          style={{ backgroundImage: product.image }}
                        />
                        {isPlatform && (
                          <span
                            className={[
                              'material-symbols-outlined relative z-10 transition-all duration-500',
                              isActive
                                ? `text-5xl ${product.accentIconActive}`
                                : `text-4xl ${product.accentIconInactive}`,
                            ].join(' ')}
                            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                          >
                            {product.icon}
                          </span>
                        )}
                      </div>
                      <span
                        className={[
                          'card-cta mt-5 inline-flex items-center gap-2 self-start text-xs font-bold uppercase tracking-[0.18em] transition-all duration-300',
                          isActive ? product.accentText : `${product.accentMutedText} ${product.accentHoverText}`,
                          product.key === 'autodrivecx' ? 'opacity-95' : 'opacity-85',
                          'pointer-events-none group-hover:translate-x-1 group-hover:opacity-100',
                        ].join(' ')}
                      >
                        {product.cta}
                        <span className="cta-arrow text-sm leading-none">→</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="fade-in-section bg-[#121414] py-48">
          <div className="mx-auto max-w-7xl px-8">
            <div className="mb-24 max-w-3xl">
              <h2 className="mb-6 text-5xl tracking-tighter md:text-6xl">
                This is not a motivation problem.
                <br />
                <span className="text-[#eaffb8] opacity-90">It&apos;s a behavior consistency problem.</span>
              </h2>
              <p className="max-w-2xl text-xl leading-relaxed text-[#aaabab] md:text-2xl">
                Most dealerships don&apos;t lack the drive; they lack the infrastructure to maintain high performance across every single customer touchpoint.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-0.5 border border-[#464848]/10 bg-[#464848]/5 md:grid-cols-2 lg:grid-cols-4">
              {frictionCards.map((card) => {
                const isActive = (hoveredFrictionCard ?? activeFrictionCard) === card.key;

                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setActiveFrictionCard(card.key)}
                    onMouseEnter={() => setHoveredFrictionCard(card.key)}
                    onMouseLeave={() => setHoveredFrictionCard(null)}
                    onFocus={() => setHoveredFrictionCard(card.key)}
                    onBlur={() => setHoveredFrictionCard(null)}
                    ref={(node) => {
                      frictionRefs.current[card.key] = node;
                    }}
                    className={[
                      'group relative overflow-hidden bg-[#0d0f0f] p-10 text-left transition-all duration-500 ease-out',
                      isActive
                        ? 'border-2 border-[#bdfc00] bg-[#161919] shadow-[0_0_40px_rgba(189,252,0,0.12)]'
                        : 'border border-transparent hover:border-[#eaffb8]/20 hover:bg-[#2a2d2d]',
                    ].join(' ')}
                    aria-pressed={isActive}
                  >
                    {isActive && <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-[#bdfc00]/12 blur-3xl" />}
                    <span
                      className={[
                        'material-symbols-outlined mb-6 block text-3xl transition-colors duration-500',
                        isActive ? 'text-[#bdfc00]' : 'text-zinc-600',
                      ].join(' ')}
                    >
                      {card.icon}
                    </span>
                    <h4 className={isActive ? 'mb-4 text-xl font-medium text-[#f4f3f3]' : 'mb-4 text-xl font-medium text-[#f4f3f3]'}>
                      {card.title}
                    </h4>
                    <div
                      className={[
                        'mb-4 h-px transition-all duration-500',
                        isActive ? 'w-full bg-[#bdfc00]/40' : 'w-0 bg-[#eaffb8]/30 group-hover:w-full',
                      ].join(' ')}
                    />
                    <p
                      className={[
                        'text-sm leading-relaxed text-[#aaabab] transition-all duration-300',
                        isActive ? 'max-h-24 opacity-100' : 'max-h-0 overflow-hidden opacity-0 group-hover:max-h-24 group-hover:opacity-100',
                      ].join(' ')}
                    >
                      {card.copy}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="fade-in-section overflow-hidden px-8 py-48">
          <div className="mx-auto max-w-7xl">
            <div className="relative">
              <div className="absolute left-0 top-1/2 hidden h-px w-full bg-[#464848]/20 md:block" />
              <div className="pointer-events-none absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 overflow-hidden md:block">
                <div className="animate-autoknerd-travel h-full w-40 bg-gradient-to-r from-transparent via-[#bdfc00] to-transparent opacity-70 blur-[1px]" />
              </div>
              <div className="relative z-10 grid grid-cols-1 gap-12 md:grid-cols-3">
                {processCards.map((card) => {
                  const isActive = (hoveredProcessCard ?? activeProcessCard) === card.key;

                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => setActiveProcessCard(card.key)}
                      onMouseEnter={() => setHoveredProcessCard(card.key)}
                      onMouseLeave={() => setHoveredProcessCard(null)}
                      onFocus={() => setHoveredProcessCard(card.key)}
                      onBlur={() => setHoveredProcessCard(null)}
                      ref={(node) => {
                        processRefs.current[card.key] = node;
                      }}
                      className={[
                        'group relative text-center transition-all duration-500 ease-out',
                        isActive
                          ? 'z-20 scale-100 md:scale-[1.06]'
                          : 'z-10 md:scale-[0.96]',
                      ].join(' ')}
                      aria-pressed={isActive}
                    >
                      <div
                        className={[
                          'relative overflow-hidden p-12 transition-all duration-500 ease-out',
                          isActive
                            ? 'border-2 border-[#bdfc00] bg-[#0d0f0f] shadow-[0_0_40px_rgba(189,252,0,0.12)]'
                            : 'border border-[#464848]/10 bg-[#0d0f0f] hover:border-[#eaffb8]/20',
                        ].join(' ')}
                      >
                        {isActive && <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-[#bdfc00]/10 blur-3xl" />}
                        <span
                          className={[
                            'mb-6 block text-4xl font-black transition-colors duration-500',
                            isActive ? 'text-[#eaffb8]' : 'text-[#eaffb8]/10 group-hover:text-[#eaffb8]/30',
                          ].join(' ')}
                        >
                          {card.step}
                        </span>
                        <h3 className="mb-4 text-2xl uppercase tracking-tighter">{card.title}</h3>
                        <div
                          className={[
                            'mx-auto mb-4 h-px transition-all duration-500',
                            isActive ? 'w-24 bg-[#bdfc00]/40' : 'w-0 bg-[#eaffb8]/30 group-hover:w-16',
                          ].join(' ')}
                        />
                        <p
                          className={[
                            'leading-relaxed transition-all duration-300',
                            isActive
                              ? 'max-h-32 text-[#f4f3f3] opacity-100'
                              : 'max-h-0 overflow-hidden text-[#aaabab] opacity-0 group-hover:max-h-32 group-hover:opacity-100 md:max-h-20 md:opacity-80',
                          ].join(' ')}
                        >
                          {card.copy}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="fade-in-section px-8 pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden border border-[#464848]/15 bg-[#121414] px-8 py-12 md:px-14 md:py-16">
              <div className="pointer-events-none absolute -left-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[#bdfc00]/10 blur-[90px]" />
              <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-[#eaffb8]/8 blur-[80px]" />
              <div className="relative z-10 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Choose Your Next Step</p>
                  <h2 className="mb-4 text-3xl tracking-tighter text-[#f4f3f3] md:text-5xl">
                    Not sure which path fits your dealership best?
                  </h2>
                  <p className="max-w-2xl text-base leading-relaxed text-[#aaabab] md:text-lg">
                    Start with a guided fit check if you want clarity, or book a diagnostic if you already know you need a deeper deployment conversation.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-4 md:w-auto md:min-w-[320px]">
                  <button
                    type="button"
                    onClick={() => setIsScheduleCallModalOpen(true)}
                    className="glow-primary-hover inline-flex items-center justify-center bg-[#bdfc00] px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#445d00] transition-all duration-300 hover:brightness-110 active:scale-95"
                  >
                    Schedule a Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduleCallModalOpen(true)}
                    className="inline-flex items-center justify-center border border-[#eaffb8]/30 px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#f4f3f3] transition-all duration-300 hover:border-[#bdfc00]/50 hover:bg-[#1d2020] hover:text-[#eaffb8] active:scale-95"
                  >
                    Book AutoForge Diagnostic
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fade-in-section bg-zinc-950 py-48">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-24 px-8 md:flex-row">
            <div className="md:w-1/3">
              <h2 className="mb-8 text-5xl leading-[0.95] tracking-tighter md:text-6xl">
                Precision execution,
                <br />
                predictable growth.
              </h2>
              <div className="mb-8 h-1 w-12 bg-[#eaffb8]" />
              <p className="leading-relaxed text-[#aaabab]">
                We don&apos;t just provide software.
                <br />
                We provide a closed-loop system
                <br />
                for continuous improvement.
              </p>
            </div>
            <div className="grid gap-8 md:w-2/3 md:grid-cols-2">
              {[
                ['chat', 'Clearer conversations', 'Every interaction mapped for maximum clarity and trust.'],
                ['visibility', 'Stronger transparency', 'End-to-end visibility for both consumers and management.'],
                ['sports', 'Better coaching', 'Behavior-based data allows for surgical precision in training.'],
                ['analytics', 'Operational Velocity', 'Reduce cycle times and increase throughput without headcount.'],
              ].map(([icon, title, copy]) => (
                <div key={title} className="flex items-start space-x-4 border-l border-[#eaffb8]/30 bg-[#181a1a]/50 p-8 transition-colors hover:bg-[#181a1a]">
                  <span className="material-symbols-outlined mt-1 text-[#eaffb8]">{icon}</span>
                  <div>
                    <h4 className="mb-2 text-lg">{title}</h4>
                    <p className="text-sm leading-relaxed text-zinc-500">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fade-in-section px-8 py-48">
          <div className="relative mx-auto max-w-7xl overflow-hidden border border-[#464848]/10 bg-[#1d2020] p-12 md:p-24">
            <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#eaffb8]/5 blur-[100px]" />
            <div className="relative z-10 grid gap-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <div className="max-w-3xl">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">What Changes Next</p>
                <h2 className="mb-8 text-4xl tracking-tighter md:text-6xl">
                  AutoKnerd turns good intentions into visible operating standards.
                </h2>
                <p className="max-w-2xl text-lg leading-relaxed text-[#aaabab] md:text-xl">
                  The point is not another round of inspiration. The point is creating a dealership environment where customers experience the same clarity, consistency, and follow-through every single time.
                </p>
              </div>
              <div className="grid gap-4">
                {[
                  ['01', 'Standards become visible', 'Expectations stop living in memory and start showing up inside the daily workflow.'],
                  ['02', 'Coaching gets specific', 'Managers can correct patterns earlier instead of reacting after performance slips.'],
                  ['03', 'Execution compounds', 'The system keeps reinforcing the behaviors that create trust, speed, and stronger conversion.'],
                ].map(([step, title, copy]) => (
                  <div
                    key={step}
                    className="border border-[#464848]/20 bg-[#0d0f0f] p-8 transition-all hover:border-[#eaffb8]/30 hover:bg-[#111414]"
                  >
                    <div className="mb-4 flex items-center gap-4">
                      <span className="text-sm font-black uppercase tracking-[0.22em] text-[#bdfc00]">{step}</span>
                      <div className="h-px flex-1 bg-[#bdfc00]/15" />
                    </div>
                    <h3 className="mb-3 text-xl font-medium text-[#f4f3f3]">{title}</h3>
                    <p className="text-sm leading-relaxed text-[#aaabab]">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="fade-in-section px-8 pb-20">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsScheduleCallModalOpen(true)}
              className="glow-primary-hover inline-flex min-h-[112px] items-center justify-center bg-[#bdfc00] px-8 py-6 text-center text-2xl font-black uppercase tracking-[0.22em] text-[#445d00] transition-all duration-300 hover:brightness-110 active:scale-[0.99]"
            >
              Schedule a Call
            </button>
            <button
              type="button"
              onClick={() => setIsScheduleCallModalOpen(true)}
              className="inline-flex min-h-[112px] items-center justify-center border border-[#6e7652] bg-transparent px-8 py-6 text-center text-2xl font-black uppercase tracking-[0.18em] text-[#f4f3f3] transition-all duration-300 hover:border-[#bdfc00]/50 hover:bg-[#171919] hover:text-[#eaffb8] active:scale-[0.99]"
            >
              Book AutoForge Diagnostic
            </button>
          </div>
        </section>
      </main>
      <BeehiivSubscriberDialog
        open={isScheduleCallModalOpen}
        onOpenChange={setIsScheduleCallModalOpen}
        title="Schedule a Call"
        description="Built for dealerships that want clearer communication, stronger customer trust, and more consistent experiences."
      />
      <AutoknerdFooter />
    </AutoknerdShell>
  );
}
