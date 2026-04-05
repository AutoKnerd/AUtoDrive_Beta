import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AutoKnerd | Dealership CX Development',
  icons: {
    icon: '/gear-head.png',
    apple: '/gear-head.png',
  },
};

export default function AutoknerdLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
