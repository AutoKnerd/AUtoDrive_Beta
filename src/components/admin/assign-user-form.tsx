
'use client';

import { useState } from 'react';
import { User, Dealership } from '@/lib/definitions';
import { updateUserDealerships } from '@/lib/data.client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import isEqual from 'lodash.isequal';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AssignUserFormProps {
  manageableUsers: User[];
  dealerships: Dealership[];
  currentUser?: User;
  onUserAssigned?: () => void;
}

export function AssignUserForm({ manageableUsers, dealerships, currentUser, onUserAssigned }: AssignUserFormProps) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDealerships, setSelectedDealerships] = useState<string[]>([]);
  const { toast } = useToast();

  // For Owners: only show their assigned dealerships
  // For others: show all managed dealerships
  const isOwner = currentUser?.role === 'Owner';
  const managedDealerships = isOwner 
    ? dealerships.filter(d => currentUser?.dealershipIds?.includes(d.id))
    : dealerships;

  const handleUserSelect = (userId: string) => {
    const user = manageableUsers.find(u => u.userId === userId);
    if (user) {
        setSelectedUser(user);
        setSelectedDealerships(user.dealershipIds);
    } else {
        setSelectedUser(null);
        setSelectedDealerships([]);
    }
  }

  async function handleAssignDealerships() {
    if (!selectedUser) return;
    setIsAssigning(true);
    try {
        await updateUserDealerships(selectedUser.userId, selectedDealerships);
        toast({
            title: 'Success',
            description: `${selectedUser.name}'s assignments have been updated.`,
        });
        onUserAssigned?.();
        setSelectedUser(null);
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
        <Select onValueChange={handleUserSelect} value={selectedUser?.userId || ""}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a user to manage..." />
            </SelectTrigger>
            <SelectContent>
                {manageableUsers.map(user => (
                    <SelectItem key={user.userId} value={user.userId}>
                        <div className="flex items-center gap-2">
                             <Avatar className="h-6 w-6">
                                <AvatarImage src={user.avatarUrl} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{user.name} ({user.email})</span>
                        </div>
                    </SelectItem>
                ))}
                {manageableUsers.length === 0 && <SelectItem value="none" disabled>No users to manage.</SelectItem>}
            </SelectContent>
        </Select>

      {selectedUser && (
        <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-md border p-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedUser.avatarUrl} />
                    <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.role}</p>
                </div>
            </div>
            
            <div>
                <Label>Assign to Dealership(s)</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal mt-2">
                            <span className="truncate">
                                {selectedDealerships.length > 0 ? 
                                    dealerships.filter(d => selectedDealerships.includes(d.id)).map(d => d.name).join(', ') :
                                    "Not assigned"}
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

          <Button onClick={handleAssignDealerships} disabled={isAssigning || isEqual([...selectedUser.dealershipIds].sort(), [...selectedDealerships].sort())} className="w-full">
            {isAssigning ? <Spinner size="sm" /> : 'Update Assignments'}
          </Button>
        </div>
      )}
    </div>
  );
}
