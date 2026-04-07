'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { createIndividualCheckoutSessionUrl } from '@/app/actions/stripe';
import { getConsultant, parseConsultantFromURL, setAttribution, touchAttribution } from '@/lib/consultant-referral';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '../ui/spinner';
import type { UserRole } from '@/lib/definitions';

const signupRoleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'Sales Consultant', label: 'Sales Consultant' },
  { value: 'Service Writer', label: 'Service Advisor' },
  { value: 'BDC', label: 'BDC Professional' },
  { value: 'Parts Consultant', label: 'Parts Consultant' },
  { value: 'manager', label: 'Sales Manager' },
  { value: 'Service Manager', label: 'Service Manager' },
  { value: 'Parts Manager', label: 'Parts Manager' },
  { value: 'General Manager', label: 'General Manager' },
  { value: 'Finance Manager', label: 'F&I Director' },
];

const signupSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your full name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.string().min(1, { message: 'Please select your role.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string().min(8, { message: 'Please confirm your password.' }),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didCaptureEmailEntry, setDidCaptureEmailEntry] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const firebaseAuth = useFirebaseAuth();
  const { publicSignup } = useAuth();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Sales Consultant',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const fromUrl = parseConsultantFromURL(`${window.location.pathname}${window.location.search}`);
    if (fromUrl) {
      setAttribution({
        consultant_id: fromUrl,
        engagement_type: 'weak',
        engagement_event: 'page_visit',
        timestamp: Date.now(),
      });
    }

    touchAttribution('medium', 'signup_started');
  }, []);

  const emailValue = form.watch('email');

  useEffect(() => {
    const prefillEmail = String(searchParams.get('email') || '').trim();
    const prefillRole = String(searchParams.get('role') || '').trim();
    const hasRoleOption = signupRoleOptions.some((option) => option.value === prefillRole);

    if (prefillEmail) {
      form.setValue('email', prefillEmail, { shouldDirty: true });
    }
    if (hasRoleOption) {
      form.setValue('role', prefillRole, { shouldDirty: true });
    }
  }, [form, searchParams]);

  useEffect(() => {
    if (didCaptureEmailEntry) return;
    const value = String(emailValue || '').trim();
    if (!value.includes('@') || !value.includes('.')) return;

    touchAttribution('medium', 'email_entered');
    setDidCaptureEmailEntry(true);
  }, [didCaptureEmailEntry, emailValue]);

  async function onSubmit(data: SignupFormValues) {
    setIsSubmitting(true);
    try {
      const consultant = getConsultant() || undefined;
      await publicSignup(data.name, data.email, data.password, data.role as UserRole, consultant);
      if (consultant) {
        void fetch('/api/consultant-marketing-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            consultant_id: consultant,
            event_type: 'signup_event',
            source: 'signup_form_success',
            referral_code: consultant,
          }),
        });
      }
      touchAttribution('strong', 'signup_completed');

      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Signup succeeded, but no authenticated user was found. Please try again.');
      }

      const idToken = await fbUser.getIdToken(true);

      toast({
        title: 'Account Created!',
        description: 'Your 30-day trial is active. Opening Stripe Checkout…',
      });

      try {
        touchAttribution('strong', 'payment_started');
        const checkout = await createIndividualCheckoutSessionUrl(idToken, 'monthly', getConsultant() || undefined);
        if (!checkout.ok) {
          throw new Error(checkout.message);
        }

        window.location.assign(checkout.url);
      } catch (error: any) {
        console.error('[Signup] Checkout session bootstrap failed after account creation:', error);
        toast({
          title: 'Account Created',
          description: error?.message || 'Your account is ready. Continue billing setup from the next screen.',
        });
        router.push('/subscribe');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-[hsl(var(--border))] bg-[rgba(243,240,234,0.96)] text-[hsl(var(--foreground))] shadow-[0_18px_50px_rgba(66,53,27,0.06)]">
      <CardHeader className="space-y-2 pb-4">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          Secure Account Setup
        </p>
        <CardTitle className="text-center text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">Create your Pro account</CardTitle>
        <p className="text-center text-sm font-semibold text-[hsl(var(--primary))]">30-day free trial</p>
        <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">Then $12.99/month. Cancel anytime.</p>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[hsl(var(--foreground))]">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      className="h-11 border-[hsl(var(--border))] bg-[rgba(235,232,226,0.95)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[rgb(243,240,234)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[hsl(var(--foreground))]">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="name@example.com"
                      className="h-11 border-[hsl(var(--border))] bg-[rgba(235,232,226,0.95)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[rgb(243,240,234)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[hsl(var(--foreground))]">Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 border-[hsl(var(--border))] bg-[rgba(235,232,226,0.95)] text-[hsl(var(--foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[rgb(243,240,234)]">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {signupRoleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[hsl(var(--foreground))]">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="h-11 border-[hsl(var(--border))] bg-[rgba(235,232,226,0.95)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[rgb(243,240,234)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[hsl(var(--foreground))]">Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="h-11 border-[hsl(var(--border))] bg-[rgba(235,232,226,0.95)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[rgb(243,240,234)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="h-12 w-full bg-[hsl(var(--primary))] text-[15px] font-semibold text-[hsl(var(--primary-foreground))] shadow-[0_12px_30px_rgba(117,191,36,0.22)] transition-all hover:bg-[hsl(var(--primary)/0.92)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Sign Up & Start Trial'}
            </Button>
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">No charge today. Secure checkout via Stripe.</p>
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              Already have an account?{' '}
              <Button asChild variant="link" className="h-auto px-1 py-0 text-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]">
                <Link href="/login">Sign In</Link>
              </Button>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
