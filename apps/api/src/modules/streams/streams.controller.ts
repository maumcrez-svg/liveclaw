import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { StreamsService } from './streams.service';
import { ChatService } from '../chat/chat.service';
import { WebhookSecretGuard } from '../../common/webhook-secret.guard';
import { ApiKeyGuard } from '../../common/api-key.guard';
import { CurrentAgent } from '../../common/current-agent.decorator';
import { UpdateStreamDto } from './streams.dto';
import { AgentEntity } from '../agents/agent.entity';

@Controller('streams')
export class StreamsController {
  constructor(
    private readonly streamsService: StreamsService,
    private readonly chatService: ChatService,
  ) {}

  @Get('live')
  @SkipThrottle()
  async findLive(
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    const streams = await this.streamsService.findLive({ category, sort });
    return streams.map(stripAgentSensitive);
  }

  @Get('agent/:agentId')
  @SkipThrottle()
  async findByAgent(@Param('agentId') agentId: string) {
    const streams = await this.streamsService.findByAgent(agentId);
    return streams.map(stripAgentSensitive);
  }

  @Get('agent/:agentId/current')
  @SkipThrottle()
  async getCurrentStream(@Param('agentId') agentId: string) {
    const stream = await this.streamsService.getCurrentStream(agentId);
    return stream ? stripAgentSensitive(stream) : null;
  }

  @Get('agent/:agentId/viewers')
  @SkipThrottle()
  async getViewerCount(@Param('agentId') agentId: string) {
    const stream = await this.streamsService.getCurrentStream(agentId);
    if (!stream) return { count: 0 };
    const count = await this.chatService.getViewerCount(stream.id);
    return { count };
  }

  @Patch(':id')
  @UseGuards(ApiKeyGuard)
  updateStreamMetadata(
    @Param('id') id: string,
    @CurrentAgent() agent: AgentEntity,
    @Body() dto: UpdateStreamDto,
  ) {
    return this.streamsService.updateMetadata(id, agent.id, dto);
  }

  @Post('webhook/mediamtx')
  @UseGuards(WebhookSecretGuard)
  async handleWebhook(@Body() body: { event: string; path: string }) {
    const streamKey = body.path?.replace(/^\//, '');
    if (body.event === 'publish' || body.event === 'unpublish') {
      await this.streamsService.handleMediaMTXEvent(
        body.event as 'publish' | 'unpublish',
        streamKey,
      );
    }
    return { ok: true };
  }
}

/** Strip sensitive fields from agent inside stream, expose hlsPath when live */
function stripAgentSensitive(stream: any) {
  if (!stream?.agent) return stream;
  const { streamKey, containerId, config, apiKeyHash, apiKeySha256, ...safeAgent } = stream.agent;
  return {
    ...stream,
    agent: {
      ...safeAgent,
      ...(stream.isLive && streamKey ? { hlsPath: streamKey } : {}),
    },
  };
}
