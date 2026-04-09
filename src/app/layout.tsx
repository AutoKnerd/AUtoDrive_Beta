
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { AuthProvider } from '@/context/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { MainLayout } from '@/components/layout/main-layout';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ThemeProvider } from '@/context/theme-provider';
import { SiteTrafficTracker } from '@/components/analytics/site-traffic-tracker';

const GTM_ID = 'GTM-T23TJBN6';

export const metadata: Metadata = {
  title: 'AutoDrive CX',
  description: 'AI-powered training and performance for automotive professionals.',
  icons: {
    icon: '/autodrive-ai-icon1.png',
    apple: '/autodrive-ai-icon1.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeSyncScript = `
    (() => {
      const root = document.documentElement;
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}
        </Script>
        <script dangerouslySetInnerHTML={{ __html: themeSyncScript }} />
      </head>
      <body className="antialiased">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <FirebaseClientProvider>
          <AuthProvider>
            <ThemeProvider>
              <Suspense fallback={null}>
                <SiteTrafficTracker />
              </Suspense>
              <MainLayout>
                {children}
              </MainLayout>
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
