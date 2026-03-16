import { IsUUID, IsNumber, IsOptional, IsString, Min, MaxLength, Matches } from 'class-validator';

export class InitiateDonationDto {
  @IsUUID()
  agentId: string;

  @IsNumber()
  @Min(0.000001)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsUUID()
  streamId?: string;
}

export class SubmitTxDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'txHash must be a valid transaction hash' })
  txHash: string;

  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'senderAddress must be a valid Ethereum address' })
  senderAddress?: string;
}
