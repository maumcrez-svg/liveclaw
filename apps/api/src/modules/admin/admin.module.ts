import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UserEntity } from '../users/user.entity';
import { AgentEntity } from '../agents/agent.entity';
import { StreamEntity } from '../streams/stream.entity';
import { CryptoDonationEntity } from '../crypto/crypto-donation.entity';
import { SubscriptionEntity } from '../subscriptions/subscription.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AgentEntity,
      StreamEntity,
      CryptoDonationEntity,
      SubscriptionEntity,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
