
'use client';

import { useState } from 'react';
import { User } from '@/lib/definitions';
import { updateUserDealerships } from '@/lib/data';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

interface RemoveUserFormProps {
  manageableUsers: User[];
  onUserRemoved?: () => void;
}

export function RemoveUserForm({ manageableUsers, onUserRemoved }: RemoveUserFormProps) {
  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();

  async function handleRemove() {
    if (!userToRemove) return;

    setIsRemoving(true);
    try {
      await updateUserDealerships(userToRemove.userId, []);
      toast({
        title: 'User Unassigned',
        description: `${userToRemove.name} has been removed from all their dealerships.`,
      });
      onUserRemoved?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Removal Failed',
        description: (error as Error).message || 'Could not remove user from dealerships.',
      });
    } finally {
      setIsRemoving(false);
      setUserToRemove(null);
      setConfirmationInput('');
    }
  }

  return (
    <>
      <ScrollArea className="max-h-[60vh] -mx-6">
        <div className="space-y-2 px-6">
          {manageableUsers.length > 0 ? (
            manageableUsers.map(user => (
              <div key={user.userId} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button variant="destructive" onClick={() => setUserToRemove(user)}>
                  Remove
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              No users available to remove.
            </p>
          )}
        </div>
      </ScrollArea>
      <AlertDialog open={!!userToRemove} onOpenChange={(open) => !open && setUserToRemove(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will remove <strong>{userToRemove?.name}</strong> from all their assigned dealerships. They will become "unassigned". This action cannot be undone, but they can be reassigned later.
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
                <AlertDialogCancel onClick={() => { setUserToRemove(null); setConfirmationInput(''); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleRemove} 
                    disabled={confirmationInput.toLowerCase() !== 'remove' || isRemoving}
                    className={buttonVariants({ variant: "destructive" })}
                >
                    {isRemoving ? <Spinner size="sm" /> : 'Confirm Removal'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    