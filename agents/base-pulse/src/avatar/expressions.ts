import type { AvatarExpression } from '../models/types';

export interface AvatarState {
  expression: string;
  browStyle: string;
}

export const EXPRESSION_MAP: Record<AvatarExpression, AvatarState> = {
  neutral: { expression: 'neutral', browStyle: 'neutral' },
  focused: { expression: 'focused', browStyle: 'furrowed' },
  confident: { expression: 'confident', browStyle: 'raised' },
  impressed: { expression: 'impressed', browStyle: 'raised' },
};
