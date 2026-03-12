import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DonationsService } from './donations.service';
import { StripeService } from '../stripe/stripe.service';
import { AgentsService } from '../agents/agents.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';
import { JwtPayload } from '../auth/auth.service';

@Controller('donations')
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly agentsService: AgentsService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createCheckout(
    @Body() body: { agentId: string; streamId?: string; amount: number; message?: string },
    @Req() req: Request & { user: JwtPayload },
  ) {
    const { agentId, streamId, amount, message } = body;
    if (!agentId || !amount || amount < 0.01) {
      throw new BadRequestException('Invalid agentId or amount');
    }
    if (amount > 10000) {
      throw new BadRequestException('Maximum donation amount is $10,000');
    }

    const agent = await this.agentsService.findById(agentId);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const session = await this.stripeService.createCheckoutSession({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Donation to ${agent.name}` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'donation',
        userId: req.user.sub,
        agentId,
        streamId: streamId || '',
        message: (message || '').slice(0, 200),
      },
      success_url: `${frontendUrl}/${agent.slug}?payment=success&type=donation`,
      cancel_url: `${frontendUrl}/${agent.slug}?payment=canceled`,
    });

    return { url: session.url };
  }

  @Get('stream/:streamId')
  getStreamDonations(@Param('streamId') streamId: string) {
    return this.donationsService.getStreamDonations(streamId);
  }

  @Get('agent/:agentId/stats')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  getDonationStats(@Param('agentId') agentId: string) {
    return this.donationsService.getDonationStats(agentId);
  }
}
