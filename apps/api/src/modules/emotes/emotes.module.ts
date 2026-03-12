import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmoteEntity } from './emote.entity';
import { EmotesService } from './emotes.service';
import { EmotesController } from './emotes.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmoteEntity]),
    forwardRef(() => SubscriptionsModule),
    AuthModule,
  ],
  controllers: [EmotesController],
  providers: [EmotesService],
  exports: [EmotesService],
})
export class EmotesModule {}
