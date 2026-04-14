'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { managerialRoles } from '@/lib/definitions';
import { BottomNav } from '@/components/layout/bottom-nav';
import { hasDealershipAssignment, requiresIndividualCheckout } from '@/lib/billing/access';

export default function Home() {
  const { user, loading, isTouring, firebaseUser } = useAuth();
  const router = useRouter();
  const isAssigned = !!user && hasDealershipAssignment(user);
  const [consultantRoute, setConsultantRoute] = useState<string | null>(null);
  const [isConsultantRouteChecking, setIsConsultantRouteChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveConsultantRoute() {
      if (loading) return;

      if (!user || !firebaseUser) {
        if (!cancelled) {
          setConsultantRoute(null);
          setIsConsultantRouteChecking(false);
        }
        return;
      }

      const role = String(user.role || '').toLowerCase();
      if (role === 'admin' || role === 'developer') {
        if (!cancelled) {
          setConsultantRoute(null);
          setIsConsultantRouteChecking(false);
        }
        return;
      }

      try {
        const token = await firebaseUser.getIdToken(true);
        const response = await fetch('/api/consultants/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (!cancelled) {
            setConsultantRoute(null);
          }
          return;
        }

        const payload = await response.json() as { consultant?: { referral_code?: string; referralCode?: string } };
        const referralCode = String(payload.consultant?.referral_code || payload.consultant?.referralCode || '').trim().toLowerCase();
        if (!cancelled) {
          setConsultantRoute(referralCode ? `/consultant/${encodeURIComponent(referralCode)}` : null);
        }
      } catch {
        if (!cancelled) {
          setConsultantRoute(null);
        }
      } finally {
        if (!cancelled) {
          setIsConsultantRouteChecking(false);
        }
      }
    }

    void resolveConsultantRoute();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.userId, user?.role, firebaseUser]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/Autoknerd');
    } else if (!loading && user && requiresIndividualCheckout(user)) {
      router.push('/subscribe');
    } else if (!loading && !isConsultantRouteChecking && consultantRoute) {
      router.push(consultantRoute);
    } else if (!loading && isAssigned && (user?.role === 'Developer' || user?.role === 'Admin')) {
      router.push('/developer');
    }
  }, [user, loading, router, isAssigned, consultantRoute, isConsultantRouteChecking]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!loading || user) return;

    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobileViewport) return;

    const redirectTimer = window.setTimeout(() => {
      router.replace('/live-session');
    }, 2500);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [loading, router, user]);

  if (
    loading ||
    !user ||
    isConsultantRouteChecking ||
    (!!consultantRoute) ||
    (isAssigned && (user.role === 'Developer' || user.role === 'Admin')) ||
    requiresIndividualCheckout(user)
  ) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-transparent">
        <Spinner size="lg" />
      </div>
    );
  }

  const isManager = isAssigned && managerialRoles.includes(user.role);

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
