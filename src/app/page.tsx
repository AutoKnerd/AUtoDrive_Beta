'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { managerialRoles } from '@/lib/definitions';
import { BottomNav } from '@/components/layout/bottom-nav';
import { requiresIndividualCheckout } from '@/lib/billing/access';

export default function Home() {
  const { user, loading, isTouring } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && (user?.role === 'Developer' || user?.role === 'Admin')) {
      router.push('/developer');
    } else if (!loading && user && requiresIndividualCheckout(user)) {
      router.push('/subscribe');
    }
  }, [user, loading, router]);

  if (
    loading ||
    !user ||
    user.role === 'Developer' ||
    user.role === 'Admin' ||
    requiresIndividualCheckout(user)
  ) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent">
        <Spinner size="lg" />
      </div>
    );
  }

  const isManager = managerialRoles.includes(user.role);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        {isManager ? (
          <ManagerDashboard user={user} />
        ) : (
          <ConsultantDashboard user={user} />
        )}
      </main>
      {!isManager && !isTouring && <BottomNav />}
    </div>
  );
}
