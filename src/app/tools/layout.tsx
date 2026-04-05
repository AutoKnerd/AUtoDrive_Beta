import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AutoShop | AutoKnerd CX Tool Box',
};

export default function ToolsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
