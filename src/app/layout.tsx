import type { Metadata } from 'next';
import { AuthProvider } from '@/context/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AutoDrive powered by AutoKnerd',
  description: 'AI-powered training and performance for automotive professionals.',
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
          <AuthProvider>
            <div className="relative flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
                <footer className="p-4 text-center text-xs text-muted-foreground border-t">
                    <Link href="/privacy" className="hover:text-primary underline-offset-4 hover:underline">Privacy Policy</Link>
                    <span className="mx-2">|</span>
                    <span>© {new Date().getFullYear()} AutoKnerd, Inc. All rights reserved.</span>
                </footer>
            </div>
            <Toaster />
          </AuthProvider>
      </body>
    </html>
  );
}
