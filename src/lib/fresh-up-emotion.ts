export type FreshUpEmotionState =
  | 'guarded'
  | 'cautious'
  | 'open'
  | 'trusting'
  | 'frustrated'
  | 'resistant'
  | 'curious'
  | 'comfortable'
  | 'engaged'
  | 'stressed'
  | 'reassured'
  | 'optimistic';

function clampMeter(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeEmotion(value: string | null | undefined): FreshUpEmotionState {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed: FreshUpEmotionState[] = [
    'guarded', 'cautious', 'open', 'trusting', 'frustrated', 'resistant',
    'curious', 'comfortable', 'engaged', 'stressed', 'reassured', 'optimistic',
  ];
  return (allowed.includes(normalized as FreshUpEmotionState)
    ? normalized
    : 'cautious') as FreshUpEmotionState;
}

export function applyFreshUpEmotionalResponse(input: {
  currentEmotion: FreshUpEmotionState;
  currentMeter: number;
  momentumDelta: number;
}): {
  nextEmotion: FreshUpEmotionState;
  meterAdjustment: number;
  shiftLabel: string | null;
} {
  const baselineMeter = clampMeter(input.currentMeter + input.momentumDelta);

  if (input.momentumDelta <= -10) {
    const nextEmotion: FreshUpEmotionState = baselineMeter < 25 ? 'resistant' : 'frustrated';
    return {
      nextEmotion,
      meterAdjustment: -4,
      shiftLabel: `${input.currentEmotion} -> ${nextEmotion}`,
    };
  }

  if (input.momentumDelta >= 10) {
    const nextEmotion: FreshUpEmotionState =
      baselineMeter >= 85 ? 'trusting' : baselineMeter >= 70 ? 'engaged' : 'open';
    return {
      nextEmotion,
      meterAdjustment: 3,
      shiftLabel: `${input.currentEmotion} -> ${nextEmotion}`,
    };
  }

  if (baselineMeter <= 35) {
    const nextEmotion: FreshUpEmotionState = input.currentEmotion === 'stressed' ? 'guarded' : 'cautious';
    return { nextEmotion, meterAdjustment: -1, shiftLabel: nextEmotion !== input.currentEmotion ? `${input.currentEmotion} -> ${nextEmotion}` : null };
  }

  if (baselineMeter >= 65) {
    const nextEmotion: FreshUpEmotionState = input.currentEmotion === 'curious' ? 'comfortable' : 'optimistic';
    return { nextEmotion, meterAdjustment: 1, shiftLabel: nextEmotion !== input.currentEmotion ? `${input.currentEmotion} -> ${nextEmotion}` : null };
  }

  return { nextEmotion: input.currentEmotion, meterAdjustment: 0, shiftLabel: null };
}
