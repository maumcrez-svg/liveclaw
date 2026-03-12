import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Or, Repository } from 'typeorm';
import { ChatBanEntity } from './chat-ban.entity';
import { ChatService } from '../chat.service';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ChatBanEntity)
    private readonly banRepo: Repository<ChatBanEntity>,
    private readonly chatService: ChatService,
  ) {}

  async banUser(
    agentId: string,
    userId: string,
    moderatorId: string,
    reason?: string,
    durationSeconds?: number,
  ): Promise<ChatBanEntity> {
    // Remove any existing ban record before inserting a fresh one so the
    // unique constraint on (agentId, userId) does not collide.
    await this.banRepo.delete({ agentId, userId });

    const expiresAt =
      durationSeconds != null
        ? new Date(Date.now() + durationSeconds * 1000)
        : null;

    const ban = this.banRepo.create({
      agentId,
      userId,
      moderatorId,
      reason: reason ?? null,
      type: 'ban',
      durationSeconds: durationSeconds ?? null,
      expiresAt,
    });

    return this.banRepo.save(ban);
  }

  async unbanUser(agentId: string, userId: string): Promise<void> {
    await this.banRepo.delete({ agentId, userId });
  }

  async timeoutUser(
    agentId: string,
    userId: string,
    moderatorId: string,
    seconds: number,
    reason?: string,
  ): Promise<ChatBanEntity> {
    await this.banRepo.delete({ agentId, userId });

    const expiresAt = new Date(Date.now() + seconds * 1000);

    const timeout = this.banRepo.create({
      agentId,
      userId,
      moderatorId,
      reason: reason ?? null,
      type: 'timeout',
      durationSeconds: seconds,
      expiresAt,
    });

    return this.banRepo.save(timeout);
  }

  async isUserBanned(agentId: string, userId: string): Promise<boolean> {
    const ban = await this.banRepo.findOne({ where: { agentId, userId } });
    if (!ban) return false;

    // Permanent ban (no expiry)
    if (ban.expiresAt === null) return true;

    // Timed ban / timeout — still active if expiry is in the future
    if (ban.expiresAt > new Date()) return true;

    // Expired — clean up so subsequent lookups are cheaper
    await this.banRepo.delete({ id: ban.id });
    return false;
  }

  async deleteMessage(messageId: string): Promise<void> {
    // Publish a delete event on the generic system channel.  Clients that
    // receive a `delete_message` event should remove the matching message
    // from their local UI.
    await this.chatService.publishMessage('system', {
      type: 'delete_message',
      messageId,
    });
  }

  async setSlowMode(agentId: string, seconds: number): Promise<void> {
    await this.chatService.setRedisKey(`slowmode:${agentId}`, String(seconds));
  }

  async getSlowMode(agentId: string): Promise<number> {
    const value = await this.chatService.getRedisKey(`slowmode:${agentId}`);
    return value !== null ? parseInt(value, 10) : 0;
  }

  async getBans(agentId: string): Promise<ChatBanEntity[]> {
    const now = new Date();
    const bans = await this.banRepo.find({ where: { agentId } });

    // Filter out expired bans and remove them lazily
    const active: ChatBanEntity[] = [];
    const expiredIds: string[] = [];

    for (const ban of bans) {
      if (ban.expiresAt !== null && ban.expiresAt <= now) {
        expiredIds.push(ban.id);
      } else {
        active.push(ban);
      }
    }

    if (expiredIds.length > 0) {
      await this.banRepo.delete(expiredIds);
    }

    return active;
  }
}
