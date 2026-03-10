'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { createIndividualCheckoutSessionUrl } from '@/app/actions/stripe';

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
  const router = useRouter();
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
    const params = new URLSearchParams(window.location.search);
    const consultant = params.get('consultant')?.trim().toLowerCase();
    if (consultant) {
      localStorage.setItem('consultant_referral', consultant);
    }
  }, []);

  async function onSubmit(data: SignupFormValues) {
    setIsSubmitting(true);
    try {
      const consultant = localStorage.getItem('consultant_referral')?.trim().toLowerCase() || undefined;
      await publicSignup(data.name, data.email, data.password, data.role as UserRole, consultant);

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
        const consultant = localStorage.getItem('consultant_referral')?.trim().toLowerCase();
        const checkout = await createIndividualCheckoutSessionUrl(idToken, 'monthly', consultant || undefined);
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
    <Card className="border-slate-700/70 bg-slate-900/85 text-slate-100 shadow-none">
      <CardHeader className="space-y-2 pb-4">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
          Secure Account Setup
        </p>
        <CardTitle className="text-center text-2xl font-semibold tracking-tight text-white">Create your Pro account</CardTitle>
        <p className="text-center text-sm font-semibold text-emerald-200">30-day free trial</p>
        <p className="text-center text-sm text-slate-300">Then $50/month. Cancel anytime.</p>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      className="h-11 border-slate-700 bg-slate-950/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-cyan-400 focus-visible:ring-offset-slate-900"
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
                  <FormLabel className="text-slate-200">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="name@example.com"
                      className="h-11 border-slate-700 bg-slate-950/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-cyan-400 focus-visible:ring-offset-slate-900"
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
                  <FormLabel className="text-slate-200">Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 border-slate-700 bg-slate-950/80 text-slate-50 focus-visible:ring-cyan-400 focus-visible:ring-offset-slate-900">
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
                  <FormLabel className="text-slate-200">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="h-11 border-slate-700 bg-slate-950/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-cyan-400 focus-visible:ring-offset-slate-900"
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
                  <FormLabel className="text-slate-200">Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="h-11 border-slate-700 bg-slate-950/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-cyan-400 focus-visible:ring-offset-slate-900"
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
              className="h-12 w-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-[15px] font-semibold text-slate-950 transition-all hover:from-cyan-300 hover:to-emerald-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Sign Up & Start Trial'}
            </Button>
            <p className="text-center text-xs text-slate-400">No charge today. Secure checkout via Stripe.</p>
            <p className="text-center text-sm text-slate-300">
              Already have an account?{' '}
              <Button asChild variant="link" className="h-auto px-1 py-0 text-cyan-300 hover:text-cyan-200">
                <Link href="/login">Sign In</Link>
              </Button>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
