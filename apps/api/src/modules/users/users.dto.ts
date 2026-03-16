import { IsString, IsOptional, MinLength, MaxLength, Matches, IsUrl, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @IsOptional()
  walletAddress?: string;

  @IsOptional()
  @ValidateIf((o) => o.avatarUrl !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @ValidateIf((o) => o.avatarUrl !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string | null;
}
