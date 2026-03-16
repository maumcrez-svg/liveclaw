import { IsString, IsOptional, IsUUID, IsUrl, MaxLength, Matches } from 'class-validator';

export class CreateEmoteDto {
  @IsUUID()
  agentId: string;

  @IsString()
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Emote name may only contain letters, numbers, and underscores' })
  name: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl: string;

  @IsString()
  @IsOptional()
  tier?: string | null;
}
