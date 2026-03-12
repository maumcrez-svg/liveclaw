import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EmotesService } from './emotes.service';
import { CreateEmoteDto } from './emotes.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('emotes')
export class EmotesController {
  constructor(private readonly emotesService: EmotesService) {}

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
  createEmote(@Body() dto: CreateEmoteDto) {
    return this.emotesService.createEmote(dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteEmote(@Param('id') id: string) {
    return this.emotesService.deleteEmote(id);
  }
}
