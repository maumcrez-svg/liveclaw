import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { StreamsService } from './streams.service';
import { ThumbnailService } from './thumbnail.service';
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
    private readonly thumbnailService: ThumbnailService,
    private readonly chatService: ChatService,
  ) {}

  @Get('live')
  async findLive(
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    const streams = await this.streamsService.findLive({ category, sort });
    return streams.map(stripAgentSensitive);
  }

  @Get('agent/:agentId')
  async findByAgent(@Param('agentId') agentId: string) {
    const streams = await this.streamsService.findByAgent(agentId);
    return streams.map(stripAgentSensitive);
  }

  @Get('agent/:agentId/current')
  async getCurrentStream(@Param('agentId') agentId: string) {
    const stream = await this.streamsService.getCurrentStream(agentId);
    return stream ? stripAgentSensitive(stream) : null;
  }

  @Get('agent/:agentId/viewers')
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

  @Get('thumbnail/:streamKey')
  getThumbnail(
    @Param('streamKey') streamKey: string,
    @Res() res: Response,
  ) {
    const buffer = this.thumbnailService.getThumbnail(streamKey);
    if (!buffer) {
      res.status(404).send();
      return;
    }
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=30',
    });
    res.send(buffer);
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
