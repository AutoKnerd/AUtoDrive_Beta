'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { registerDealership } from '@/lib/data';
import { UserRole } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Terminal } from 'lucide-react';

interface RegisterDealershipFormProps {
  onDealershipRegistered?: () => void;
}

const registrationRoles: UserRole[] = ['Owner', 'manager', 'Service Manager', 'Parts Manager', 'Finance Manager'];

const registerSchema = z.object({
  dealershipName: z.string().min(3, 'Dealership name must be at least 3 characters long.'),
  userEmail: z.string().email('Please enter a valid email address for the intended user.'),
  role: z.enum(registrationRoles as [UserRole, ...UserRole[]]),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterDealershipForm({ onDealershipRegistered }: RegisterDealershipFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{ codes: { role: UserRole; activationCode: string; uses: number }[] } | null>(null);
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      dealershipName: '',
      userEmail: '',
      role: 'Owner',
    },
  });

  async function onSubmit(data: RegisterFormValues) {
    setIsSubmitting(true);
    setRegistrationResult(null);
    try {
      const result = await registerDealership(data.dealershipName, data.userEmail, data.role);
      
      setRegistrationResult(result);
      toast({
        title: 'Dealership Registered!',
        description: `An invitation code for ${data.dealershipName} has been created.`,
      });
      
      onDealershipRegistered?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: (error as Error).message || 'An error occurred while registering the dealership.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (registrationResult && registrationResult.codes.length > 0) {
    const primaryRole = form.getValues('role');
    const primaryUserEmail = form.getValues('userEmail');

    return (
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Registration Successful!</AlertTitle>
        <AlertDescription>
          <p className="mb-4">
            {primaryRole === 'Owner'
              ? 'Invitation codes have been generated for the new dealership. Provide these to the Owner to distribute to their team.'
              : 'An invitation code has been generated. Provide this to the new user to activate their account.'}
          </p>
          <div className="space-y-3">
            {registrationResult.codes.map((reg, index) => (
              <div key={reg.activationCode} className="rounded-md bg-muted p-3 font-mono text-sm">
                {index === 0 && <p className="mb-1">Intended for: {primaryUserEmail}</p>}
                <p>Role: <span className="font-semibold">{reg.role === 'manager' ? 'Sales Manager' : reg.role}</span></p>
                <p>Invitation Code: <span className="font-bold text-primary">{reg.activationCode}</span></p>
                <p>Uses: {reg.uses}</p>
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <FormField
          control={form.control}
          name="dealershipName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Dealership Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., AutoDrive North" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
            control={form.control}
            name="userEmail"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Intended User's Email</FormLabel>
                <FormControl>
                    <Input placeholder="user@example.com" {...field} />
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
                    <FormLabel>Intended User Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a role..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {registrationRoles.map(role => (
                            <SelectItem key={role} value={role}>
                                {role === 'manager' ? 'Sales Manager' : role}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" /> : 'Generate Invitation Code'}
        </Button>
      </form>
    </Form>
  );
}
