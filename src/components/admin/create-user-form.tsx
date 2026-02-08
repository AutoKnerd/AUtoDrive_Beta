'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CreateUserFormProps {
  onUserCreated?: () => void;
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  role: z.enum(['Owner', 'General Manager', 'manager']),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function CreateUserForm({ onUserCreated }: CreateUserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [createdUserEmail, setCreatedUserEmail] = useState('');
  const { toast } = useToast();
  const { firebaseUser } = useAuth();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'Owner',
    },
  });

  async function onSubmit(data: CreateUserFormValues) {
    setIsSubmitting(true);
    setUserCreated(false);

    try {
      // Prepare headers - only include token if user exists
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get auth token, but handle gracefully if user doesn't have Firestore record yet (bootstrap scenario)
      try {
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken(true);
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (tokenError) {
        console.warn('[CreateUserForm] Could not obtain ID token:', tokenError);
        // Continue without token - bootstrap mode will handle it
      }

      const response = await fetch('/api/admin/createUser', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create user.';
        try {
          if (errorText) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          }
        } catch (e) {
          console.error("Non-JSON error response from API:", errorText);
        }
        throw new Error(errorMessage);
      }

      const newUser = await response.json();
      setCreatedUserEmail(data.email);
      setUserCreated(true);
      form.reset();

      toast({
        title: 'User Created!',
        description: `${data.name} has been added to the system.`,
      });

      onUserCreated?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (error as Error).message || 'An error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      {userCreated && (
        <Alert className="border-green-600 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">Success!</AlertTitle>
          <AlertDescription className="text-green-800">
            User {createdUserEmail} has been created. You can now assign dealerships to them.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., John Smith"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="General Manager">General Manager</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Creating User...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
