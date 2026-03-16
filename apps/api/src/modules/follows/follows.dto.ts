import { IsUUID } from 'class-validator';

export class FollowDto {
  @IsUUID()
  agentId: string;
}
