
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
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
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
