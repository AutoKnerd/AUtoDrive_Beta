'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import type { UserRole } from '@/lib/definitions';

export default function Home() {
  const { user, loading } = useAuth();
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

  const managerialRoles: UserRole[] = ['manager', 'Service Manager', 'Parts Manager', 'Finance Manager', 'Owner', 'Trainer', 'Admin'];

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {managerialRoles.includes(user.role) ? (
          <ManagerDashboard user={user} />
        ) : (
          <ConsultantDashboard user={user} />
        )}
      </main>
    </div>
  );
}
