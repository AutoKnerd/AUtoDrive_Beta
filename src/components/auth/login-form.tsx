
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const quickLoginRoles = [
  { value: 'consultant@autodrive.com', label: 'Sales Consultant' },
  { value: 'manager@autodrive.com', label: 'Sales Manager' },
  { value: 'service.writer@autodrive.com', label: 'Service Writer' },
  { value: 'service.manager@autodrive.com', label: 'Service Manager' },
  { value: 'finance.manager@autodrive.com', label: 'Finance Manager' },
  { value: 'parts.consultant@autodrive.com', label: 'Parts Consultant' },
  { value: 'parts.manager@autodrive.com', label: 'Parts Manager' },
  { value: 'owner@autodrive.com', label: 'Owner' },
  { value: 'trainer@autoknerd.com', label: 'Trainer' },
  { value: 'admin@autoknerd.com', label: 'Admin' },
];

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuickLogin, setSelectedQuickLogin] = useState<string>('');
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
  
  async function handleQuickLogin() {
    if (!selectedQuickLogin) {
      toast({
        variant: 'destructive',
        title: 'Quick Login Failed',
        description: 'Please select a role from the dropdown.',
      });
      return;
    }

    setIsSubmitting(true);
    const roleInfo = quickLoginRoles.find(r => r.value === selectedQuickLogin);

    try {
      await login(selectedQuickLogin, 'password');
      toast({
        title: 'Login Successful',
        description: `Logged in as ${roleInfo?.label}.`,
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: `${roleInfo?.label} Login Failed`,
        description: `Could not log in as ${roleInfo?.label.toLowerCase()} user.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
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

            <div className="w-full space-y-2">
                <p className="text-center text-sm text-muted-foreground">Quick login as developer role</p>
                <Select onValueChange={setSelectedQuickLogin} value={selectedQuickLogin}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a role to log in..." />
                    </SelectTrigger>
                    <SelectContent>
                        {quickLoginRoles.map(role => (
                            <SelectItem key={role.value} value={role.value}>
                                {role.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="button" variant="outline" className="w-full" onClick={handleQuickLogin} disabled={isSubmitting || !selectedQuickLogin}>
                  {isSubmitting ? <Spinner size="sm" /> : 'Quick Login'}
                </Button>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
