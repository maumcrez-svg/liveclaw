import { IsString, IsOptional } from 'class-validator';

export class CreateEmoteDto {
  @IsString()
  agentId: string;

  @IsString()
  name: string;

  @IsString()
  imageUrl: string;

  @IsString()
  @IsOptional()
  tier?: string | null;
}
