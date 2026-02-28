
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { ProfileForm } from '@/components/profile/profile-form';
import { Spinner } from '@/components/ui/spinner';
import { BottomNav } from '@/components/layout/bottom-nav';
import { managerialRoles } from '@/lib/definitions';

export default function ProfilePage() {
  const { user, loading, isTouring } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  const isManager = managerialRoles.includes(user.role);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
        <div className="w-full max-w-4xl space-y-6">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <ProfileForm user={user} />
        </div>
      </main>
      {!isManager && !isTouring && <BottomNav />}
    </div>
  );
}
