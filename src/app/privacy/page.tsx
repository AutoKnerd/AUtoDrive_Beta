'use client';

import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

export default function PrivacyPolicyPage() {
  return (
    <AutoknerdShell active="home">
      <main className="bg-[#0d0f0f] px-6 pb-24 pt-32 text-[#f4f3f3] md:px-10">
        <div className="mx-auto w-full max-w-5xl space-y-8">
          <div className="border border-[#464848]/15 bg-[#121414] px-6 py-8 text-center md:px-10">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Legal</p>
            <h1 className="text-4xl font-black uppercase leading-none tracking-tighter md:text-6xl">Privacy Policy</h1>
            <p className="mt-4 text-[#aaabab]">Effective Date: January 1st. 2026</p>
            <p className="text-[#aaabab]">Last Updated: April 9th, 2926</p>
          </div>

          <div className="space-y-6 border border-[#464848]/15 bg-[#121414] p-6 text-[#aaabab] md:p-8">
            <section id="introduction" className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">PRIVACY POLICY</h2>
              <p>Effective Date: January 1st. 2026</p>
              <p>Last Updated: April 9th, 2926</p>
              <p>AutoKnerd LLC (“AutoKnerd,” “we,” “us,” or “our”) is committed to protecting your information.</p>
              <p>This Privacy Policy explains how we collect, use, and safeguard information when you use our Services.</p>
            </section>
            <section id="collection" className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">1. INFORMATION WE COLLECT</h2>
              <p>We may collect:</p>
              <p className="font-semibold text-[#eaffb8]">Personal Information:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Name</li>
                <li>Email</li>
                <li>Phone number</li>
                <li>Job title and company</li>
              </ul>
              <p className="mt-4 font-semibold text-[#eaffb8]">Usage Data:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Pages visited</li>
                <li>Features used</li>
                <li>Device and browser information</li>
                <li>IP address</li>
              </ul>
              <p className="mt-4 font-semibold text-[#eaffb8]">Performance Data:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Training activity</li>
                <li>Scoring and engagement metrics</li>
                <li>Behavioral trends</li>
              </ul>
              <p className="mt-4 font-semibold text-[#eaffb8]">AI Interaction Data:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Inputs and outputs from AutoForge, Otto, and Sprocket</li>
              </ul>
            </section>
            <section id="usage" className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">2. HOW WE USE INFORMATION</h2>
              <p>We use information to:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Provide and improve Services</li>
                <li>Personalize recommendations</li>
                <li>Generate analytics and insights</li>
                <li>Process payments</li>
                <li>Communicate with users</li>
                <li>Maintain security</li>
              </ul>
            </section>
            <section id="disclosure" className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">3. DATA OWNERSHIP</h2>
              <p>You retain ownership of your dealership data.</p>
              <p>You grant AutoKnerd a limited license to use data to operate and improve the Services.</p>
              <p>We do not sell identifiable user or dealership data.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">4. DATA SHARING</h2>
              <p>We may share data with:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Service providers (hosting, payments, analytics)</li>
                <li>Legal authorities when required</li>
                <li>Business partners in the event of a sale or merger</li>
              </ul>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">5. COOKIES</h2>
              <p>We use cookies to improve functionality and analyze usage.</p>
              <p>You can control cookies through your browser.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">6. DATA RETENTION</h2>
              <p>We retain data as necessary to provide Services and meet legal obligations.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">7. SECURITY</h2>
              <p>We implement reasonable safeguards but cannot guarantee absolute security.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">8. USER RIGHTS</h2>
              <p>You may request access, correction, or deletion of your data.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">9. THIRD-PARTY SERVICES</h2>
              <p>We are not responsible for third-party privacy practices.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">10. CHILDREN</h2>
              <p>Services are not intended for users under 18.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">11. CHANGES</h2>
              <p>This policy may be updated. Continued use constitutes acceptance.</p>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-[#f4f3f3]">12. CONTACT</h2>
              <p>
                AutoKnerd LLC
                <br />
                Lakeland, FL
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
