import type { Metadata } from 'next';

import AutoForgePageClient from './auto-forge-page-client';

export const metadata: Metadata = {
  title: 'AutoForge | High-Performance Dealership Execution',
  description: 'A Stitch-inspired AutoForge product page for weekly execution across the dealership.',
};

export default function AutoForgePage() {
  return <AutoForgePageClient />;
}
