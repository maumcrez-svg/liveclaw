import type { Mood } from '../personality/mood';

// Maps mood states to Live2D expression names + motion groups
// These work with standard Live2D models that have expression files
export interface AvatarState {
  expression: string;
  motionGroup: string;
  mouthDefault: number; // 0-1, resting mouth position
}

export const MOOD_TO_AVATAR: Record<Mood, AvatarState> = {
  serene: {
    expression: 'f01', // calm/default
    motionGroup: 'idle',
    mouthDefault: 0,
  },
  excited: {
    expression: 'f04', // happy/excited
    motionGroup: 'tap_body',
    mouthDefault: 0.1,
  },
  contemplative: {
    expression: 'f02', // thinking
    motionGroup: 'idle',
    mouthDefault: 0,
  },
  playful: {
    expression: 'f03', // playful/wink
    motionGroup: 'flick_head',
    mouthDefault: 0.05,
  },
  melancholic: {
    expression: 'f05', // sad
    motionGroup: 'idle',
    mouthDefault: 0,
  },
};
