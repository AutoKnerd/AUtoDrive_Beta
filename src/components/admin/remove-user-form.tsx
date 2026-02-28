
'use client';

import { useState, useMemo } from 'react';
import { User } from '@/lib/definitions';
import { deleteUser } from '@/lib/data.client';
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
import { X } from 'lucide-react';

interface RemoveUserFormProps {
  manageableUsers: User[];
  onUserRemoved?: () => void;
}

export function RemoveUserForm({ manageableUsers, onUserRemoved }: RemoveUserFormProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
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
        setSearchTerm('');
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

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchTerm(''); // Clear search after selection
  }
  
  const handleClearSelection = () => {
      setSelectedUser(null);
      setConfirmationInput('');
      setIsConfirming(false);
  }

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
                    <p className="p-4 text-center text-sm text-muted-foreground">No users to remove.</p>
                )}
            </div>
        ) : (
            <div className="space-y-4 rounded-lg border border-destructive bg-destructive/10 p-4">
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
                
                <p className="text-sm text-destructive-foreground">
                    Removing this user is permanent and cannot be undone. All associated data, including lesson history and XP, will be deleted.
                </p>

                <Button onClick={() => setIsConfirming(true)} disabled={isRemoving} variant="destructive" className="w-full">
                    {isRemoving ? <Spinner size="sm" /> : `Permanently Remove ${selectedUser.name}`}
                </Button>
            </div>
        )}

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
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
