import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CreatorWalletEntity } from './creator-wallet.entity';
import { CryptoDonationEntity } from './crypto-donation.entity';
import { CryptoWalletService } from './crypto-wallet.service';
import { CryptoWalletController } from './crypto-wallet.controller';
import { CryptoDonationService } from './crypto-donation.service';
import { CryptoDonationController } from './crypto-donation.controller';
import { EthPriceService } from './eth-price.service';
import { EthPriceController } from './eth-price.controller';
import { ChainVerificationService } from './chain-verification.service';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { SubscriptionEntity } from '../subscriptions/subscription.entity';
import { AgentEntity } from '../agents/agent.entity';
import { ModuleRef } from '@nestjs/core';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      CreatorWalletEntity,
      CryptoDonationEntity,
      SubscriptionEntity,
      AgentEntity,
    ]),
    forwardRef(() => AgentsModule),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
  controllers: [CryptoWalletController, CryptoDonationController, EthPriceController],
  providers: [
    CryptoWalletService,
    CryptoDonationService,
    EthPriceService,
    ChainVerificationService,
  ],
  exports: [
    CryptoWalletService,
    CryptoDonationService,
    EthPriceService,
    ChainVerificationService,
  ],
})
export class CryptoModule implements OnModuleInit {
  constructor(
    private readonly donationService: CryptoDonationService,
    private readonly chainVerificationService: ChainVerificationService,
  ) {}

  onModuleInit() {
    // Wire up the lazy dependency to avoid circular imports
    this.donationService.setChainVerificationService(this.chainVerificationService);
  }
}
