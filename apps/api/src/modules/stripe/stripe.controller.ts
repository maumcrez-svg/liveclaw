import {
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { DonationsService } from '../donations/donations.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly donationsService: DonationsService,
    private readonly subscriptionsService: SubscriptionsService,
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

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error processing webhook ${event.type}: ${err}`);
    }

    return res.json({ received: true });
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const metadata = session.metadata || {};
    const type = metadata.type;

    if (type === 'donation') {
      await this.donationsService.completeDonation({
        stripeSessionId: session.id,
        userId: metadata.userId,
        agentId: metadata.agentId,
        streamId: metadata.streamId || null,
        amount: (session.amount_total || 0) / 100,
        message: metadata.message || '',
      });
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
}
