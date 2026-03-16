import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CryptoSubscribeService } from './crypto-subscribe.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly cryptoSubscribeService: CryptoSubscribeService,
  ) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiateSubscription(
    @Body() body: { agentId: string; tier: string },
    @Req() req: any,
  ) {
    return this.cryptoSubscribeService.initiateSubscription(
      req.user.sub,
      body.agentId,
      body.tier,
    );
  }

  @Patch(':paymentId/tx')
  @UseGuards(JwtAuthGuard)
  async submitSubscriptionTx(
    @Param('paymentId') paymentId: string,
    @Body() body: { txHash: string; senderAddress?: string },
    @Req() req: any,
  ) {
    return this.cryptoSubscribeService.submitSubscriptionTx(
      paymentId,
      body.txHash,
      body.senderAddress,
      req.user.sub,
    );
  }

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
