import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { StreamEntity } from '../streams/stream.entity';
import { CryptoDonationEntity } from '../crypto/crypto-donation.entity';
import { AgentEntity } from '../agents/agent.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([StreamEntity, CryptoDonationEntity, AgentEntity]),
  ],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
