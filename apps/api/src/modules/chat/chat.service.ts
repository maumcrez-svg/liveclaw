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
      const liveStreams = await this.streamRepo.find({ where: { isLive: true } });
      for (const stream of liveStreams) {
        const count = await this.pub.scard(`viewers:${stream.id}`);
        stream.currentViewers = count;
        if (count > stream.peakViewers) {
          stream.peakViewers = count;
        }
        await this.streamRepo.save(stream);
      }
    } catch (err) {
      console.error('Failed to sync viewer counts:', err);
    }
  }

  async publishMessage(streamId: string, message: object): Promise<void> {
    await this.pub.publish(`chat:${streamId}`, JSON.stringify(message));
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
