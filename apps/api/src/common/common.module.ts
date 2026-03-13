import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../modules/agents/agent.entity';
import { OwnerGuard } from './owner.guard';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity])],
  providers: [OwnerGuard, WebhookSecretGuard, ApiKeyGuard],
  exports: [OwnerGuard, WebhookSecretGuard, ApiKeyGuard, TypeOrmModule],
})
export class CommonModule {}
