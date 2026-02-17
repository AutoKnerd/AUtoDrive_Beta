
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, UserRole, allRoles, Dealership } from '@/lib/definitions';
import { updateUser, updateUserDealerships } from '@/lib/data.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { X, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import isEqual from 'lodash.isequal';

// Define the schema for the edit form
const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email(), // Will be read-only
  role: z.enum(allRoles),
  phone: z.string().optional(),
  dealershipIds: z.array(z.string()).optional(),
  isPrivate: z.boolean().optional(),
  isPrivateFromOwner: z.boolean().optional(),
  showDealerCriticalOnly: z.boolean().optional(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserFormProps {
  manageableUsers: User[];
  dealerships: Dealership[];
  onUserUpdated?: () => void;
}

export function EditUserForm({ manageableUsers, dealerships, onUserUpdated }: EditUserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const form = useForm<EditUserFormValues>({
      resolver: zodResolver(editUserSchema),
  });

  useEffect(() => {
    if (selectedUser) {
      form.reset({
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role,
        phone: selectedUser.phone || '',
        dealershipIds: selectedUser.dealershipIds || [],
        isPrivate: selectedUser.isPrivate || false,
        isPrivateFromOwner: selectedUser.isPrivateFromOwner || false,
        showDealerCriticalOnly: selectedUser.showDealerCriticalOnly || false,
      });
    }
  }, [selectedUser, form]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return [];
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return manageableUsers.filter(user =>
      user.name.toLowerCase().includes(lowercasedTerm) ||
      user.email.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, manageableUsers]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchTerm('');
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    form.reset();
  };

  async function onSubmit(data: EditUserFormValues) {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const updatePromises: Promise<any>[] = [];
      
      // Update profile data
      updatePromises.push(updateUser(selectedUser.userId, {
        name: data.name,
        role: data.role,
        phone: data.phone,
        isPrivate: data.isPrivate,
        isPrivateFromOwner: data.isPrivateFromOwner,
        showDealerCriticalOnly: data.showDealerCriticalOnly,
      }));

      // Update dealership assignments if they changed
      const originalIds = selectedUser.dealershipIds || [];
      const newIds = data.dealershipIds || [];
      if (!isEqual(originalIds.sort(), newIds.sort())) {
        updatePromises.push(updateUserDealerships(selectedUser.userId, newIds));
      }

      await Promise.all(updatePromises);
      
      toast({
        title: 'User Updated',
        description: `${data.name}'s profile has been saved.`,
      });
      onUserUpdated?.();
      handleClearSelection();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (e as Error).message || 'An error occurred while saving the user.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      {!selectedUser ? (
        <div className="space-y-2">
          <Input
            placeholder="Search for a user by name or email to edit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ScrollArea className="h-64 rounded-md border">
            <div className="p-2">
              {searchTerm ? (
                filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <div
                      key={user.userId}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => handleSelectUser(user)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-center text-sm text-muted-foreground">No users found.</p>
                )
              ) : (
                <p className="p-4 text-center text-sm text-muted-foreground">Start typing to find a user.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-primary/20 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedUser.avatarUrl} />
                  <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">Editing: {selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClearSelection} className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Clear selection and cancel</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl><Input placeholder="(555) 555-5555" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a role..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {allRoles.map(role => (
                            <SelectItem key={role} value={role}>{role === 'manager' ? 'Sales Manager' : role}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="dealershipIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealership Assignments</FormLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <span className="truncate">
                          {field.value && field.value.length > 0
                            ? dealerships.filter(d => field.value?.includes(d.id)).map(d => d.name).join(', ')
                            : "Independent User"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" align="start">
                      <DropdownMenuLabel>Managed Dealerships</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {dealerships.map(dealership => (
                        <DropdownMenuCheckboxItem
                          key={dealership.id}
                          checked={field.value?.includes(dealership.id)}
                          onCheckedChange={(checked) => {
                            const currentIds = field.value || [];
                            const newIds = checked
                              ? [...currentIds, dealership.id]
                              : currentIds.filter(id => id !== dealership.id);
                            field.onChange(newIds);
                          }}
                        >
                          {dealership.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <FormDescription>
                    Assigning one or more dealerships makes a user "Dealer Managed". No assignments makes them "Independent".
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2 rounded-lg border p-4">
                <h4 className="font-medium text-sm">Privacy Settings</h4>
                <FormField
                    control={form.control}
                    name="isPrivate"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between py-2">
                        <FormLabel>Hide from Managers</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="isPrivateFromOwner"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between py-2">
                        <FormLabel>Hide from Owners</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="showDealerCriticalOnly"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between py-2">
                        <FormLabel>Show Critical Only</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
