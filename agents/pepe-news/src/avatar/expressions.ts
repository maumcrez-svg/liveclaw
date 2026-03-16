import type { AvatarExpression } from '../models/types';

export interface AvatarState {
  expression: string;
  browStyle: string;
}

export const EXPRESSION_MAP: Record<AvatarExpression, AvatarState> = {
  neutral: { expression: 'neutral', browStyle: 'neutral' },
  smirk: { expression: 'smirk', browStyle: 'raised' },
  surprised: { expression: 'surprised', browStyle: 'raised' },
  skeptical: { expression: 'skeptical', browStyle: 'furrowed' },
};
