
import type { Metadata } from 'next';
import { AuthProvider } from '@/context/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { MainLayout } from '@/components/layout/main-layout';
import { FirebaseClientProvider } from '@/firebase/client-provider';


export const metadata: Metadata = {
  title: 'AutoDrive powered by AutoKnerd',
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
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const applyTheme = (isDark) => {
        root.classList.toggle('dark', isDark);
        root.style.colorScheme = isDark ? 'dark' : 'light';
      };
      applyTheme(media.matches);
      const onChange = (event) => applyTheme(event.matches);
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onChange);
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeSyncScript }} />
      </head>
      <body className="antialiased">
          <FirebaseClientProvider>
            <AuthProvider>
              <MainLayout>
                  {children}
              </MainLayout>
              <Toaster />
            </AuthProvider>
          </FirebaseClientProvider>
      </body>
    </html>
  );
}
