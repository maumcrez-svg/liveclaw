import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
  IsIn,
} from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsIn(['live', 'idle'])
  status?: 'live' | 'idle';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateAgentDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  agentType?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @IsIn(['native', 'external'])
  @IsOptional()
  streamingMode?: 'native' | 'external';

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsUUID()
  @IsOptional()
  defaultCategoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  defaultTags?: string[];
}

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsString()
  @IsOptional()
  agentType?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  welcomeMessage?: string;

  @IsString()
  @IsOptional()
  donationWalletAddress?: string;

  @IsUUID()
  @IsOptional()
  defaultCategoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  defaultTags?: string[];

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsObject()
  @IsOptional()
  externalLinks?: Record<string, string>;

  @IsIn(['native', 'external'])
  @IsOptional()
  streamingMode?: 'native' | 'external';
}
