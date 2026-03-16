import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../modules/agents/agent.entity';
import { OwnerGuard } from './owner.guard';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { ApiKeyGuard } from './api-key.guard';
import { redisProvider, REDIS_CLIENT } from './redis.provider';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), ConfigModule],
  providers: [OwnerGuard, WebhookSecretGuard, ApiKeyGuard, redisProvider],
  exports: [OwnerGuard, WebhookSecretGuard, ApiKeyGuard, TypeOrmModule, REDIS_CLIENT, redisProvider],
})
export class CommonModule {}
