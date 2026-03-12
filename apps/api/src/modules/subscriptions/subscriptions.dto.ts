import { IsString, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  userId: string;

  @IsString()
  agentId: string;

  @IsString()
  @IsOptional()
  tier?: string; // 'tier_1' | 'tier_2' | 'tier_3', defaults to 'tier_1'
}
