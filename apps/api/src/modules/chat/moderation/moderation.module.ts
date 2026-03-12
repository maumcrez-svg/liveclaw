import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatBanEntity } from './chat-ban.entity';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { ChatModule } from '../chat.module';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatBanEntity]),
    forwardRef(() => ChatModule),
    AuthModule,
    CommonModule,
  ],
  providers: [ModerationService],
  controllers: [ModerationController],
  exports: [ModerationService],
})
export class ModerationModule {}
