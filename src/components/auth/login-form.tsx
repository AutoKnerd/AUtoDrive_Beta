
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';

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
import { Separator } from '../ui/separator';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Users, Briefcase } from 'lucide-react';
import { UserRole } from '@/lib/definitions';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const devRoles: { email: string; role: UserRole }[] = [
    { email: 'admin@autoknerd.com', role: 'Admin' },
    { email: 'trainer@autoknerd.com', role: 'Trainer' },
    { email: 'owner@autodrive.com', role: 'Owner' },
    { email: 'gm@autodrive.com', role: 'General Manager' },
    { email: 'manager@autodrive.com', role: 'manager' },
    { email: 'service.manager@autodrive.com', role: 'Service Manager' },
    { email: 'parts.manager@autodrive.com', role: 'Parts Manager' },
    { email: 'finance.manager@autodrive.com', role: 'Finance Manager' },
    { email: 'consultant@autodrive.com', role: 'Sales Consultant' },
    { email: 'service.writer@autodrive.com', role: 'Service Writer' },
    { email: 'parts.consultant@autodrive.com', role: 'Parts Consultant' },
];

function QuickLogin() {
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (email: string) => {
    setIsLoggingIn(true);
    try {
      await login(email, 'readyplayer1');
      router.push('/');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Login Failed', description: (e as Error).message });
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="w-full" disabled={isLoggingIn}>
          {isLoggingIn ? <Spinner size="sm" /> : 'Quick Login'}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        {devRoles.map(({ email, role }) => (
          <DropdownMenuItem key={email} onSelect={() => handleLogin(email)}>
            Log in as {role === 'manager' ? 'Sales Manager' : role}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TakeATour() {
    const { login } = useAuth();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleTour = async () => {
        setIsLoggingIn(true);
        try {
            await login('consultant.demo@autodrive.com', 'readyplayer1');
            router.push('/');
        } catch (e) {
             toast({ variant: 'destructive', title: 'Tour Failed', description: (e as Error).message });
        } finally {
            setIsLoggingIn(false);
        }
    }

    return (
        <Button variant="outline" className="w-full" onClick={handleTour} disabled={isLoggingIn}>
             {isLoggingIn ? <Spinner size="sm" /> : 'Take a Tour'}
        </Button>
    )
}

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
        description: (error as Error).message || 'Invalid email or password. Please try again.',
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-center text-xl font-semibold tracking-tight">Sign in to your account</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
            
            <div className="relative w-full">
              <Separator />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs text-muted-foreground">
                OR
              </span>
            </div>

            <div className="grid w-full grid-cols-2 gap-4">
              <QuickLogin />
              <TakeATour />
            </div>
             <p className="pt-2 text-center text-sm text-muted-foreground">
              Have an invitation?{' '}
              <Link
                href="/register"
                className="underline underline-offset-4 hover:text-primary"
              >
                Sign Up
              </Link>
            </p>
            <div className="w-full text-center text-sm">
                <Separator className="my-3"/>
                <Link href="/register?setup=true" className="text-muted-foreground hover:text-primary underline-offset-4 hover:underline">
                    First-time Admin Setup
                </Link>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
