'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import * as z from 'zod';
import { useAuth as useFirebaseAuth } from '@/firebase';
import {
  claimDealershipEnrollment,
  type EnrollmentLinkPreview,
  updateUser,
} from '@/lib/data.client';
import type { UserRole } from '@/lib/definitions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';

const enrollmentSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your full name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.string().min(1, { message: 'Please select your role.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string().min(8, { message: 'Please confirm your password.' }),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type EnrollmentFormValues = z.infer<typeof enrollmentSchema>;

function formatRole(role: UserRole): string {
  return role === 'manager' ? 'Sales Manager' : role;
}

interface EnrollmentFormProps {
  enrollment: EnrollmentLinkPreview;
}

export function EnrollmentForm({ enrollment }: EnrollmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const auth = useFirebaseAuth();
  const { toast } = useToast();

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      name: '',
      email: '',
      role: enrollment.allowedRoles[0] || '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: EnrollmentFormValues) {
    setIsSubmitting(true);

    const normalizedEmail = values.email.toLowerCase();
    const selectedRole = values.role as UserRole;
    const displayName = values.name.trim();

    try {
      try {
        const created = await createUserWithEmailAndPassword(auth, normalizedEmail, values.password);
        await claimDealershipEnrollment(enrollment.token, selectedRole);

        if (displayName.length > 0) {
          await updateUser(created.user.uid, { name: displayName });
        }
      } catch (error: any) {
        if (error?.code !== 'auth/email-already-in-use') {
          throw error;
        }

        const existing = await signInWithEmailAndPassword(auth, normalizedEmail, values.password);
        await claimDealershipEnrollment(enrollment.token, selectedRole);

        if (displayName.length > 0) {
          await updateUser(existing.user.uid, { name: displayName });
        }
      }

      toast({
        title: 'Enrollment complete',
        description: `You are now assigned to ${enrollment.dealershipName}.`,
      });
      router.replace('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not complete enrollment',
        description: error?.message || 'Please verify your details and try again.',
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
                    <Input placeholder="name@example.com" {...field} />
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
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {enrollment.allowedRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {formatRole(role)}
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

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : 'Complete Enrollment'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
