import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import Redis from 'ioredis';
import { StreamEntity } from '../streams/stream.entity';
import { CryptoDonationEntity } from '../crypto/crypto-donation.entity';
import { AgentEntity } from '../agents/agent.entity';
import { UserEntity } from '../users/user.entity';

export interface PlatformStats {
  liveViewersNow: number;
  liveStreamsNow: number;
  totalWatchMinutes: number;
  totalDonatedUsd: number;
  totalAgents: number;
  totalUsers: number;
  totalStreams: number;
  recentRegistrations: Array<{ username: string; role: string; createdAt: string }>;
}

@Injectable()
export class PlatformService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformService.name);
  private redis: Redis;

  private cachedStats: PlatformStats | null = null;
  private cacheExpiresAt = 0;
  private static readonly CACHE_TTL_MS = 10_000;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    @InjectRepository(CryptoDonationEntity)
    private readonly donationRepo: Repository<CryptoDonationEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    });
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  async getStats(): Promise<PlatformStats> {
    const now = Date.now();
    if (this.cachedStats && now < this.cacheExpiresAt) {
      return this.cachedStats;
    }

    const [liveStreams, totalDonatedUsd, totalAgents, totalWatchMinutes, totalUsers, totalStreams, recentUsers] =
      await Promise.all([
        this.streamRepo.find({ where: { isLive: true }, select: ['id'] }),
        this.getTotalDonatedUsd(),
        this.agentRepo.count(),
        this.getTotalWatchMinutes(),
        this.userRepo.count(),
        this.streamRepo.count(),
        this.userRepo.find({
          order: { createdAt: 'DESC' },
          take: 10,
          select: ['username', 'role', 'createdAt'],
        }),
      ]);

    let liveViewersNow = 0;
    if (liveStreams.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const stream of liveStreams) {
        pipeline.scard(`viewers:${stream.id}`);
      }
      const results = await pipeline.exec();
      if (results) {
        for (const [err, count] of results) {
          if (!err && typeof count === 'number') {
            liveViewersNow += count;
          }
        }
      }
    }

    const stats: PlatformStats = {
      liveViewersNow,
      liveStreamsNow: liveStreams.length,
      totalWatchMinutes: Math.round(totalWatchMinutes),
      totalDonatedUsd,
      totalAgents,
      totalUsers,
      totalStreams,
      recentRegistrations: recentUsers.map((u) => ({
        username: u.username,
        role: u.role,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
      })),
    };

    this.cachedStats = stats;
    this.cacheExpiresAt = now + PlatformService.CACHE_TTL_MS;

    return stats;
  }

  private async getTotalDonatedUsd(): Promise<number> {
    const result = await this.donationRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount_usd), 0)', 'total')
      .where('d.status = :status', { status: 'confirmed' })
      .getRawOne();
    return parseFloat(result?.total) || 0;
  }

  private async getTotalWatchMinutes(): Promise<number> {
    const val = await this.redis.get('platform:watch_minutes');
    return parseFloat(val || '0');
  }

  /** Accumulate watch time every 30 seconds */
  @Interval(30_000)
  async accumulateWatchTime(): Promise<void> {
    try {
      const liveStreams = await this.streamRepo.find({
        where: { isLive: true },
        select: ['id'],
      });

      if (liveStreams.length === 0) return;

      const pipeline = this.redis.pipeline();
      for (const stream of liveStreams) {
        pipeline.scard(`viewers:${stream.id}`);
      }
      const results = await pipeline.exec();
      if (!results) return;

      let totalMinutesIncrement = 0;
      const incrPipeline = this.redis.pipeline();

      for (let i = 0; i < liveStreams.length; i++) {
        const [err, count] = results[i];
        if (err || typeof count !== 'number') continue;

        // 30 seconds of watching = 0.5 viewer-minutes per viewer
        const minutes = count * 0.5;
        if (minutes > 0) {
          totalMinutesIncrement += minutes;
          incrPipeline.incrbyfloat(`watchtime:${liveStreams[i].id}`, minutes);
        }
      }

      if (totalMinutesIncrement > 0) {
        incrPipeline.incrbyfloat('platform:watch_minutes', totalMinutesIncrement);
        await incrPipeline.exec();
      }
    } catch (err) {
      this.logger.error('Failed to accumulate watch time', err);
    }
  }
}
