import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { StreamEntity } from '../streams/stream.entity';

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private pub: Redis;
  private sub: Redis;
  private messageHandlers: Map<string, (message: string) => void> = new Map();
  private syncInterval: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  onModuleInit() {
    const redisConfig = {
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    };
    this.pub = new Redis(redisConfig);
    this.sub = new Redis(redisConfig);

    this.sub.on('message', (channel, message) => {
      const handler = this.messageHandlers.get(channel);
      if (handler) handler(message);
    });

    // Sync viewer counts to DB every 30s
    this.syncInterval = setInterval(() => this.syncViewerCounts(), 30000);
  }

  onModuleDestroy() {
    clearInterval(this.syncInterval);
    this.pub?.disconnect();
    this.sub?.disconnect();
  }

  private async syncViewerCounts(): Promise<void> {
    try {
      const liveStreams = await this.streamRepo.find({
        where: { isLive: true },
        select: ['id', 'peakViewers'],
      });
      if (liveStreams.length === 0) return;

      // Redis pipeline: all SCARDs in a single round-trip
      const pipeline = this.pub.pipeline();
      for (const s of liveStreams) pipeline.scard(`viewers:${s.id}`);
      const results = await pipeline.exec();

      const updates: Array<{ id: string; count: number; peak: number }> = [];
      for (let i = 0; i < liveStreams.length; i++) {
        const count = (results?.[i]?.[1] as number) ?? 0;
        const peak = Math.max(count, liveStreams[i].peakViewers);
        updates.push({ id: liveStreams[i].id, count, peak });
      }

      // Single batch UPDATE instead of N individual saves
      // FIX Bug #6: use parameterized queries to prevent SQL injection
      if (updates.length > 0) {
        const params: any[] = [];
        const viewerCases = updates.map((u, i) => {
          params.push(u.id, u.count);
          return `WHEN id = $${i * 2 + 1} THEN $${i * 2 + 2}`;
        }).join(' ');
        const offset = params.length;
        const peakCases = updates.map((u, i) => {
          params.push(u.id, u.peak);
          return `WHEN id = $${offset + i * 2 + 1} THEN $${offset + i * 2 + 2}`;
        }).join(' ');
        const idsOffset = params.length;
        const idPlaceholders = updates.map((u, i) => {
          params.push(u.id);
          return `$${idsOffset + i + 1}`;
        }).join(',');
        await this.streamRepo.query(
          `UPDATE streams SET
            current_viewers = CASE ${viewerCases} ELSE current_viewers END,
            peak_viewers = CASE ${peakCases} ELSE peak_viewers END
          WHERE id IN (${idPlaceholders})`,
          params,
        );
      }
    } catch (err) {
      console.error('Failed to sync viewer counts:', err);
    }
  }

  async publishMessage(streamId: string, message: object): Promise<void> {
    const json = JSON.stringify(message);
    await this.pub.publish(`chat:${streamId}`, json);
    await this.pub.lpush(`chat_history:${streamId}`, json);
    await this.pub.ltrim(`chat_history:${streamId}`, 0, 199);
  }

  async getRecentMessages(streamId: string, limit: number = 50): Promise<object[]> {
    const raw = await this.pub.lrange(`chat_history:${streamId}`, 0, limit - 1);
    return raw.map((m) => JSON.parse(m));
  }

  async subscribe(streamId: string, handler: (message: string) => void): Promise<void> {
    const channel = `chat:${streamId}`;
    this.messageHandlers.set(channel, handler);
    await this.sub.subscribe(channel);
  }

  async unsubscribe(streamId: string): Promise<void> {
    const channel = `chat:${streamId}`;
    this.messageHandlers.delete(channel);
    await this.sub.unsubscribe(channel);
  }

  async publishAlert(streamId: string, alert: object): Promise<void> {
    const json = JSON.stringify(alert);
    await this.pub.publish(`alerts:${streamId}`, json);
  }

  async subscribeAlerts(streamId: string, handler: (message: string) => void): Promise<void> {
    const channel = `alerts:${streamId}`;
    this.messageHandlers.set(channel, handler);
    await this.sub.subscribe(channel);
  }

  // Viewer count via Redis
  async addViewer(streamId: string, clientId: string): Promise<number> {
    await this.pub.sadd(`viewers:${streamId}`, clientId);
    return this.pub.scard(`viewers:${streamId}`);
  }

  async removeViewer(streamId: string, clientId: string): Promise<number> {
    await this.pub.srem(`viewers:${streamId}`, clientId);
    return this.pub.scard(`viewers:${streamId}`);
  }

  async getViewerCount(streamId: string): Promise<number> {
    return this.pub.scard(`viewers:${streamId}`);
  }

  async getViewerCountsBatch(streamIds: string[]): Promise<Map<string, number>> {
    if (streamIds.length === 0) return new Map();
    const pipeline = this.pub.pipeline();
    for (const id of streamIds) pipeline.scard(`viewers:${id}`);
    const results = await pipeline.exec();
    const map = new Map<string, number>();
    if (results) {
      for (let i = 0; i < streamIds.length; i++) {
        const count = results[i]?.[1] as number;
        if (count > 0) map.set(streamIds[i], count);
      }
    }
    return map;
  }

  async clearViewers(streamId: string): Promise<void> {
    await this.pub.del(`viewers:${streamId}`);
  }

  /** Clear ALL viewer sets — used on server restart to prevent ghost viewers from previous deploy */
  async clearAllViewers(): Promise<void> {
    const keys = await this.pub.keys('viewers:*');
    if (keys.length > 0) {
      await this.pub.del(...keys);
      console.log(`[ChatService] Cleared ${keys.length} stale viewer sets on startup`);
    }
  }

  async setRedisKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.pub.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.pub.set(key, value);
    }
  }

  async getRedisKey(key: string): Promise<string | null> {
    return this.pub.get(key);
  }

  async deleteRedisKey(key: string): Promise<void> {
    await this.pub.del(key);
  }
}
