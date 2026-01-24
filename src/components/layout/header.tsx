
'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { UserNav } from './user-nav';

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <Link href="/" className="flex items-center font-semibold">
        <Logo variant="full" width={146} height={48} />
      </Link>
      <div className="ml-auto flex items-center gap-4">
        {user && (
          <UserNav user={user} avatarClassName="h-8 w-8" />
        )}
      </div>
    </header>
  );
}
