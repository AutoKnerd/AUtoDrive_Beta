'use client';

import { useState } from 'react';
import type { CxTrait, User } from '@/lib/definitions';
import { logLessonCompletion } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function BaselineAssessmentDialog({ user, open, onOpenChange, onCompleted }: BaselineAssessmentDialogProps) {
  const { toast } = useToast();
  const [scores, setScores] = useState<ScoreMap>(defaultScores);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateScore = (trait: CxTrait, rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setScores((prev) => ({ ...prev, [trait]: clampScore(parsed) }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const baselineId = `baseline-${new Date().toISOString().slice(0, 10)}`;
      await logLessonCompletion({
        userId: user.userId,
        lessonId: baselineId,
        xpGained: 0,
        isRecommended: false,
        scores,
      });

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
