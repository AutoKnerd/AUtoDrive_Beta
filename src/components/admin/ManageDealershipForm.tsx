
'use client';

import { useState, useMemo } from 'react';
import { Dealership } from '@/lib/definitions';
import { updateDealershipStatus } from '@/lib/data.client';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Ban, Play, Trash2 } from 'lucide-react';

interface ManageDealershipFormProps {
  dealerships: Dealership[];
  onDealershipManaged?: () => void;
}

export function ManageDealershipForm({ dealerships, onDealershipManaged }: ManageDealershipFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
  const [isConfirming, setIsConfirming] = useState< 'pause' | 'deactivate' | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const { toast } = useToast();
  
  const activeDealerships = useMemo(() => {
    return dealerships.filter(d => d.status !== 'deactivated');
  }, [dealerships]);

  const handleSelectDealership = (dealershipId: string) => {
    const dealership = dealerships.find(d => d.id === dealershipId);
    setSelectedDealership(dealership || null);
  }

  async function handleUpdateStatus(newStatus: 'active' | 'paused' | 'deactivated') {
    if (!selectedDealership) return;
    setIsLoading(true);
    try {
        await updateDealershipStatus(selectedDealership.id, newStatus);
        toast({
            title: 'Dealership Updated',
            description: `${selectedDealership.name} has been ${newStatus}.`,
        });
        onDealershipManaged?.();
        setSelectedDealership(null); // Deselect after action
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: (e as Error).message || 'An error occurred.',
        });
    } finally {
        setIsLoading(false);
        setIsConfirming(null);
        setConfirmationInput('');
    }
  }
  
  const getStatusBadge = (status: Dealership['status']) => {
      switch(status) {
          case 'active':
              return <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
          case 'paused':
              return <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">Paused</Badge>;
          case 'deactivated':
              return <Badge variant="destructive">Deactivated</Badge>;
      }
  }

  const confirmationText = isConfirming === 'pause' ? 'PAUSE' : 'DEACTIVATE';

  return (
    <div className="grid gap-6">
        <Select onValueChange={handleSelectDealership} value={selectedDealership?.id || ""}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a dealership to manage..." />
            </SelectTrigger>
            <SelectContent>
                {dealerships.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center justify-between w-full">
                           <span>{d.name}</span>
                           {getStatusBadge(d.status)}
                        </div>
                    </SelectItem>
                ))}
                {dealerships.length === 0 && <SelectItem value="none" disabled>No dealerships available.</SelectItem>}
            </SelectContent>
        </Select>

      {selectedDealership && (
        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-lg">{selectedDealership.name}</h3>
                    <div className="text-sm text-muted-foreground">Current Status: {getStatusBadge(selectedDealership.status)}</div>
                </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
                Use the actions below to manage the dealership's status within AutoDrive. These actions are immediate and may affect user access.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {selectedDealership.status === 'active' && (
                    <Button onClick={() => setIsConfirming('pause')} disabled={isLoading} variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                       <Ban className="mr-2 h-4 w-4"/> Pause Activity
                    </Button>
                )}
                {selectedDealership.status === 'paused' && (
                    <Button onClick={() => handleUpdateStatus('active')} disabled={isLoading} variant="outline" className="border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-400">
                       <Play className="mr-2 h-4 w-4"/> Reactivate
                    </Button>
                )}
                {selectedDealership.status !== 'deactivated' && (
                    <Button onClick={() => setIsConfirming('deactivate')} disabled={isLoading} variant="destructive" className="col-start-1 md:col-start-3">
                        <Trash2 className="mr-2 h-4 w-4"/> Deactivate
                    </Button>
                )}
                 {selectedDealership.status === 'deactivated' && (
                    <p className="text-center text-muted-foreground text-sm md:col-span-3">This dealership has been deactivated. No further actions can be taken.</p>
                 )}
            </div>
        </div>
      )}

      <AlertDialog open={!!isConfirming} onOpenChange={() => setIsConfirming(null)}>
        <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    {isConfirming === 'pause' && 'Pausing a dealership will prevent all associated users from taking new lessons. Their metrics will be hidden from reports until reactivated.'}
                    {isConfirming === 'deactivate' && 'Deactivating is permanent and cannot be undone. It will remove the dealership from all associated user profiles. User accounts will be preserved.'}
                    <br /><br />
                    To confirm, please type <strong>{confirmationText}</strong> in the box below.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={confirmationText}
                autoFocus
                className="border-destructive/50 focus-visible:ring-destructive"
            />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setIsConfirming(null); setConfirmationInput(''); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={() => handleUpdateStatus(isConfirming!)} 
                    disabled={confirmationInput.toUpperCase() !== confirmationText || isLoading}
                    className={buttonVariants({ variant: "destructive" })}
                >
                    {isLoading ? <Spinner size="sm" /> : `Confirm ${isConfirming === 'pause' ? 'Pausing' : 'Deactivation'}`}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
