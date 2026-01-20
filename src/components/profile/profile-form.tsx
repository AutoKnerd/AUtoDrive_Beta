

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Dealership, Badge } from '@/lib/definitions';
import { updateUser, getDealerships, updateUserDealerships } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge as UiBadge } from '@/components/ui/badge';
import placeholderImagesData from '@/lib/placeholder-images.json';
import { Camera, X } from 'lucide-react';
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
import { BadgeShowcase } from './badge-showcase';
import { Skeleton } from '../ui/skeleton';

interface ProfileFormProps {
  user: User;
  badges: Badge[];
  loadingBadges: boolean;
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email.'),
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
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({ user, badges, loadingBadges }: ProfileFormProps) {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dealershipToRemove, setDealershipToRemove] = useState<string | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [showOwnerPrivacyDialog, setShowOwnerPrivacyDialog] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
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
    },
  });

  useEffect(() => {
    async function fetchDealerships() {
        const dealerships = await getDealerships();
        setAllDealerships(dealerships);
    }
    fetchDealerships();
  }, []);

  const userDealerships = useMemo(() => {
    return user.dealershipIds
      .map(id => allDealerships.find(d => d.id === id))
      .filter((d): d is Dealership => d !== undefined);
  }, [user.dealershipIds, allDealerships]);

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


  async function onSubmit(data: ProfileFormValues) {
    setIsSubmitting(true);
    try {
      const updatedUserData = await updateUser(user.userId, data);
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

        {loadingBadges ? (
            <Card>
                <CardHeader><CardTitle>My Badges</CardTitle></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
        ) : (
            <BadgeShowcase badges={badges} />
        )}

        <Card>
            <CardHeader>
                <CardTitle>Work Information</CardTitle>
                <CardDescription>Your role and dealership assignments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <FormLabel>Role</FormLabel>
                    <Input value={user.role} readOnly disabled />
                </div>
                 <div>
                    <FormLabel>Dealership(s)</FormLabel>
                    <div className="flex flex-wrap gap-2 pt-2">
                        {userDealerships.length > 0 ? (
                            userDealerships.map(dealership => (
                                <UiBadge key={dealership.id} variant="secondary" className="flex items-center gap-1.5 py-1 pl-2.5 pr-1 text-sm">
                                    {dealership.name}
                                    <button
                                        type="button"
                                        onClick={() => setDealershipToRemove(dealership.id)}
                                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                                        aria-label={`Remove ${dealership.name}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </UiBadge>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">Not assigned to any dealership.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control how your performance metrics are displayed to management.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                control={form.control}
                name="isPrivate"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel className="text-base">
                        Private Mode
                        </FormLabel>
                        <FormDescription>
                        When enabled, your detailed CX scores will be hidden from non-administrator roles on dashboards. Your anonymized data will still contribute to dealership-wide average statistics.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
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
                        Hide from Owner
                        </FormLabel>
                        <FormDescription>
                        When enabled, your profile metrics will also be hidden from users with the &apos;Owner&apos; role.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={handleOwnerPrivacyChange}
                            disabled={!form.watch('isPrivate')}
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
        <AlertDialogContent>
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
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    Hiding your data from ownership may result in lost opportunities for recognition, bonuses, or promotions that are based on performance metrics visible to company leadership.
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
