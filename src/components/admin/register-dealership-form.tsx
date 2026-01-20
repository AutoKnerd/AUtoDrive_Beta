
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sendInvitation, getDealerships, getTeamMemberRoles, getDealershipById } from '@/lib/data';
import { User, UserRole, Dealership, Address } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { MailCheck } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface RegisterDealershipFormProps {
  user: User;
  onDealershipRegistered?: () => void;
}

const registerSchema = z.object({
  dealershipName: z.string().min(1, 'Dealership name is required.'),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  userEmail: z.string().email('Please enter a valid email address for the intended user.'),
  role: z.string().min(1, "A role must be selected."),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterDealershipForm({ user, onDealershipRegistered }: RegisterDealershipFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const { toast } = useToast();

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [isNewDealership, setIsNewDealership] = useState(false);

  const canManageAllDealerships = ['Admin', 'Trainer'].includes(user.role);
  const registrationRoles = getTeamMemberRoles(user.role);

  useEffect(() => {
    async function fetchDealershipData() {
        if (canManageAllDealerships || user.role === 'Owner') {
            const d = await getDealerships(user);
            setDealerships(d);
            if (d.length === 0 && canManageAllDealerships) {
                setIsNewDealership(true);
            }
        } else {
            const managedDealerships = await Promise.all(user.dealershipIds.map(id => getDealershipById(id)));
            const validDealerships = managedDealerships.filter((d): d is Dealership => d !== null);
            setDealerships(validDealerships);
        }
    }
    fetchDealershipData();
  }, [canManageAllDealerships, user]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      dealershipName: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      userEmail: '',
      role: '',
    },
  });
  
  useEffect(() => {
    if (dealerships.length === 1 && !canManageAllDealerships && user.role !== 'Owner') {
        form.setValue('dealershipName', dealerships[0].name);
    }
  }, [dealerships, canManageAllDealerships, user.role, form]);


  async function onSubmit(data: RegisterFormValues) {
    setIsSubmitting(true);
    setInvitationSent(false);
    try {
      const dealershipToUse = data.dealershipName;
      if (!dealershipToUse) {
        throw new Error('Dealership name is missing.');
      }
      
      const newDealershipAddress = (isNewDealership && data.street) ? {
          street: data.street,
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
      } : undefined;

      await sendInvitation(dealershipToUse, data.userEmail, data.role as UserRole, user.userId, newDealershipAddress);
      
      setInvitationSent(true);
      toast({
        title: 'Invitation Sent!',
        description: `An invitation has been sent to ${data.userEmail}.`,
      });
      
      onDealershipRegistered?.();
      form.reset({
        dealershipName: (dealerships.length === 1 && !canManageAllDealerships && user.role !== 'Owner') ? dealerships[0].name : '',
        userEmail: '',
        role: '',
        street: '',
        city: '',
        state: '',
        zip: '',
      });

      if (canManageAllDealerships) {
        setIsNewDealership(false);
        // Refresh dealership list
        const d = await getDealerships(user);
        setDealerships(d);
      }

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Invitation Failed',
        description: (error as Error).message || 'An error occurred while sending the invitation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (invitationSent) {
    return (
      <div className="text-center">
        <Alert>
          <MailCheck className="h-4 w-4" />
          <AlertTitle>Invitation Sent Successfully!</AlertTitle>
          <AlertDescription>
            <p className="mb-4">
              An invitation email has been sent to <span className="font-semibold">{form.getValues('userEmail')}</span>. They can use the link in the email to create their account.
            </p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => { setInvitationSent(false); if (canManageAllDealerships) setIsNewDealership(false); } } className="mt-4">
            Send Another Invitation
        </Button>
      </div>
    );
  }
  
  const showDealershipSelect = canManageAllDealerships || user.role === 'Owner' || (user.dealershipIds && user.dealershipIds.length > 1);

  return (
    <Form {...form}>
       <ScrollArea className="max-h-[60vh] -mx-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 px-6">
          <FormField
            control={form.control}
            name="dealershipName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dealership</FormLabel>
                  { !showDealershipSelect ? (
                      <Input value={field.value || ''} disabled />
                  ) : (
                      <>
                          <Select 
                              onValueChange={(value) => {
                                  if (value === '---new---') {
                                      setIsNewDealership(true);
                                      field.onChange('');
                                  } else {
                                      setIsNewDealership(false);
                                      field.onChange(value);
                                  }
                              }} 
                              value={isNewDealership ? '---new---' : (field.value || '')}
                          >
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select an existing dealership..." />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {canManageAllDealerships && (
                                <SelectItem value="---new---">
                                    <span className="font-semibold">-- Add New Dealership --</span>
                                </SelectItem>
                              )}
                              {dealerships.map(d => (
                                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                          {isNewDealership && canManageAllDealerships && (
                            <div className="mt-4 space-y-4 rounded-lg border p-4">
                                <p className="text-sm font-medium text-muted-foreground">
                                    First, search for the dealership. If it's not found, you can enter the details manually.
                                </p>
                                
                                <div className="space-y-2">
                                    <FormLabel>Dealership Name</FormLabel>
                                    <FormControl>
                                    <Input
                                        placeholder="Search by name or address with Google..."
                                        {...field}
                                        autoFocus
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                    control={form.control}
                                    name="street"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Street</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>City</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>State / Province</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={form.control}
                                    name="zip"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>ZIP / Postal Code</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                </div>
                            </div>
                          )}
                      </>
                  )}
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
                  <FormLabel>New User's Email</FormLabel>
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
                      <FormLabel>New User's Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select a role..." />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {registrationRoles.length === 0 && <SelectItem value="" disabled>No roles available to invite.</SelectItem>}
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
          <Button type="submit" disabled={isSubmitting || registrationRoles.length === 0}>
            {isSubmitting ? <Spinner size="sm" /> : 'Send Invitation'}
          </Button>
        </form>
      </ScrollArea>
    </Form>
  );
}
