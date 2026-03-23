import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClipEntity } from './clip.entity';
import { AgentEntity } from '../agents/agent.entity';
import { StreamEntity } from '../streams/stream.entity';
import { ClipsService } from './clips.service';
import { ClipProcessorService } from './clip-processor.service';
import { ClipsController, ClipsMediaController } from './clips.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClipEntity, AgentEntity, StreamEntity]),
    AuthModule,
  ],
  controllers: [ClipsController, ClipsMediaController],
  providers: [ClipsService, ClipProcessorService],
  exports: [ClipsService],
})
export class ClipsModule {}
