import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FollowsService } from './follows.service';
import { FollowDto } from './follows.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  follow(@Body() dto: FollowDto) {
    return this.followsService.follow(dto.userId, dto.agentId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  unfollow(@Body() dto: FollowDto) {
    return this.followsService.unfollow(dto.userId, dto.agentId);
  }

  @Get('user/:userId')
  getFollowedAgents(@Param('userId') userId: string) {
    return this.followsService.getFollowedAgents(userId);
  }

  @Get('check')
  async isFollowing(
    @Query('userId') userId: string,
    @Query('agentId') agentId: string,
  ) {
    const following = await this.followsService.isFollowing(userId, agentId);
    return { following };
  }
}
