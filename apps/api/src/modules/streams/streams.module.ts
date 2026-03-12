import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamEntity } from './stream.entity';
import { StreamsService } from './streams.service';
import { StreamsController } from './streams.controller';
import { AgentsModule } from '../agents/agents.module';
import { ThumbnailService } from './thumbnail.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([StreamEntity]), AgentsModule, CommonModule],
  controllers: [StreamsController],
  providers: [StreamsService, ThumbnailService],
  exports: [StreamsService],
})
export class StreamsModule {}
