"use client";

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Bolt,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ListChecks,
  Search,
  Send,
  ShieldCheck,
  TimerOff,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type PainCard = {
  icon: LucideIcon;
  title: string;
  body: string;
};

type Step = {
  number: string;
  icon: LucideIcon;
  title: string;
};

type LeadFormState = {
  name: string;
  email: string;
  dealershipName: string;
  role: string;
};

const painCards: PainCard[] = [
  {
    icon: Users,
    title: 'Confidence breaks fast',
    body: 'Customers lose confidence because every employee delivers a different experience.',
  },
  {
    icon: Gauge,
    title: 'Training spend evaporates',
    body: 'Thousands spent on training disappears before it ever hits the floor.',
  },
  {
    icon: TimerOff,
    title: 'The 7-day memory gap',
    body: 'Your team forgets most training within a week without reinforcement.',
  },
];

const implementationSteps = [
  { title: 'Select your missions', icon: ListChecks },
  { title: 'Assign automatically', icon: Send },
  { title: 'Track and verify instantly', icon: Bolt },
];

const processSteps: Step[] = [
  { number: '01', icon: Search, title: 'Identify leakage' },
  { number: '02', icon: Send, title: 'Deploy weekly mission' },
  { number: '03', icon: Users, title: 'Run 10-minute session' },
  { number: '04', icon: ClipboardCheck, title: 'Verify behavior' },
  { number: '05', icon: ShieldCheck, title: 'Standardize' },
];

const outcomes = [
  'Consistent sales workflow',
  'Locked-in service experience',
  'Verified management accountability',
];

const initialLeadForm: LeadFormState = {
  name: '',
  email: '',
  dealershipName: '',
  role: '',
};

