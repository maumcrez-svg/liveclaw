import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateDonationDto {
  @IsString()
  userId: string;

  @IsString()
  agentId: string;

  @IsString()
  streamId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  message?: string;
}
