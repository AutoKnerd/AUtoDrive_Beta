

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { redeemInvitation, getInvitationByToken, createFirstAdminUser, adminUserExists } from '@/lib/data';
import type { EmailInvitation } from '@/lib/definitions';
import { carBrands } from '@/lib/definitions';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '../ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle } from 'lucide-react';


const registerSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your full name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  brand: z.string().min(1, { message: 'Please select your primary brand.' }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;


function RegisterFormComponent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const isSetupFlow = searchParams.get('setup') === 'true';

  const [invitation, setInvitation] = useState<EmailInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdminSetup, setIsAdminSetup] = useState(false);


  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      brand: '',
    },
  });

  useEffect(() => {
    async function validate() {
      if (isSetupFlow) {
        const alreadyExists = await adminUserExists();
        if (alreadyExists) {
          setError("An Admin account already exists. Please use the login page.");
        } else {
          setIsAdminSetup(true);
        }
        setLoading(false);
        return;
      }

      if (!token) {
        setError('No invitation token provided. Please use the link from your invitation email.');
        setLoading(false);
        return;
      }

      try {
        const inv = await getInvitationByToken(token as string);
        if (!inv) {
          setError('This invitation link is invalid.');
        } else if (inv.claimed) {
          setError('This invitation has already been claimed.');
        } else {
          setInvitation(inv);
          form.setValue('email', inv.email);
        }
      } catch (e) {
        setError('An error occurred while validating your invitation.');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token, isSetupFlow, form]);

  async function onSubmit(data: RegisterFormValues) {
    setIsSubmitting(true);
    try {
      if (isAdminSetup) {
        await createFirstAdminUser(data.name, data.email, data.brand, data.password);
      } else {
        if (!token || !invitation) return;
        await redeemInvitation(token, data.name, data.email, data.brand, data.password);
      }
      
      await login(data.email, data.password);
      
      toast({
        title: 'Account Created!',
        description: 'Welcome to AutoDrive!',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: (error as Error).message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (loading) {
    return <div className="flex items-center justify-center p-8"><Spinner /> <span className="ml-2">Validating...</span></div>;
  }
  
  if (error && !isAdminSetup) {
    return (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
                {error}
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl font-semibold tracking-tight">
            {isAdminSetup ? 'Create Admin Account' : 'Activate Your Account'}
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
             {error && isAdminSetup && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cannot Create Admin</AlertTitle>
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly={!isAdminSetup} disabled={!isAdminSetup} placeholder={isAdminSetup ? "admin@example.com" : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Brand</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select the brand you represent..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {carBrands.map(brand => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
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
            <Button type="submit" className="w-full" disabled={isSubmitting || (isAdminSetup && !!error)}>
              {isSubmitting ? <Spinner size="sm" /> : (isAdminSetup ? 'Create Admin Account' : 'Activate Account')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}


export function RegisterForm() {
    return (
        <Suspense fallback={<div className="flex w-full justify-center p-8"><Spinner /></div>}>
            <RegisterFormComponent />
        </Suspense>
    )
}
