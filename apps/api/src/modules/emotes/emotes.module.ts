import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmoteEntity } from './emote.entity';
import { EmotesService } from './emotes.service';
import { EmotesController } from './emotes.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmoteEntity]),
    forwardRef(() => SubscriptionsModule),
    AuthModule,
    AgentsModule,
  ],
  controllers: [EmotesController],
  providers: [EmotesService],
  exports: [EmotesService],
})
export class EmotesModule {}