function Section({
  image,
  children,
  className = '',
  overlayClassName = '',
}: {
  image: string;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
}) {
  return (
    <section className={`relative overflow-hidden border-b border-white/10 ${className}`}>
      <div className="absolute inset-0">
        <img src={image} alt="" className="h-full w-full object-cover" />
        <div
          className={`absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.36),rgba(10,10,10,0.88)),linear-gradient(90deg,rgba(10,10,10,0.94),rgba(10,10,10,0.46)_54%,rgba(10,10,10,0.94))] ${overlayClassName}`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>
      <div className="relative mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">{children}</div>
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[0.78rem] font-extrabold uppercase tracking-[0.22em] text-white/50">{children}</p>;
}

export default function AutoForgePageClient() {
  const { toast } = useToast();
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'form' | 'schedule'>('form');
  const [leadForm, setLeadForm] = useState<LeadFormState>(initialLeadForm);
  const [submittedLead, setSubmittedLead] = useState<LeadFormState | null>(null);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const openLeadModal = () => {
    setModalStep('form');
    setIsLeadModalOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsLeadModalOpen(open);
    if (!open) {
      setModalStep('form');
    }
  };

  const handleLeadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.dealershipName || !leadForm.role || isSubmittingLead) {
      return;
    }

    const payload = { ...leadForm };
    setIsSubmittingLead(true);

    try {
      const response = await fetch('/api/autoforge/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to save your AutoForge request.');
      }

      setSubmittedLead(payload);
      window.sessionStorage.setItem('autoforgeLead', JSON.stringify(payload));
      setModalStep('schedule');
    } catch (error) {
      toast({
        title: 'Lead capture failed',
        description: error instanceof Error ? error.message : 'Unable to save your AutoForge request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleScheduleRedirect = () => {
    if (submittedLead) {
      window.sessionStorage.setItem('autoforgeLead', JSON.stringify(submittedLead));
    }
    setIsLeadModalOpen(false);
    window.location.href = 'https://calendar.app.google/zjo3gkPHR74buJ7f9';
  };

  return (
    <>
      <main className="min-h-screen bg-[#0a0a0a] text-[#ece8e4]">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgba(10,10,10,0.78)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
            <a href="/autoforge" className="inline-flex items-center" aria-label="AutoForge">
              <img src="/AutoForge%20logo.png" alt="AutoForge" className="h-12 w-auto md:h-14" />
            </a>

            <a
              href="/login"
              className="inline-flex min-h-[46px] items-center justify-center bg-[#cc0000] px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(204,0,0,0.24)] transition hover:bg-[#e00000]"
            >
              Log In
            </a>
          </div>
        </header>

        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrPeL72sI4RNZv7AlDZZBUAN_xbgW9cKb4cdDSXxUG9QjB-XaagynWSZhcjpeV79ywH6oasQRiBAa6BEl4Cx1uNiaf6sRrIsgMbPC3oeBh-fMchIa_VW3SCxReddMdPaSI5AU-3-uKrZLcY4KaWQ-pMczfKC1kj-iicbK27q_D8dZH3h3xwPHd_id5QnUEgimV4mCiozOYg1C49o34TdnlCp5J9t8FyXLJGSCsYMW5MVpWzjNc8nSZ0EqAjjhk5oJoArNdgi-Fn0vg"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.32),rgba(10,10,10,0.9)),linear-gradient(90deg,rgba(10,10,10,0.95),rgba(10,10,10,0.38)_56%,rgba(10,10,10,0.92))]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px]" />
          </div>
          <div className="relative mx-auto flex min-h-[92vh] max-w-7xl items-center px-5 py-28 md:px-8">
            <div className="max-w-5xl">
              <Kicker>AutoForge | The Weekly Execution System</Kicker>
              <h1 className="max-w-[9ch] font-[family-name:var(--font-heading)] text-[clamp(3.4rem,11vw,8.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.04em] text-white">
                Execution is <span className="text-[#00ff66]">profit.</span>
              </h1>
              <p className="mt-6 max-w-3xl font-[family-name:var(--font-heading)] text-[clamp(1.35rem,3vw,2.2rem)] font-extrabold uppercase leading-[1.08] text-white">
                Most dealerships don’t have a knowledge problem. They have a consistency problem.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/75 md:text-lg">
                If your team isn’t improving every week, your dealership is falling behind.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={openLeadModal}
                  className="inline-flex min-h-[60px] items-center justify-center bg-[#00ff66] px-6 py-4 font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-black shadow-[0_0_34px_rgba(0,255,102,0.16)]"
                >
                  Deploy the System
                </button>
                <a
                  href="/tools"
                  className="inline-flex min-h-[60px] items-center justify-center border border-white/25 bg-white/5 px-6 py-4 font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-white"
                >
                  Start With Free Tools
                </a>
              </div>
            </div>
          </div>
        </section>

        <Section image="https://lh3.googleusercontent.com/aida-public/AB6AXuAGbUZq34xmfJiikuvYndigAmPDHfiyKAKnnfsWbBHwbuEdIHh5RIxBTn4-oV3jF_ivReZpK8g2dMC_g2lUSWUf-TeJ9cRFpujBRA_NnuZCukUd1PU2_wU8P7KgK5dnBtSeaawSff1VOMRHHzDvNF1AKQBHkE0sBzeYeO83aen65i5QkHG6E8tAvQr2wORiKNWRXgf7FMqW8AW5xCTuTdeuJXtBfPREY94E86uNsSqYdt0pj451J9oww4Dy71O2pecYWkoE0bfbZB6J">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <Kicker>The breakdown</Kicker>
              <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.15rem,5vw,4.4rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.04em] text-white">
                Training isn&apos;t your problem.
                <br />
                <span className="text-[#cc0000]">Execution is.</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-white/75 md:text-lg">
                Dealerships spend thousands on training that never sticks. Without a system to reinforce
                behavior weekly, teams fall back into old habits.
              </p>
              <a
                href="#cta"
                className="mt-6 inline-flex items-center gap-2 text-[0.78rem] font-extrabold uppercase tracking-[0.12em] text-[#00ff66]"
              >
                See how this would work in your store <ArrowRight size={16} />
              </a>
            </div>

            <div className="grid gap-4">
              {painCards.map(({ icon: Icon, title, body }) => (
                <article key={title} className="border border-white/10 bg-[rgba(24,24,24,0.84)] p-6 backdrop-blur-xl">
                  <Icon size={28} className="text-[#cc0000]" />
                  <h3 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-black uppercase tracking-[-0.03em] text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-base leading-7 text-white/72">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </Section>

        <Section
          image="https://lh3.googleusercontent.com/aida-public/AB6AXuAWGlTNXEcrTiQYKuzGGHmHQwcngIpYB7fao_cm6PuDQ8WepOfg4zd-fCURgfOeuzY1QiD6D4vWa7FifgCU_IGVkOQ-q5y8DN2UWcz_Pxnaw2MVpjzNDdIVhC3ZSBOW1JGICuJ_m7-dsWdYy0PXkeKv9n6nm4rcZzI8a-BfSu7jW5I38HPtvdf297ScF_Oc4T31fMXiYPeBihhmQIkq8qvF6ox2AJYiWOPMZ37uWPsZZPXyj0T4LtUavoL9ohJ8_3Wg5xA_6JbeeqHj"
          overlayClassName="bg-[linear-gradient(180deg,rgba(204,0,0,0.38),rgba(10,10,10,0.86)),linear-gradient(90deg,rgba(10,10,10,0.92),rgba(10,10,10,0.28),rgba(10,10,10,0.92))]"
        >
          <div className="mx-auto max-w-4xl border border-white/10 bg-[rgba(24,24,24,0.8)] p-8 text-center backdrop-blur-xl md:p-12">
            <Kicker>The performance gap</Kicker>
            <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.15rem,5vw,4.4rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.04em] text-white">
              The Performance Gap
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-[#cc0000] md:text-xl">
              Most dealerships don’t fail from lack of knowledge. They fail from lack of reinforcement.
            </p>
          </div>
        </Section>

        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_24%,rgba(204,0,0,0.08),transparent_18%),radial-gradient(circle_at_82%_72%,rgba(0,255,102,0.04),transparent_18%),linear-gradient(135deg,rgba(4,4,4,1)_0%,rgba(8,8,8,0.98)_40%,rgba(4,4,4,1)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(160,255,0,0.04)_22%,transparent_42%),linear-gradient(90deg,transparent_0%,rgba(160,255,0,0.03)_54%,transparent_76%),linear-gradient(180deg,rgba(255,255,255,0.008),transparent_35%)] blur-2xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px]" />
          </div>
          <div className="relative mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
            <div className="mb-8 text-center">
              <Kicker>The system</Kicker>
              <h2
                id="missions"
                className="font-[family-name:var(--font-heading)] text-[clamp(2.15rem,5vw,4.4rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.04em] text-white"
              >
                Here&apos;s how your dealership improves every week
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/75 md:text-lg">
                Every week, your managers know exactly what to coach, how to run it, and how to verify it.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="border border-white/10 bg-[rgba(18,18,18,0.78)] p-6 backdrop-blur-xl md:p-8">
                <h3 className="font-[family-name:var(--font-heading)] text-3xl font-black uppercase tracking-[-0.03em] text-white">
                  Weekly execution visibility
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/72">
                  AutoForge diagnoses behavior, prescribes action, and drives weekly execution across the
                  dealership.
                </p>

                <div className="mt-6 border-l-4 border-[#00ff66] bg-black/50 p-4">
                  <div className="flex items-center justify-between gap-4 text-[0.72rem] font-bold uppercase tracking-[0.12em]">
                    <span className="text-white/55">Weekly mission progress</span>
                    <strong className="text-[#00ff66]">88% done</strong>
                  </div>
                  <div className="mt-3 h-2 bg-white/10">
                    <div className="h-full w-[88%] bg-[#00ff66]" />
                  </div>
                </div>

                <div className="mt-4 border-l-4 border-[#cc0000] bg-black/50 p-4">
                  <div className="flex items-center justify-between gap-4 text-[0.72rem] font-bold uppercase tracking-[0.12em]">
                    <span className="text-white/55">Active skill gaps</span>
                    <strong className="text-[#cc0000]">3 alerts</strong>
                  </div>
                  <div className="mt-3 h-2 bg-white/10">
                    <div className="h-full w-[35%] bg-[#cc0000]" />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-[0.72rem] font-bold uppercase tracking-[0.12em]">
                  <span className="text-white/55">System status: active</span>
                  <span className="text-[#00ff66]">All teams synchronized</span>
                </div>
              </article>

              <div className="grid gap-4">
                {[
                  ['01', 'Diagnose behavior', 'Pinpoint where consistency is breaking across the customer journey.'],
                  ['02', 'Prescribe action', 'Push one focused mission managers can run immediately this week.'],
                  ['03', 'Drive execution', 'Verify reinforcement in the store so behavior becomes standard.'],
                ].map(([number, title, body]) => (
                  <article
                    key={title}
                    className="grid items-center gap-4 border border-white/10 bg-[rgba(24,24,24,0.84)] p-4 backdrop-blur-xl md:grid-cols-[4.25rem_1fr]"
                  >
                    <div className="flex min-h-14 items-center justify-center bg-[#00ff66] font-[family-name:var(--font-heading)] text-2xl font-black text-black">
                      {number}
                    </div>
                    <div>
                      <h3 className="font-[family-name:var(--font-heading)] text-xl font-black uppercase tracking-[-0.03em] text-white">
                        {title}
                      </h3>
                      <p className="mt-2 text-base leading-7 text-white/72">{body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Section image="https://lh3.googleusercontent.com/aida-public/AB6AXuCnFmZ_OXyt3xc2zZP5xMU5dR-qiXZywP6IuXdmw4iOS_xelWrh1H-Pt_pk1xZ-o5Uywf6Ewth56PBXZrnp5y0HiNYf7ou65EH5-uCzkGRtK3kwsnpg-Zoy3qDAhfU3ev2WARxqjYwZ8-1JOa1DTasFANu-K89hThKhpbNeS3b78mhxOcnmYtgjrPJPII-yv9Pa75axBIfntNEPr-oxZ4lcM9Zn3z3damkDJNAzazeZdOpmOQgycHRIIQ0OYHilh97mXDcs5KlvOIhR">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <Kicker>Implementation + execution</Kicker>
              <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.15rem,5vw,4.4rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.04em] text-white">
                From zero to execution in one week
              </h2>
              <div className="mt-6 grid gap-4">
                {implementationSteps.map(({ title, icon: Icon }, index) => (
                  <article
                    key={title}
                    className="grid items-center gap-4 border border-white/10 bg-[rgba(24,24,24,0.84)] p-4 backdrop-blur-xl md:grid-cols-[4.25rem_1fr]"
                  >
                    <div className="flex min-h-14 items-center justify-center bg-[#00ff66] font-[family-name:var(--font-heading)] text-2xl font-black text-black">
                      {`0${index + 1}`}
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon size={20} className="text-[#00ff66]" />
                      <h3 className="font-[family-name:var(--font-heading)] text-xl font-black uppercase tracking-[-0.03em] text-white">
                        {title}
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <Kicker>How it works</Kicker>
              <p className="mb-5 text-base font-extrabold uppercase tracking-[0.12em] text-[#00ff66] md:text-lg">
                This takes 10 minutes to run.
              </p>
              <div className="border border-white/10 bg-[rgba(12,12,12,0.72)] p-5 backdrop-blur-xl">
                {processSteps.map(({ number, icon: Icon, title }, index) => (
                  <article
                    key={number}
                    className={`grid items-center gap-4 py-4 ${index > 0 ? 'border-t border-white/10' : ''} md:grid-cols-[3.2rem_1fr]`}
                  >
                    <div
                      className={`flex h-[3.2rem] w-[3.2rem] items-center justify-center ${
                        index === processSteps.length - 1 ? 'bg-[#00ff66] text-black' : 'bg-white/10 text-white'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className="mb-1 block text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-white/50">
                        {number}
                      </span>
                      <h3 className="font-[family-name:var(--font-heading)] text-lg font-black uppercase tracking-[-0.02em] text-white">
                        {title}
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section image="https://lh3.googleusercontent.com/aida-public/AB6AXuDa56sS5masWLxfXZLaHL2hddfy2LLgHo5BDnkGH8Q0lFUMqm2YI4Wg4R-4FugIRCZqsZ8h5mBh4lbbNyaJycSwmCHzj6MiPF4OKfkPazjXthltcQXOfLXq6edDkmZmA8CEaeW14W6-2YqJ9ML7MVjjh7P2UpltGFAwfDouQXU58YmfwmiOZGt4H_uIoNas1kygPRzC2BtnBjFBo85u7PZnzolS9arTNLNh-XA1Q-ezw3cGuBvU3eCEnjqvykY6Nl-8XohQCPKXq96X">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Kicker>The outcome</Kicker>
              <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.15rem,5vw,4.4rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.04em] text-white">
                The outcome of real execution
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-white/75 md:text-lg">
                Stop guessing if your team is following the process. AutoForge provides the operational
                visibility you need to drive growth.
              </p>
              <p className="mt-4 max-w-xl text-base leading-8 text-white/75 md:text-lg">
                You&apos;re no longer guessing if your team is following the process. You can see it.
              </p>
              <ul className="mt-6 grid gap-4">
                {outcomes.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 font-[family-name:var(--font-heading)] text-lg font-black uppercase tracking-[-0.02em] text-white"
                  >
                    <CheckCircle2 size={18} className="text-[#00ff66]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-x-auto border border-white/10 bg-[rgba(5,5,5,0.56)] backdrop-blur-xl">
              <div className="px-4 pt-4 text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-white/50">
                What changes when execution becomes weekly
              </div>
              <table className="min-w-[38rem] w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-white/10 px-4 py-4 text-left text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-white/50">
                      Metric
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 text-left text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-white/50">
                      Legacy Training
                    </th>
                    <th className="border-b border-white/10 px-4 py-4 text-left text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-white/50">
                      AutoForge System
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Retention Rate', '~15% (typical training retention)', 'Up to 90%+ with weekly reinforcement'],
                    ['Implementation', 'Manual / Random', 'Weekly Automated'],
                    ['Visibility', 'Non-existent', 'Group-Wide View'],
                    ['Management Time', 'High Friction', 'Plug-and-Play'],
                  ].map(([metric, legacy, system], index) => (
                    <tr key={metric}>
                      <td className={`px-4 py-4 text-white/72 ${index > 0 ? 'border-t border-white/10' : ''}`}>{metric}</td>
                      <td className={`px-4 py-4 text-white/72 ${index > 0 ? 'border-t border-white/10' : ''}`}>{legacy}</td>
                      <td
                        className={`px-4 py-4 ${
                          metric === 'Retention Rate' || metric === 'Visibility' ? 'text-[#00ff66]' : 'text-white'
                        } ${index > 0 ? 'border-t border-white/10' : ''}`}
                      >
                        {system}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 pb-4 pt-3 text-xs leading-6 text-white/45">
                Based on behavior reinforcement models and early AutoForge pilot usage. Results vary by dealership.
              </div>
            </div>
          </div>
        </Section>

        <Section image="https://lh3.googleusercontent.com/aida-public/AB6AXuCkmTSX_odmvYoLBh1gy3TRsapUmC5hX6fi646Qtt-fO0p6GLgrOPYKHE3iQ4tZasaliiQ7n754o2l2SHRbiRQjARgKDMrJ6_5rc1MggCuqBWSauSOyy4vpBcRidh_4BhPpt8p3_owB41WUiVr9-yoParsvnh8GrxOOTPfId6451f8pc40AqYb1qCAjU8GDjXRHzW2DHPysK-FhhhV5LVskpsLZsh80sWnOIdzm51UFWAPkpAh9-eqsCllt4zrM8O6Qrd-KiOvnfsEv">
          <div
            id="cta"
            className="mx-auto max-w-4xl border border-white/10 bg-[rgba(24,24,24,0.82)] p-8 text-center backdrop-blur-xl md:p-12"
          >
            <Kicker>Stop guessing. Start forging.</Kicker>
            <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.15rem,5vw,4.8rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.04em] text-white">
              Execution is <span className="text-[#00ff66]">everything</span>
            </h2>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={openLeadModal}
                className="inline-flex min-h-[60px] items-center justify-center bg-[#00ff66] px-6 py-4 font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-black"
              >
                Deploy the System
              </button>
              <a
                href="/signup"
                className="inline-flex min-h-[60px] items-center justify-center bg-[#cc0000] px-6 py-4 font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-white"
              >
                See It in Action
              </a>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-[0.8rem] font-bold uppercase tracking-[0.12em] text-white/70">
              <div className="inline-flex items-center gap-2">
                <CalendarDays size={16} className="text-[#00ff66]" />
                <span>Franchise dealers</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Bolt size={16} className="text-[#00ff66]" />
                <span>Large auto groups</span>
              </div>
            </div>
          </div>
        </Section>
      </main>

      <Dialog open={isLeadModalOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="border-white/10 bg-[#101010] p-0 text-white sm:max-w-[540px]">
          {modalStep === 'form' ? (
            <div className="p-6 sm:p-8">
              <DialogHeader className="text-left">
                <DialogTitle className="font-[family-name:var(--font-heading)] text-3xl font-black uppercase tracking-[-0.03em] text-white">
                  Deploy AutoForge in Your Dealership
                </DialogTitle>
                <DialogDescription className="mt-3 text-base leading-7 text-white/70">
                  Tell us a bit about your store and we’ll show you exactly how this works for you.
                </DialogDescription>
              </DialogHeader>

              <form className="mt-6 grid gap-4" onSubmit={handleLeadSubmit}>
                <div className="grid gap-2">
                  <label htmlFor="autoforge-name" className="text-sm font-semibold text-white/80">
                    Name
                  </label>
                  <Input
                    id="autoforge-name"
                    type="text"
                    required
                    value={leadForm.name}
                    onChange={(event) =>
                      setLeadForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="autoforge-email" className="text-sm font-semibold text-white/80">
                    Email
                  </label>
                  <Input
                    id="autoforge-email"
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={(event) =>
                      setLeadForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="autoforge-dealership" className="text-sm font-semibold text-white/80">
                    Dealership Name
                  </label>
                  <Input
                    id="autoforge-dealership"
                    type="text"
                    required
                    value={leadForm.dealershipName}
                    onChange={(event) =>
                      setLeadForm((current) => ({
                        ...current,
                        dealershipName: event.target.value,
                      }))
                    }
                    className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-white/80">Role</label>
                  <Select
                    value={leadForm.role}
                    onValueChange={(value) =>
                      setLeadForm((current) => ({
                        ...current,
                        role: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-12 border-white/10 bg-[#181818] text-white">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#181818] text-white">
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Fixed Ops">Fixed Ops</SelectItem>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmittingLead}
                  className="mt-2 h-12 bg-[#00ff66] font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-black hover:bg-[#00ff66]/90"
                >
                  {isSubmittingLead ? 'Saving...' : 'Continue'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <DialogHeader className="text-left">
                <DialogTitle className="font-[family-name:var(--font-heading)] text-3xl font-black uppercase tracking-[-0.03em] text-white">
                  Want to walk through this live?
                </DialogTitle>
                <DialogDescription className="mt-3 text-base leading-7 text-white/70">
                  We’ll use what you shared to tailor the walkthrough to your store.
                </DialogDescription>
              </DialogHeader>

              <Button
                type="button"
                onClick={handleScheduleRedirect}
                className="mt-6 h-12 w-full bg-[#00ff66] font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-black hover:bg-[#00ff66]/90"
              >
                See Available Times
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
