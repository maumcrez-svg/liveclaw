import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from './subscription.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { CryptoSubscribeService } from './crypto-subscribe.service';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { StreamEntity } from '../streams/stream.entity';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionEntity, StreamEntity]),
    AgentsModule,
    AuthModule,
    forwardRef(() => ChatModule),
    forwardRef(() => UsersModule),
    CommonModule,
    CryptoModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, CryptoSubscribeService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
