
'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { UserNav } from './user-nav';
import { usePathname } from 'next/navigation';

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isToolsSurface = pathname?.startsWith('/tools');

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur-sm ${
        isToolsSurface
          ? 'border-[#c7d6e8] bg-[#f6fbff]/95 text-[#0f2135] dark:border-[#1f3657] dark:bg-[#0f192c]/95 dark:text-[#eaf2ff]'
          : 'border-border bg-background/80'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center font-semibold">
          <Logo variant="full" width={146} height={48} />
        </Link>
        <div className="ml-auto flex items-center gap-4">
          {user && (
            <UserNav user={user} avatarClassName="h-8 w-8" />
          )}
        </div>
      </div>
    </header>
  );
}
