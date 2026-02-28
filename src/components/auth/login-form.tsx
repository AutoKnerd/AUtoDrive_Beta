
'use client';

import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '../ui/spinner';
import { ArrowRight, User, Shield } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;


export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back! Redirecting...',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: (error as Error).message || 'Invalid email or password. Please try again.',
      });
      setIsSubmitting(false);
    }
  }
  
  const handleStartTour = async (role: 'consultant' | 'manager') => {
    setIsTouring(true);
    const email = role === 'consultant' ? 'consultant.demo@autodrive.com' : 'manager.demo@autodrive.com';
    const roleName = role === 'consultant' ? 'Sales Consultant' : 'Sales Manager';
    try {
        await login(email, 'readyplayer1');
        toast({
            title: 'Tour Started!',
            description: `You're now viewing as a ${roleName}.`,
        });
        router.push('/');
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Tour Failed',
            description: (error as Error).message || 'Could not start the tour. Please try again.',
        });
        setIsTouring(false);
    }
  };

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
            <Button type="submit" className="w-full" disabled={isSubmitting || isTouring}>
              {isSubmitting ? <Spinner size="sm" /> : 'Sign In'}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={isSubmitting || isTouring}>
                  {isTouring ? <Spinner size="sm" /> : 'Take a Guided Tour'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Choose Your Tour Perspective</DialogTitle>
                  <DialogDescription>
                    Select a role to experience how AutoDrive empowers every member of your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <Button variant="outline" className="h-auto p-6 flex-col gap-2 items-start whitespace-normal" onClick={() => handleStartTour('consultant')} disabled={isTouring}>
                        <div className="flex items-center gap-2">
                           <User className="h-5 w-5 text-primary" />
                           <h3 className="font-semibold">Team Member</h3>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">Explore as a Sales Consultant or Service Writer. Focus on personal growth and mastering customer interactions.</p>
                         <div className="flex items-center text-sm text-primary font-semibold mt-2">
                            Start Tour <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                    </Button>
                     <Button variant="outline" className="h-auto p-6 flex-col gap-2 items-start whitespace-normal" onClick={() => handleStartTour('manager')} disabled={isTouring}>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Leader</h3>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">View as a Manager or Owner. See how AutoDrive provides high-level insights to coach your team effectively.</p>
                         <div className="flex items-center text-sm text-primary font-semibold mt-2">
                            Start Tour <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                    </Button>
                </div>
              </DialogContent>
            </Dialog>

          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
