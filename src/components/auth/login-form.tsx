
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatPasswordResetErrorMessage, sendUserPasswordResetEmail } from '@/lib/auth/password-reset';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;


export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const firebaseAuth = useFirebaseAuth();
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const resolvePostLoginPath = (): string => {
    const requested = searchParams.get('next')?.trim();
    if (!requested) return '/';
    if (!requested.startsWith('/') || requested.startsWith('//')) return '/';
    return requested;
  };

  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      const postLoginPath = resolvePostLoginPath();
      toast({
        title: 'Login Successful',
        description: 'Welcome back! Redirecting...',
      });
      router.push(postLoginPath);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: (error as Error).message || 'Invalid email or password. Please try again.',
      });
      setIsSubmitting(false);
    }
  }
  
  const handleForgotPassword = async () => {
    const emailValue = form.getValues('email').trim();
    const emailValidation = z.string().email().safeParse(emailValue);

    if (!emailValidation.success) {
      form.setError('email', { type: 'manual', message: 'Enter your email above, then click Forgot password.' });
      return;
    }

    setIsResettingPassword(true);
    try {
      await sendUserPasswordResetEmail(firebaseAuth, emailValue);
      toast({
        title: 'Reset Email Sent',
        description: 'If an account exists for that email, a reset link has been sent.',
      });
    } catch (error) {
      console.error('[LoginForm] Password reset failed:', error);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: formatPasswordResetErrorMessage(error),
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <Card className="border-[hsl(var(--border))] bg-[linear-gradient(180deg,rgba(26,24,17,0.96),rgba(18,17,12,0.92))] text-[hsl(var(--card-foreground))] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-center text-xl font-semibold tracking-tight text-[hsl(var(--accent))]">Sign in to your account</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[hsl(var(--foreground))]">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="name@example.com"
                      className="border-[hsl(var(--border))] bg-[rgba(232,226,206,0.04)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[hsl(var(--background))]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[hsl(var(--foreground))]">Password</FormLabel>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isSubmitting || isResettingPassword}
                      className="text-xs font-medium text-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResettingPassword ? 'Sending...' : 'Forgot password?'}
                    </button>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="border-[hsl(var(--border))] bg-[rgba(232,226,206,0.04)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-[hsl(var(--background))]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))] shadow-[0_10px_30px_rgba(117,191,36,0.28)] transition-transform duration-200 hover:translate-y-[-1px] hover:bg-[hsl(var(--primary)/0.9)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
