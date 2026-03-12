import { IsString } from 'class-validator';

export class FollowDto {
  @IsString()
  userId: string;

  @IsString()
  agentId: string;
}
