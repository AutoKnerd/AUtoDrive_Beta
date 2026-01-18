'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Dealership } from '@/lib/definitions';
import { updateUser, getDealerships } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import placeholderImagesData from '@/lib/placeholder-images.json';

interface ProfileFormProps {
  user: User;
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email.'),
  phone: z.string().optional(),
  avatarUrl: z.string().url('Invalid URL for avatar.'),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({ user }: ProfileFormProps) {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);

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
    },
  });

  useEffect(() => {
    async function fetchDealerships() {
        const dealerships = await getDealerships();
        setAllDealerships(dealerships);
    }
    fetchDealerships();
  }, []);

  const userDealershipNames = useMemo(() => {
    return user.dealershipIds
      .map(id => allDealerships.find(d => d.id === id)?.name)
      .filter(Boolean);
  }, [user.dealershipIds, allDealerships]);

  const { placeholderImages } = placeholderImagesData;

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Select a new avatar for your profile.</CardDescription>
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
                <CardTitle>Work Information</CardTitle>
                <CardDescription>Your role and dealership assignments are managed by an administrator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <FormLabel>Role</FormLabel>
                    <Input value={user.role} readOnly disabled />
                </div>
                 <div>
                    <FormLabel>Dealership(s)</FormLabel>
                    <div className="flex flex-wrap gap-2 pt-2">
                        {userDealershipNames.length > 0 ? (
                            userDealershipNames.map(name => <Badge key={name} variant="secondary">{name}</Badge>)
                        ) : (
                            <p className="text-sm text-muted-foreground">Not assigned to any dealership.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
