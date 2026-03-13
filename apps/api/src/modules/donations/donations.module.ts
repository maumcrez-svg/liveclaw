import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonationEntity } from './donation.entity';
import { DonationsService } from './donations.service';
import { DonationsController } from './donations.controller';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AgentsModule } from '../agents/agents.module';
import { StripeModule } from '../stripe/stripe.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DonationEntity]),
    forwardRef(() => ChatModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    forwardRef(() => AgentsModule),
    forwardRef(() => StripeModule),
    CommonModule,
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
