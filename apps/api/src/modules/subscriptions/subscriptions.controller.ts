import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Delete(':userId/:agentId')
  @UseGuards(JwtAuthGuard)
  unsubscribe(
    @Param('userId') userId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.subscriptionsService.unsubscribe(userId, agentId);
  }

  @Get('user/:userId')
  getUserSubscriptions(@Param('userId') userId: string) {
    return this.subscriptionsService.getUserSubscriptions(userId);
  }

  @Get('check')
  checkSubscription(
    @Query('userId') userId: string,
    @Query('agentId') agentId: string,
  ) {
    return this.subscriptionsService.getActiveSubscription(userId, agentId);
  }

  @Get('agent/:agentId/stats')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  getSubscriptionStats(@Param('agentId') agentId: string) {
    return this.subscriptionsService.getSubscriptionStats(agentId);
  }
}
