import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { StreamEntity } from '../streams/stream.entity';
import { AgentEntity } from '../agents/agent.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmotesModule } from '../emotes/emotes.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { ModerationModule } from './moderation/moderation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StreamEntity, AgentEntity]),
    AuthModule,
    CommonModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => EmotesModule),
    forwardRef(() => ModerationModule),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
