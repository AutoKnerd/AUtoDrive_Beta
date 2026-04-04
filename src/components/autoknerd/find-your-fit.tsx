'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

type RoleOption = {
  id: 'consultant' | 'manager' | 'owner';
  title: string;
  description: string;
  icon: string;
  image: string;
};

type ChallengeOption = {
  id: 'consistency' | 'followup' | 'trust' | 'coaching';
  title: string;
  description: string;
  icon: string;
};

type GoalOption = {
  id: 'close-rate' | 'csi' | 'team-performance' | 'retention';
  title: string;
  description: string;
  icon: string;
};

type UrgencyOption = {
  id: 'immediate' | 'month' | 'quarter';
  title: string;
  description: string;
  badge: string;
  icon: string;
};

const roles: RoleOption[] = [
  {
    id: 'consultant',
    title: 'Consultant',
    description: 'You’re on the front lines, talking to customers every day and trying to move deals forward.',
    icon: 'query_stats',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBWOoDwSeSxlfCy0sBYdVQPshQr34AjhVK2zP4fOGrsQwr-wisSKkN8wJ__kXkj63cYqeziTsEGw6HzBrcLGbkiZmEDw4TX4PcPZSH2SAY5QqQPLek49Jwcpvki-3Aftwz-cqvx5yfjz0l4BXBtX-CVehEexvi7bCDwlxvCoeqn1k5u-52Qc2XNu_ztsP7oYnVLrNxhFYjT-7WQYuxOOZQiWbJfl3VWe6MQGmZfft2AKmVlDoPMNPYI1ST2-vGhEzuZ3vk9UwApe1E',
  },
  {
    id: 'manager',
    title: 'Manager',
    description: 'You’re responsible for your team’s performance and making sure things actually get done.',
    icon: 'lan',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBYvxeNA5OsYcW1Pn556knUjfOYXQLS6WhiguaAUqJ1W-ZJcHSC2oUWAtI05Uqaboq_2d7rpux6Xsg_ve2oYz9YcedR8Dqi0-D0Rrwr8iaAWOJ9IPJ6ZILTg0YuoUgUDhFBJof_-q2_y3o2H-Pg31mCVzYfD0D2QSZ8lVSb-ztSxFlFmRURZiejXD02-dgaI7NwedbSkgg3HOZV0_-3XDoPccU-n5uNq5tdU3w7k7dmkl3mcuChatF2c6IuX42lwHTRx3o6f4GVgaI',
  },
  {
    id: 'owner',
    title: 'Leader / Owner',
    description: 'You’re focused on results across the entire dealership and how everything connects.',
    icon: 'workspace_premium',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuALB9PrLi_TQiqf0mVSPV4yjZ6hYKjF3g36M5FRLKXrF3vKQFcG-2AZJA8hrXnLnDpideQsuxF0WWojW1-bhgqBpvYGFMFkJTXupNwXuRSo5qSaBApY58JXx0Xy2aca-pL83zG5-fgzq3lCCOo2F6nqcIuvrG5Y9mrmkdicc-qlxbQ8na-o4OIW-w1EQfw9RJd9G-nVyQbjfzg1tR7PYdcAafqG7PCN_5MmZHtDVZd7YQUu_BQb-e0CvlEVD_YuR5oTHC9K5mAwP18',
  },
];

const challenges: ChallengeOption[] = [
  {
    id: 'consistency',
    title: 'Inconsistent behavior',
    description: 'Customers get a different experience depending on who they talk to.',
    icon: 'speed',
  },
  {
    id: 'followup',
    title: 'Weak follow-up',
    description: 'Opportunities leak out after the first interaction because the next move is not clear.',
    icon: 'history',
  },
  {
    id: 'trust',
    title: 'Customer friction',
    description: 'Deals stall because confidence drops when the process feels uneven or unclear.',
    icon: 'verified_user',
  },
  {
    id: 'coaching',
    title: 'Management drift',
    description: 'Managers coach differently, so behavior standards do not hold team-wide.',
    icon: 'groups',
  },
];

