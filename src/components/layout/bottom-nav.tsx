
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, BarChart, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '#', icon: ClipboardList, label: 'Lessons' },
  { href: '#', icon: BarChart, label: 'Stats' },
  { href: '#', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-gray-950/80 backdrop-blur-lg border-t border-cyan-400/30 shadow-[0_-5px_20px_-5px_hsl(var(--primary)/0.2)] md:hidden">
      <div className="flex h-full items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full transition-colors',
                isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
