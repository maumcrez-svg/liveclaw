import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { StreamEntity } from '../streams/stream.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmotesModule } from '../emotes/emotes.module';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from './moderation/moderation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StreamEntity]),
    AuthModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => EmotesModule),
    forwardRef(() => ModerationModule),
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
