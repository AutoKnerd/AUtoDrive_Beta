'use client';

import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

const sections = [
  {
    title: '1. ELIGIBILITY',
    body: 'You must be at least 18 years of age to use the Services. By using the Services, you represent that you are acting in a professional or business capacity.',
  },
  {
    title: '2. DESCRIPTION OF SERVICES',
    body: 'AutoKnerd provides tools, training materials, analytics, coaching frameworks, and artificial intelligence-driven recommendations designed to support dealership customer experience, employee development, and operational improvement.',
  },
  {
    title: '3. ADVISORY NATURE OF SERVICES',
    body: 'The Services are provided for informational and educational purposes only. AutoKnerd does not guarantee specific outcomes, including improvements in performance, revenue, or customer satisfaction. All AI-driven outputs, including AutoForge, Otto, and Sprocket, are advisory only and do not replace professional judgment. All decisions remain your responsibility.',
  },
  {
    title: '4. USER RESPONSIBILITIES',
    body: 'You agree to use the Services lawfully and not to:',
    list: ['Copy or resell the Services', 'Reverse engineer the platform', 'Interfere with system performance'],
    footer: 'You are responsible for your account and all activity under it.',
  },
  {
    title: '5. INTELLECTUAL PROPERTY',
    body: 'All content, tools, frameworks, and materials are owned by AutoKnerd LLC. You are granted a limited license for internal business use only.',
  },
  {
    title: '6. SUBSCRIPTIONS AND PAYMENTS',
    body: 'Paid Services require payment of applicable fees. You agree to recurring billing where applicable. All fees are non-refundable unless required by law.',
  },
  {
    title: '7. DATA USE',
    body: 'Use of the Services is governed by our Privacy Policy.',
  },
  {
    title: '8. THIRD-PARTY SERVICES',
    body: 'AutoKnerd is not responsible for third-party tools or integrations.',
  },
  {
    title: '9. DISCLAIMER OF WARRANTIES',
    body: 'Services are provided “as is” without warranties of any kind.',
  },
  {
    title: '10. LIMITATION OF LIABILITY',
    body: 'AutoKnerd is not liable for indirect or consequential damages, including loss of revenue or business outcomes. Total liability shall not exceed the amount paid in the prior 12 months.',
  },
  {
    title: '11. INDEMNIFICATION',
    body: 'You agree to indemnify AutoKnerd against claims arising from your use of the Services.',
  },
  {
    title: '12. TERMINATION',
    body: 'AutoKnerd may suspend or terminate access for violations of these Terms.',
  },
  {
    title: '13. CHANGES',
    body: 'These Terms may be updated at any time. Continued use constitutes acceptance.',
  },
  {
    title: '14. GOVERNING LAW',
    body: 'These Terms are governed by the laws of the State of Florida.',
  },
] as const;

export default function TermsPage() {
  return (
    <AutoknerdShell active="home">
      <main className="bg-[#0d0f0f] px-6 pb-24 pt-32 text-[#f4f3f3] md:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-12 border border-[#464848]/15 bg-[#121414] px-6 py-8 md:px-10">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Terms of Service</p>
            <h1 className="text-4xl font-black uppercase leading-none tracking-tighter md:text-6xl">Terms of Service</h1>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-[#aaabab] md:text-base">
              Effective Date: January 1st, 2026
              <br />
              Last Updated: April 9th, 2026
            </p>
            <p className="mt-6 max-w-5xl text-base leading-relaxed text-[#aaabab] md:text-lg">
              These Terms of Service (“Terms”) govern access to and use of the AutoKnerd platform, including AutoShop, AutoForge, AutoDriveCX, and all related services, applications, content, and tools (collectively, the “Services”) provided by AutoKnerd LLC (“AutoKnerd,” “Company,” “we,” “us,” or “our”).
            </p>
            <p className="mt-4 max-w-5xl text-base leading-relaxed text-[#aaabab] md:text-lg">
              By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use the Services.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <section key={section.title} className="border border-[#464848]/15 bg-[#121414] p-6">
                <h2 className="mb-3 text-lg font-bold uppercase tracking-[0.16em] text-[#eaffb8]">{section.title}</h2>
                <p className="text-sm leading-7 text-[#aaabab]">{section.body}</p>
                {'list' in section && section.list ? (
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-[#aaabab]">
                    {section.list.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#bdfc00]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {'footer' in section && section.footer ? <p className="mt-4 text-sm leading-7 text-[#aaabab]">{section.footer}</p> : null}
              </section>
            ))}

            <section className="border border-[#464848]/15 bg-[#121414] p-6 md:col-span-2 xl:col-span-1">
              <h2 className="mb-3 text-lg font-bold uppercase tracking-[0.16em] text-[#eaffb8]">15. CONTACT</h2>
              <p className="text-sm leading-7 text-[#aaabab]">
                AutoKnerd LLC
                <br />
                Andrew@AutoKnerd.com
              </p>
            </section>
          </div>
        </div>
      </main>
    </AutoknerdShell>
  );
}
