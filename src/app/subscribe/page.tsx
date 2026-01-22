'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createCheckoutSession } from '@/app/actions/stripe';
import { useToast } from '@/hooks/use-toast';
import { Check } from 'lucide-react';


export default function SubscribePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
     if (!loading && user?.subscriptionStatus === 'active') {
      router.push('/profile');
    }
  }, [user, loading, router]);
  
  const handleSubscribe = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
        await createCheckoutSession(user.userId);
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'An error occurred',
            description: (e as Error).message || 'Could not initiate subscription. Please try again.',
        });
        setIsSubmitting(false);
    }
  }

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
      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-3xl">AutoDrive Pro</CardTitle>
                <CardDescription>Unlock your full potential with unlimited access to all features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-4xl font-bold">
                    $49 <span className="text-lg font-normal text-muted-foreground">/ month</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited lesson access</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> In-depth performance analytics</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Manager dashboard & team reports</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Custom lesson creation</li>
                </ul>
            </CardContent>
            <CardFooter>
                 <form action={handleSubscribe} className="w-full">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Spinner /> : 'Upgrade to Pro'}
                    </Button>
                </form>
            </CardFooter>
        </Card>
      </main>
    </div>
  );
}
