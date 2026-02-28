'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Dealership, UserRole, allRoles, carBrands, type ThemePreference } from '@/lib/definitions';
import { updateUser, getDealerships, updateUserDealerships } from '@/lib/data.client';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge as UiBadge } from '@/components/ui/badge';
import placeholderImagesData from '@/lib/placeholder-images.json';
import { Camera, X, CheckCircle, ExternalLink, Sparkles, Shield, Palette } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { createCustomerPortalSession } from '@/app/actions/stripe';
import { resolveBillingAccess } from '@/lib/billing/access';
import { getDaysRemaining } from '@/lib/billing/trial';

interface ProfileFormProps {
  user: User;
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email.'),
  brand: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().min(1, 'An avatar image is required.'),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  isPrivate: z.boolean().optional(),
  isPrivateFromOwner: z.boolean().optional(),
  showDealerCriticalOnly: z.boolean().optional(),
  themePreference: z.enum(['vibrant', 'executive', 'steel', 'patriot', 'velocity', 'monochrome', 'forest', 'sunset', 'oceanic', 'cyber']).optional(),
  selfDeclaredDealershipId: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
const SELF_SELECTABLE_ROLES: UserRole[] = allRoles.filter((role) => (
  !['Owner', 'Admin', 'Developer', 'Trainer'].includes(role)
));

export function ProfileForm({ user }: ProfileFormProps) {
  const { setUser } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dealershipToRemove, setDealershipToRemove] = useState<string | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [showOwnerPrivacyDialog, setShowOwnerPrivacyDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    SELF_SELECTABLE_ROLES.includes(user.role) ? user.role : 'Sales Consultant'
  );
  const [isRoleUpdating, setIsRoleUpdating] = useState(false);
  const isUnassignedUser = !Array.isArray(user.dealershipIds) || user.dealershipIds.length === 0;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      brand: user.brand || '',
      phone: user.phone || '',
      avatarUrl: user.avatarUrl,
      address: {
        street: user.address?.street || '',
        city: user.address?.city || '',
        state: user.address?.state || '',
        zip: user.address?.zip || '',
      },
      isPrivate: user.isPrivate || false,
      isPrivateFromOwner: user.isPrivateFromOwner || false,
      showDealerCriticalOnly: user.showDealerCriticalOnly || false,
      themePreference: user.themePreference || (user.useProfessionalTheme ? 'executive' : 'vibrant'),
      selfDeclaredDealershipId: user.selfDeclaredDealershipId || '',
    },
  });

  const isPrivateValue = form.watch('isPrivate');
  const criticalOnlyValue = form.watch('showDealerCriticalOnly');

  useEffect(() => {
    setSelectedRole(SELF_SELECTABLE_ROLES.includes(user.role) ? user.role : 'Sales Consultant');
  }, [user.role]);

  useEffect(() => {
    let active = true;

    async function fetchDealerships() {
      try {
        const dealerships = await getDealerships();
        if (!active) return;
        setAllDealerships(dealerships);
      } catch (error) {
        console.error('[ProfileForm] Failed to load dealerships', error);
        if (!active) return;
        setAllDealerships([]);
      }
    }

    fetchDealerships();
    return () => {
      active = false;
    };
  }, []);

  const userDealerships = useMemo(() => {
    return user.dealershipIds
      .map(id => allDealerships.find(d => d.id === id))
      .filter((d): d is Dealership => d !== undefined);
  }, [user.dealershipIds, allDealerships]);
  const billingAccess = useMemo(() => resolveBillingAccess(user, userDealerships), [user, userDealerships]);
  const trialDaysRemaining = useMemo(() => getDaysRemaining(billingAccess.trialEndsAt), [billingAccess.trialEndsAt]);

  const { placeholderImages } = placeholderImagesData;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          form.setValue('avatarUrl', e.target.result, { shouldValidate: true });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleRemoveDealership() {
    if (!dealershipToRemove) return;

    setIsRemoving(true);
    try {
      const newDealershipIds = user.dealershipIds.filter(id => id !== dealershipToRemove);
      const updatedUser = await updateUserDealerships(user.userId, newDealershipIds);
      setUser(updatedUser);
      toast({
        title: 'Dealership Removed',
        description: `You have been removed from the dealership.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Removal Failed',
        description: (error as Error).message || 'Could not remove you from the dealership.',
      });
    } finally {
      setIsRemoving(false);
      setDealershipToRemove(null);
      setConfirmationInput('');
    }
  }

  const handleManageSubscription = async () => {
    if (!user.stripeCustomerId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Stripe customer ID not found.' });
      return;
    }
    setIsPortalLoading(true);
    try {
      const firebaseUser = firebaseAuth.currentUser;
      if (!firebaseUser) {
        throw new Error('Authentication session expired. Please sign in again.');
      }
      const idToken = await firebaseUser.getIdToken(true);
      await createCustomerPortalSession(idToken);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: (e as Error).message });
      setIsPortalLoading(false);
    }
  }

  const handleRoleUpdate = async () => {
    if (!isUnassignedUser) return;
    if (selectedRole === user.role) return;

    setIsRoleUpdating(true);
    try {
      const firebaseUser = firebaseAuth.currentUser;
      if (!firebaseUser) {
        throw new Error('Authentication session expired. Please sign in again.');
      }
      const idToken = await firebaseUser.getIdToken(true);

      const response = await fetch('/api/profile/select-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Could not update role.');
      }

      setUser({ ...user, role: selectedRole });
      toast({
        title: 'Role Updated',
        description: 'Your role access has been updated.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Role Update Failed',
        description: error?.message || 'Could not update your role.',
      });
    } finally {
      setIsRoleUpdating(false);
    }
  };


  async function onSubmit(data: ProfileFormValues) {
    setIsSubmitting(true);
    try {
      // Sync legacy boolean for backward compatibility
      const updatedData = {
        ...data,
        address: data.address ? {
          street: data.address.street || '',
          city: data.address.city || '',
          state: data.address.state || '',
          zip: data.address.zip || '',
        } : undefined,
        useProfessionalTheme: data.themePreference === 'executive' || data.themePreference === 'steel',
      };

      const updatedUserData = await updateUser(user.userId, updatedData);
      setUser(updatedUserData);
      toast({
        title: 'Profile Updated',
        description: 'Your changes have been saved successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (error as Error).message || 'Could not save your changes.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleOwnerPrivacyChange = (checked: boolean) => {
    if (checked) {
      setShowOwnerPrivacyDialog(true);
    } else {
      form.setValue('isPrivateFromOwner', false);
    }
  };

  const confirmOwnerPrivacy = () => {
    form.setValue('isPrivateFromOwner', true);
    setShowOwnerPrivacyDialog(false);
  };

  useEffect(() => {
    if (!isPrivateValue) {
      form.setValue('isPrivateFromOwner', false);
    }
  }, [isPrivateValue, form]);

  useEffect(() => {
    if (isPrivateValue && criticalOnlyValue) {
      form.setValue('showDealerCriticalOnly', false);
    }
  }, [isPrivateValue, criticalOnlyValue, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Select a new avatar for your profile or upload your own.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-wrap items-center gap-4">
                      {placeholderImages.map((image) => (
                        <button
                          type="button"
                          key={image.id}
                          onClick={() => field.onChange(image.imageUrl)}
                          className={`rounded-full ring-offset-background ring-offset-2 transition-all ${field.value === image.imageUrl ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-primary/50'}`}
                        >
                          <Avatar className={`h-20 w-20 cursor-pointer`}>
                            <AvatarImage src={image.imageUrl} alt={image.description} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </button>
                      ))}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-muted ring-offset-background ring-offset-2 transition-all hover:ring-2 hover:ring-primary/50"
                      >
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal and contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 555-5555" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Your personal address information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="address.street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP / Postal Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Current account enrollment status.</CardDescription>
          </CardHeader>
          <CardContent>
            {billingAccess.source === 'dealership' ? (
              <div className={cn(
                "space-y-4 rounded-lg border p-4",
                billingAccess.accessGranted
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-amber-500/50 bg-amber-500/10"
              )}>
                <div className='flex items-center gap-2'>
                  <CheckCircle className={cn("h-5 w-5", billingAccess.accessGranted ? "text-green-400" : "text-amber-400")} />
                  <h4 className={cn("font-semibold", billingAccess.accessGranted ? "text-green-300" : "text-amber-300")}>
                    {billingAccess.accessGranted ? 'Dealership Billing Active' : 'Dealership Billing Inactive'}
                  </h4>
                </div>
                <p className={cn("text-sm", billingAccess.accessGranted ? "text-green-200/80" : "text-amber-200/80")}>
                  Your access is controlled by your dealership plan. Individual billing is overridden while you are dealership-enrolled.
                  {billingAccess.status === 'trialing' && trialDaysRemaining > 0
                    ? ` Trial time remaining: ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}.`
                    : ''}
                </p>
              </div>
            ) : billingAccess.source === 'individual' && billingAccess.accessGranted ? (
              <div className="space-y-4 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <div className="flex items-center justify-between">
                  <div className='flex items-center gap-2'>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <h4 className="font-semibold text-green-300">
                      {billingAccess.status === 'trialing' ? '30-Day Trial Active' : 'AutoDrive Pro is Active'}
                    </h4>
                  </div>
                  {user.stripeCustomerId ? (
                    <Button type="button" onClick={handleManageSubscription} variant="ghost" disabled={isPortalLoading} className="text-sm">
                      {isPortalLoading ? <Spinner size="sm" /> : <>Manage <ExternalLink className="ml-2 h-4 w-4" /></>}
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm text-green-200/80">
                  {billingAccess.status === 'trialing'
                    ? `Your individual trial is active with ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining.`
                    : 'You have full access to all features. You can manage billing and invoices through the secure payment portal.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="font-semibold">Subscription Inactive</h4>
                <p className="text-sm text-muted-foreground">
                  Your trial has ended or billing has not been activated yet. Contact your manager or activate an individual plan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {isUnassignedUser ? (
          <Card>
            <CardHeader>
              <CardTitle>Role Access</CardTitle>
              <CardDescription>
                Choose your role for your individual experience. Once you are assigned to a dealership, role changes are managed by dealership leadership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormLabel>Role</FormLabel>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as UserRole)}
                disabled={isRoleUpdating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your role..." />
                </SelectTrigger>
                <SelectContent>
                  {SELF_SELECTABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === 'manager' ? 'Sales Manager' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={handleRoleUpdate}
                disabled={isRoleUpdating || selectedRole === user.role}
              >
                {isRoleUpdating ? <Spinner size="sm" /> : 'Update Role Access'}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Work Information</CardTitle>
            <CardDescription>Your role and dealership assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Brand</FormLabel>
                  <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select the brand you primarily sell/service..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">-- Not Specified --</SelectItem>
                      {carBrands.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <FormLabel>Role</FormLabel>
              <Input value={user.role} readOnly disabled />
            </div>
            <div>
              <FormLabel>Dealership(s)</FormLabel>
              {userDealerships.length > 0 ? (
                <div className="space-y-2 pt-2">
                  {userDealerships.map(dealership => (
                    <div key={dealership.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-semibold">{dealership.name}</p>
                        {dealership.address && (
                          <p className="text-xs text-muted-foreground">
                            {dealership.address.street}, {dealership.address.city}, {dealership.address.state} {dealership.address.zip}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDealershipToRemove(dealership.id)}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7 shrink-0')}
                        aria-label={`Remove ${dealership.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <FormField
                    control={form.control}
                    name="selfDeclaredDealershipId"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a dealership to affiliate with..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">-- Not Affiliated --</SelectItem>
                            {allDealerships.filter(d => d.status === 'active').map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          As an individual subscriber, you can display a public affiliation with one dealership. This does not grant access to dealership-specific data.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interface Preferences</CardTitle>
            <CardDescription>Customize the visual style of your performance visualizations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="themePreference"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex flex-row items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <FormLabel className="text-base">Performance Visualization Theme</FormLabel>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value || 'vibrant'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a theme..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vibrant">Vibrant Neon (High Energy)</SelectItem>
                      <SelectItem value="executive">Elite Executive (Purple, Green, Gold)</SelectItem>
                      <SelectItem value="steel">Professional Steel (Cyan, Sky, Slate)</SelectItem>
                      <SelectItem value="patriot">Tricolor (Red, White, Blue)</SelectItem>
                      <SelectItem value="velocity">Velocity (Orange, Indigo, Teal)</SelectItem>
                      <SelectItem value="monochrome">Monochrome (Silver, Graphite, Charcoal)</SelectItem>
                      <SelectItem value="forest">Forest (Pine, Mint, Sage)</SelectItem>
                      <SelectItem value="sunset">Sunset (Crimson, Amber, Rose)</SelectItem>
                      <SelectItem value="oceanic">Oceanic (Navy, Aqua, Sand)</SelectItem>
                      <SelectItem value="cyber">Cyber (Magenta, Cyan, Lime)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the color palette for your sound rings, charts, and score cards.
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selective Visibility</CardTitle>
            <CardDescription>Your personal performance metrics may be hidden from management, but they still contribute anonymously to dealership improvement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="showDealerCriticalOnly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Show Dealer Critical Only
                    </FormLabel>
                    <FormDescription>
                      Superiors will only see your top strength and area for improvement, without percentage scores.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue('isPrivate', false);
                          form.setValue('isPrivateFromOwner', false);
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPrivate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Hide Performance from Managers
                    </FormLabel>
                    <FormDescription>
                      When enabled, your detailed performance insights will be hidden from Manager-level roles on dashboards.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue('showDealerCriticalOnly', false);
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPrivateFromOwner"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Hide Performance from Owners
                    </FormLabel>
                    <FormDescription>
                      When enabled, your performance insights will also be hidden from users with the &apos;Owner&apos; role.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={handleOwnerPrivacyChange}
                      disabled={!isPrivateValue}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : 'Save Changes'}
          </Button>
        </div>
      </form>
      <AlertDialog open={!!dealershipToRemove} onOpenChange={(open) => !open && setDealershipToRemove(null)}>
        <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You will lose access to this dealership and will need an administrator to add you back.
              <br /><br />
              To confirm, please type <strong>remove</strong> in the box below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="remove"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDealershipToRemove(null); setConfirmationInput(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveDealership}
              disabled={confirmationInput.toLowerCase() !== 'remove' || isRemoving}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isRemoving ? <Spinner size="sm" /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showOwnerPrivacyDialog} onOpenChange={setShowOwnerPrivacyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Privacy Setting</AlertDialogTitle>
            <AlertDialogDescription>
              Hiding your data from ownership may result in lost opportunities for recognition, bonuses, or promotions that are based on performance metrics visible to company leadership. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowOwnerPrivacyDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOwnerPrivacy}>
              I Understand, Hide My Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
