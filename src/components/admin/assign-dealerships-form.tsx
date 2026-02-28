'use client';

import { useState, useEffect } from 'react';
import { User, Dealership } from '@/lib/definitions';
import { updateUserDealerships } from '@/lib/data.client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import isEqual from 'lodash.isequal';

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
  const { toast } = useToast();

  // For Owners: only show their assigned dealerships
  // For others: show all managed dealerships
  const isOwner = currentUser?.role === 'Owner';
  const managedDealerships = isOwner
    ? dealerships.filter((d) => currentUser?.dealershipIds?.includes(d.id))
    : dealerships;

  const handleUserSelect = (userId: string) => {
    const user = manageableUsers.find((u) => u.userId === userId);
    if (user) {
      setSelectedUser(user);
      setSelectedDealerships(user.dealershipIds);
    } else {
      setSelectedUser(null);
      setSelectedDealerships([]);
    }
  };

  async function handleAssignDealerships() {
    if (!selectedUser) return;

    const hasChanges = !isEqual(selectedDealerships, selectedUser.dealershipIds);
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
      setSelectedUser(null);
      setSelectedDealerships([]);
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
      if (checked) {
        return [...prev, dealershipId];
      } else {
        return prev.filter((id) => id !== dealershipId);
      }
    });
  };

  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <Label htmlFor="user-select">Select User</Label>
        <Select value={selectedUser?.userId || ''} onValueChange={handleUserSelect}>
          <SelectTrigger id="user-select">
            <SelectValue placeholder="Select a user to assign dealerships..." />
          </SelectTrigger>
          <SelectContent>
            {manageableUsers.map((user) => (
              <SelectItem key={user.userId} value={user.userId}>
                {user.name} ({user.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedUser && (
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold mb-4 block">Assign Dealerships</Label>
            <div className="space-y-3">
              {managedDealerships.length === 0 ? (
                <p className="text-sm text-gray-500">No dealerships available to assign.</p>
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
            className="w-full bg-cyan-500 hover:bg-cyan-600"
          >
            {isAssigning ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Assigning...
              </>
            ) : (
              'Assign Dealerships'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
