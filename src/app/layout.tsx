
import type { Metadata } from 'next';
import { AuthProvider } from '@/context/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { MainLayout } from '@/components/layout/main-layout';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ThemeProvider } from '@/context/theme-provider';


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
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const storageKey = 'autodrive-theme-mode';
      const stored = localStorage.getItem(storageKey);
      const params = new URLSearchParams(window.location.search);
      const forced = params.get('theme');
      const forcedMode = forced === 'light' || forced === 'dark' ? forced : null;
      const mode = forcedMode || (stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system');
      const applyTheme = (isDark) => {
        root.classList.toggle('dark', isDark);
        root.style.colorScheme = isDark ? 'dark' : 'light';
      };
      const resolveIsDark = () => {
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        return media.matches;
      };
      applyTheme(resolveIsDark());
      const onChange = (event) => applyTheme(event.matches);
      if (mode === 'system' && typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange);
      } else if (mode === 'system' && typeof media.addListener === 'function') {
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
              <ThemeProvider>
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
