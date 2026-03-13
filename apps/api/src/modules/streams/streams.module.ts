import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamEntity } from './stream.entity';
import { StreamsService } from './streams.service';
import { StreamsController } from './streams.controller';
import { AgentsModule } from '../agents/agents.module';
import { ThumbnailService } from './thumbnail.service';
import { CommonModule } from '../../common/common.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StreamEntity]),
    AgentsModule,
    CommonModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [StreamsController],
  providers: [StreamsService, ThumbnailService],
  exports: [StreamsService],
})
export class StreamsModule {}
