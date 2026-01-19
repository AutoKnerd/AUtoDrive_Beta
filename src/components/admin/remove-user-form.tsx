
'use client';

import { useState } from 'react';
import { User } from '@/lib/definitions';
import { deleteUser } from '@/lib/data';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface RemoveUserFormProps {
  manageableUsers: User[];
  onUserRemoved?: () => void;
}

export function RemoveUserForm({ manageableUsers, onUserRemoved }: RemoveUserFormProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const { toast } = useToast();

  const handleUserSelect = (userId: string) => {
    const user = manageableUsers.find(u => u.userId === userId);
    setSelectedUser(user || null);
  }

  async function handleRemoveUser() {
    if (!selectedUser) return;
    setIsRemoving(true);
    try {
        await deleteUser(selectedUser.userId);
        toast({
            title: 'User Removed',
            description: `${selectedUser.name} has been permanently removed from the system.`,
        });
        onUserRemoved?.();
        setSelectedUser(null);
        setIsConfirming(false);
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'Removal Failed',
            description: (e as Error).message || 'An error occurred.',
        });
    } finally {
        setIsRemoving(false);
        setConfirmationInput('');
    }
  }

  return (
    <div className="grid gap-6">
        <Select onValueChange={handleUserSelect} value={selectedUser?.userId || ""}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a user to remove..." />
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
                {manageableUsers.length === 0 && <SelectItem value="none" disabled>No users to remove.</SelectItem>}
            </SelectContent>
        </Select>

      {selectedUser && (
        <div className="space-y-4 rounded-lg border border-destructive bg-destructive/10 p-4">
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
            
            <p className="text-sm text-destructive-foreground">
                Removing this user is permanent and cannot be undone. All associated data, including lesson history and XP, will be deleted.
            </p>

          <Button onClick={() => setIsConfirming(true)} disabled={isRemoving} variant="destructive" className="w-full">
            {isRemoving ? <Spinner size="sm" /> : `Permanently Remove ${selectedUser.name}`}
          </Button>
        </div>
      )}

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is irreversible. It will permanently delete the account for <strong>{selectedUser?.name}</strong> and all of their data.
                    <br /><br />
                    To confirm, please type <strong>DELETE</strong> in the box below.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="DELETE"
                autoFocus
                className="border-destructive/50 focus-visible:ring-destructive"
            />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setIsConfirming(false); setConfirmationInput(''); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleRemoveUser} 
                    disabled={confirmationInput.toUpperCase() !== 'DELETE' || isRemoving}
                    className={buttonVariants({ variant: "destructive" })}
                >
                    {isRemoving ? <Spinner size="sm" /> : 'Confirm Deletion'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
