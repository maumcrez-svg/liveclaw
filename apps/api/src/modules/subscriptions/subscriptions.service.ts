import { Injectable, NotFoundException, ConflictException, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { SubscriptionEntity } from './subscription.entity';
import { AgentsService } from '../agents/agents.service';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';
import { StreamEntity } from '../streams/stream.entity';
import { TIER_PRICES_ETH } from '../../common/pricing.constants';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    private readonly agentsService: AgentsService,
    @Optional() @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Optional() @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  async checkNoActiveSubscription(userId: string, agentId: string): Promise<void> {
    const existing = await this.subRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.agent_id = :agentId', { agentId })
      .andWhere('s.is_active = true')
      .getOne();
    if (existing) {
      throw new ConflictException('Active subscription already exists');
    }
  }

  async unsubscribe(userId: string, agentId: string): Promise<void> {
    const sub = await this.subRepo.findOne({
      where: { userId, agentId, isActive: true },
    });
    if (!sub) throw new NotFoundException('Active subscription not found');

    sub.isActive = false;
    sub.canceledAt = new Date();
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
      .getMany();

    let mrr = 0;
    for (const sub of activeSubs) {
      mrr += TIER_PRICES_ETH[sub.tier] || 0;
    }

    const recent = await this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .where('s.agent_id = :agentId', { agentId })
      .orderBy('s.created_at', 'DESC')
      .take(20)
      .getMany();

    return {
      activeCount: activeSubs.length,
      mrr: Math.round(mrr * 100) / 100,
      recent,
    };
  }

  /** Expire subscriptions every 6 hours */
  @Interval(6 * 60 * 60 * 1000)
  async expireSubscriptions(): Promise<void> {
    const result = await this.subRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('is_active = true')
      .andWhere('expires_at < NOW()')
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} subscriptions`);
    }
  }
}
