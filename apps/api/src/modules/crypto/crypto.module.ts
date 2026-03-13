import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorWalletEntity } from './creator-wallet.entity';
import { CryptoDonationEntity } from './crypto-donation.entity';
import { CryptoWalletService } from './crypto-wallet.service';
import { CryptoWalletController } from './crypto-wallet.controller';
import { CryptoDonationService } from './crypto-donation.service';
import { CryptoDonationController } from './crypto-donation.controller';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreatorWalletEntity, CryptoDonationEntity]),
    forwardRef(() => AgentsModule),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
  controllers: [CryptoWalletController, CryptoDonationController],
  providers: [CryptoWalletService, CryptoDonationService],
  exports: [CryptoWalletService, CryptoDonationService],
})
export class CryptoModule {}
