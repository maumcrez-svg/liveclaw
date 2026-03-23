import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateClipDto {
  @IsUUID()
  agentId: string;

  @IsUUID()
  @IsOptional()
  streamId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsNumber()
  @Min(5)
  @Max(120)
  duration: number;

  @IsNumber()
  @Min(5)
  @Max(300)
  @IsOptional()
  offsetFromEnd?: number;
}
