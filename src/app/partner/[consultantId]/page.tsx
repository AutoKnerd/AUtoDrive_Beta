import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getConsultantByReferralCode } from '@/lib/consultants-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDisplayName(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function PartnerLandingPage({
  params,
}: {
  params: Promise<{ consultantId: string }>;
}) {
  const { consultantId } = await params;
  const normalizedConsultantId = (consultantId || '').trim().toLowerCase();
  const consultant = await getConsultantByReferralCode(normalizedConsultantId);
  const consultantName = consultant?.name || toDisplayName(normalizedConsultantId);
  const signupHref = `/join/${encodeURIComponent(normalizedConsultantId)}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10">
      <Card className="w-full border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
        <CardHeader>
          <CardTitle className="text-3xl text-cyan-200">AutoDriveCX Partner Program</CardTitle>
          <CardDescription className="text-slate-300">
            Consultant: {consultantName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-200">
            AutoDriveCX helps dealership teams improve customer experience with role-specific coaching, daily skills practice, and measurable performance gains.
          </p>
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Ready to start?</p>
            <p className="mt-1 text-xs text-slate-300">
              Sign up through this partner page to ensure consultant attribution is attached to your account metadata.
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link href={signupHref}>Start Free Trial</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
