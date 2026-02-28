
'use client';

import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function PrivacyPolicyPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      <Header />
      <main className="flex-1 items-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-4xl mx-auto space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground h-5">
              {isClient ? `Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
            </p>
          </div>
          <div className="space-y-8 text-muted-foreground">
            <section id="introduction">
                <h2 className="text-2xl font-semibold mb-2 text-foreground">1. Introduction</h2>
                <p>Welcome to AutoDrive. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application. By using the service, you agree to the collection and use of information in accordance with this policy.</p>
            </section>
             <section id="collection">
                <h2 className="text-2xl font-semibold mb-2 text-foreground">2. Information We Collect</h2>
                <p>We may collect information about you in a variety of ways. The information we may collect via the Application includes:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                    <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and telephone number, that you voluntarily give to us when you register with the Application.</li>
                    <li><strong>Performance Data:</strong> Information related to your performance in training lessons, including scores, completion data, and AI-generated feedback.</li>
                    <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Application, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Application.</li>
                </ul>
            </section>
             <section id="usage">
                <h2 className="text-2xl font-semibold mb-2 text-foreground">3. Use of Your Information</h2>
                <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:</p>
                 <ul className="list-disc pl-6 space-y-2 mt-4">
                    <li>Create and manage your account.</li>
                    <li>Provide you with personalized training and feedback.</li>
                    <li>Generate anonymized, aggregate reports for dealership management to track overall team performance.</li>
                    <li>Monitor and analyze usage and trends to improve your experience with the Application.</li>
                    <li>Notify you of updates to the Application.</li>
                </ul>
            </section>
             <section id="disclosure">
                <h2 className="text-2xl font-semibold mb-2 text-foreground">4. Disclosure of Your Information</h2>
                <p>We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
                <ul className="list-disc pl-6 space-y-2 mt-4">
                    <li><strong>To Your Management:</strong> Your performance data (CX scores, lesson completion, etc.) is visible to your direct manager, General Manager, and dealership Owner within your organization, unless you have enabled privacy settings. You can control this in your <Link href="/profile" className="text-primary hover:underline">Profile Settings</Link>.</li>
                     <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
                </ul>
            </section>
            <section id="security">
                <h2 className="text-2xl font-semibold mb-2 text-foreground">5. Security of Your Information</h2>
                <p>We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.</p>
            </section>
             <section id="contact">
                <h2 className="text-2xl font-semibold mb-2 text-foreground">6. Contact Us</h2>
                <p>If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:andrew@autoknerd.com" className="text-primary hover:underline">andrew@autoknerd.com</a></p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
