import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  HttpCode,
  Logger,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { TransferEntity } from './transfer.entity';
import { DonationsService } from '../donations/donations.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { AgentsService } from '../agents/agents.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly donationsService: DonationsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly agentsService: AgentsService,
    @InjectRepository(TransferEntity)
    private readonly transferRepo: Repository<TransferEntity>,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ) {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!signature || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature or secret' });
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        req.rawBody!,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${err}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        case 'account.updated':
          await this.handleAccountUpdated(
            event.data.object as Stripe.Account,
          );
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error processing webhook ${event.type}: ${err}`);
    }

    return res.json({ received: true });
  }

  @Post('connect/onboard')
  @UseGuards(JwtAuthGuard)
  async onboardConnect(@Req() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      const account = await this.stripeService.createConnectAccount(
        user.username + '@liveclaw.io',
      );
      accountId = account.id;
      user.stripeConnectAccountId = accountId;
      await this.usersService.save(user);
    }

    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const accountLink = await this.stripeService.createAccountLink(
      accountId,
      `${baseUrl}/dashboard`,
      `${baseUrl}/dashboard`,
    );

    return { url: accountLink.url };
  }

  @Get('connect/status')
  @UseGuards(JwtAuthGuard)
  async getConnectStatus(@Req() req: any) {
    const user = await this.usersService.findById(req.user.sub);

    if (!user.stripeConnectAccountId) {
      return {
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const status = await this.stripeService.getAccountStatus(
      user.stripeConnectAccountId,
    );
    return { connected: true, ...status };
  }

  @Post('connect/dashboard-link')
  @UseGuards(JwtAuthGuard)
  async getDashboardLink(@Req() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user.stripeConnectAccountId) {
      throw new BadRequestException('No Stripe Connect account');
    }
    const link = await this.stripeService.createLoginLink(
      user.stripeConnectAccountId,
    );
    return { url: link.url };
  }

  @Get('connect/earnings')
  @UseGuards(JwtAuthGuard)
  async getEarnings(@Req() req: any, @Query('agentId') agentId: string) {
    const userId = req.user.sub;

    const stats = await this.transferRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.gross_amount), 0)', 'totalGross')
      .addSelect('COALESCE(SUM(t.platform_fee), 0)', 'totalFees')
      .addSelect('COALESCE(SUM(t.creator_amount), 0)', 'totalNet')
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.status = 'pending' THEN t.creator_amount ELSE 0 END), 0)",
        'pendingAmount',
      )
      .where('t.user_id = :userId', { userId })
      .andWhere(agentId ? 't.agent_id = :agentId' : '1=1', { agentId })
      .getRawOne();

    const recentTransfers = await this.transferRepo.find({
      where: { userId, ...(agentId ? { agentId } : {}) },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      totalGross: parseFloat(stats.totalGross) || 0,
      totalFees: parseFloat(stats.totalFees) || 0,
      totalNet: parseFloat(stats.totalNet) || 0,
      pendingAmount: parseFloat(stats.pendingAmount) || 0,
      recentTransfers,
    };
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const metadata = session.metadata || {};
    const type = metadata.type;

    if (type === 'donation') {
      const donation = await this.donationsService.completeDonation({
        stripeSessionId: session.id,
        userId: metadata.userId,
        agentId: metadata.agentId,
        streamId: metadata.streamId || null,
        amount: (session.amount_total || 0) / 100,
        message: metadata.message || '',
      });

      if (donation) {
        await this.createTransferForPayment(
          metadata.agentId,
          donation.id,
          'donation',
          (session.amount_total || 0) / 100,
        );
      }
    } else if (type === 'subscription') {
      await this.subscriptionsService.activateSubscription({
        stripeSessionId: session.id,
        stripeCustomerId:
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id || '',
        stripeSubscriptionId:
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as any)?.id || '',
        userId: metadata.userId,
        agentId: metadata.agentId,
        tier: metadata.tier || 'tier_1',
      });
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const sub = subscription as any;
    await this.subscriptionsService.updateBillingStatus(
      subscription.id,
      subscription.status === 'active' ? 'active' : subscription.status,
      sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null,
    );
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    await this.subscriptionsService.deactivateByStripeId(subscription.id);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const inv = invoice as any;
    const subscriptionId =
      typeof inv.subscription === 'string'
        ? inv.subscription
        : inv.subscription?.id;
    if (subscriptionId) {
      await this.subscriptionsService.updateBillingStatus(
        subscriptionId,
        'past_due',
        null,
      );
    }
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const inv = invoice as any;
    const subscriptionId =
      typeof inv.subscription === 'string'
        ? inv.subscription
        : inv.subscription?.id;

    if (!subscriptionId) return;

    // Retrieve subscription to get metadata (agentId, userId)
    const metadata: Record<string, string> = inv.subscription_details?.metadata || {};
    const agentId = metadata.agentId;
    const amountPaid = (invoice.amount_paid || 0) / 100;

    if (agentId && amountPaid > 0) {
      await this.createTransferForPayment(
        agentId,
        subscriptionId,
        'subscription',
        amountPaid,
      );
    }
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    if (!account.charges_enabled) return;

    try {
      const user = await this.usersService.findByStripeConnectAccountId(
        account.id,
      );
      if (!user) return;

      if (!user.stripeConnectOnboardedAt) {
        user.stripeConnectOnboardedAt = new Date();
        await this.usersService.save(user);
        this.logger.log(
          `Stripe Connect onboarding complete for user ${user.id}`,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to handle account.updated: ${err}`);
    }
  }

  private async createTransferForPayment(
    agentId: string,
    sourceId: string,
    sourceType: 'donation' | 'subscription',
    amount: number,
  ): Promise<void> {
    try {
      const agent = await this.agentsService.findById(agentId);
      if (!agent.ownerId) return;

      const owner = await this.usersService.findById(agent.ownerId);
      const feePercent = this.stripeService.getPlatformFeePercent();
      const platformFee = Math.round(amount * feePercent) / 100;
      const creatorAmount = amount - platformFee;

      const transfer = this.transferRepo.create({
        userId: owner.id,
        agentId,
        sourceType,
        sourceId,
        grossAmount: amount,
        platformFee,
        creatorAmount,
      });

      if (owner.stripeConnectAccountId) {
        try {
          const stripeTransfer = await this.stripeService.createTransfer(
            Math.round(creatorAmount * 100),
            owner.stripeConnectAccountId,
          );
          transfer.stripeTransferId = stripeTransfer.id;
          transfer.status = 'completed';
        } catch (err) {
          this.logger.error(`Transfer failed: ${err}`);
          transfer.status = 'failed';
          transfer.errorMessage = String(err);
        }
      } else {
        transfer.status = 'pending';
      }

      await this.transferRepo.save(transfer);
    } catch (err) {
      this.logger.error(`Failed to create transfer: ${err}`);
    }
  }
}
