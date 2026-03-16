'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

function normalizeConsultant(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export default function TourConsultantLauncherPage() {
  const params = useParams<{ consultantId: string }>();
  const router = useRouter();

  useEffect(() => {
    const consultantId = normalizeConsultant(params.consultantId);
    if (consultantId) {
      localStorage.setItem('tourConsultant', consultantId);
      localStorage.setItem('consultant_referral', consultantId);
    }
    localStorage.setItem('tourMode', 'true');
    router.replace('/demo');
  }, [params.consultantId, router]);

  return null;
}
