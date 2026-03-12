import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from '../stripe/stripe.service';
import { AgentsService } from '../agents/agents.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';
import { JwtPayload } from '../auth/auth.service';

const TIER_PRICE_MAP: Record<string, string> = {
  tier_1: 'STRIPE_PRICE_TIER1',
  tier_2: 'STRIPE_PRICE_TIER2',
  tier_3: 'STRIPE_PRICE_TIER3',
};

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly agentsService: AgentsService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createCheckout(
    @Body() body: { agentId: string; tier?: string },
    @Req() req: Request & { user: JwtPayload },
  ) {
    const { agentId, tier = 'tier_1' } = body;
    if (!agentId) {
      throw new BadRequestException('agentId is required');
    }

    const envVar = TIER_PRICE_MAP[tier];
    if (!envVar) {
      throw new BadRequestException('Invalid tier');
    }

    const stripePriceId = this.configService.get<string>(envVar);
    if (!stripePriceId) {
      throw new BadRequestException(`Stripe price not configured for ${tier}`);
    }

    const agent = await this.agentsService.findById(agentId);
    await this.subscriptionsService.checkNoActiveSubscription(req.user.sub, agentId);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const session = await this.stripeService.createCheckoutSession({
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata: {
        type: 'subscription',
        userId: req.user.sub,
        agentId,
        tier,
      },
      subscription_data: {
        metadata: {
          userId: req.user.sub,
          agentId,
          tier,
        },
      },
      success_url: `${frontendUrl}/${agent.slug}?payment=success&type=subscription`,
      cancel_url: `${frontendUrl}/${agent.slug}?payment=canceled`,
    });

    return { url: session.url };
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
