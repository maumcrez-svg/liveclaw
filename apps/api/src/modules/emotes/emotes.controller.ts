import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmotesService } from './emotes.service';
import { CreateEmoteDto } from './emotes.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';
import { AgentsService } from '../agents/agents.service';

@Controller('emotes')
export class EmotesController {
  constructor(
    private readonly emotesService: EmotesService,
    private readonly agentsService: AgentsService,
  ) {}

  @Get('agent/:agentId')
  getEmotesForAgent(@Param('agentId') agentId: string) {
    return this.emotesService.getEmotesForAgent(agentId);
  }

  @Get('agent/:agentId/available')
  getAvailableEmotes(
    @Param('agentId') agentId: string,
    @Query('userId') userId?: string,
  ) {
    return this.emotesService.getAvailableEmotes(agentId, userId ?? null);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createEmote(@Body() dto: CreateEmoteDto, @Req() req: any) {
    const agent = await this.agentsService.findById(dto.agentId);
    if (agent.ownerId !== req.user.sub && req.user.role !== 'admin') {
      throw new ForbiddenException('Not the owner of this agent');
    }
    return this.emotesService.createEmote(dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteEmote(@Param('id') id: string, @Req() req: any) {
    const emote = await this.emotesService.findById(id);
    if (!emote) throw new NotFoundException('Emote not found');
    const agent = await this.agentsService.findById(emote.agentId);
    if (agent.ownerId !== req.user.sub && req.user.role !== 'admin') {
      throw new ForbiddenException('Not the owner of this agent');
    }
    return this.emotesService.deleteEmote(id);
  }
}
