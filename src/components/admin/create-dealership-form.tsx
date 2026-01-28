
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createDealership } from '@/lib/data';
import { User, Address } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { CheckCircle } from 'lucide-react';

interface CreateDealershipFormProps {
  user: User;
  onDealershipCreated?: () => void;
}

const createDealershipSchema = z.object({
  dealershipName: z.string().min(1, 'Dealership name is required.'),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

type CreateDealershipFormValues = z.infer<typeof createDealershipSchema>;

export function CreateDealershipForm({ user, onDealershipCreated }: CreateDealershipFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dealershipCreated, setDealershipCreated] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateDealershipFormValues>({
    resolver: zodResolver(createDealershipSchema),
    defaultValues: {
      dealershipName: '',
      street: '',
      city: '',
      state: '',
      zip: '',
    },
  });

  async function onSubmit(data: CreateDealershipFormValues) {
    setIsSubmitting(true);
    setDealershipCreated(false);
    try {
      const address: Partial<Address> = {
        street: data.street,
        city: data.city,
        state: data.state,
        zip: data.zip,
      };

      await createDealership({
        name: data.dealershipName,
        address,
        trainerId: user.role === 'Trainer' ? user.userId : undefined,
      });
      
      setDealershipCreated(true);
      toast({
        title: 'Dealership Created!',
        description: `${data.dealershipName} has been added to the system.`,
      });
      
      onDealershipCreated?.();
      form.reset();

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: (error as Error).message || 'An error occurred while creating the dealership.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (dealershipCreated) {
    return (
      <div className="text-center">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Dealership Created Successfully!</AlertTitle>
          <AlertDescription>
            <p className="mb-4">
              You can now invite an Owner or Manager to this dealership from the 'Invite User' tab.
            </p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => setDealershipCreated(false)} className="mt-4">
            Create Another Dealership
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
            control={form.control}
            name="dealershipName"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>New Dealership Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Summit Cars" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="street"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl><Input placeholder="123 Auto Lane" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl><Input placeholder="Carville" {...field} /></FormControl>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl><Input placeholder="CA" {...field} /></FormControl>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="zip"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl><Input placeholder="90210" {...field} /></FormControl>
                    </FormItem>
                )}
            />
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Spinner size="sm" /> : 'Create Dealership'}
        </Button>
      </form>
    </Form>
  );
}
