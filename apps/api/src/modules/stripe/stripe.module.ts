import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { TransferEntity } from './transfer.entity';
import { DonationsModule } from '../donations/donations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TransferEntity]),
    forwardRef(() => DonationsModule),
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => ChatModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AgentsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
