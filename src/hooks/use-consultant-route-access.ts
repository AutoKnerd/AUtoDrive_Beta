'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

type ConsultantIdentity = {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  firebase_uid: string;
  created_at: string;
  referralCode?: string;
};

const ADMIN_EMAILS = ['jarett@autoknerd.com', 'cj@autoknerd.com'];

function normalizeConsultantCode(value: string): string {
  return value.trim().toLowerCase();
}

export function useConsultantRouteAccess(routeConsultantId: string) {
  const { user, firebaseUser, loading } = useAuth();
  const [consultant, setConsultant] = useState<ConsultantIdentity | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const normalizedRouteConsultantId = useMemo(
    () => normalizeConsultantCode(routeConsultantId || ''),
    [routeConsultantId]
  );

  const mappedReferralCode = useMemo(() => {
    const value = consultant?.referral_code || consultant?.referralCode || '';
    return normalizeConsultantCode(value);
  }, [consultant?.referral_code, consultant?.referralCode]);

  useEffect(() => {
    const controller = new AbortController();

    async function resolveConsultantIdentity() {
      if (loading) {
        return;
      }

      if (!user || !firebaseUser) {
        setConsultant(null);
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      setError(null);

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const claimRole = String(tokenResult.claims?.role || '').trim().toLowerCase();
        const byCustomClaim = claimRole === 'admin' || claimRole === 'developer';
        const byEmail = ADMIN_EMAILS.includes(String(user.email || '').trim().toLowerCase());
        const byAppRole = String(user.role || '').toLowerCase() === 'admin' || String(user.role || '').toLowerCase() === 'developer';
        const hasAdminOverride = byCustomClaim || byEmail || byAppRole;
        setIsAdmin(hasAdminOverride);

        if (hasAdminOverride) {
          setConsultant(null);
          return;
        }

        const token = await firebaseUser.getIdToken(true);
        const response = await fetch('/api/consultants/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to validate consultant identity.');
        }

        setConsultant((payload.consultant as ConsultantIdentity) || null);
      } catch (identityError) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          identityError instanceof Error
            ? identityError.message
            : 'Unable to validate consultant identity.';
        setConsultant(null);
        setIsAdmin(false);
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsChecking(false);
        }
      }
    }

    void resolveConsultantIdentity();

    return () => controller.abort();
  }, [loading, user?.userId, firebaseUser]);

  const isAuthorized =
    !loading &&
    !isChecking &&
    !!user &&
    !!firebaseUser &&
    (isAdmin || (!!mappedReferralCode && mappedReferralCode === normalizedRouteConsultantId));

  return {
    isAuthorized,
    isChecking,
    isAdmin,
    error,
    mappedReferralCode,
    normalizedRouteConsultantId,
  };
}
