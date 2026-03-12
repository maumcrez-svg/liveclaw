import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { RuntimeService } from './runtime.service';
import { RuntimeController } from './runtime.controller';
import { ReconciliationService } from './reconciliation.service';
import { AgentsModule } from '../agents/agents.module';
import { StreamsModule } from '../streams/streams.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    AgentsModule,
    StreamsModule,
    AuthModule,
    CommonModule,
  ],
  controllers: [RuntimeController],
  providers: [RuntimeService, ReconciliationService],
})
export class RuntimeModule {}
