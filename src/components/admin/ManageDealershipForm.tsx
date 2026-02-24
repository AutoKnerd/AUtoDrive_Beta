
'use client';

import { useState } from 'react';
import { Dealership, type DealershipBillingTier } from '@/lib/definitions';
import {
  updateDealershipStatus,
  updateDealershipRetakeTestingAccess,
  updateDealershipNewRecommendedTestingAccess,
  updateDealershipPppAccess,
  updateDealershipSaasPppAccess,
  updateDealershipBillingConfig,
} from '@/lib/data.client';
import { BILLING_PRICING, calculateDealershipMonthlyCents, formatUsdFromCents } from '@/lib/billing/tiers';
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
import { Ban, Play, Trash2 } from 'lucide-react';
import { Switch } from '../ui/switch';

interface ManageDealershipFormProps {
  dealerships: Dealership[];
  onDealershipManaged?: () => void;
}

export function ManageDealershipForm({ dealerships, onDealershipManaged }: ManageDealershipFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
  const [isConfirming, setIsConfirming] = useState< 'pause' | 'deactivate' | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [retakeTestingEnabled, setRetakeTestingEnabled] = useState(false);
  const [newRecommendedTestingEnabled, setNewRecommendedTestingEnabled] = useState(false);
  const [pppProtocolEnabled, setPppProtocolEnabled] = useState(false);
  const [saasPppTrainingEnabled, setSaasPppTrainingEnabled] = useState(false);
  const [billingTier, setBillingTier] = useState<DealershipBillingTier>('sales_fi');
  const [billingUserCount, setBillingUserCount] = useState('0');
  const [billingOwnerAccountCount, setBillingOwnerAccountCount] = useState('0');
  const [billingStoreCount, setBillingStoreCount] = useState('1');
  const { toast } = useToast();
  
  const toSafeCount = (value: string, fallback = 0): number => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
  };

  const handleSelectDealership = (dealershipId: string) => {
    const dealership = dealerships.find(d => d.id === dealershipId);
    setSelectedDealership(dealership || null);
    setRetakeTestingEnabled(dealership?.enableRetakeRecommendedTesting === true);
    setNewRecommendedTestingEnabled(dealership?.enableNewRecommendedTesting === true);
    setPppProtocolEnabled(dealership?.enablePppProtocol === true);
    setSaasPppTrainingEnabled(dealership?.enableSaasPppTraining === true);
    setBillingTier((dealership?.billingTier as DealershipBillingTier) || 'sales_fi');
    setBillingUserCount(String(dealership?.billingUserCount ?? 0));
    setBillingOwnerAccountCount(String(dealership?.billingOwnerAccountCount ?? 0));
    setBillingStoreCount(String(dealership?.billingStoreCount ?? 1));
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

  async function handleUpdateRetakeTestingAccess() {
    if (!selectedDealership) return;
    setIsLoading(true);
    try {
      await updateDealershipRetakeTestingAccess(selectedDealership.id, retakeTestingEnabled);
      setSelectedDealership((prev) => (
        prev ? { ...prev, enableRetakeRecommendedTesting: retakeTestingEnabled } : prev
      ));
      toast({
        title: 'Testing Access Updated',
        description: `${selectedDealership.name} ${retakeTestingEnabled ? 'can now' : 'can no longer'} use the Retake Recommended (Testing) button.`,
      });
      onDealershipManaged?.();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (e as Error).message || 'An error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateNewRecommendedTestingAccess() {
    if (!selectedDealership) return;
    setIsLoading(true);
    try {
      await updateDealershipNewRecommendedTestingAccess(selectedDealership.id, newRecommendedTestingEnabled);
      setSelectedDealership((prev) => (
        prev ? { ...prev, enableNewRecommendedTesting: newRecommendedTestingEnabled } : prev
      ));
      toast({
        title: 'Testing Access Updated',
        description: `${selectedDealership.name} ${newRecommendedTestingEnabled ? 'can now' : 'can no longer'} use the New Recommended (Testing) button.`,
      });
      onDealershipManaged?.();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (e as Error).message || 'An error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdatePppAccess() {
    if (!selectedDealership) return;
    setIsLoading(true);
    try {
      await updateDealershipPppAccess(selectedDealership.id, pppProtocolEnabled);
      setSelectedDealership((prev) => (
        prev ? { ...prev, enablePppProtocol: pppProtocolEnabled } : prev
      ));
      toast({
        title: 'PPP Access Updated',
        description: `${selectedDealership.name} ${pppProtocolEnabled ? 'now has' : 'no longer has'} Profit Protection Protocol enabled.`,
      });
      onDealershipManaged?.();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (e as Error).message || 'An error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateSaasPppAccess() {
    if (!selectedDealership) return;
    setIsLoading(true);
    try {
      await updateDealershipSaasPppAccess(selectedDealership.id, saasPppTrainingEnabled);
      setSelectedDealership((prev) => (
        prev ? { ...prev, enableSaasPppTraining: saasPppTrainingEnabled } : prev
      ));
      toast({
        title: 'SaaS PPP Access Updated',
        description: `${selectedDealership.name} ${saasPppTrainingEnabled ? 'now has' : 'no longer has'} SaaS PPP Training enabled.`,
      });
      onDealershipManaged?.();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (e as Error).message || 'An error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateBillingConfig() {
    if (!selectedDealership) return;
    setIsLoading(true);
    try {
      const next = await updateDealershipBillingConfig(selectedDealership.id, {
        billingTier,
        billingUserCount: toSafeCount(billingUserCount, 0),
        billingOwnerAccountCount: toSafeCount(billingOwnerAccountCount, 0),
        billingStoreCount: Math.max(1, toSafeCount(billingStoreCount, 1)),
      });
      setSelectedDealership(next);
      toast({
        title: 'Billing Configuration Updated',
        description: `${selectedDealership.name} billing tier is now ${BILLING_PRICING[billingTier].label}.`,
      });
      onDealershipManaged?.();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (e as Error).message || 'An error occurred.',
      });
    } finally {
      setIsLoading(false);
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
  const estimatedMonthly = formatUsdFromCents(calculateDealershipMonthlyCents({
    tier: billingTier,
    userCount: toSafeCount(billingUserCount, 0),
    ownerAccountCount: toSafeCount(billingOwnerAccountCount, 0),
    storeCount: Math.max(1, toSafeCount(billingStoreCount, 1)),
  }));
  const billingDirty = !selectedDealership || (
    billingTier !== (selectedDealership.billingTier || 'sales_fi') ||
    toSafeCount(billingUserCount, 0) !== (selectedDealership.billingUserCount ?? 0) ||
    toSafeCount(billingOwnerAccountCount, 0) !== (selectedDealership.billingOwnerAccountCount ?? 0) ||
    Math.max(1, toSafeCount(billingStoreCount, 1)) !== (selectedDealership.billingStoreCount ?? 1)
  );

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

            <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">Retake Recommended (Testing)</p>
                        <p className="text-xs text-muted-foreground">
                            Allow users in this dealership to see and use the temporary retake testing button.
                        </p>
                    </div>
                    <Switch
                      checked={retakeTestingEnabled}
                      onCheckedChange={setRetakeTestingEnabled}
                      disabled={isLoading}
                      aria-label="Enable retake recommended testing"
                    />
                </div>
                <Button
                  variant="outline"
                  disabled={isLoading || retakeTestingEnabled === (selectedDealership.enableRetakeRecommendedTesting === true)}
                  onClick={handleUpdateRetakeTestingAccess}
                  className="w-full md:w-auto"
                >
                  {isLoading ? <Spinner size="sm" /> : 'Save Retake Access'}
                </Button>
            </div>

            <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">New Recommended (Testing)</p>
                        <p className="text-xs text-muted-foreground">
                            Allow users in this dealership to launch an extra recommended lesson for testing.
                        </p>
                    </div>
                    <Switch
                      checked={newRecommendedTestingEnabled}
                      onCheckedChange={setNewRecommendedTestingEnabled}
                      disabled={isLoading}
                      aria-label="Enable new recommended testing"
                    />
                </div>
                <Button
                  variant="outline"
                  disabled={isLoading || newRecommendedTestingEnabled === (selectedDealership.enableNewRecommendedTesting === true)}
                  onClick={handleUpdateNewRecommendedTestingAccess}
                  className="w-full md:w-auto"
                >
                  {isLoading ? <Spinner size="sm" /> : 'Save New Lesson Access'}
                </Button>
            </div>

            <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">Profit Protection Protocol (PPP)</p>
                        <p className="text-xs text-muted-foreground">
                            Enable or disable PPP for users assigned to this dealership.
                        </p>
                    </div>
                    <Switch
                      checked={pppProtocolEnabled}
                      onCheckedChange={setPppProtocolEnabled}
                      disabled={isLoading}
                      aria-label="Enable Profit Protection Protocol"
                    />
                </div>
                <Button
                  variant="outline"
                  disabled={isLoading || pppProtocolEnabled === (selectedDealership.enablePppProtocol === true)}
                  onClick={handleUpdatePppAccess}
                  className="w-full md:w-auto"
                >
                  {isLoading ? <Spinner size="sm" /> : 'Save PPP Access'}
                </Button>
            </div>

            <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">Enable SaaS PPP Training (Internal Sales Track)</p>
                        <p className="text-xs text-muted-foreground">
                            Controls the SaaS-only PPP module for this dealership. This is independent of dealership-facing PPP.
                        </p>
                    </div>
                    <Switch
                      checked={saasPppTrainingEnabled}
                      onCheckedChange={setSaasPppTrainingEnabled}
                      disabled={isLoading}
                      aria-label="Enable SaaS PPP Training"
                    />
                </div>
                <Button
                  variant="outline"
                  disabled={isLoading || saasPppTrainingEnabled === (selectedDealership.enableSaasPppTraining === true)}
                  onClick={handleUpdateSaasPppAccess}
                  className="w-full md:w-auto"
                >
                  {isLoading ? <Spinner size="sm" /> : 'Save SaaS PPP Access'}
                </Button>
            </div>

            <div className="rounded-md border p-3 space-y-3">
                <div>
                    <p className="text-sm font-medium">Billing Tier Configuration</p>
                    <p className="text-xs text-muted-foreground">
                        Configure pricing model inputs for this dealership. This controls billing calculations and Stripe tier mapping.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Tier</p>
                        <Select value={billingTier} onValueChange={(value) => setBillingTier(value as DealershipBillingTier)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sales_fi">Sales and F&amp;I</SelectItem>
                                <SelectItem value="service_parts">Service and Parts</SelectItem>
                                <SelectItem value="owner_hq">Ownership (All Stores)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {billingTier === 'owner_hq' ? (
                        <>
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Owner Accounts</p>
                                <Input
                                  type="number"
                                  min={0}
                                  value={billingOwnerAccountCount}
                                  onChange={(event) => setBillingOwnerAccountCount(event.target.value)}
                                  disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Store Count</p>
                                <Input
                                  type="number"
                                  min={1}
                                  value={billingStoreCount}
                                  onChange={(event) => setBillingStoreCount(event.target.value)}
                                  disabled={isLoading}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">User Count</p>
                            <Input
                              type="number"
                              min={0}
                              value={billingUserCount}
                              onChange={(event) => setBillingUserCount(event.target.value)}
                              disabled={isLoading}
                            />
                        </div>
                    )}
                </div>

                <div className="rounded-md border border-dashed p-3 text-sm">
                    Estimated monthly total: <span className="font-semibold">{estimatedMonthly}</span>
                </div>

                <Button
                  variant="outline"
                  disabled={isLoading || !billingDirty}
                  onClick={handleUpdateBillingConfig}
                  className="w-full md:w-auto"
                >
                  {isLoading ? <Spinner size="sm" /> : 'Save Billing Tier'}
                </Button>
            </div>

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
                    onClick={() => handleUpdateStatus(isConfirming === 'pause' ? 'paused' : 'deactivated')} 
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
