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

const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email(),
  role: z.enum(allRoles as [UserRole, ...UserRole[]]),
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

  const toFormValues = (u: User): EditUserFormValues => ({
    name: u.name || '',
    email: u.email || '',
    role: u.role,
    phone: u.phone || '',
    dealershipIds: u.dealershipIds || [],
    isPrivate: !!u.isPrivate,
    isPrivateFromOwner: !!u.isPrivateFromOwner,
    showDealerCriticalOnly: !!u.showDealerCriticalOnly,
  });

  const form = useForm<EditUserFormValues>({
      resolver: zodResolver(editUserSchema),
      defaultValues: { name: '', email: '', role: 'Sales Consultant', phone: '', dealershipIds: [] },
  });

  useEffect(() => {
    if (selectedUser) form.reset(toFormValues(selectedUser));
  }, [selectedUser, form]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return manageableUsers.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [searchTerm, manageableUsers]);

  const handleSelectUser = (u: User) => {
    form.reset(toFormValues(u));
    setSelectedUser(u);
    setSearchTerm('');
  };

  async function onSubmit(data: EditUserFormValues) {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const updates = [];
      updates.push(updateUser(selectedUser.userId, {
        name: data.name,
        role: data.role,
        phone: data.phone,
        isPrivate: data.isPrivate,
        isPrivateFromOwner: data.isPrivateFromOwner,
        showDealerCriticalOnly: data.showDealerCriticalOnly,
      }));

      const oldIds = (selectedUser.dealershipIds || []).sort();
      const newIds = (data.dealershipIds || []).sort();
      if (!isEqual(oldIds, newIds)) {
        updates.push(updateUserDealerships(selectedUser.userId, newIds));
      }

      await Promise.all(updates);
      toast({ title: 'User Updated', description: `${data.name} saved successfully.` });
      onUserUpdated?.();
      setSelectedUser(null);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Update Failed', description: (e as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      {!selectedUser ? (
        <div className="space-y-2">
          <Input placeholder="Search name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <ScrollArea className="h-64 rounded-md border">
            <div className="p-2">
              {searchTerm ? filteredUsers.map(u => (
                <div key={u.userId} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => handleSelectUser(u)}>
                  <Avatar className="h-8 w-8"><AvatarFallback>{u.name.charAt(0)}</AvatarFallback></Avatar>
                  <div className="min-w-0"><p className="font-medium text-sm truncate">{u.name}</p><p className="text-xs text-muted-foreground truncate">{u.email}</p></div>
                </div>
              )) : <p className="p-4 text-center text-sm text-muted-foreground">Start typing to find a user...</p>}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg border p-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">Editing: {selectedUser.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
                <FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
            </div>
            <FormField control={form.control} name="role" render={({ field }) => <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{allRoles.map(r => <SelectItem key={r} value={r}>{r === 'manager' ? 'Sales Manager' : r}</SelectItem>)}</SelectContent></Select></FormItem>} />
            <FormField control={form.control} name="dealershipIds" render={({ field }) => (
                <FormItem><FormLabel>Dealerships</FormLabel>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-start truncate font-normal">{field.value?.length ? dealerships.filter(d => field.value?.includes(d.id)).map(d => d.name).join(', ') : "Independent"}</Button></DropdownMenuTrigger><DropdownMenuContent className="w-64">{dealerships.map(d => <DropdownMenuCheckboxItem key={d.id} checked={field.value?.includes(d.id)} onCheckedChange={checked => field.onChange(checked ? [...(field.value || []), d.id] : (field.value || []).filter(id => id !== d.id))}>{d.name}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
                  <FormDescription>Assigning stores makes the user "Dealer Managed".</FormDescription>
                </FormItem>
            )} />
            <div className="grid gap-2 border rounded-md p-3">
                <FormField control={form.control} name="isPrivate" render={({ field }) => <FormItem className="flex items-center justify-between"><FormLabel>Hide from Managers</FormLabel><Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>} />
                <FormField control={form.control} name="showDealerCriticalOnly" render={({ field }) => <FormItem className="flex items-center justify-between"><FormLabel>Critical Data Only</FormLabel><Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>} />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? <Spinner size="sm" /> : <><Save className="mr-2 h-4 w-4" /> Save Edits</>}</Button>
          </form>
        </Form>
      )}
    </div>
  );
}
