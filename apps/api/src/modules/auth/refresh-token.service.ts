import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis.provider';

@Injectable()
export class RefreshTokenService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async generateRefreshToken(userId: string): Promise<string> {
    const token = randomUUID();
    await this.redis.set(`refresh:${token}`, userId, 'EX', 604800); // 7 days
    await this.redis.sadd(`user_tokens:${userId}`, token);
    await this.redis.expire(`user_tokens:${userId}`, 604800);
    return token;
  }

  async consumeRefreshToken(token: string): Promise<string | null> {
    const userId = await this.redis.getdel(`refresh:${token}`);
    if (userId) {
      await this.redis.srem(`user_tokens:${userId}`, token);
    }
    return userId;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const tokens = await this.redis.smembers(`user_tokens:${userId}`);
    if (tokens.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const token of tokens) {
        pipeline.del(`refresh:${token}`);
      }
      pipeline.del(`user_tokens:${userId}`);
      await pipeline.exec();
    }
  }
}
