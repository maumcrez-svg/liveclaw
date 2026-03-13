import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not configured — Stripe payments disabled');
      return;
    }
    this.stripe = new Stripe(secretKey);
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.');
    }
    return this.stripe;
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    return this.ensureStripe().checkout.sessions.create(params);
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.ensureStripe().webhooks.constructEvent(rawBody, signature, secret);
  }

  async cancelSubscription(
    stripeSubscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return this.ensureStripe().subscriptions.cancel(stripeSubscriptionId);
  }

  getPlatformFeePercent(): number {
    return parseFloat(this.configService.get<string>('PLATFORM_FEE_PERCENT', '20'));
  }

  async createConnectAccount(email: string): Promise<Stripe.Account> {
    return this.ensureStripe().accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },
    });
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    return this.ensureStripe().accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  async createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
    return this.ensureStripe().accounts.createLoginLink(accountId);
  }

  async getAccountStatus(
    accountId: string,
  ): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
    const account = await this.ensureStripe().accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }

  async createTransfer(
    amountCents: number,
    destinationAccountId: string,
  ): Promise<Stripe.Transfer> {
    return this.ensureStripe().transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: destinationAccountId,
    });
  }
}
