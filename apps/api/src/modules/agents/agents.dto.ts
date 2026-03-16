import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
  IsIn,
  IsUrl,
  ValidateIf,
  MinLength,
  MaxLength,
  Matches,
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
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'slug must be lowercase alphanumeric with hyphens, and cannot start or end with a hyphen',
  })
  slug: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.avatarUrl !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
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

  @IsOptional()
  @ValidateIf((o) => o.avatarUrl !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string;

  @IsOptional()
  @ValidateIf((o) => o.bannerUrl !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
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
