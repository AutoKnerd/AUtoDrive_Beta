
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sendInvitation, getDealerships, getTeamMemberRoles, getDealershipById } from '@/lib/data';
import { User, UserRole } from '@/lib/definitions';
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
  userEmail: z.string().email('Please enter a valid email address for the intended user.'),
  role: z.string().min(1, "A role must be selected."),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterDealershipForm({ user, onDealershipRegistered }: RegisterDealershipFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const { toast } = useToast();

  const [dealerships, setDealerships] = useState<string[]>([]);
  const [isNewDealership, setIsNewDealership] = useState(false);
  const [managerDealershipName, setManagerDealershipName] = useState('');

  const canManageAllDealerships = ['Admin', 'Trainer', 'Owner'].includes(user.role);
  const registrationRoles = getTeamMemberRoles(user.role);

  useEffect(() => {
    async function fetchDealershipData() {
        if (canManageAllDealerships) {
            const d = await getDealerships(user);
            setDealerships(d);
            if (d.length === 0) {
                setIsNewDealership(true);
            }
        } else {
            const dealership = await getDealershipById(user.dealershipId);
            if (dealership) {
                setManagerDealershipName(dealership.name);
            }
        }
    }
    fetchDealershipData();
  }, [canManageAllDealerships, user]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      dealershipName: canManageAllDealerships ? '' : managerDealershipName,
      userEmail: '',
      role: '',
    },
  });
  
  useEffect(() => {
      if (!canManageAllDealerships && managerDealershipName) {
          form.setValue('dealershipName', managerDealershipName);
      }
  }, [managerDealershipName, canManageAllDealerships, form]);


  async function onSubmit(data: RegisterFormValues) {
    setIsSubmitting(true);
    setInvitationSent(false);
    try {
      const dealershipToUse = canManageAllDealerships ? data.dealershipName : managerDealershipName;
      if (!dealershipToUse) {
        throw new Error('Dealership name is missing.');
      }
      
      await sendInvitation(dealershipToUse, data.userEmail, data.role as UserRole, user.userId);
      
      setInvitationSent(true);
      toast({
        title: 'Invitation Sent!',
        description: `An invitation has been sent to ${data.userEmail}.`,
      });
      
      onDealershipRegistered?.();
      form.reset({
        dealershipName: canManageAllDealerships ? '' : managerDealershipName,
        userEmail: '',
        role: '',
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

  return (
    <Form {...form}>
       <ScrollArea className="max-h-[70vh] -mx-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 px-6">
          <FormField
            control={form.control}
            name="dealershipName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dealership</FormLabel>
                  { !canManageAllDealerships ? (
                      <Input value={managerDealershipName} disabled />
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
                              <SelectItem value="---new---">
                                  <span className="font-semibold">-- Add New Dealership --</span>
                              </SelectItem>
                              {dealerships.map(d => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                          {isNewDealership && (
                              <FormControl>
                                  <Input
                                      placeholder="Enter new dealership name"
                                      {...field}
                                      className="mt-2"
                                  />
                              </FormControl>
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
