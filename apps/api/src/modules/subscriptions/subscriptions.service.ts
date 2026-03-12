import { Injectable, NotFoundException, ConflictException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionEntity } from './subscription.entity';
import { AgentsService } from '../agents/agents.service';
import { StripeService } from '../stripe/stripe.service';

export interface ActivateSubscriptionParams {
  stripeSessionId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  userId: string;
  agentId: string;
  tier: string;
}

const TIER_PRICES: Record<string, number> = {
  tier_1: 4.99,
  tier_2: 9.99,
  tier_3: 24.99,
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => StripeService))
    private readonly stripeService: StripeService,
  ) {}

  async checkNoActiveSubscription(userId: string, agentId: string): Promise<void> {
    const existing = await this.subRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.agent_id = :agentId', { agentId })
      .andWhere('s.is_active = true')
      .andWhere('s.stripe_subscription_id IS NOT NULL')
      .getOne();
    if (existing) {
      throw new ConflictException('Active subscription already exists');
    }
  }

  async activateSubscription(params: ActivateSubscriptionParams): Promise<SubscriptionEntity | null> {
    // Idempotency: check if already processed
    const existing = await this.subRepo.findOne({
      where: { stripeSessionId: params.stripeSessionId },
    });
    if (existing) {
      this.logger.log(`Subscription already processed for session ${params.stripeSessionId}`);
      return existing;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const sub = this.subRepo.create({
      userId: params.userId,
      agentId: params.agentId,
      tier: params.tier,
      isActive: true,
      expiresAt,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripePriceId: null,
      stripeSessionId: params.stripeSessionId,
      billingStatus: 'active',
    });

    const saved = await this.subRepo.save(sub);

    // Increment subscriber count
    const agent = await this.agentsService.findById(params.agentId);
    agent.subscriberCount = (agent.subscriberCount || 0) + 1;
    await this.agentsService.update(params.agentId, {
      subscriberCount: agent.subscriberCount,
    } as any);

    return saved;
  }

  async updateBillingStatus(
    stripeSubscriptionId: string,
    billingStatus: string,
    currentPeriodEnd: Date | null,
  ): Promise<void> {
    const sub = await this.subRepo.findOne({
      where: { stripeSubscriptionId },
    });
    if (!sub) {
      this.logger.warn(`Subscription not found for Stripe ID ${stripeSubscriptionId}`);
      return;
    }

    sub.billingStatus = billingStatus;
    if (currentPeriodEnd) {
      sub.currentPeriodEnd = currentPeriodEnd;
    }
    await this.subRepo.save(sub);
  }

  async deactivateByStripeId(stripeSubscriptionId: string): Promise<void> {
    const sub = await this.subRepo.findOne({
      where: { stripeSubscriptionId },
    });
    if (!sub) {
      this.logger.warn(`Subscription not found for Stripe ID ${stripeSubscriptionId}`);
      return;
    }

    const wasActive = sub.isActive;

    sub.isActive = false;
    sub.billingStatus = 'canceled';
    sub.canceledAt = new Date();
    await this.subRepo.save(sub);

    // Only decrement if it was still active (prevents double-decrement)
    if (wasActive) {
      const agent = await this.agentsService.findById(sub.agentId);
      agent.subscriberCount = Math.max((agent.subscriberCount || 0) - 1, 0);
      await this.agentsService.update(sub.agentId, {
        subscriberCount: agent.subscriberCount,
      } as any);
    }
  }

  async unsubscribe(userId: string, agentId: string): Promise<void> {
    const sub = await this.subRepo.findOne({
      where: { userId, agentId, isActive: true },
    });
    if (!sub) throw new NotFoundException('Active subscription not found');

    // Cancel on Stripe if it's a Stripe subscription
    if (sub.stripeSubscriptionId) {
      try {
        await this.stripeService.cancelSubscription(sub.stripeSubscriptionId);
      } catch (err) {
        this.logger.warn(`Failed to cancel Stripe subscription: ${err}`);
      }
    }

    sub.isActive = false;
    sub.canceledAt = new Date();
    sub.billingStatus = 'canceled';
    await this.subRepo.save(sub);

    // Decrement subscriber count
    const agent = await this.agentsService.findById(agentId);
    agent.subscriberCount = Math.max((agent.subscriberCount || 0) - 1, 0);
    await this.agentsService.update(agentId, {
      subscriberCount: agent.subscriberCount,
    } as any);
  }

  async getActiveSubscription(
    userId: string,
    agentId: string,
  ): Promise<SubscriptionEntity | null> {
    return this.subRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.agent_id = :agentId', { agentId })
      .andWhere('s.is_active = true')
      .andWhere('s.stripe_subscription_id IS NOT NULL')
      .getOne();
  }

  async getSubscriberTier(
    userId: string,
    agentId: string,
  ): Promise<string | null> {
    const sub = await this.getActiveSubscription(userId, agentId);
    return sub ? sub.tier : null;
  }

  async getUserSubscriptions(userId: string): Promise<SubscriptionEntity[]> {
    return this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.agent', 'agent')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.is_active = true')
      .andWhere('s.stripe_subscription_id IS NOT NULL')
      .orderBy('s.started_at', 'DESC')
      .getMany();
  }

  async getSubscriptionStats(agentId: string): Promise<{
    activeCount: number;
    mrr: number;
    recent: SubscriptionEntity[];
  }> {
    const activeSubs = await this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .where('s.agent_id = :agentId', { agentId })
      .andWhere('s.is_active = true')
      .andWhere('s.stripe_subscription_id IS NOT NULL')
      .getMany();

    let mrr = 0;
    for (const sub of activeSubs) {
      mrr += TIER_PRICES[sub.tier] || 0;
    }

    const recent = await this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .where('s.agent_id = :agentId', { agentId })
      .andWhere('s.stripe_subscription_id IS NOT NULL')
      .orderBy('s.created_at', 'DESC')
      .take(20)
      .getMany();

    return {
      activeCount: activeSubs.length,
      mrr: Math.round(mrr * 100) / 100,
      recent,
    };
  }
}