const goals: GoalOption[] = [
  {
    id: 'close-rate',
    title: 'Increase close rate',
    description: 'Turn more conversations into actual deals.',
    icon: 'trending_up',
  },
  {
    id: 'csi',
    title: 'Improve customer experience (CSI)',
    description: 'Create smoother, more confident experiences for your customers.',
    icon: 'sentiment_very_satisfied',
  },
  {
    id: 'team-performance',
    title: 'Get consistent team performance',
    description: 'Make sure everyone on your team performs at the same level.',
    icon: 'groups',
  },
  {
    id: 'retention',
    title: 'Fix follow-up and retention',
    description: 'Stay connected with customers and stop losing them after the first interaction.',
    icon: 'history',
  },
];

const urgencyOptions: UrgencyOption[] = [
  {
    id: 'immediate',
    title: 'Need traction now',
    description: 'You want a system the team can start using this week.',
    badge: 'Day 7',
    icon: 'bolt',
  },
  {
    id: 'month',
    title: 'Need momentum this month',
    description: 'You are ready to clean up process and coaching in the near term.',
    badge: '30 Days',
    icon: 'schedule',
  },
  {
    id: 'quarter',
    title: 'Planning for the quarter',
    description: 'You want the right long-view system before rolling it out broadly.',
    badge: 'Quarter',
    icon: 'flag',
  },
];

const stepMeta = [
  { label: 'Role', icon: 'person_search' },
  { label: 'Challenges', icon: 'speed' },
  { label: 'Goals', icon: 'target' },
  { label: 'Urgency', icon: 'bolt' },
] as const;

