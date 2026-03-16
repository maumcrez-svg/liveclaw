import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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
  follow(@Body() dto: FollowDto, @Req() req: any) {
    return this.followsService.follow(req.user.sub, dto.agentId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  unfollow(@Body() dto: FollowDto, @Req() req: any) {
    return this.followsService.unfollow(req.user.sub, dto.agentId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  getFollowedAgents(@Param('userId') userId: string, @Req() req: any) {
    if (req.user.sub !== userId && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only view your own follows');
    }
    return this.followsService.getFollowedAgents(userId);
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  async isFollowing(
    @Query('userId') userId: string,
    @Query('agentId') agentId: string,
    @Req() req: any,
  ) {
    if (req.user.sub !== userId && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only check your own follow status');
    }
    const following = await this.followsService.isFollowing(userId, agentId);
    return { following };
  }
}
