import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { WebhookSecretGuard } from '../../common/webhook-secret.guard';

@Controller('streams')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

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
