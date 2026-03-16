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
  ForbiddenException,
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

  @Delete(':agentId')
  @UseGuards(JwtAuthGuard)
  unsubscribe(
    @Param('agentId') agentId: string,
    @Req() req: any,
  ) {
    return this.subscriptionsService.unsubscribe(req.user.sub, agentId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  getUserSubscriptions(@Param('userId') userId: string, @Req() req: any) {
    if (req.user.sub !== userId && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only view your own subscriptions');
    }
    return this.subscriptionsService.getUserSubscriptions(userId);
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  checkSubscription(
    @Query('userId') userId: string,
    @Query('agentId') agentId: string,
    @Req() req: any,
  ) {
    if (req.user.sub !== userId && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only check your own subscription status');
    }
    return this.subscriptionsService.getActiveSubscription(userId, agentId);
  }

  @Get('agent/:agentId/stats')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  getSubscriptionStats(@Param('agentId') agentId: string) {
    return this.subscriptionsService.getSubscriptionStats(agentId);
  }
}
