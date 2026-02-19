
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, CreditCard, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/#lessons', icon: ClipboardList, label: 'Lessons' },
  { href: '/scorecard', icon: CreditCard, label: 'Score Card' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 border-t border-border bg-background/90 shadow-[0_-5px_20px_-5px_hsl(var(--primary)/0.2)] backdrop-blur-lg md:hidden dark:border-cyan-400/30 dark:bg-gray-950/80">
      <div className="flex h-full items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full transition-colors',
                isActive ? 'text-primary dark:text-cyan-400' : 'text-muted-foreground hover:text-foreground dark:hover:text-white'
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
