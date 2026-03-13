import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { AgentEntity } from '../agents/agent.entity';
import { StreamEntity } from '../streams/stream.entity';
import { DonationEntity } from '../donations/donation.entity';
import { SubscriptionEntity } from '../subscriptions/subscription.entity';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const TIER_PRICES: Record<string, number> = {
  tier_1: 4.99,
  tier_2: 9.99,
  tier_3: 24.99,
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    @InjectRepository(DonationEntity)
    private readonly donationRepo: Repository<DonationEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
  ) {}

  // ── Users ──

  async getUsers(opts: {
    page: number;
    limit: number;
    role?: string;
    banned?: boolean;
    sort?: string;
  }): Promise<PaginatedResult<UserEntity>> {
    const qb = this.userRepo.createQueryBuilder('u');

    if (opts.role) {
      qb.andWhere('u.role = :role', { role: opts.role });
    }
    if (opts.banned !== undefined) {
      qb.andWhere('u.is_banned = :banned', { banned: opts.banned });
    }

    if (opts.sort === 'oldest') {
      qb.orderBy('u.created_at', 'ASC');
    } else {
      qb.orderBy('u.created_at', 'DESC');
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit)
      .getMany();

    // Strip password hashes
    data.forEach((u) => { u.passwordHash = null as any; });

    return {
      data,
      meta: {
        total,
        page: opts.page,
        limit: opts.limit,
        totalPages: Math.ceil(total / opts.limit),
      },
    };
  }

  async searchUsers(
    query: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<UserEntity>> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.username ILIKE :q', { q: `%${query}%` })
      .orderBy('u.created_at', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    data.forEach((u) => { u.passwordHash = null as any; });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async banUser(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (user.role === 'admin') {
      throw new BadRequestException('Cannot ban an admin user');
    }
    user.isBanned = true;
    user.bannedAt = new Date();
    const saved = await this.userRepo.save(user);
    saved.passwordHash = null as any;
    return saved;
  }

  async unbanUser(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    user.isBanned = false;
    user.bannedAt = null;
    const saved = await this.userRepo.save(user);
    saved.passwordHash = null as any;
    return saved;
  }

  async changeUserRole(id: string, role: string): Promise<UserEntity> {
    const validRoles = ['viewer', 'creator', 'admin'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (user.role === 'admin' && role !== 'admin') {
      throw new BadRequestException('Cannot demote an admin user. Remove admin role manually.');
    }
    user.role = role;
    const saved = await this.userRepo.save(user);
    saved.passwordHash = null as any;
    return saved;
  }

  // ── Global Stats ──

  async getGlobalStats(): Promise<{
    users: { total: number; viewers: number; creators: number; admins: number; banned: number };
    agents: { total: number; live: number; offline: number };
    streams: { totalHistoric: number; currentlyLive: number };
    revenue: { totalDonations: number; donationCount: number; totalMrr: number; activeSubscriptions: number };
  }> {
    // Users
    const userStats = await this.userRepo
      .createQueryBuilder('u')
      .select('COUNT(*)::int', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE u.role = 'viewer')::int`, 'viewers')
      .addSelect(`COUNT(*) FILTER (WHERE u.role = 'creator')::int`, 'creators')
      .addSelect(`COUNT(*) FILTER (WHERE u.role = 'admin')::int`, 'admins')
      .addSelect(`COUNT(*) FILTER (WHERE u.is_banned = true)::int`, 'banned')
      .getRawOne();

    // Agents
    const agentStats = await this.agentRepo
      .createQueryBuilder('a')
      .select('COUNT(*)::int', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE a.status = 'live')::int`, 'live')
      .addSelect(`COUNT(*) FILTER (WHERE a.status != 'live')::int`, 'offline')
      .getRawOne();

    // Streams
    const streamStats = await this.streamRepo
      .createQueryBuilder('s')
      .select('COUNT(*)::int', 'totalHistoric')
      .addSelect(`COUNT(*) FILTER (WHERE s.is_live = true)::int`, 'currentlyLive')
      .getRawOne();

    // Revenue
    const donationStats = await this.donationRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount), 0)', 'totalDonations')
      .addSelect('COUNT(*)::int', 'donationCount')
      .where('d.payment_status = :status', { status: 'completed' })
      .andWhere('d.stripe_session_id IS NOT NULL')
      .getRawOne();

    const activeSubs = await this.subRepo
      .createQueryBuilder('s')
      .where('s.is_active = true')
      .andWhere('s.stripe_subscription_id IS NOT NULL')
      .getMany();

    let totalMrr = 0;
    for (const sub of activeSubs) {
      totalMrr += TIER_PRICES[sub.tier] || 0;
    }

    return {
      users: {
        total: userStats.total,
        viewers: userStats.viewers,
        creators: userStats.creators,
        admins: userStats.admins,
        banned: userStats.banned,
      },
      agents: {
        total: agentStats.total,
        live: agentStats.live,
        offline: agentStats.offline,
      },
      streams: {
        totalHistoric: streamStats.totalHistoric,
        currentlyLive: streamStats.currentlyLive,
      },
      revenue: {
        totalDonations: parseFloat(donationStats.totalDonations) || 0,
        donationCount: donationStats.donationCount,
        totalMrr: Math.round(totalMrr * 100) / 100,
        activeSubscriptions: activeSubs.length,
      },
    };
  }

  // ── Donations ──

  async getDonations(opts: {
    page: number;
    limit: number;
    agentId?: string;
    userId?: string;
    sort?: string;
  }): Promise<PaginatedResult<DonationEntity>> {
    const qb = this.donationRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.user', 'user')
      .leftJoinAndSelect('d.agent', 'agent')
      .where('d.payment_status = :status', { status: 'completed' })
      .andWhere('d.stripe_session_id IS NOT NULL');

    if (opts.agentId) {
      qb.andWhere('d.agent_id = :agentId', { agentId: opts.agentId });
    }
    if (opts.userId) {
      qb.andWhere('d.user_id = :userId', { userId: opts.userId });
    }

    if (opts.sort === 'amount') {
      qb.orderBy('d.amount', 'DESC');
    } else {
      qb.orderBy('d.created_at', 'DESC');
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit)
      .getMany();

    return {
      data,
      meta: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) },
    };
  }

  // ── Subscriptions ──

  async getSubscriptions(opts: {
    page: number;
    limit: number;
    agentId?: string;
    userId?: string;
    active?: boolean;
    tier?: string;
    sort?: string;
  }): Promise<PaginatedResult<SubscriptionEntity>> {
    const qb = this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.agent', 'agent')
      .where('s.stripe_subscription_id IS NOT NULL');

    if (opts.agentId) {
      qb.andWhere('s.agent_id = :agentId', { agentId: opts.agentId });
    }
    if (opts.userId) {
      qb.andWhere('s.user_id = :userId', { userId: opts.userId });
    }
    if (opts.active !== undefined) {
      qb.andWhere('s.is_active = :active', { active: opts.active });
    }
    if (opts.tier) {
      qb.andWhere('s.tier = :tier', { tier: opts.tier });
    }

    if (opts.sort === 'oldest') {
      qb.orderBy('s.created_at', 'ASC');
    } else {
      qb.orderBy('s.created_at', 'DESC');
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit)
      .getMany();

    return {
      data,
      meta: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) },
    };
  }

  // ── Streams ──

  async getStreams(opts: {
    page: number;
    limit: number;
    live?: boolean;
    agentId?: string;
    sort?: string;
  }): Promise<PaginatedResult<StreamEntity>> {
    const qb = this.streamRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.agent', 'agent')
      .leftJoinAndSelect('s.category', 'category');

    if (opts.live !== undefined) {
      qb.andWhere('s.is_live = :live', { live: opts.live });
    }
    if (opts.agentId) {
      qb.andWhere('s.agent_id = :agentId', { agentId: opts.agentId });
    }

    if (opts.sort === 'viewers') {
      qb.orderBy('s.current_viewers', 'DESC');
    } else if (opts.sort === 'oldest') {
      qb.orderBy('s.started_at', 'ASC');
    } else {
      qb.orderBy('s.started_at', 'DESC');
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit)
      .getMany();

    return {
      data,
      meta: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) },
    };
  }
}
