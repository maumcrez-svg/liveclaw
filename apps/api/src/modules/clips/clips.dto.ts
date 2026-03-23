import {
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
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

  @IsIn([15, 30, 60])
  duration: number;
}
