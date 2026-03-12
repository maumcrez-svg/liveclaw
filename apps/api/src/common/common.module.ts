import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../modules/agents/agent.entity';
import { OwnerGuard } from './owner.guard';
import { WebhookSecretGuard } from './webhook-secret.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity])],
  providers: [OwnerGuard, WebhookSecretGuard],
  exports: [OwnerGuard, WebhookSecretGuard, TypeOrmModule],
})
export class CommonModule {}