export function FindYourFit() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<RoleOption['id']>('manager');
  const [challenge, setChallenge] = useState<ChallengeOption['id']>('consistency');
  const [goal, setGoal] = useState<GoalOption['id']>('team-performance');
  const [urgency, setUrgency] = useState<UrgencyOption['id']>('immediate');

  const currentGoal = goals.find((item) => item.id === goal) ?? goals[2];
  const currentRole = roles.find((item) => item.id === role) ?? roles[1];
  const currentUrgency = urgencyOptions.find((item) => item.id === urgency) ?? urgencyOptions[0];
  const isRecommendationStep = step === 4;

  const alignmentScore = useMemo(() => {
    let score = 84;
    if (role === 'consultant') score -= 6;
    if (role === 'owner') score += 4;
    if (challenge === 'consistency') score -= 4;
    if (challenge === 'coaching') score -= 2;
    if (goal === 'team-performance') score += 3;
    if (urgency === 'immediate') score -= 1;
    if (urgency === 'quarter') score += 2;
    return `${Math.max(68, Math.min(96, score))}%`;
  }, [challenge, goal, role, urgency]);

  const urgencyLabel = urgency === 'immediate' ? 'CRITICAL' : urgency === 'month' ? 'ELEVATED' : 'ACTIVE';
  const modelType = role === 'owner' ? 'Enterprise V3' : role === 'consultant' ? 'Tactical V1' : 'Hybrid V2';

  const diagnosticNarrative = useMemo(() => {
    if (role === 'owner') {
      return 'Based on your profile, you need dealership-wide accountability and stronger execution architecture to protect performance across every department.';
    }

    if (role === 'consultant') {
      return 'Based on your profile, you need stronger behavior consistency and practical support inside real customer conversations to create momentum fast.';
    }

    return 'Based on your profile, you need stronger behavior consistency and coaching structure to reach your quarterly dealership targets.';
  }, [role]);

  const nextMilestone = currentUrgency.badge;
  const primaryButtonLabel =
    role === 'owner' ? 'Book AutoForge Diagnostic' : role === 'consultant' ? 'Start with AutoShop' : 'Start AutoDriveCX';
  const tertiaryButtonLabel =
    role === 'owner' ? 'Start AutoDriveCX' : role === 'consultant' ? 'Start AutoDriveCX' : 'Book AutoForge Diagnostic';

  const recommendation = useMemo(() => {
    if (role === 'owner') {
      return {
        primaryTitle: 'Book AutoForge Diagnostic',
        primaryDescription:
          'When this needs to be fixed across your entire dealership, this is the move.',
        primaryHref: '/autoforge',
        secondaryTitle: 'Fix your biggest gaps in the next 7 days with AutoShop tools',
        secondaryDescription: 'Start plugging the biggest process leaks while the larger rollout gets scoped.',
        secondaryHref: '/tools',
        tertiaryTitle: 'Build the operating system underneath the results',
        tertiaryDescription: 'Use AutoDriveCX to monitor behavior patterns, reinforce standards, and keep the team aligned while the larger diagnostic is underway.',
        tertiaryHref: '/login',
      };
    }

    if (role === 'consultant') {
      return {
        primaryTitle: 'Start with AutoShop tools',
        primaryDescription: 'This is what gives you practical support you can use immediately in customer conversations.',
        primaryHref: '/tools',
        secondaryTitle: 'Fix your biggest gaps in the next 7 days with AutoShop tools',
        secondaryDescription: 'Quick-deployment tools for follow-up, trust-building, and customer-facing consistency.',
        secondaryHref: '/tools',
        tertiaryTitle: 'Fix this across your entire team with AutoDriveCX',
        tertiaryDescription: 'When you need coaching visibility and ongoing behavior feedback, this is the layer that keeps performance from slipping.',
        tertiaryHref: '/login',
      };
    }

    return {
      primaryTitle: 'Start with AutoDriveCX',
      primaryDescription: 'This is what turns inconsistency into predictable performance.',
      primaryHref: '/login',
      secondaryTitle: 'Fix your biggest gaps in the next 7 days with AutoShop tools',
      secondaryDescription: 'Quick-deployment utility kit for immediate shop floor optimization and technician tracking.',
      secondaryHref: '/tools',
      tertiaryTitle: 'Fix this across your entire dealership',
      tertiaryDescription: 'When this needs to be fixed across your entire dealership, this is the move.',
      tertiaryHref: '/autoforge',
    };
  }, [role]);

  const nextStep = () => setStep((value) => Math.min(value + 1, 4));
  const previousStep = () => setStep((value) => Math.max(value - 1, 0));

  return (
    <AutoknerdShell active="fit">
      <aside className="fixed left-0 top-28 hidden h-screen w-64 flex-col bg-[#121414] py-8 md:flex">
        <div className="mb-8 px-6">
          <h2 className="text-lg font-black text-[#BFFF00]">Diagnostic</h2>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-[#464848]">Precision Intelligence</p>
        </div>
        <nav className="flex flex-col">
          {stepMeta.map((item, index) => {
            const active = index === Math.min(step, 3);
            const complete = index < Math.min(step, 4);
            return (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-4 px-6 py-4 text-xs uppercase tracking-widest transition-all duration-300',
                  active
                    ? 'cursor-default border-l-4 border-[#BFFF00] bg-[#181a1a] text-[#BFFF00]'
                    : complete
                      ? 'cursor-pointer text-[#BFFF00]/75 hover:bg-[#232626] hover:text-[#f4f3f3]'
                      : 'cursor-pointer text-[#464848] opacity-60 hover:bg-[#232626] hover:text-[#f4f3f3]'
                )}
              >
                <span
                  className="material-symbols-outlined"
                  style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-xs uppercase tracking-widest">{item.label}</span>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className={cn('min-h-screen overflow-hidden px-6 pb-24 pt-36 md:pl-64', isRecommendationStep ? 'relative' : 'technical-grid')}>
        {isRecommendationStep && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-20" />
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#bdfc00]/10 blur-[120px]" />
            <div className="absolute -left-24 top-1/2 h-64 w-64 rounded-full bg-[#e6ea5a]/5 blur-[100px]" />
          </>
        )}
        <div className="relative z-10 mx-auto max-w-6xl md:px-12">
          <div
            className={cn(
              'mb-12',
              step === 4
                ? 'hidden'
                : step === 2
                  ? 'border-b-0 pb-0'
                  : 'flex items-end justify-between border-b border-[#464848]/20 pb-6'
            )}
          >
            <div className="w-full">
              {step === 2 ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#b1ed00]">Diagnostic Module 03</span>
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#aaabab]">Step 3 of 5</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden bg-[#232626]">
                    <div className="h-full w-3/5 bg-[#bdfc00] shadow-[0_0_15px_rgba(189,252,0,0.4)] transition-all duration-1000" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdfc00]">
                      Identifying performance benchmarks...
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#747675]">
                      This takes less than a minute.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2 inline-flex items-center gap-2">
                    {stepMeta.map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          'h-1 w-8',
                          index <= Math.min(step, 3) ? 'bg-[#bdfc00]' : 'bg-[#232626]'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs uppercase tracking-widest text-[#b1ed00]">
                    {step < 4 ? `Step ${step + 1} of 4` : 'Diagnostic Complete'}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#747675]">
                    {step < 4 ? 'This takes less than a minute.' : 'Recommendation ready.'}
                  </p>
                </>
              )}
              {step === 0 && (
                <>
                  <h1 className="mt-2 text-4xl font-bold tracking-tighter text-[#f4f3f3] md:text-5xl">
                    What best describes your role?
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg text-[#aaabab]">
                    This helps us tailor the system to how you actually work.
                  </p>
                </>
              )}
              {step === 1 && (
                <>
                  <h1 className="mt-2 text-4xl font-bold tracking-tighter text-[#f4f3f3] md:text-5xl">
                    What problem feels most urgent?
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg text-[#aaabab]">
                    Pick the friction that is costing you the most right now.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  <h1 className="mt-2 text-5xl font-bold tracking-tighter leading-none text-[#f4f3f3] md:text-7xl">
                    What are you trying to <span className="bg-gradient-to-r from-[#bdfc00] to-[#eaffb8] bg-clip-text text-transparent">improve</span> right now?
                  </h1>
                  <p className="mt-6 max-w-2xl text-lg font-light text-[#aaabab]">
                    This helps us focus the system on what actually matters to you.
                  </p>
                  <p className="mt-2 text-sm font-medium uppercase tracking-widest italic text-[#bdfc00]/80">
                    Most teams try to fix everything. The best teams focus on one thing first.
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <h1 className="mt-2 text-4xl font-bold tracking-tighter text-[#f4f3f3] md:text-5xl">
                    How quickly do you need to move?
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg text-[#aaabab]">
                    This helps us point you to the right entry point.
                  </p>
                </>
              )}
              {step === 4 && (
                <>
                  <h1 className="mt-2 text-4xl font-bold tracking-tighter text-[#f4f3f3] md:text-5xl">
                    You&apos;re losing performance to inconsistent behavior...
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg text-[#aaabab]">
                    ...and you need a system built for {currentGoal.title.toLowerCase()}.
                  </p>
                </>
              )}
            </div>
            <div className={cn('hidden text-right lg:block', step === 2 && 'hidden')}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#747675]">
                {step < 4 ? 'Module: ID_VERIFICATION' : 'Module: RECOMMENDATION_ENGINE'}
              </p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#747675]">
                {step < 4 ? 'Status: SCANNING_USER_PROFILE' : 'Status: TARGET_LOCKED'}
              </p>
            </div>
          </div>

          {step === 0 && (
            <section>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {roles.map((item) => {
                  const selected = item.id === role;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRole(item.id)}
                      className={cn(
                        'group relative overflow-hidden text-left transition-all duration-300',
                        selected
                          ? 'border-2 border-[#bdfc00] bg-[#1d2020] shadow-[0_0_30px_rgba(189,252,0,0.1)]'
                          : 'border border-[#464848]/20 bg-[#181a1a] hover:border-[#bdfc00]/50'
                      )}
                    >
                      <div className={cn('absolute inset-0 transition-opacity', selected ? 'bg-gradient-to-br from-[#bdfc00]/10 to-transparent opacity-100' : 'bg-gradient-to-br from-[#bdfc00]/5 to-transparent opacity-0 group-hover:opacity-100')} />
                      <div className="relative flex min-h-[320px] flex-col p-8">
                        <div className="mb-auto">
                          <div className={cn('mb-6 flex h-12 w-12 items-center justify-center', selected ? 'bg-[#bdfc00] text-[#445d00]' : 'bg-[#232626] text-[#eaffb8]')}>
                            <span
                              className="material-symbols-outlined text-3xl"
                              style={selected ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
                            >
                              {item.icon}
                            </span>
                          </div>
                          <h3 className={cn('text-2xl font-bold transition-colors', selected ? 'text-[#eaffb8]' : 'text-[#f4f3f3] group-hover:text-[#eaffb8]')}>
                            {item.title}
                          </h3>
                          <p className={cn('mt-4 text-sm leading-relaxed', selected ? 'text-[#f4f3f3]' : 'text-[#aaabab]')}>
                            {item.description}
                          </p>
                        </div>
                        <div className="mt-8 flex items-center justify-between">
                          {selected ? (
                            <>
                              <span className="text-[10px] uppercase tracking-widest text-[#eaffb8]">This is me</span>
                              <span className="material-symbols-outlined text-[#bdfc00]">check_circle</span>
                            </>
                          ) : (
                            <span className="material-symbols-outlined text-[#747675] transition-colors group-hover:text-[#bdfc00]">
                              arrow_forward_ios
                            </span>
                          )}
                        </div>
                      </div>
                      <img
                        alt=""
                        className={cn(
                          'absolute -bottom-12 -right-12 h-48 w-48 object-cover transition-all duration-500',
                          selected ? 'opacity-20' : 'opacity-10 grayscale group-hover:opacity-20 group-hover:grayscale-0'
                        )}
                        src={item.image}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {challenges.map((item) => {
                const selected = item.id === challenge;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChallenge(item.id)}
                    className={cn(
                      'border p-8 text-left transition-all duration-300',
                      selected ? 'border-[#bdfc00] bg-[#1d2020] shadow-[0_0_20px_rgba(189,252,0,0.12)]' : 'border-[#464848]/20 bg-[#181a1a] hover:border-[#bdfc00]/40 hover:bg-[#1d2020]'
                    )}
                  >
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center bg-[#232626] text-[#eaffb8]">
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      {selected && <span className="material-symbols-outlined text-[#bdfc00]">check_circle</span>}
                    </div>
                    <h3 className={cn('text-2xl font-bold', selected && 'text-[#eaffb8]')}>{item.title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-[#aaabab]">{item.description}</p>
                  </button>
                );
              })}
            </section>
          )}

          {step === 2 && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              {goals.map((item) => {
                const selected = item.id === goal;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGoal(item.id)}
                    className={cn(
                      'group relative flex min-h-[280px] flex-col justify-between p-8 text-left transition-all duration-300',
                      selected
                        ? 'border-2 border-[#bdfc00] bg-[#1d2020] shadow-[0_0_30px_rgba(189,252,0,0.1)]'
                        : 'border border-[#464848]/10 bg-[#181a1a] hover:-translate-y-1 hover:border-[#bdfc00]/30 hover:bg-[#1d2020] hover:shadow-[0_0_20px_rgba(189,252,0,0.15)]'
                    )}
                  >
                    <div className={cn('absolute right-0 top-0 p-8', selected ? 'opacity-100' : 'opacity-10 transition-opacity group-hover:opacity-100')}>
                      <span className="material-symbols-outlined text-4xl text-[#bdfc00]" style={selected ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>
                        {item.icon}
                      </span>
                    </div>
                    <div>
                      {selected && (
                        <div className="mb-4 inline-block bg-[#bdfc00] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
                          This is the priority
                        </div>
                      )}
                      <div
                        className={cn(
                          'mb-6 flex h-12 w-12 items-center justify-center border',
                          selected ? 'bg-[#bdfc00] text-black' : 'border-[#464848]/20 bg-[#232626] text-[#bdfc00]'
                        )}
                      >
                        <span className="material-symbols-outlined" style={selected ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>
                          {item.icon}
                        </span>
                      </div>
                      <h3 className={cn('text-2xl font-bold transition-colors', selected ? 'text-[#bdfc00]' : 'text-[#f4f3f3] group-hover:text-[#bdfc00]')}>
                        {item.title}
                      </h3>
                      <p className={cn('mt-4 max-w-xs text-sm leading-relaxed', selected ? 'text-[#f4f3f3]' : 'text-[#aaabab]')}>
                        {item.description}
                      </p>
                    </div>
                    <div className={cn('mt-8 flex items-center gap-2 border-t pt-6 text-xs font-bold uppercase tracking-widest', selected ? 'border-[#bdfc00]/20 text-[#bdfc00]' : 'border-[#464848]/10 text-[#bdfc00]/70 group-hover:text-[#bdfc00]')}>
                      <span>Prioritize this</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                  </button>
                );
              })}
            </section>
          )}

          {step === 3 && (
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {urgencyOptions.map((item) => {
                const selected = item.id === urgency;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setUrgency(item.id)}
                    className={cn(
                      'border p-8 text-left transition-all duration-300',
                      selected ? 'border-[#bdfc00] bg-[#1d2020] shadow-[0_0_20px_rgba(189,252,0,0.12)]' : 'border-[#464848]/20 bg-[#181a1a] hover:border-[#bdfc00]/40 hover:bg-[#1d2020]'
                    )}
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#bdfc00]">{item.badge}</span>
                      {selected ? <span className="material-symbols-outlined text-[#bdfc00]">check_circle</span> : <span className="material-symbols-outlined text-[#747675]">{item.icon}</span>}
                    </div>
                    <h3 className={cn('text-2xl font-bold', selected && 'text-[#eaffb8]')}>{item.title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-[#aaabab]">{item.description}</p>
                  </button>
                );
              })}
            </section>
          )}

          {step === 4 && (
            <section>
              <div className="mb-16">
                <div className="mb-6 inline-flex items-center gap-2 rounded-sm border border-[#464848] bg-[#232626] px-3 py-1">
                  <span className="material-symbols-outlined text-sm text-[#eaffb8]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                    verified
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aaabab]">Diagnostic Complete</span>
                </div>
                <h1 className="mb-6 text-5xl font-bold leading-[0.95] md:text-7xl">
                  <span className="mb-2 block">You&apos;re losing performance to inconsistent behavior...</span>
                  <span className="mb-2 block text-[#aaabab]">...and weak coaching structure.</span>
                  <span className="block text-[#bdfc00]">Fixing that is what unlocks your next level of results.</span>
                </h1>
                <p className="mb-6 text-lg font-medium uppercase tracking-wider text-[#bdfc00]">Start fixing this now:</p>
                <div className="max-w-2xl">
                  <p className="text-xl font-light leading-relaxed text-[#aaabab]">
                    {diagnosticNarrative.includes('need ') ? (
                      <>
                        {diagnosticNarrative.split('need ')[0]}
                        need <span className="font-medium text-[#f4f3f3]">{diagnosticNarrative.split('need ')[1]}</span>
                      </>
                    ) : (
                      diagnosticNarrative
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-stretch">
                <div className="group relative flex flex-col overflow-hidden border border-[#464848]/20 bg-[#181a1a] md:col-span-7">
                  <div className="absolute right-0 top-0 p-4">
                    <span className="material-symbols-outlined text-[80px] text-[#bdfc00] opacity-20 transition-opacity group-hover:opacity-100">
                      auto_mode
                    </span>
                  </div>
                  <div className="flex-1 p-8">
                    <div className="mb-8 flex items-center gap-2">
                      <span className="h-1 w-8 bg-[#bdfc00]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#bdfc00]">Start here first</span>
                    </div>
                    <h3 className="mb-4 text-3xl font-bold">{recommendation.primaryTitle}</h3>
                    <p className="mb-8 leading-relaxed text-[#aaabab]">{recommendation.primaryDescription}</p>
                    <p className="mt-[-1.5rem] mb-8 text-sm italic font-medium text-[#bdfc00]/80">
                      {role === 'owner'
                        ? 'This is where leadership gets control.'
                        : role === 'consultant'
                          ? 'This is where reps start building repeatable confidence.'
                          : 'This is where most teams finally get control.'}
                    </p>
                    <ul className="mb-10 space-y-4">
                      <li className="flex items-center gap-3 text-sm">
                        <span className="material-symbols-outlined text-lg text-[#bdfc00]">check_circle</span>
                        <span>
                          {role === 'owner'
                            ? 'Dealership-wide performance architecture'
                            : role === 'consultant'
                              ? 'Practical scripts and conversation tools'
                              : 'Real-time behavioral monitoring'}
                        </span>
                      </li>
                      <li className="flex items-center gap-3 text-sm">
                        <span className="material-symbols-outlined text-lg text-[#bdfc00]">check_circle</span>
                        <span>
                          {role === 'owner'
                            ? 'Executive visibility and accountability design'
                            : role === 'consultant'
                              ? 'Immediate follow-up structure'
                              : 'Automated follow-up sequences'}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="p-8 pt-0">
                    <Link href={recommendation.primaryHref} className="inline-flex w-full items-center justify-center bg-[#bdfc00] px-8 py-4 text-sm font-bold tracking-tight text-[#445d00] transition-all hover:shadow-[0_0_20px_rgba(189,252,0,0.3)] active:scale-95 md:w-auto">
                      {primaryButtonLabel}
                    </Link>
                  </div>
                  <img
                    alt=""
                    className="h-48 w-full object-cover opacity-30 grayscale transition-all duration-500 hover:grayscale-0"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaXNeSfXs6f7vJPkG-i9lQP6wFN01NAWYTvBetVCQ_VwvGFNLGOoGGkYZJ4ts3GFU7rzLlCTHQS5DRh2KQWATmAqfmLfD1KNc-VYL_0ShEokLm1UhzhhhZXFX11n-UWmLjSv5yTmVCMKEa-gZ52H9y0o-UmLvaFtJGz25pPkjsQ2gjDkJBA6KSLrMgcomNETDQEjm9aotuuHjFlh8BvqrVDg1b5hyhIg_B3qfINPka2zRkzTncrUEy94G5WkxuXkc-qICVnAPp0Uk"
                  />
                </div>

                <div className="flex flex-col gap-6 md:col-span-5">
                  <div className="glass-panel flex flex-1 flex-col justify-between border border-[#464848]/20 p-8">
                    <div>
                      <div className="mb-6 flex h-12 w-12 items-center justify-center bg-[#232626]">
                        <span className="material-symbols-outlined text-[#e6ea5a]">build</span>
                      </div>
                      <h3 className="mb-3 text-2xl font-bold">{recommendation.secondaryTitle}</h3>
                      <p className="mb-6 text-sm leading-relaxed text-[#aaabab]">{recommendation.secondaryDescription}</p>
                    </div>
                    <Link href={recommendation.secondaryHref} className="group inline-flex items-center gap-2 text-sm font-bold text-[#eaffb8]">
                      Explore Tools
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </Link>
                  </div>
                  <div className="flex flex-1 flex-col justify-between border border-[#464848]/20 bg-[#1d2020] p-8">
                    <div>
                      <div className="mb-6 flex h-12 w-12 items-center justify-center bg-[#232626]">
                        <span className="material-symbols-outlined text-[#fff4c0]">hub</span>
                      </div>
                      <h3 className="mb-3 text-2xl font-bold">{recommendation.tertiaryTitle}</h3>
                      <p className="mb-6 text-sm leading-relaxed text-[#aaabab]">{recommendation.tertiaryDescription}</p>
                    </div>
                    <Link
                      href={recommendation.tertiaryHref}
                      className="inline-flex w-full items-center justify-center border border-[#747675] px-6 py-3 text-sm font-bold transition-colors hover:bg-[#232626] md:w-auto"
                    >
                      {tertiaryButtonLabel}
                    </Link>
                  </div>
                </div>
              </div>

              <p className="mb-4 mt-16 text-sm font-medium uppercase tracking-widest text-[#aaabab]">
                Here&apos;s what this looks like right now:
              </p>
              <div className="mt-6 grid grid-cols-2 gap-8 border-t border-[#464848]/20 pt-12 md:grid-cols-4">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[#aaabab]">Alignment Score</p>
                  <p className="text-3xl font-bold text-[#bdfc00]">{alignmentScore}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[#aaabab]">Urgency Level</p>
                  <p className="text-3xl font-bold text-[#ff7351]">{urgencyLabel}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[#aaabab]">Model Type</p>
                  <p className="text-3xl font-bold">{modelType}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[#aaabab]">Next Milestone</p>
                  <p className="text-3xl font-bold">{nextMilestone}</p>
                </div>
              </div>
            </section>
          )}

          {step < 4 && (
            <div className="mt-16 flex flex-col items-center justify-between gap-8 border-t border-[#464848]/10 pt-12 md:flex-row">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={previousStep}
                  disabled={step === 0}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                    step === 0
                      ? 'cursor-not-allowed border-[#464848]/20 text-[#464848]/40'
                      : 'border-[#464848]/30 text-[#747675] hover:border-[#f4f3f3] hover:text-[#f4f3f3]'
                  )}
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <span className="text-xs uppercase tracking-widest text-[#747675]">Back to previous</span>
              </div>
              <button
                type="button"
                onClick={nextStep}
                className="w-full bg-[#bdfc00] px-12 py-4 text-sm font-bold uppercase tracking-widest text-[#445d00] transition-all hover:shadow-[0_0_20px_rgba(189,252,0,0.4)] active:scale-95 md:w-auto"
              >
                {step === 0 ? 'Continue to Challenges' : step === 1 ? 'Continue to Goals' : step === 2 ? 'Continue →' : 'See Recommendation'}
              </button>
            </div>
          )}

          {!isRecommendationStep && (
            <div className="mt-24 grid grid-cols-2 gap-8 opacity-10 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest">System Latency</span>
                <span className="text-xs font-mono">14ms</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest">Engine Load</span>
                <span className="text-xs font-mono">0.02%</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest">Auth Token</span>
                <span className="text-xs font-mono">VALID_2024</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest">Protocol</span>
                <span className="text-xs font-mono">HTTP/3_QUIC</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {step === 2 && (
        <div className="fixed bottom-8 right-8 z-20 hidden lg:block">
          <div className="border border-[#464848]/20 bg-[#232626]/80 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#eaffb8] shadow-[0_0_8px_#bdfc00]" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#f4f3f3]">System Status: Active</div>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase text-[#aaabab]">Goal_Alignment_Engaged</div>
          </div>
        </div>
      )}

      {isRecommendationStep && (
        <nav className="fixed bottom-0 left-0 z-50 grid h-16 w-full grid-cols-4 border-t border-[#464848]/20 bg-[#1d2020] md:hidden">
          <button className="flex flex-col items-center justify-center text-[#bdfc00]" type="button">
            <span className="material-symbols-outlined">bolt</span>
            <span className="mt-1 text-[10px]">Status</span>
          </button>
          <button className="flex flex-col items-center justify-center text-[#aaabab]" type="button">
            <span className="material-symbols-outlined">insights</span>
            <span className="mt-1 text-[10px]">Data</span>
          </button>
          <button className="flex flex-col items-center justify-center text-[#aaabab]" type="button">
            <span className="material-symbols-outlined">shopping_cart</span>
            <span className="mt-1 text-[10px]">Tools</span>
          </button>
          <button className="flex flex-col items-center justify-center text-[#aaabab]" type="button">
            <span className="material-symbols-outlined">account_circle</span>
            <span className="mt-1 text-[10px]">Profile</span>
          </button>
        </nav>
      )}
    </AutoknerdShell>
  );
}
