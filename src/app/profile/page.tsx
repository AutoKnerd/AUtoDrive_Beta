
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { ProfileForm } from '@/components/profile/profile-form';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/lib/definitions';
import { getEarnedBadgesByUserId } from '@/lib/data';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchBadges() {
      if (user) {
        setLoadingBadges(true);
        const earnedBadges = await getEarnedBadgesByUserId(user.userId);
        setBadges(earnedBadges);
        setLoadingBadges(false);
      }
    }
    fetchBadges();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-4xl space-y-6">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <ProfileForm user={user} badges={badges} loadingBadges={loadingBadges} />
        </div>
      </main>
    </div>
  );
}
