import { IsUUID, IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';

export class BanUserDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2592000)
  durationSeconds?: number;
}

export class TimeoutUserDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(1)
  @Max(86400)
  seconds: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class SlowModeDto {
  @IsInt()
  @Min(0)
  @Max(300)
  seconds: number;
}
