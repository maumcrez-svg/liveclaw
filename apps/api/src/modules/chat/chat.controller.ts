import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiKeyGuard } from '../../common/api-key.guard';
import { CurrentAgent } from '../../common/current-agent.decorator';
import { AgentEntity } from '../agents/agent.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamEntity } from '../streams/stream.entity';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  @Get(':agentId/messages')
  async getRecentMessages(
    @Param('agentId') agentId: string,
    @Query('limit') limit?: string,
  ) {
    const stream = await this.streamRepo.findOne({
      where: { agentId, isLive: true },
    });
    if (!stream) {
      return [];
    }
    const count = Math.min(parseInt(limit || '50', 10) || 50, 200);
    return this.chatService.getRecentMessages(stream.id, count);
  }

  @Post(':agentId/messages')
  @UseGuards(ApiKeyGuard)
  async sendMessage(
    @Param('agentId') agentId: string,
    @CurrentAgent() agent: AgentEntity,
    @Body() body: { content: string },
  ) {
    if (agent.id !== agentId) {
      throw new NotFoundException('Agent mismatch');
    }

    const stream = await this.streamRepo.findOne({
      where: { agentId, isLive: true },
    });
    if (!stream) {
      throw new NotFoundException('No live stream found');
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      streamId: stream.id,
      userId: agent.id,
      username: agent.name,
      content: body.content,
      type: 'agent',
      isAgent: true,
      createdAt: new Date().toISOString(),
    };

    await this.chatService.publishMessage(stream.id, message);
    return message;
  }
}
