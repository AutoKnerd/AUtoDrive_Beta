'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ConsultantSidebarProps = {
  consultantId: string;
  active: 'dashboard' | 'dealer_registrations' | 'dealer_pipeline' | 'customers' | 'sales_report' | 'payouts' | 'marketing';
};

export function ConsultantSidebar({ consultantId, active }: ConsultantSidebarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consultant Menu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild variant={active === 'dashboard' ? 'default' : 'outline'} className="w-full justify-start">
          <Link href={`/consultant/${encodeURIComponent(consultantId)}`}>Dashboard</Link>
        </Button>
        <Button asChild variant={active === 'dealer_pipeline' ? 'default' : 'outline'} className="w-full justify-start">
          <Link href={`/consultant/${encodeURIComponent(consultantId)}/dealer-pipeline`}>Dealer Pipeline</Link>
        </Button>
        <Button asChild variant={active === 'customers' ? 'default' : 'outline'} className="w-full justify-start">
          <Link href={`/consultant/${encodeURIComponent(consultantId)}/customers`}>Customers</Link>
        </Button>
        <Button asChild variant={active === 'sales_report' ? 'default' : 'outline'} className="w-full justify-start">
          <Link href={`/consultant/${encodeURIComponent(consultantId)}/sales-report`}>Sales Report</Link>
        </Button>
        <Button asChild variant={active === 'marketing' ? 'default' : 'outline'} className="w-full justify-start">
          <Link href={`/consultant/${encodeURIComponent(consultantId)}/marketing`}>Dealer Outreach</Link>
        </Button>
        <Button asChild variant={active === 'payouts' ? 'default' : 'outline'} className="w-full justify-start">
          <Link href={`/consultant/${encodeURIComponent(consultantId)}/payouts`}>Payouts</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
