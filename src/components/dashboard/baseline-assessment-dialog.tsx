'use client';

import { useEffect, useState } from 'react';
import type { CxTrait, User, UserRole } from '@/lib/definitions';
import { allRoles } from '@/lib/definitions';
import { logLessonCompletion } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

const SELF_SELECTABLE_ROLES: UserRole[] = allRoles.filter((role) => (
  !['Owner', 'Admin', 'Developer', 'Trainer'].includes(role)
));

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function BaselineAssessmentDialog({ user, open, onOpenChange, onCompleted }: BaselineAssessmentDialogProps) {
  const { toast } = useToast();
  const { setUser } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const [scores, setScores] = useState<ScoreMap>(defaultScores);
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    SELF_SELECTABLE_ROLES.includes(user.role) ? user.role : 'Sales Consultant'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(Boolean(user.privacyPolicyAcceptedAt));
  const allowRoleSelection = !Array.isArray(user.dealershipIds) || user.dealershipIds.length === 0;

  useEffect(() => {
    setSelectedRole(SELF_SELECTABLE_ROLES.includes(user.role) ? user.role : 'Sales Consultant');
  }, [user.role]);
  useEffect(() => {
    setPrivacyAccepted(Boolean(user.privacyPolicyAcceptedAt));
  }, [user.privacyPolicyAcceptedAt]);

  const updateRoleSelection = (value: string) => {
    if (!SELF_SELECTABLE_ROLES.includes(value as UserRole)) return;
    setSelectedRole(value as UserRole);
  };

  const persistRoleSelection = async () => {
    if (!allowRoleSelection || selectedRole === user.role) return;
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) {
      throw new Error('Authentication session expired. Please sign in again.');
    }

    const idToken = await firebaseUser.getIdToken(true);
    const response = await fetch('/api/profile/select-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        role: selectedRole,
        acceptPrivacyPolicy: true,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Could not update role.');
    }
  };

  const updateScore = (trait: CxTrait, rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setScores((prev) => ({ ...prev, [trait]: clampScore(parsed) }));
  };

  const handleSubmit = async () => {
    if (!privacyAccepted) {
      toast({
        variant: 'destructive',
        title: 'Privacy Policy Required',
        description: 'Please accept the Privacy Policy before saving your baseline assessment.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (!allowRoleSelection) {
        const firebaseUser = firebaseAuth.currentUser;
        if (!firebaseUser) {
          throw new Error('Authentication session expired. Please sign in again.');
        }

        const idToken = await firebaseUser.getIdToken(true);
        const response = await fetch('/api/profile/select-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ acceptPrivacyPolicy: true }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Could not save privacy policy consent.');
        }
      } else {
        await persistRoleSelection();
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
          {allowRoleSelection ? (
            <div className="grid gap-2">
              <Label htmlFor="baseline-role">Role</Label>
              <Select value={selectedRole} onValueChange={updateRoleSelection} disabled={isSubmitting}>
                <SelectTrigger id="baseline-role">
                  <SelectValue placeholder="Select your role..." />
                </SelectTrigger>
                <SelectContent>
                  {SELF_SELECTABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === 'manager' ? 'Sales Manager' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="baseline-privacy-policy"
              checked={privacyAccepted}
              onCheckedChange={(checked) => setPrivacyAccepted(Boolean(checked))}
              disabled={isSubmitting}
            />
            <Label htmlFor="baseline-privacy-policy" className="text-sm leading-5">
              I agree to the{' '}
              <Link href="/privacy" className="text-primary underline" target="_blank">
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Baseline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
