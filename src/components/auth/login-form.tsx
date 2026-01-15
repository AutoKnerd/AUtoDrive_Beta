'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);


  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid email or password. Please try again.',
      });
      setIsSubmitting(false);
    }
  }
  
  async function handleAdminLogin() {
    setIsSubmitting(true);
    try {
      await login('manager@autodrive.com', 'password'); // Using manager credentials
      toast({
        title: 'Login Successful',
        description: 'Logged in as Admin.',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Admin Login Failed',
        description: 'Could not log in as admin user.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConsultantLogin() {
    setIsSubmitting(true);
    try {
      await login('consultant@autodrive.com', 'password'); // Using consultant credentials
      toast({
        title: 'Login Successful',
        description: 'Logged in as Consultant.',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Consultant Login Failed',
        description: 'Could not log in as consultant user.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleAdminLogin} disabled={isSubmitting}>
              Admin Bypass
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleConsultantLogin} disabled={isSubmitting}>
              Consultant Bypass
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
