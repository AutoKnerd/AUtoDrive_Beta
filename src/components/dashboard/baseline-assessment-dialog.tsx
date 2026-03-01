'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CxTrait, User, UserRole } from '@/lib/definitions';
import { logLessonCompletion, updateUser } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BaselineAssessmentDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void | Promise<void>;
}

type ScoreMap = Record<CxTrait, number>;

const traitFields: Array<{ key: CxTrait; label: string }> = [
  { key: 'empathy', label: 'Empathy' },
  { key: 'listening', label: 'Listening' },
  { key: 'trust', label: 'Trust' },
  { key: 'followUp', label: 'Follow-Up' },
  { key: 'closing', label: 'Closing' },
  { key: 'relationshipBuilding', label: 'Relationship Building' },
];

const defaultScores: ScoreMap = {
  empathy: 75,
  listening: 75,
  trust: 75,
  followUp: 75,
  closing: 75,
  relationshipBuilding: 75,
};

const baselineRoleOptions: UserRole[] = [
  'Sales Consultant',
  'manager',
  'Service Writer',
  'Service Manager',
  'Finance Manager',
  'Parts Consultant',
  'Parts Manager',
  'General Manager',
];

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function BaselineAssessmentDialog({ user, open, onOpenChange, onCompleted }: BaselineAssessmentDialogProps) {
  const { toast } = useToast();
  const { setUser } = useAuth();
  const [scores, setScores] = useState<ScoreMap>(defaultScores);
  const rawRole = (user as Partial<User>)?.role;
  const currentRole = typeof rawRole === 'string' ? rawRole : '';
  const hasAssignedRole = baselineRoleOptions.includes(currentRole as UserRole);
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>(hasAssignedRole ? (currentRole as UserRole) : '');
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrivacyAcknowledged(false);
    setSelectedRole(hasAssignedRole ? (currentRole as UserRole) : '');
  }, [open, hasAssignedRole, currentRole]);

  const updateScore = (trait: CxTrait, rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setScores((prev) => ({ ...prev, [trait]: clampScore(parsed) }));
  };

  const handleSubmit = async () => {
    if (!privacyAcknowledged) {
      toast({
        variant: 'destructive',
        title: 'Privacy policy required',
        description: 'Please acknowledge the privacy policy before saving your baseline.',
      });
      return;
    }

    if (!hasAssignedRole && !selectedRole) {
      toast({
        variant: 'destructive',
        title: 'Role required',
        description: 'Please select your role before saving your baseline.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (!hasAssignedRole && selectedRole) {
        await updateUser(user.userId, { role: selectedRole });
      }

      const baselineId = `baseline-${new Date().toISOString().slice(0, 10)}`;
      const result = await logLessonCompletion({
        userId: user.userId,
        lessonId: baselineId,
        xpGained: 0,
        isRecommended: false,
        scores,
      });
      setUser(result.updatedUser);

      toast({
        title: 'Baseline saved',
        description: 'Your baseline assessment has been recorded.',
      });

      await onCompleted();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save baseline',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baseline Assessment</DialogTitle>
          <DialogDescription>
            Set your current confidence across each CX skill (0-100). This establishes your baseline for recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!hasAssignedRole && (
            <div className="grid gap-2">
              <Label htmlFor="baseline-role">Your Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)} disabled={isSubmitting}>
                <SelectTrigger id="baseline-role">
                  <SelectValue placeholder="Select your role..." />
                </SelectTrigger>
                <SelectContent>
                  {baselineRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === 'manager' ? 'Sales Manager' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {traitFields.map((trait) => (
            <div key={trait.key} className="grid grid-cols-[1fr_100px] items-center gap-3">
              <Label htmlFor={`baseline-${trait.key}`}>{trait.label}</Label>
              <Input
                id={`baseline-${trait.key}`}
                type="number"
                min={0}
                max={100}
                value={scores[trait.key]}
                onChange={(event) => updateScore(trait.key, event.target.value)}
                disabled={isSubmitting}
              />
            </div>
          ))}

          <div className="flex items-start gap-3 rounded-md border border-border/60 p-3">
            <Checkbox
              id="baseline-privacy-policy"
              checked={privacyAcknowledged}
              onCheckedChange={(checked) => setPrivacyAcknowledged(checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="baseline-privacy-policy" className="leading-5 text-sm font-normal text-muted-foreground">
              I acknowledge the{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || (!hasAssignedRole && !selectedRole) || !privacyAcknowledged}>
            {isSubmitting ? 'Saving...' : 'Save Baseline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
