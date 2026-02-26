'use client';

import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createIndividualCheckoutSessionUrl } from '@/app/actions/stripe';
import { requiresIndividualCheckout } from '@/lib/billing/access';
import { CreditCard } from 'lucide-react';

export default function SubscribePage() {
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !requiresIndividualCheckout(user)) {
      router.push('/');
    }
  }, [user, loading, router]);

  const startCheckout = async () => {
    try {
      setIsSubmitting(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      const idToken = await fbUser.getIdToken(true);
      const checkout = await createIndividualCheckoutSessionUrl(idToken);
      if (!checkout.ok) {
        throw new Error(checkout.message);
      }

      window.location.assign(checkout.url);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout Error',
        description: error?.message || 'Could not start Stripe checkout. Please try again.',
      });
      setIsSubmitting(false);
    }
  };

  if (loading || !user || !requiresIndividualCheckout(user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-3xl">Start Your 30-Day Trial</CardTitle>
            <CardDescription>
              Add your payment method securely in Stripe. Your trial begins after billing setup is completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What happens next:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Open secure Stripe checkout</li>
                <li>Add your billing method (no immediate charge during trial)</li>
                <li>Return to AutoDrive and start your trial</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              You can cancel before any paid billing cycle starts.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={startCheckout} className="w-full" disabled={isSubmitting}>
              <CreditCard className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Opening Stripe…' : 'Continue to Secure Checkout'}
            </Button>
            <Button onClick={() => router.push('/profile')} variant="outline" className="w-full" disabled={isSubmitting}>
              Back to Profile
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
