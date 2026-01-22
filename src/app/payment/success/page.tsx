import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="mt-4 text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your subscription to AutoDrive Pro is now active. It may take a moment for your account to update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/">
              Go to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
