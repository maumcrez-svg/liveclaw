import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  findLive(
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    return this.streamsService.findLive({ category, sort });
  }

  @Get('agent/:agentId')
  findByAgent(@Param('agentId') agentId: string) {
    return this.streamsService.findByAgent(agentId);
  }

  @Get('agent/:agentId/current')
  getCurrentStream(@Param('agentId') agentId: string) {
    return this.streamsService.getCurrentStream(agentId);
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
