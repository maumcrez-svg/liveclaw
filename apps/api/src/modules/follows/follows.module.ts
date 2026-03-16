import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowEntity } from './follow.entity';
import { FollowsService } from './follows.service';
import { FollowsController } from './follows.controller';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { StreamEntity } from '../streams/stream.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FollowEntity, StreamEntity]),
    AgentsModule,
    AuthModule,
    forwardRef(() => ChatModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
