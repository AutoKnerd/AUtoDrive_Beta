
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { findUserByEmail, updateUserDealerships, getDealerships } from '@/lib/data';
import { User, Dealership } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import isEqual from 'lodash.isequal';
import { Label } from '@/components/ui/label';

interface AssignUserFormProps {
  currentUser: User;
  onUserAssigned?: () => void;
}

const searchSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

type SearchFormValues = z.infer<typeof searchSchema>;

export function AssignUserForm({ currentUser, onUserAssigned }: AssignUserFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [managedDealerships, setManagedDealerships] = useState<Dealership[]>([]);
  const [selectedDealerships, setSelectedDealerships] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    async function fetchManagedDealerships() {
      const allDealerships = await getDealerships(currentUser);
      if (['Owner', 'Admin', 'Trainer'].includes(currentUser.role)) {
        setManagedDealerships(allDealerships);
      } else {
        const userDealerships = allDealerships.filter(d => currentUser.dealershipIds.includes(d.id));
        setManagedDealerships(userDealerships);
      }
    }
    fetchManagedDealerships();
  }, [currentUser]);

  const searchForm = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { email: '' },
  });

  async function onSearch(data: SearchFormValues) {
    setIsSearching(true);
    setFoundUser(null);
    setSearchMessage('');
    try {
      const user = await findUserByEmail(data.email);
      if (user) {
        setFoundUser(user);
        setSelectedDealerships(user.dealershipIds);
      } else {
        setSearchMessage('No user found with that email address.');
      }
    } catch (error) {
      setSearchMessage('An error occurred during the search.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAssignDealerships() {
    if (!foundUser) return;
    setIsAssigning(true);
    try {
        await updateUserDealerships(foundUser.userId, selectedDealerships);
        toast({
            title: 'Success',
            description: `${foundUser.name} has been assigned to new dealerships.`,
        });
        onUserAssigned?.();
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'Assignment Failed',
            description: (e as Error).message || 'An error occurred.',
        });
    } finally {
        setIsAssigning(false);
    }
  }

  const handleCheckedChange = (dealershipId: string, checked: boolean) => {
    setSelectedDealerships(prev => {
        if (checked) {
            return [...prev, dealershipId];
        } else {
            return prev.filter(id => id !== dealershipId);
        }
    });
  }

  return (
    <div className="grid gap-6">
      <Form {...searchForm}>
        <form onSubmit={searchForm.handleSubmit(onSearch)} className="flex items-start gap-2">
          <FormField
            control={searchForm.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="sr-only">Email</FormLabel>
                <FormControl>
                  <Input placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? <Spinner size="sm" /> : 'Search'}
          </Button>
        </form>
      </Form>

      {searchMessage && !foundUser && (
        <Alert variant="destructive">
          <AlertTitle>Search Failed</AlertTitle>
          <AlertDescription>{searchMessage}</AlertDescription>
        </Alert>
      )}

      {foundUser && (
        <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-md border p-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={foundUser.avatarUrl} />
                    <AvatarFallback>{foundUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{foundUser.name}</p>
                    <p className="text-sm text-muted-foreground">{foundUser.role}</p>
                </div>
            </div>
            
            <div>
                <Label>Assign to Dealership(s)</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal mt-2">
                            <span className="truncate">
                                {selectedDealerships.length > 0 ? 
                                    managedDealerships.filter(d => selectedDealerships.includes(d.id)).map(d => d.name).join(', ') :
                                    "Select dealerships..."}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" align="start">
                        <DropdownMenuLabel>Managed Dealerships</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {managedDealerships.map(dealership => (
                            <DropdownMenuCheckboxItem
                                key={dealership.id}
                                checked={selectedDealerships.includes(dealership.id)}
                                onCheckedChange={(checked) => handleCheckedChange(dealership.id, !!checked)}
                            >
                                {dealership.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

          <Button onClick={handleAssignDealerships} disabled={isAssigning || isEqual([...foundUser.dealershipIds].sort(), [...selectedDealerships].sort())} className="w-full">
            {isAssigning ? <Spinner size="sm" /> : `Assign to ${selectedDealerships.length} Dealership(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
