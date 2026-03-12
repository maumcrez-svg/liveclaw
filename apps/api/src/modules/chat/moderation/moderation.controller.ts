import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { OwnerGuard } from '../../../common/owner.guard';

class BanUserDto {
  userId: string;
  reason?: string;
  durationSeconds?: number;
}

class TimeoutUserDto {
  userId: string;
  seconds: number;
  reason?: string;
}

class SlowModeDto {
  seconds: number;
}

@Controller('moderation')
@UseGuards(JwtAuthGuard, OwnerGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post(':agentId/ban')
  @HttpCode(HttpStatus.CREATED)
  async banUser(
    @Param('agentId') agentId: string,
    @Body() dto: BanUserDto,
    @Request() req: { user: { sub: string } },
  ) {
    const ban = await this.moderationService.banUser(
      agentId,
      dto.userId,
      req.user.sub,
      dto.reason,
      dto.durationSeconds,
    );
    return ban;
  }

  @Delete(':agentId/ban/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbanUser(
    @Param('agentId') agentId: string,
    @Param('userId') userId: string,
  ) {
    await this.moderationService.unbanUser(agentId, userId);
  }

  @Post(':agentId/timeout')
  @HttpCode(HttpStatus.CREATED)
  async timeoutUser(
    @Param('agentId') agentId: string,
    @Body() dto: TimeoutUserDto,
    @Request() req: { user: { sub: string } },
  ) {
    const timeout = await this.moderationService.timeoutUser(
      agentId,
      dto.userId,
      req.user.sub,
      dto.seconds,
      dto.reason,
    );
    return timeout;
  }

  @Post(':agentId/slow-mode')
  @HttpCode(HttpStatus.OK)
  async setSlowMode(
    @Param('agentId') agentId: string,
    @Body() dto: SlowModeDto,
  ) {
    await this.moderationService.setSlowMode(agentId, dto.seconds);
    return { agentId, slowModeSeconds: dto.seconds };
  }

  @Get(':agentId/bans')
  async getBans(@Param('agentId') agentId: string) {
    return this.moderationService.getBans(agentId);
  }
}
