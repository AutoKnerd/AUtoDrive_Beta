
'use client';

import { useState, useMemo } from 'react';
import { User, Dealership } from '@/lib/definitions';
import { updateUserDealerships } from '@/lib/data.client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import isEqual from 'lodash.isequal';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { X } from 'lucide-react';

interface AssignDealershipsFormProps {
  manageableUsers: User[];
  dealerships: Dealership[];
  currentUser?: User;
  onDealershipsAssigned?: () => void;
}

export function AssignDealershipsForm({
  manageableUsers,
  dealerships,
  currentUser,
  onDealershipsAssigned,
}: AssignDealershipsFormProps) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDealerships, setSelectedDealerships] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return [];
    }
    return manageableUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, manageableUsers]);

  const isOwner = currentUser?.role === 'Owner';
  const managedDealerships = isOwner
    ? dealerships.filter((d) => currentUser?.dealershipIds?.includes(d.id))
    : dealerships;

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSelectedDealerships(user.dealershipIds || []);
    setSearchTerm('');
  };
  
  const handleClearSelection = () => {
    setSelectedUser(null);
    setSelectedDealerships([]);
  };

  async function handleAssignDealerships() {
    if (!selectedUser) return;

    const hasChanges = !isEqual(selectedDealerships.sort(), (selectedUser.dealershipIds || []).sort());
    if (!hasChanges) {
      toast({
        title: 'No Changes',
        description: 'No dealership assignments were modified.',
      });
      return;
    }

    setIsAssigning(true);
    try {
      await updateUserDealerships(selectedUser.userId, selectedDealerships);
      toast({
        title: 'Success',
        description: `${selectedUser.name}'s dealership assignments have been updated.`,
      });
      onDealershipsAssigned?.();
      handleClearSelection();
    } catch (e) {
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
    setSelectedDealerships((prev) => {
      const newSelection = new Set(prev);
      if (checked) {
        newSelection.add(dealershipId);
      } else {
        newSelection.delete(dealershipId);
      }
      return Array.from(newSelection);
    });
  };

  return (
    <div className="grid gap-6">
      {!selectedUser ? (
        <div className="space-y-2">
            <Input 
                placeholder="Search for a user by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
                <ScrollArea className="h-64 rounded-md border">
                    <div className="p-2">
                    {filteredUsers.length > 0 ? filteredUsers.map(user => (
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
                    )) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">No users found.</p>
                    )}
                    </div>
                </ScrollArea>
            )}
            {manageableUsers.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">No users available.</p>
            )}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-primary/20 bg-muted/20 p-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedUser.avatarUrl} />
                        <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{selectedUser.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedUser.role}</p>
                    </div>
                </div>
                 <Button variant="ghost" size="icon" onClick={handleClearSelection} className="h-8 w-8">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear selection</span>
                </Button>
            </div>
          <div>
            <Label className="text-base font-semibold mb-4 block">Assign Dealerships</Label>
            <div className="space-y-3">
              {managedDealerships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dealerships available to assign.</p>
              ) : (
                managedDealerships.map((dealership) => (
                  <div key={dealership.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dealership-${dealership.id}`}
                      checked={selectedDealerships.includes(dealership.id)}
                      onCheckedChange={(checked) =>
                        handleCheckedChange(dealership.id, checked as boolean)
                      }
                      disabled={isAssigning}
                    />
                    <label
                      htmlFor={`dealership-${dealership.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {dealership.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button
            onClick={handleAssignDealerships}
            disabled={isAssigning || !selectedUser}
            className="w-full"
          >
            {isAssigning ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Assigning...
              </>
            ) : (
              'Update Assignments'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
