
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
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head />
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
