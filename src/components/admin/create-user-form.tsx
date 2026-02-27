'use client';

import { useEffect, useState } from 'react';
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
import { CheckCircle, Copy, Plus, Building2, Mail, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Label } from '@/components/ui/label';
import type { Dealership } from '@/lib/definitions';

interface CreateUserFormProps {
  onUserCreated?: () => void;
  dealerships: Dealership[];
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  role: z.enum(['Owner', 'General Manager', 'manager']),
  dealershipId: z.string().optional(),
  newDealershipName: z.string().optional(),
  newDealershipStreet: z.string().optional(),
  newDealershipCity: z.string().optional(),
  newDealershipState: z.string().optional(),
  newDealershipZip: z.string().optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function CreateUserForm({ onUserCreated, dealerships }: CreateUserFormProps) {
  const RESULT_STORAGE_KEY = 'autodrive:create-user:last-result';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [createdUserEmail, setCreatedUserEmail] = useState('');
  const [createdDealershipName, setCreatedDealershipName] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const [setupLinkError, setSetupLinkError] = useState('');
  const [createNewDealership, setCreateNewDealership] = useState(false);
  const { toast } = useToast();
  const { firebaseUser } = useAuth();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'Owner',
      dealershipId: '__none__',
      newDealershipName: '',
      newDealershipStreet: '',
      newDealershipCity: '',
      newDealershipState: '',
      newDealershipZip: '',
    },
  });

  function persistLatestResult(result: {
    email: string;
    setupLink: string;
    setupLinkError: string;
    createdDealershipName?: string;
  }) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        RESULT_STORAGE_KEY,
        JSON.stringify({
          ...result,
          createdAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }

  function clearPersistedResult() {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(RESULT_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        email?: string;
        setupLink?: string;
        setupLinkError?: string;
        createdDealershipName?: string;
        createdAt?: number;
      };
      if (!parsed || typeof parsed !== 'object') return;

      // Expire stale result after 1 day.
      if (typeof parsed.createdAt === 'number' && Date.now() - parsed.createdAt > 24 * 60 * 60 * 1000) {
        clearPersistedResult();
        return;
      }

      if (typeof parsed.email === 'string') {
        setCreatedUserEmail(parsed.email);
      }
      if (typeof parsed.setupLink === 'string') {
        setSetupLink(parsed.setupLink);
      }
      if (typeof parsed.setupLinkError === 'string') {
        setSetupLinkError(parsed.setupLinkError);
      }
      setUserCreated(true);
      if (typeof parsed.createdDealershipName === 'string') {
        setCreatedDealershipName(parsed.createdDealershipName);
      }
    } catch {
      // Ignore malformed cache.
    }
  }, []);

  async function onSubmit(data: CreateUserFormValues) {
    setIsSubmitting(true);
    setUserCreated(false);
    setCreatedDealershipName('');
    setSetupLink('');
    setSetupLinkError('');
    clearPersistedResult();

    if (createNewDealership && !String(data.newDealershipName || '').trim()) {
      toast({
        variant: 'destructive',
        title: 'Dealership Required',
        description: 'Enter a dealership name or switch back to selecting an existing dealership.',
      });
      setIsSubmitting(false);
      return;
    }

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
          dealershipId: !createNewDealership && data.dealershipId && data.dealershipId !== '__none__'
            ? data.dealershipId
            : undefined,
          newDealership: createNewDealership
            ? {
                name: data.newDealershipName,
                street: data.newDealershipStreet,
                city: data.newDealershipCity,
                state: data.newDealershipState,
                zip: data.newDealershipZip,
              }
            : undefined,
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
      const resolvedSetupLink = typeof newUser?.setupLink === 'string' ? newUser.setupLink : '';
      const resolvedSetupLinkError = typeof newUser?.setupLinkError === 'string' ? newUser.setupLinkError : '';
      const resolvedCreatedDealershipName = typeof newUser?.createdDealership?.name === 'string'
        ? newUser.createdDealership.name
        : '';

      setCreatedUserEmail(data.email);
      setCreatedDealershipName(resolvedCreatedDealershipName);
      setSetupLink(resolvedSetupLink);
      setSetupLinkError(resolvedSetupLinkError);
      setUserCreated(true);
      persistLatestResult({
        email: data.email,
        setupLink: resolvedSetupLink,
        setupLinkError: resolvedSetupLinkError,
        ...(resolvedCreatedDealershipName ? { createdDealershipName: resolvedCreatedDealershipName } : {}),
      });
      form.reset();
      setCreateNewDealership(false);

      toast({
        title: 'User Created!',
        description: typeof newUser?.setupLink === 'string' && newUser.setupLink.length > 0
          ? `${data.name} has been added${resolvedCreatedDealershipName ? ` in ${resolvedCreatedDealershipName}` : ''}. Share the setup link so they can create their password.`
          : `${data.name} has been added, but no setup link was generated.`,
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
            User {createdUserEmail} has been created.
            {createdDealershipName ? ` Dealership ${createdDealershipName} was created and assigned.` : ''}
            {setupLink
              ? ' Share the setup link below so they can set their password and log in for the first time.'
              : ' Setup link generation failed, so they cannot set a password yet.'}
          </AlertDescription>
        </Alert>
      )}

      {userCreated && !setupLink && setupLinkError && (
        <Alert variant="destructive">
          <AlertTitle>Setup Link Error</AlertTitle>
          <AlertDescription>{setupLinkError}</AlertDescription>
        </Alert>
      )}

      {userCreated && setupLink && (
        <div className="grid gap-2 rounded-md border border-cyan-700/40 bg-cyan-950/20 p-3">
          <Label className="text-xs uppercase tracking-wide text-cyan-300">First Login Setup Link</Label>
          <div className="flex gap-2">
            <Input value={setupLink} readOnly />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(setupLink);
                  toast({ title: 'Copied', description: 'Setup link copied to clipboard.' });
                } catch {
                  toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy setup link.' });
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild type="button" variant="outline" className="w-full">
              <a
                href={`mailto:${encodeURIComponent(createdUserEmail || '')}?subject=${encodeURIComponent('AutoDrive First Login Setup')}&body=${encodeURIComponent(
                  `Use this secure link to set your AutoDrive password and complete first login:\n\n${setupLink}`
                )}`}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </a>
            </Button>
            <Button asChild type="button" variant="outline" className="w-full">
              <a href={`sms:?&body=${encodeURIComponent(`AutoDrive first login setup link: ${setupLink}`)}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Text
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This link lets the user set their password on first login.
          </p>
        </div>
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

          <div className="space-y-2 rounded-md border border-cyan-900/40 bg-cyan-950/10 p-3">
            <div className="flex items-center justify-between">
              <FormLabel className="m-0">Dealership Assignment</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateNewDealership((prev) => !prev)}
                disabled={isSubmitting}
              >
                {createNewDealership ? (
                  <>Use Existing</>
                ) : (
                  <>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Create Dealership
                  </>
                )}
              </Button>
            </div>

            {!createNewDealership ? (
              <FormField
                control={form.control}
                name="dealershipId"
                render={({ field }) => (
                  <FormItem>
                    <Select value={field.value || '__none__'} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dealership (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {dealerships.map((dealership) => (
                          <SelectItem key={dealership.id} value={dealership.id}>
                            {dealership.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="newDealershipName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="New dealership name"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="newDealershipCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="City (optional)" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newDealershipState"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="State (optional)" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="newDealershipStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Street (optional)" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newDealershipZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="ZIP (optional)" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This creates the dealership and assigns the user in one action.
                </p>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Building2 className="mr-2 h-4 w-4" />
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
